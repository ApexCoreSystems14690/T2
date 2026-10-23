// [23/10] LOJA DE ROYALTIES — o núcleo (banco + regras). Rotas em routes/royalties.js.
//
// Royalties são pontos que a STAFF credita (Diretor Geral+), sempre com motivo da lista e
// comprovação. O jogador troca por prêmio no site; o prêmio chega no jogo pelo MESMO
// caminho do benefício de booster (src/entrega.js): quando ele estiver online, o heartbeat
// manda dinheiro/carro/item pro servidor dele e confere a entrega.
//
// Regras (plano do Julio, 23/10 — não mudar sem ele):
//   - extrato imutável: royalties_lancamentos não aceita UPDATE nem DELETE (trigger).
//     Corrigir = estorno, que é uma linha nova.
//   - até 3 trocas por semana (seg 00:00 a dom 23:59, Brasília), no máximo 1 pacote de dinheiro;
//   - item com limite 'temporada' (cupom, Carro da Temporada): 1 por temporada, e conta nas 3;
//   - saldo NÃO zera no wipe (é da pessoa); os limites "por temporada" seguem game_config.temporada;
//   - tudo por cidade (cidade_id em toda tabela).
//
// Concorrência: toda troca/crédito/estorno trava a linha do saldo (SELECT ... FOR UPDATE)
// numa transação, igual ao caixa das corps. Saldo tem CHECK >= 0 no banco.

const ENTREGA = require('./entrega');

const MAX_SEMANA = 3;
const MAX_DINHEIRO_SEMANA = 1;
const SANTA_FE = 1;
const TIPOS = ['dinheiro', 'item', 'carro', 'garagem', 'cupom'];

// ------------------------------------------------------------ padrão (semente do Santa Fé)
const MOTIVOS_PADRAO = [
  { chave: 'amigo',      nome: 'Amigo convidado que verificou o Roblox e jogou 3 SSUs', valor: 100, ordem: 10 },
  { chave: 'sugestao',   nome: 'Sugestão que entrou no jogo',                           valor: 100, ordem: 20 },
  { chave: 'bug_p1',     nome: 'Bug aceito P1',                                         valor: 80,  ordem: 30 },
  { chave: 'bug_p2',     nome: 'Bug aceito P2',                                         valor: 40,  ordem: 40 },
  { chave: 'bug_p3',     nome: 'Bug aceito P3',                                         valor: 15,  ordem: 50 },
  { chave: 'cronica',    nome: 'Clip escolhido para a crônica da cidade',               valor: 50,  ordem: 60 },
  { chave: 'evento',     nome: 'Participação em evento in-game',                        valor: 30,  ordem: 70 },
  { chave: 'voto',       nome: 'Voto na eleição',                                       valor: 20,  ordem: 80 },
  { chave: 'ajuste',     nome: 'Ajuste manual',                                         valor: 0,   ordem: 90, so_dono: true, livre: true },
];

// Os prêmios que dependem de mudança no jogo nascem DESLIGADOS: o jogo hoje não tem
// "item preso à conta", vaga extra de garagem nem cupom. O Dono liga quando o jogo estiver pronto.
const PRESO = 'O jogo ainda não marca item ou carro como preso à conta: sem isso o prêmio poderia ser vendido na OLX.';
const CATALOGO_PADRAO = [
  { chave: 'dinheiro_5k',  nome: 'R$ 5.000',  custo: 50,  tipo: 'dinheiro', conteudo: { dinheiro: 5000 },  icone: 'dinheiro', ordem: 10, ativo: true },
  { chave: 'dinheiro_15k', nome: 'R$ 15.000', custo: 140, tipo: 'dinheiro', conteudo: { dinheiro: 15000 }, icone: 'dinheiro', ordem: 20, ativo: true },
  { chave: 'dinheiro_40k', nome: 'R$ 40.000', custo: 350, tipo: 'dinheiro', conteudo: { dinheiro: 40000 }, icone: 'dinheiro', ordem: 30, ativo: true },
  { chave: 'galao',   nome: '1 galão de gasolina', custo: 10, tipo: 'item', conteudo: { itens: [{ item: 'Galao de gasolina', qtd: 1, preso: true }] }, icone: 'mochila', ordem: 40, ativo: false, depende_jogo: PRESO },
  { chave: 'kit_reparo', nome: '1 kit de reparo',  custo: 15, tipo: 'item', conteudo: { itens: [{ item: 'Kit de reparo', qtd: 1, preso: true }] }, icone: 'ajustes', ordem: 50, ativo: false, depende_jogo: PRESO },
  { chave: 'mochila', nome: '1 mochila',           custo: 40, tipo: 'item', conteudo: { itens: [{ item: 'Mochila', qtd: 1, preso: true }] }, icone: 'mochila', ordem: 60, ativo: false, depende_jogo: PRESO },
  { chave: 'vaga_garagem', nome: '+1 vaga na garagem', custo: 120, tipo: 'garagem', conteudo: { vagas: 1 }, icone: 'carro', ordem: 70, ativo: false,
    depende_jogo: 'O jogo não tem limite de vagas por jogador pra aumentar (a garagem de casa é física). Precisa definir o que a vaga faz.' },
  { chave: 'cupom_15', nome: 'Cupom de 15% num carro ou casa (uso único)', custo: 200, tipo: 'cupom', conteudo: { cupom_pct: 15 }, limite: 'temporada', icone: 'loja', ordem: 80, ativo: false,
    depende_jogo: 'O jogo ainda não lê cupom na compra (RemotesHandler ComprarCarro e ImoveisService:comprar).' },
  { chave: 'gol', nome: '1 Gol', custo: 300, tipo: 'carro', conteudo: { carro: 'Gol' }, icone: 'carro', ordem: 90, ativo: false, depende_jogo: PRESO },
  { chave: 'carro_temporada', nome: 'Carro da Temporada', custo: 800, tipo: 'carro', conteudo: { carro: null }, limite: 'temporada', icone: 'carro', ordem: 100, ativo: false,
    depende_jogo: 'O Julio ainda vai escolher o modelo (um carro da frota que não é vendido na concessionária).' },
];

