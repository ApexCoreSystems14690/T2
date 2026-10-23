// ============================================================================
// [23/10] CÂMARA DO GOVERNO — propostas votadas pelo Parlamento (pedido do Julio).
//
// Segue o Regulamento Oficial (Cap. 10), que o Julio mandou seguir onde o pedido conflitava:
//   · Art. 10.11 — qualquer Parlamentar (ou o Presidente da Câmara) abre projeto: mudar o
//     salário de um cargo do Governo, ou aprovar uma obra do tesouro.
//   · Art. 10.2  — 48 h de DEBATE e depois a votação. A votação fica aberta 24 h.
//   · Art. 10.14 — aprova com maioria simples dos SIM contra NÃO de quem votou (sem quórum).
//     Empate: o Presidente da Câmara desempata. Ninguém votou / empate sem desempate = recusada.
//     Votam os Parlamentares (1 voto por pessoa, público, com nome).
//   · Sanção: aprovada, vai pro Presidente da República, que tem 24 h pra SANCIONAR ou VETAR.
//     Sem resposta em 24 h, é sancionada sozinha. Veto volta pra Câmara (24 h) e só cai com
//     2/3 dos votos SIM de quem votou.
//   · Sancionada, aplica sozinha: salário muda o ranks.salary; obra debita o tesouro e entra
//     no extrato com o número da proposta.
//   · Art. 10.12A — AUMENTO do salário de Parlamentar só vale no mandato seguinte (depois do
//     próximo wipe = próxima temporada). Redução vale na hora.
//   · Teto: nenhum salário passa de 2x o valor padrão do cargo, nem fica abaixo de 0.
//   · O Dono continua mudando salário e retirando obra direto, como staff.
// ============================================================================
const pool = require('./db/pool');
const GOV = require('./governo');

const H = 3600 * 1000;
const DEBATE_H = 48, VOTACAO_H = 24, SANCAO_H = 24, DERRUBADA_H = 24;
const CARGO_PARLAMENTAR = 'Parlamentar';
const CARGO_PRES_CAMARA = 'Presidente da Câmara';
const CARGO_PRESIDENTE = 'Presidente da República';

const STATUS = {
  debate: 'Em debate', votacao: 'Em votação', aguardando_sancao: 'Aguardando sanção',
  sancionada: 'Sancionada', aguarda_mandato: 'Sancionada, vale no próximo mandato',
  vetada: 'Vetada (Câmara pode derrubar)', veto_mantido: 'Vetada', recusada: 'Recusada',
  sem_saldo: 'Sancionada, esperando saldo no tesouro',
};