// ------------------------------------------------------------ banco
async function garantir(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS royalties_motivos (
      cidade_id INTEGER NOT NULL REFERENCES cidades(id),
      chave VARCHAR(32) NOT NULL,
      nome VARCHAR(120) NOT NULL,
      valor INTEGER NOT NULL DEFAULT 0 CHECK (valor >= 0),
      so_dono BOOLEAN NOT NULL DEFAULT false,
      livre BOOLEAN NOT NULL DEFAULT false,
      ativo BOOLEAN NOT NULL DEFAULT true,
      ordem INTEGER NOT NULL DEFAULT 100,
      PRIMARY KEY (cidade_id, chave)
    );
    CREATE TABLE IF NOT EXISTS royalties_catalogo (
      cidade_id INTEGER NOT NULL REFERENCES cidades(id),
      chave VARCHAR(32) NOT NULL,
      nome VARCHAR(120) NOT NULL,
      custo INTEGER NOT NULL CHECK (custo > 0),
      tipo VARCHAR(16) NOT NULL,
      conteudo JSONB NOT NULL DEFAULT '{}'::jsonb,
      limite VARCHAR(16) NOT NULL DEFAULT 'nenhum',     -- nenhum | temporada
      ativo BOOLEAN NOT NULL DEFAULT false,
      depende_jogo TEXT,                                -- por que ainda está desligado
      icone VARCHAR(24) NOT NULL DEFAULT 'loja',
      ordem INTEGER NOT NULL DEFAULT 100,
      PRIMARY KEY (cidade_id, chave)
    );
    CREATE TABLE IF NOT EXISTS royalties_saldo (
      cidade_id INTEGER NOT NULL REFERENCES cidades(id),
      roblox_id BIGINT NOT NULL,
      saldo INTEGER NOT NULL DEFAULT 0 CHECK (saldo >= 0),
      atualizado_em TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (cidade_id, roblox_id)
    );
    CREATE TABLE IF NOT EXISTS royalties_trocas (
      id SERIAL PRIMARY KEY,
      cidade_id INTEGER NOT NULL REFERENCES cidades(id),
      roblox_id BIGINT NOT NULL,
      user_id INTEGER,
      nome VARCHAR(64),
      item VARCHAR(32) NOT NULL,
      item_nome VARCHAR(120) NOT NULL,
      tipo VARCHAR(16) NOT NULL,
      custo INTEGER NOT NULL,
      conteudo JSONB NOT NULL DEFAULT '{}'::jsonb,
      semana VARCHAR(10) NOT NULL,
      temporada INTEGER NOT NULL,
      -- pendente (esperando ele entrar) -> enviando -> entregue | revisar | cancelada
      status VARCHAR(16) NOT NULL DEFAULT 'pendente',
      cmd_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      fila_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      tentativas INTEGER NOT NULL DEFAULT 0,
      nota TEXT,
      criado_em TIMESTAMP DEFAULT NOW(),
      entregue_em TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_roy_trocas_quem ON royalties_trocas(cidade_id, roblox_id, semana);
    CREATE INDEX IF NOT EXISTS idx_roy_trocas_status ON royalties_trocas(status);
    CREATE TABLE IF NOT EXISTS royalties_lancamentos (
      id SERIAL PRIMARY KEY,
      cidade_id INTEGER NOT NULL REFERENCES cidades(id),
      roblox_id BIGINT NOT NULL,
      tipo VARCHAR(12) NOT NULL,                 -- credito | estorno | troca
      valor INTEGER NOT NULL,                    -- com sinal
      saldo_depois INTEGER NOT NULL,
      motivo VARCHAR(200) NOT NULL,
      motivo_chave VARCHAR(32),
      comprovacao TEXT,
      por INTEGER,                               -- users.id de quem lançou (NULL = o próprio jogador, na troca)
      por_nome VARCHAR(128),
      troca_id INTEGER REFERENCES royalties_trocas(id),
      estorno_de INTEGER UNIQUE REFERENCES royalties_lancamentos(id),
      criado_em TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_roy_lanc_quem ON royalties_lancamentos(cidade_id, roblox_id, id DESC);
    -- o item da fila pode ir marcado como PRESO À CONTA (o jogo precisa ler; ver o fim do arquivo)
    ALTER TABLE game_item_fila ADD COLUMN IF NOT EXISTS preso BOOLEAN NOT NULL DEFAULT false;
  `);
  // extrato imutável: nem UPDATE nem DELETE. Só a limpeza de teste passa (configuração de sessão).
  await pool.query(`
    CREATE OR REPLACE FUNCTION royalties_extrato_imutavel() RETURNS trigger AS $$
    BEGIN
      IF current_setting('royalties.limpeza_de_teste', true) = 'sim' THEN RETURN OLD; END IF;
      RAISE EXCEPTION 'royalties_lancamentos não aceita %: corrija com estorno', TG_OP;
    END $$ LANGUAGE plpgsql;
  `);
  await pool.query(`DROP TRIGGER IF EXISTS trg_royalties_imutavel ON royalties_lancamentos`);
  await pool.query(`CREATE TRIGGER trg_royalties_imutavel BEFORE UPDATE OR DELETE ON royalties_lancamentos
                    FOR EACH ROW EXECUTE FUNCTION royalties_extrato_imutavel()`);

  // semente do Santa Fé Oficial (só o que ainda não existe; depois quem manda é o Dono)
  const tem = await pool.query('SELECT 1 FROM cidades WHERE id = $1', [SANTA_FE]);
  if (!tem.rows[0]) return;
  for (const m of MOTIVOS_PADRAO) {
    await pool.query(
      `INSERT INTO royalties_motivos (cidade_id, chave, nome, valor, so_dono, livre, ordem) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (cidade_id, chave) DO NOTHING`,
      [SANTA_FE, m.chave, m.nome, m.valor, !!m.so_dono, !!m.livre, m.ordem]);
  }
  for (const c of CATALOGO_PADRAO) {
    await pool.query(
      `INSERT INTO royalties_catalogo (cidade_id, chave, nome, custo, tipo, conteudo, limite, ativo, depende_jogo, icone, ordem)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (cidade_id, chave) DO NOTHING`,
      [SANTA_FE, c.chave, c.nome, c.custo, c.tipo, JSON.stringify(c.conteudo), c.limite || 'nenhum', !!c.ativo, c.depende_jogo || null, c.icone, c.ordem]);
  }
}

async function temporadaAtual(db) {
  try {
    const r = await db.query(`SELECT value FROM game_config WHERE key = 'temporada'`);
    return Math.max(1, parseInt(r.rows[0] && r.rows[0].value && r.rows[0].value.n) || 1);
  } catch (e) { return 1; }
}
// semana ISO no horário de Brasília (segunda 00:00 a domingo 23:59)
async function semanaAtual(db) {
  const r = await db.query(`SELECT to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'IYYY-"W"IW') AS s`);
  return r.rows[0].s;
}

// ------------------------------------------------------------ regras puras
// Estado de um item do catálogo pra uma pessoa. Devolve { pode, motivo }.
function estadoItem(item, ctx) {
  if (!item.ativo) return { pode: false, motivo: 'Indisponível no momento' };
  if (item.tipo === 'carro' && !(item.conteudo && item.conteudo.carro)) return { pode: false, motivo: 'Em breve' };
  if (ctx.semana.usadas >= MAX_SEMANA) return { pode: false, motivo: `Você já fez ${MAX_SEMANA} trocas nesta semana` };
  if (item.tipo === 'dinheiro' && ctx.semana.dinheiro >= MAX_DINHEIRO_SEMANA) return { pode: false, motivo: 'O pacote de dinheiro desta semana já foi usado' };
  if (item.limite === 'temporada' && ctx.temporadaItens.has(item.chave)) return { pode: false, motivo: 'Já trocado nesta temporada' };
  if (item.tipo === 'carro' && ctx.carros && ctx.carros.has(item.conteudo.carro)) return { pode: false, motivo: 'Você já tem esse carro' };
  if (ctx.saldo < item.custo) return { pode: false, motivo: `Faltam ${item.custo - ctx.saldo} Royalties` };
  return { pode: true, motivo: null };
}

// ------------------------------------------------------------ leitura
async function catalogo(db, cidadeId, todos) {
  const r = await db.query(`SELECT * FROM royalties_catalogo WHERE cidade_id = $1 ${todos ? '' : 'AND ativo = true'} ORDER BY ordem, chave`, [cidadeId]);
  return r.rows;
}
async function motivos(db, cidadeId, todos) {
  const r = await db.query(`SELECT * FROM royalties_motivos WHERE cidade_id = $1 ${todos ? '' : 'AND ativo = true'} ORDER BY ordem, chave`, [cidadeId]);
  return r.rows;
}
async function saldoDe(db, cidadeId, rid, travar) {
  const r = await db.query(`SELECT saldo FROM royalties_saldo WHERE cidade_id = $1 AND roblox_id = $2 ${travar ? 'FOR UPDATE' : ''}`, [cidadeId, rid]);
  return r.rows[0] ? Number(r.rows[0].saldo) : 0;
}
// Contexto de limites (usado na tela e, de novo e com trava, na hora da troca)
async function contexto(db, cidadeId, rid) {
  const [semana, temporada] = [await semanaAtual(db), await temporadaAtual(db)];
  const t = await db.query(
    `SELECT item, tipo, semana, temporada FROM royalties_trocas
      WHERE cidade_id = $1 AND roblox_id = $2 AND status <> 'cancelada' AND (semana = $3 OR temporada = $4)`,
    [cidadeId, rid, semana, temporada]);
  const daSemana = t.rows.filter(x => x.semana === semana);
  let carros = new Set();
  try {
    const p = await db.query(`SELECT carros FROM game_patrimonio WHERE roblox_id = $1 AND cidade_id = $2`, [rid, cidadeId]);
    const c = p.rows[0] && p.rows[0].carros;
    if (Array.isArray(c)) carros = new Set(c.map(x => String(typeof x === 'string' ? x : (x && (x.nome || x.carro || x.modelo)) || '')));
    else if (c && typeof c === 'object') carros = new Set(Object.keys(c));
  } catch (e) { /* sem foto do patrimônio: não bloqueia */ }
  return {
    semanaId: semana, temporada,
    semana: { usadas: daSemana.length, max: MAX_SEMANA, dinheiro: daSemana.filter(x => x.tipo === 'dinheiro').length, max_dinheiro: MAX_DINHEIRO_SEMANA },
    temporadaItens: new Set(t.rows.filter(x => x.temporada === temporada).map(x => x.item)),
    carros,
  };
}

// Tudo que a tela do jogador precisa. NÃO devolve quem lançou nem a comprovação.
async function painelDoJogador(db, cidadeId, rid) {
  const saldo = await saldoDe(db, cidadeId, rid);
  const ctx = await contexto(db, cidadeId, rid);
  ctx.saldo = saldo;
  const cat = (await catalogo(db, cidadeId, false)).map(i => ({
    chave: i.chave, nome: i.nome, custo: i.custo, tipo: i.tipo, limite: i.limite, icone: i.icone, ...estadoItem(i, ctx),
  }));
  const ext = await db.query(
    `SELECT l.id, l.tipo, l.valor, l.saldo_depois, l.motivo, l.criado_em, t.status AS troca_status, t.item_nome
       FROM royalties_lancamentos l LEFT JOIN royalties_trocas t ON t.id = l.troca_id
      WHERE l.cidade_id = $1 AND l.roblox_id = $2 ORDER BY l.id DESC LIMIT 100`, [cidadeId, rid]);
  const mot = (await motivos(db, cidadeId, false)).filter(m => !m.so_dono).map(m => ({ nome: m.nome, valor: m.valor }));
  return {
    saldo,
    semana: ctx.semana, temporada: ctx.temporada,
    catalogo: cat,
    extrato: ext.rows.map(x => ({
      id: x.id, tipo: x.tipo, valor: x.valor, saldo_depois: x.saldo_depois, motivo: x.motivo, em: x.criado_em,
      status: x.troca_status ? (x.troca_status === 'entregue' ? 'entregue' : x.troca_status === 'cancelada' ? 'cancelada' : 'pendente') : null,
    })),
    motivos: mot,
  };
}

// ------------------------------------------------------------ escrita
async function _lancar(cli, { cidadeId, rid, tipo, valor, motivo, motivoChave, comprovacao, por, porNome, trocaId, estornoDe }) {
  const atual = await saldoDe(cli, cidadeId, rid, true);
  const novo = atual + valor;
  if (novo < 0) { const e = new Error(`Saldo insuficiente: tem ${atual} Royalties`); e.status = 400; throw e; }
  await cli.query(
    `INSERT INTO royalties_saldo (cidade_id, roblox_id, saldo, atualizado_em) VALUES ($1,$2,$3,NOW())
     ON CONFLICT (cidade_id, roblox_id) DO UPDATE SET saldo = EXCLUDED.saldo, atualizado_em = NOW()`, [cidadeId, rid, novo]);
  const r = await cli.query(
    `INSERT INTO royalties_lancamentos (cidade_id, roblox_id, tipo, valor, saldo_depois, motivo, motivo_chave, comprovacao, por, por_nome, troca_id, estorno_de)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [cidadeId, rid, tipo, valor, novo, motivo, motivoChave || null, comprovacao || null, por || null, porNome || null, trocaId || null, estornoDe || null]);
  return { id: r.rows[0].id, saldo: novo };
}

// trava a linha do saldo ANTES de qualquer conta: duas operações da mesma pessoa viram fila
async function _travar(cli, cidadeId, rid) {
  await cli.query(`INSERT INTO royalties_saldo (cidade_id, roblox_id, saldo) VALUES ($1,$2,0) ON CONFLICT DO NOTHING`, [cidadeId, rid]);
  await cli.query(`SELECT saldo FROM royalties_saldo WHERE cidade_id = $1 AND roblox_id = $2 FOR UPDATE`, [cidadeId, rid]);
}

function erro(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

async function _transacao(pool, fn) {
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const r = await fn(cli);
    await cli.query('COMMIT');
    return r;
  } catch (e) {
    try { await cli.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally { cli.release(); }
}

// CREDITAR (staff). `staff` = req.user; `ehDono` decide o ajuste manual.
async function creditar(pool, cidadeId, { roblox_id, motivo, comprovacao, valor }, staff, ehDono) {
  const rid = Number(roblox_id);
  if (!Number.isFinite(rid) || rid <= 0) throw erro('Roblox ID inválido');
  const prova = typeof comprovacao === 'string' ? comprovacao.trim() : '';
  if (prova.length < 4) throw erro('A comprovação é obrigatória: link do print, do clip ou do post, ou o número do ticket');
  if (prova.length > 500) throw erro('Comprovação longa demais (máx. 500 caracteres)');
  const m = (await pool.query(`SELECT * FROM royalties_motivos WHERE cidade_id = $1 AND chave = $2 AND ativo = true`, [cidadeId, String(motivo || '')])).rows[0];
  if (!m) throw erro('Escolha um motivo da lista');
  if (m.so_dono && !ehDono) throw erro('Só o Dono faz ajuste manual', 403);
  let v = m.valor;
  if (m.livre) {
    v = Math.trunc(Number(valor));
    if (!Number.isFinite(v) || v === 0 || Math.abs(v) > 100000) throw erro('Quantidade inválida no ajuste manual');
  }
  if (!(v > 0) && !m.livre) throw erro('Esse motivo está sem valor configurado');
  const porNome = staff.discord_username || staff.roblox_username || ('user#' + staff.id);
  return _transacao(pool, async (cli) => {
    await _travar(cli, cidadeId, rid);
    return _lancar(cli, { cidadeId, rid, tipo: 'credito', valor: v, motivo: m.nome, motivoChave: m.chave, comprovacao: prova, por: staff.id, porNome });
  });
}

// ESTORNAR (staff): linha nova com o valor ao contrário. Troca pendente: cancela a entrega e devolve.
async function estornar(pool, cidadeId, { lancamento_id, motivo }, staff) {
  const id = parseInt(lancamento_id);
  const mot = typeof motivo === 'string' ? motivo.trim() : '';
  if (!id) throw erro('Lançamento inválido');
  if (mot.length < 4) throw erro('Escreva o motivo do estorno');
  const porNome = staff.discord_username || staff.roblox_username || ('user#' + staff.id);
  return _transacao(pool, async (cli) => {
    const l = (await cli.query(`SELECT * FROM royalties_lancamentos WHERE id = $1 AND cidade_id = $2`, [id, cidadeId])).rows[0];
    if (!l) throw erro('Lançamento não existe nesta cidade', 404);
    if (l.tipo === 'estorno') throw erro('Não dá pra estornar um estorno');
    await _travar(cli, cidadeId, Number(l.roblox_id));
    const ja = await cli.query(`SELECT id FROM royalties_lancamentos WHERE estorno_de = $1`, [id]);
    if (ja.rows[0]) throw erro('Esse lançamento já foi estornado (#' + ja.rows[0].id + ')');
    if (l.tipo === 'troca') {
      const t = (await cli.query(`SELECT * FROM royalties_trocas WHERE id = $1 FOR UPDATE`, [l.troca_id])).rows[0];
      if (!t || t.status !== 'pendente') throw erro('Só dá pra estornar troca que ainda não foi enviada pro jogo (esta está ' + (t ? t.status : '?') + ')');
      await cli.query(`UPDATE royalties_trocas SET status = 'cancelada', nota = $2 WHERE id = $1`, [t.id, 'estornada: ' + mot]);
    }
    return _lancar(cli, { cidadeId, rid: Number(l.roblox_id), tipo: 'estorno', valor: -l.valor, motivo: 'Estorno: ' + mot,
      comprovacao: null, por: staff.id, porNome, trocaId: l.troca_id, estornoDe: id });
  });
}

// TROCAR (jogador). Valida tudo de novo NO BACK, com a linha do saldo travada.
async function trocar(pool, cidadeId, { rid, userId, nome }, chave) {
  const out = await _transacao(pool, async (cli) => {
    await _travar(cli, cidadeId, rid);
    const item = (await cli.query(`SELECT * FROM royalties_catalogo WHERE cidade_id = $1 AND chave = $2`, [cidadeId, String(chave || '')])).rows[0];
    if (!item) throw erro('Esse prêmio não existe', 404);
    const ctx = await contexto(cli, cidadeId, rid);
    ctx.saldo = await saldoDe(cli, cidadeId, rid, true);
    const est = estadoItem(item, ctx);
    if (!est.pode) throw erro(est.motivo);
    const t = (await cli.query(
      `INSERT INTO royalties_trocas (cidade_id, roblox_id, user_id, nome, item, item_nome, tipo, custo, conteudo, semana, temporada)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [cidadeId, rid, userId || null, nome || null, item.chave, item.nome, item.tipo, item.custo, JSON.stringify(item.conteudo || {}), ctx.semanaId, ctx.temporada])).rows[0];
    const l = await _lancar(cli, { cidadeId, rid, tipo: 'troca', valor: -item.custo, motivo: 'Troca: ' + item.nome, trocaId: t.id });
    return { troca_id: t.id, saldo: l.saldo, item: item.nome };
  });
  // se ele está online agora, já manda (sem esperar o próximo heartbeat)
  try { await entregarPendentes(pool, cidadeId, await ENTREGA.onlineDaCidade(pool, cidadeId), rid); }
  catch (e) { console.error('[royalties] entrega na hora:', e.message); }
  return out;
}

// ------------------------------------------------------------ entrega no jogo (caminho do booster)
function conteudoDoJogo(t) {
  const c = t.conteudo || {};
  if (t.tipo === 'dinheiro') return { dinheiro: Number(c.dinheiro) || 0 };
  if (t.tipo === 'item') return { itens: (c.itens || []).map(i => ({ item: i.item, qtd: i.qtd || 1, preso: !!i.preso })) };
  if (t.tipo === 'carro') return { carro: c.carro };
  return {};
}

// Manda as trocas 'pendente' de quem está online. `soRid` limita a uma pessoa.
async function entregarPendentes(pool, cidadeId, online, soRid) {
  if (!online || !online.size) return 0;
  const rids = soRid ? [soRid].filter(r => online.has(Number(r))) : [...online.keys()];
  if (!rids.length) return 0;
  const pend = await pool.query(
    `SELECT id FROM royalties_trocas WHERE cidade_id = $1 AND status = 'pendente' AND roblox_id = ANY($2::bigint[]) ORDER BY id`, [cidadeId, rids]);
  let n = 0;
  for (const p of pend.rows) {
    await _transacao(pool, async (cli) => {
      const t = (await cli.query(`SELECT * FROM royalties_trocas WHERE id = $1 AND status = 'pendente' FOR UPDATE SKIP LOCKED`, [p.id])).rows[0];
      if (!t) return;
      const on = online.get(Number(t.roblox_id));
      const conteudo = conteudoDoJogo(t);
      const { cmds, fila } = await ENTREGA.enviar(cli, {
        rid: Number(t.roblox_id), nome: on.name || t.nome, job: on.job_id, conteudo, motivo: 'royalties',
        texto: `Loja de Royalties: ${t.item_nome} chegou.`,
      });
      // tipos que o jogo ainda não conhece (garagem, cupom): comando próprio, fica em revisar se falhar
      if (t.tipo === 'garagem') cmds.push(await ENTREGA.comando(cli, 'garagem_vaga_add', Number(t.roblox_id), on.name, on.job_id, { vagas: Number((t.conteudo || {}).vagas) || 1, preso: true }));
      if (t.tipo === 'cupom') cmds.push(await ENTREGA.comando(cli, 'cupom_add', Number(t.roblox_id), on.name, on.job_id, { pct: Number((t.conteudo || {}).cupom_pct) || 15, uso_unico: true }));
      if (conteudo.carro) {
        // carro vai marcado como preso (o jogo precisa ler `preso` no carro_add)
        await cli.query(`UPDATE game_commands SET payload = payload || '{"preso": true}'::jsonb WHERE id = ANY($1) AND tipo = 'carro_add'`, [cmds]);
      }
      if (fila.length) await cli.query(`UPDATE game_item_fila SET preso = true WHERE id = ANY($1)`, [fila.filter((_, i) => (conteudo.itens || [])[i] && conteudo.itens[i].preso)]);
      await cli.query(`UPDATE royalties_trocas SET status = 'enviando', cmd_ids = $2, fila_ids = $3, nome = COALESCE($4, nome) WHERE id = $1`,
        [t.id, JSON.stringify(cmds), JSON.stringify(fila), on.name || null]);
      n++;
    });
  }
  return n;
}

let _rodando = false;
// Chamado pelo heartbeat do jogo (sem esperar): manda o que está pendente e confere o enviado.
async function aoBatimento(pool, { cidadeId, players, jobId }) {
  if (_rodando) return { pulou: true };
  _rodando = true;
  try {
    const cid = cidadeId || SANTA_FE;
    const online = new Map();
    for (const p of (players || [])) { const n = Number(p && p.userId); if (n) online.set(n, { job_id: jobId, name: p.name || null }); }
    const enviadas = online.size ? await entregarPendentes(pool, cid, online) : 0;
    await ENTREGA.conferir(pool, { tabela: 'royalties_trocas', aberto: 'enviando' }, online);
    return { enviadas };
  } catch (e) {
    console.error('[royalties]', e.message);
    return { erro: e.message };
  } finally { _rodando = false; }
}

// ------------------------------------------------------------ staff: leitura
async function extratoStaff(db, cidadeId, rid) {
  const saldo = await saldoDe(db, cidadeId, rid);
  const l = await db.query(
    `SELECT l.*, t.status AS troca_status, t.item_nome, e.id AS estornado_por
       FROM royalties_lancamentos l
       LEFT JOIN royalties_trocas t ON t.id = l.troca_id
       LEFT JOIN royalties_lancamentos e ON e.estorno_de = l.id
      WHERE l.cidade_id = $1 AND l.roblox_id = $2 ORDER BY l.id DESC LIMIT 300`, [cidadeId, rid]);
  const t = await db.query(`SELECT id, item_nome, custo, status, semana, temporada, nota, criado_em, entregue_em FROM royalties_trocas
                             WHERE cidade_id = $1 AND roblox_id = $2 ORDER BY id DESC LIMIT 100`, [cidadeId, rid]);
  const ctx = await contexto(db, cidadeId, rid);
  return { roblox_id: rid, saldo, semana: ctx.semana, lancamentos: l.rows, trocas: t.rows };
}

async function trocasRecentes(db, cidadeId, status) {
  const r = await db.query(
    `SELECT id, roblox_id, nome, item_nome, custo, status, nota, criado_em, entregue_em FROM royalties_trocas
      WHERE cidade_id = $1 ${status ? 'AND status = ANY($2::text[])' : ''} ORDER BY id DESC LIMIT 100`,
    status ? [cidadeId, status] : [cidadeId]);
  return r.rows;
}

// pra aba Economia: créditos/estornos da staff (quem, quanto, pra quem)
async function lancamentosStaff(db, cidadeId, desde) {
  const r = await db.query(
    `SELECT l.id, l.criado_em, l.tipo, l.valor, l.motivo, l.comprovacao, l.por, l.por_nome, l.roblox_id,
            COALESCE(gp.nome, u.roblox_username, l.roblox_id::text) AS alvo
       FROM royalties_lancamentos l
       LEFT JOIN game_patrimonio gp ON gp.roblox_id = l.roblox_id
       LEFT JOIN users u ON u.roblox_id = l.roblox_id AND u.roblox_verificado = true
      WHERE l.cidade_id = $1 AND l.tipo IN ('credito','estorno') AND ($2::timestamptz IS NULL OR l.criado_em > $2::timestamptz)
      ORDER BY l.id DESC LIMIT 500`, [cidadeId, desde || null]);
  return r.rows;
}

// ------------------------------------------------------------ Dono: configuração
async function salvarMotivo(pool, cidadeId, chave, b) {
  const sets = [], vals = [cidadeId, chave];
  if (b.nome !== undefined) { const n = String(b.nome || '').trim(); if (!n || n.length > 120) throw erro('Nome inválido'); vals.push(n); sets.push(`nome = $${vals.length}`); }
  if (b.valor !== undefined) { const v = parseInt(b.valor); if (!(v >= 0 && v <= 100000)) throw erro('Valor inválido'); vals.push(v); sets.push(`valor = $${vals.length}`); }
  if (b.ativo !== undefined) { vals.push(!!b.ativo); sets.push(`ativo = $${vals.length}`); }
  if (!sets.length) throw erro('Nada pra mudar');
  const r = await pool.query(`UPDATE royalties_motivos SET ${sets.join(', ')} WHERE cidade_id = $1 AND chave = $2`, vals);
  if (!r.rowCount) throw erro('Motivo não existe', 404);
}
async function salvarItem(pool, cidadeId, chave, b) {
  const sets = [], vals = [cidadeId, chave];
  if (b.nome !== undefined) { const n = String(b.nome || '').trim(); if (!n || n.length > 120) throw erro('Nome inválido'); vals.push(n); sets.push(`nome = $${vals.length}`); }
  if (b.custo !== undefined) { const v = parseInt(b.custo); if (!(v > 0 && v <= 100000)) throw erro('Custo inválido'); vals.push(v); sets.push(`custo = $${vals.length}`); }
  if (b.ativo !== undefined) { vals.push(!!b.ativo); sets.push(`ativo = $${vals.length}`); }
  if (b.carro !== undefined) {   // o Carro da Temporada: o modelo que o Julio escolher
    const c = String(b.carro || '').trim();
    if (c.length > 64) throw erro('Nome do carro longo demais');
    vals.push(JSON.stringify({ carro: c || null })); sets.push(`conteudo = conteudo || $${vals.length}::jsonb`);
  }
  if (!sets.length) throw erro('Nada pra mudar');
  const r = await pool.query(`UPDATE royalties_catalogo SET ${sets.join(', ')} WHERE cidade_id = $1 AND chave = $2`, vals);
  if (!r.rowCount) throw erro('Prêmio não existe', 404);
}

module.exports = {
  MAX_SEMANA, MAX_DINHEIRO_SEMANA, TIPOS, MOTIVOS_PADRAO, CATALOGO_PADRAO,
  garantir, estadoItem, catalogo, motivos, saldoDe, contexto, painelDoJogador,
  creditar, estornar, trocar, entregarPendentes, aoBatimento,
  extratoStaff, trocasRecentes, lancamentosStaff, salvarMotivo, salvarItem, semanaAtual, temporadaAtual,
};

/* ---------------------------------------------------------------------------------------
   O QUE PRECISA MUDAR NO JOGO (listado; NÃO aplicado sem o Julio):

   1. ITEM PRESO À CONTA. O jogo não tem marca genérica: o único item que não sai da conta
      é o RG, checado pelo NOME em cada lugar. Pra usar a mesma marca:
        - novo módulo ReplicatedStorage.Shared.ItensPresos (lista de nomes + "é preso?");
        - os mesmos pontos que já recusam o RG passam a perguntar ItensPresos:
          DataHandler (RemoveInventario/drop), RemotesHandler ~5817/5846, PortaMalasService:739,
          CelularService:354 (OLX), Patrimonio:198 e :271, ArmarioService:29 (NAO_GUARDA),
          [Armas] PerdaNaMorte:18/:41 e SaqueService:185; ToolData com Dropavel=false;
        - AdminBridge.Heartbeat (~linha 222): a entrega da fila lê `it.preso` (o site já manda
          a coluna game_item_fila.preso) e dá o item na versão presa. Hoje um nome de item que o
          jogo não conhece é marcado como entregue e SOME -- por isso não dá pra inventar nome.
        - carro_add com `preso: true` (o site já manda no payload): o carro fica fora da OLX e
          do Pátio/Patrimonio de venda.
   2. CUPOM: comando novo `cupom_add {pct, uso_unico}` grava data.Cupom = {pct=15}. Aplicar e
      queimar em RemotesHandler ordem "ComprarCarro" (~6160, antes do UnincrementDinheiro) e
      "ComprarCarroFinanciado" (~6183), e em ImoveisService:comprar (~203, antes do
      CobrarCarteiraBanco) e :comprarFinanciado (~244).
   3. VAGA DE GARAGEM: o jogo não tem limite de carros por jogador pra aumentar. Precisa o
      Julio dizer o que a vaga faz antes de existir o comando `garagem_vaga_add`.
   4. Dinheiro já funciona hoje (dinheiro_add com motivo 'royalties').
   --------------------------------------------------------------------------------------- */