function erro(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

async function garantir(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS governo_propostas (
      id SERIAL PRIMARY KEY,
      cidade_id INTEGER NOT NULL REFERENCES cidades(id),
      tipo VARCHAR(12) NOT NULL CHECK (tipo IN ('salario','obra')),
      rank_id INTEGER,
      cargo VARCHAR(128),
      obra_chave VARCHAR(32),
      valor_atual BIGINT,
      valor BIGINT NOT NULL CHECK (valor >= 0),
      descricao VARCHAR(500) NOT NULL,
      autor_user_id INTEGER NOT NULL,
      autor_nome VARCHAR(128),
      status VARCHAR(20) NOT NULL DEFAULT 'debate',
      criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      votacao_em TIMESTAMPTZ NOT NULL,
      fecha_em TIMESTAMPTZ NOT NULL,
      decidida_em TIMESTAMPTZ,
      sancao_ate TIMESTAMPTZ,
      sancao VARCHAR(16),             -- sancionou | vetou | automatica | derrubada
      sancao_por VARCHAR(128),
      derrubada_ate TIMESTAMPTZ,
      temporada_sancao INTEGER,
      aplicada_em TIMESTAMPTZ,
      lancamento_id INTEGER,
      nota VARCHAR(300)
    );
    CREATE INDEX IF NOT EXISTS ix_gov_propostas_cidade ON governo_propostas(cidade_id, id DESC);
    CREATE TABLE IF NOT EXISTS governo_votos (
      proposta_id INTEGER NOT NULL REFERENCES governo_propostas(id) ON DELETE CASCADE,
      fase VARCHAR(12) NOT NULL CHECK (fase IN ('votacao','desempate','derrubada')),
      user_id INTEGER NOT NULL,
      nome VARCHAR(128),
      voto BOOLEAN NOT NULL,
      em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (proposta_id, fase, user_id)
    );
  `);
}

// ---------------------------------------------------------------- quem é quem
async function cargoNoGoverno(db, cidadeId, userId) {
  const cfg = await GOV.config(db, cidadeId);
  if (!cfg || !cfg.corporation_id) return null;
  const r = await db.query(
    `SELECT r.name AS cargo, COALESCE(u.roblox_username, u.discord_username) AS nome
       FROM members m JOIN users u ON u.id = m.user_id LEFT JOIN ranks r ON r.id = m.rank_id
      WHERE m.corporation_id = $1 AND m.user_id = $2`, [cfg.corporation_id, userId]);
  return r.rows[0] || null;
}
async function contarParlamentares(db, cidadeId) {
  const cfg = await GOV.config(db, cidadeId);
  return (await db.query(
    `SELECT COUNT(*)::int n FROM members m JOIN ranks r ON r.id = m.rank_id
      WHERE m.corporation_id = $1 AND r.name = $2`, [cfg.corporation_id, CARGO_PARLAMENTAR])).rows[0].n;
}
async function temporadaAtual(db) {
  try {
    const r = await db.query(`SELECT value FROM game_config WHERE key = 'temporada'`);
    return Math.max(1, parseInt(r.rows[0] && r.rows[0].value && r.rows[0].value.n) || 1);
  } catch (e) { return 1; }
}
function tetoDoCargo(nome, atual) {
  const p = (GOV.CARGOS_PADRAO || []).find(c => c[0].toLowerCase() === String(nome || '').toLowerCase());
  if (p) return p[2] * 2;
  return null;   // cargo sem valor padrão: não dá pra propor por votação (o Dono muda direto)
}

// ---------------------------------------------------------------- abrir
async function abrir(db, cidadeId, user, b) {
  const eu = await cargoNoGoverno(db, cidadeId, user.id);
  if (!eu || ![CARGO_PARLAMENTAR, CARGO_PRES_CAMARA].includes(eu.cargo)) throw erro('Só Parlamentar ou o Presidente da Câmara abre proposta', 403);
  const desc = String(b.descricao || '').trim();
  if (desc.length < 8) throw erro('Explique a proposta (pelo menos 8 letras)');
  if (desc.length > 500) throw erro('Descrição longa demais (máx. 500)');
  const cfg = await GOV.config(db, cidadeId);
  const agora = Date.now();
  const votacao = new Date(agora + DEBATE_H * H), fecha = new Date(agora + (DEBATE_H + VOTACAO_H) * H);
  let campos;
  if (b.tipo === 'salario') {
    const rk = (await db.query(`SELECT id, name, COALESCE(salary,0)::bigint AS salary FROM ranks WHERE id = $1 AND corporation_id = $2`,
      [parseInt(b.rank_id) || 0, cfg.corporation_id])).rows[0];
    if (!rk) throw erro('Escolha um cargo do Governo');
    const v = Math.floor(Number(b.valor));
    if (!(v >= 0)) throw erro('Salário inválido (não pode ser negativo)');
    const teto = tetoDoCargo(rk.name);
    if (teto === null) throw erro('Esse cargo não tem valor padrão: só o Dono muda');
    if (v > teto) throw erro(`Acima do teto: no máximo R$ ${teto.toLocaleString('pt-BR')} (2x o padrão do cargo)`);
    if (v === Number(rk.salary)) throw erro('O cargo já ganha esse valor');
    campos = { tipo: 'salario', rank_id: rk.id, cargo: rk.name, obra_chave: null, valor_atual: Number(rk.salary), valor: v };
  } else if (b.tipo === 'obra') {
    const o = (await db.query(`SELECT chave, nome, valor FROM governo_obras WHERE cidade_id = $1 AND chave = $2`, [cidadeId, String(b.obra || '')])).rows[0];
    if (!o) throw erro('Escolha uma das obras da lista');
    campos = { tipo: 'obra', rank_id: null, cargo: o.nome, obra_chave: o.chave, valor_atual: null, valor: Number(o.valor) };
  } else throw erro('Tipo de proposta inválido');
  const r = await db.query(
    `INSERT INTO governo_propostas (cidade_id, tipo, rank_id, cargo, obra_chave, valor_atual, valor, descricao, autor_user_id, autor_nome, votacao_em, fecha_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [cidadeId, campos.tipo, campos.rank_id, campos.cargo, campos.obra_chave, campos.valor_atual, campos.valor, desc,
     user.id, eu.nome || user.discord_username, votacao, fecha]);
  return { id: r.rows[0].id };
}

// ---------------------------------------------------------------- votar
async function votar(db, cidadeId, user, id, b) {
  await processar(db, cidadeId);
  const p = (await db.query(`SELECT * FROM governo_propostas WHERE id = $1 AND cidade_id = $2`, [parseInt(id) || 0, cidadeId])).rows[0];
  if (!p) throw erro('Proposta não existe', 404);
  const eu = await cargoNoGoverno(db, cidadeId, user.id);
  const voto = b.voto === 'sim' ? true : b.voto === 'nao' ? false : null;
  if (voto === null) throw erro('Voto é sim ou nao');
  let fase;
  if (b.desempate) {
    if (!eu || eu.cargo !== CARGO_PRES_CAMARA) throw erro('Só o Presidente da Câmara desempata', 403);
    if (p.status !== 'votacao') throw erro('A votação dessa proposta não está aberta');
    fase = 'desempate';
  } else {
    if (!eu || eu.cargo !== CARGO_PARLAMENTAR) throw erro('Só Parlamentar vota', 403);
    if (p.status === 'votacao') fase = 'votacao';
    else if (p.status === 'vetada') fase = 'derrubada';
    else if (p.status === 'debate') throw erro('Ainda em debate: a votação abre ' + new Date(p.votacao_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    else throw erro('Essa proposta não está em votação');
  }
  try {
    await db.query(`INSERT INTO governo_votos (proposta_id, fase, user_id, nome, voto) VALUES ($1,$2,$3,$4,$5)`,
      [p.id, fase, user.id, eu.nome || user.discord_username, voto]);
  } catch (e) {
    if (e.code === '23505') throw erro('Você já votou nessa proposta', 409);
    throw e;
  }
  return { ok: true, fase };
}

// ---------------------------------------------------------------- sanção
async function sancionar(db, cidadeId, user, id, b) {
  await processar(db, cidadeId);
  const eu = await cargoNoGoverno(db, cidadeId, user.id);
  if (!eu || eu.cargo !== CARGO_PRESIDENTE) throw erro('Só o Presidente da República sanciona ou veta', 403);
  const p = (await db.query(`SELECT * FROM governo_propostas WHERE id = $1 AND cidade_id = $2`, [parseInt(id) || 0, cidadeId])).rows[0];
  if (!p) throw erro('Proposta não existe', 404);
  if (p.status !== 'aguardando_sancao') throw erro('Essa proposta não está esperando sanção');
  if (b.acao === 'vetar') {
    await db.query(`UPDATE governo_propostas SET status = 'vetada', sancao = 'vetou', sancao_por = $2, derrubada_ate = NOW() + INTERVAL '${DERRUBADA_H} hours'
                     WHERE id = $1 AND status = 'aguardando_sancao'`, [p.id, eu.nome || user.discord_username]);
    return { ok: true, status: 'vetada' };
  }
  if (b.acao !== 'sancionar') throw erro('Ação é sancionar ou vetar');
  await db.query(`UPDATE governo_propostas SET sancao = 'sancionou', sancao_por = $2 WHERE id = $1`, [p.id, eu.nome || user.discord_username]);
  await aplicar(db, cidadeId, p.id);
  return { ok: true, status: (await db.query(`SELECT status FROM governo_propostas WHERE id = $1`, [p.id])).rows[0].status };
}

// ---------------------------------------------------------------- aplicar
async function aplicar(db, cidadeId, id) {
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const p = (await cli.query(`SELECT * FROM governo_propostas WHERE id = $1 FOR UPDATE`, [id])).rows[0];
    if (!p || p.aplicada_em || !['aguardando_sancao', 'vetada', 'sem_saldo', 'aguarda_mandato'].includes(p.status)) { await cli.query('ROLLBACK'); return; }
    const temporada = await temporadaAtual(cli);
    if (p.tipo === 'salario') {
      const subindoParlamentar = p.cargo === CARGO_PARLAMENTAR && Number(p.valor) > Number(p.valor_atual || 0);
      if (subindoParlamentar && (p.status !== 'aguarda_mandato' || Number(p.temporada_sancao) >= temporada)) {
        // Art. 10.12A: aumento do próprio Parlamento só no mandato seguinte
        await cli.query(`UPDATE governo_propostas SET status = 'aguarda_mandato', temporada_sancao = COALESCE(temporada_sancao, $2), decidida_em = COALESCE(decidida_em, NOW())
                          WHERE id = $1`, [p.id, temporada]);
        await cli.query('COMMIT'); return;
      }
      await cli.query(`UPDATE ranks SET salary = $2 WHERE id = $1`, [p.rank_id, p.valor]);
      await cli.query(`UPDATE governo_propostas SET status = 'sancionada', aplicada_em = NOW(), decidida_em = COALESCE(decidida_em, NOW()), temporada_sancao = COALESCE(temporada_sancao, $2) WHERE id = $1`, [p.id, temporada]);
    } else {
      const cfg = await GOV.config(cli, cidadeId);
      await cli.query(`INSERT INTO corp_caixa (corporation_id, saldo) VALUES ($1, 0) ON CONFLICT DO NOTHING`, [cfg.corporation_id]);
      const saldo = Number((await cli.query(`SELECT saldo FROM corp_caixa WHERE corporation_id = $1 FOR UPDATE`, [cfg.corporation_id])).rows[0].saldo);
      const valor = Number(p.valor);
      if (saldo < valor) {
        await cli.query(`UPDATE governo_propostas SET status = 'sem_saldo', decidida_em = COALESCE(decidida_em, NOW()), nota = $2 WHERE id = $1`,
          [p.id, 'Faltam R$ ' + (valor - saldo).toLocaleString('pt-BR') + ' no tesouro; sai sozinha quando tiver']);
        await cli.query('COMMIT'); return;
      }
      const novo = saldo - valor;
      await cli.query(`UPDATE corp_caixa SET saldo = $2, atualizado_em = NOW() WHERE corporation_id = $1`, [cfg.corporation_id, novo]);
      const l = await cli.query(
        `INSERT INTO corp_lancamentos (corporation_id, tipo, motivo, valor, saldo_depois, quem, por, detalhe)
         VALUES ($1,'obra',$2,$3,$4,$5,$6,$7) RETURNING id`,
        [cfg.corporation_id, String(p.obra_chave).slice(0, 24), -valor, novo, String(p.cargo || '').slice(0, 64), ('Proposta nº ' + p.id).slice(0, 64),
         JSON.stringify({ obra: p.cargo, descricao: 'Proposta nº ' + p.id + ': ' + p.descricao, proposta_id: p.id })]);
      await cli.query(`UPDATE governo_propostas SET status = 'sancionada', aplicada_em = NOW(), decidida_em = COALESCE(decidida_em, NOW()), lancamento_id = $2, nota = NULL WHERE id = $1`, [p.id, l.rows[0].id]);
    }
    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { cli.release(); }
}

// ---------------------------------------------------------------- relógio
// Avança as propostas pelo tempo. Idempotente: roda no intervalo e em toda leitura.
function contar(votos, fase) {
  const v = votos.filter(x => x.fase === fase);
  return { sim: v.filter(x => x.voto).length, nao: v.filter(x => !x.voto).length };
}
// núcleo puro do resultado da votação (Art. 10.14)
function resultado(sim, nao, desempate) {
  if (sim + nao === 0) return 'recusada';
  if (sim > nao) return 'aprovada';
  if (nao > sim) return 'recusada';
  if (desempate === true) return 'aprovada';
  return 'recusada';   // empate sem desempate do Presidente da Câmara
}
function derruba(sim, nao) { return sim + nao > 0 && sim * 3 >= (sim + nao) * 2; }

async function processar(db, cidadeId) {
  await db.query(`UPDATE governo_propostas SET status = 'votacao' WHERE cidade_id = $1 AND status = 'debate' AND votacao_em <= NOW()`, [cidadeId]);
  const fechar = (await db.query(`SELECT id FROM governo_propostas WHERE cidade_id = $1 AND status = 'votacao' AND fecha_em <= NOW()`, [cidadeId])).rows;
  for (const { id } of fechar) {
    const votos = (await db.query(`SELECT fase, voto FROM governo_votos WHERE proposta_id = $1`, [id])).rows;
    const c = contar(votos, 'votacao');
    const d = votos.find(x => x.fase === 'desempate');
    const res = resultado(c.sim, c.nao, d ? d.voto : null);
    if (res === 'aprovada') {
      await db.query(`UPDATE governo_propostas SET status = 'aguardando_sancao', sancao_ate = NOW() + INTERVAL '${SANCAO_H} hours' WHERE id = $1 AND status = 'votacao'`, [id]);
    } else {
      await db.query(`UPDATE governo_propostas SET status = 'recusada', decidida_em = NOW(), nota = $2 WHERE id = $1 AND status = 'votacao'`,
        [id, c.sim + c.nao === 0 ? 'Ninguém votou' : (c.sim === c.nao ? 'Empate sem desempate do Presidente da Câmara' : null)]);
    }
  }
  // Presidente não respondeu em 24 h: sancionada sozinha
  const auto = (await db.query(`SELECT id FROM governo_propostas WHERE cidade_id = $1 AND status = 'aguardando_sancao' AND sancao_ate <= NOW()`, [cidadeId])).rows;
  for (const { id } of auto) {
    await db.query(`UPDATE governo_propostas SET sancao = 'automatica', sancao_por = 'Prazo de 24 h' WHERE id = $1`, [id]);
    await aplicar(db, cidadeId, id);
  }
  // veto: a Câmara teve 24 h pra derrubar
  const vet = (await db.query(`SELECT id FROM governo_propostas WHERE cidade_id = $1 AND status = 'vetada' AND derrubada_ate <= NOW()`, [cidadeId])).rows;
  for (const { id } of vet) {
    const c = contar((await db.query(`SELECT fase, voto FROM governo_votos WHERE proposta_id = $1`, [id])).rows, 'derrubada');
    if (derruba(c.sim, c.nao)) {
      await db.query(`UPDATE governo_propostas SET sancao = 'derrubada' WHERE id = $1`, [id]);
      await aplicar(db, cidadeId, id);
    } else {
      await db.query(`UPDATE governo_propostas SET status = 'veto_mantido', decidida_em = NOW() WHERE id = $1 AND status = 'vetada'`, [id]);
    }
  }
  // esperando: obra sem saldo e aumento de Parlamentar no mandato seguinte
  const esp = (await db.query(`SELECT id FROM governo_propostas WHERE cidade_id = $1 AND status IN ('sem_saldo','aguarda_mandato') AND aplicada_em IS NULL`, [cidadeId])).rows;
  for (const { id } of esp) await aplicar(db, cidadeId, id);
}

async function listar(db, cidadeId, user) {
  const regras = { debate_h: DEBATE_H, votacao_h: VOTACAO_H, sancao_h: SANCAO_H, derrubada_h: DERRUBADA_H };
  const cfg0 = await GOV.config(db, cidadeId);
  if (!cfg0 || !cfg0.corporation_id) return { meu_cargo: null, parlamentares: 0, regras, cargos: [], propostas: [] };
  await processar(db, cidadeId);
  const props = (await db.query(`SELECT * FROM governo_propostas WHERE cidade_id = $1 ORDER BY id DESC LIMIT 60`, [cidadeId])).rows;
  const ids = props.map(p => p.id);
  const votos = ids.length ? (await db.query(`SELECT proposta_id, fase, user_id, nome, voto, em FROM governo_votos WHERE proposta_id = ANY($1) ORDER BY em`, [ids])).rows : [];
  const eu = user ? await cargoNoGoverno(db, cidadeId, user.id) : null;
  const cfg = await GOV.config(db, cidadeId);
  const cargos = cfg ? (await db.query(`SELECT id, name, COALESCE(salary,0)::bigint AS salary FROM ranks WHERE corporation_id = $1 ORDER BY level DESC`, [cfg.corporation_id])).rows
    .map(r => ({ id: r.id, nome: r.name, salario: Number(r.salary), teto: tetoDoCargo(r.name) })) : [];
  return {
    meu_cargo: eu ? eu.cargo : null,
    parlamentares: await contarParlamentares(db, cidadeId),
    regras,
    cargos,
    propostas: props.map(p => {
      const vs = votos.filter(v => v.proposta_id === p.id);
      return {
        ...p, valor: Number(p.valor), valor_atual: p.valor_atual === null ? null : Number(p.valor_atual),
        status_nome: STATUS[p.status] || p.status,
        votos: vs.map(v => ({ fase: v.fase, nome: v.nome, voto: v.voto, em: v.em })),
        placar: contar(vs, 'votacao'), placar_derrubada: contar(vs, 'derrubada'),
        ja_votei: user ? vs.some(v => v.user_id === user.id && (v.fase === (p.status === 'vetada' ? 'derrubada' : p.status === 'votacao' ? 'votacao' : '-'))) : false,
        ja_desempatei: user ? vs.some(v => v.user_id === user.id && v.fase === 'desempate') : false,
      };
    }),
  };
}

let _timer = null;
function iniciar(db, cidades) {
  if (_timer) return;
  const rodar = async () => { for (const c of cidades) await processar(db, c).catch(e => console.error('[camara]', e.message)); };
  _timer = setInterval(rodar, 60000);
  if (_timer.unref) _timer.unref();
}

module.exports = { garantir, abrir, votar, sancionar, processar, listar, iniciar, resultado, derruba, tetoDoCargo, STATUS,
  DEBATE_H, VOTACAO_H, SANCAO_H, DERRUBADA_H };
