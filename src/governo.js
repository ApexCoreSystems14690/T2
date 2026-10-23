// [23/10] GOVERNO — o tesouro da cidade (pedido do Julio).
//
// [stated] "uma nova corporação que vai ser o governo, o caixa deve ser diferente, vai receber
// por coisas compradas in game, só que ultra infladas (temos ~20 por SSU e queremos simular uma
// cidade de ~200 mil pessoas): cada compra é multiplicada por X. Eu como adm posso ir lá e tirar
// 8 valores fixos (o governo vota aumento de rua, prédio novo, modificação de lugar...), o salário
// deles também sai daí, não precisa pegar cargo em game, e ganham a cada 3 dias os salários
// definidos, se tiverem entrado no jogo nesses 3 dias."
//
// Como funciona:
//   ARRECADAÇÃO  o jogo manda um log 'compra' {userId, valor, categoria} em cada compra feita do
//                Estado/comércio (carro, casa, item, roupa, gasolina, CNH...). Aqui: valor x
//                multiplicador vai pro caixa. Fica somado por hora e categoria (governo_arrecadacao).
//   OBRAS        8 valores fixos (governo_obras). Só o Dono retira, com a descrição do que foi
//                aprovado. Cada retirada é uma linha no extrato (corp_lancamentos tipo 'obra').
//   SALÁRIO      a cada 3 dias (períodos fixos, âncora 23/10/2026 00:00 de Brasília). No fim de cada
//                período, quem é membro do Governo, tem salário no cargo (ranks.salary) e ENTROU NO
//                JOGO dentro do período recebe. Sai do caixa e chega no jogo pela fila de itens
//                ('Dinheiro'), mesmo offline. UNIQUE(cidade, período, user) = nunca paga 2x.
// O caixa é o corp_caixa da corporação tipo 'governo' (trava de linha igual às outras corps).

const DIA = 86400000;
const PERIODO_DIAS = 3;
const ANCORA = Date.parse('2026-10-23T03:00:00Z');     // 23/10/2026 00:00 em Brasília
const SANTA_FE = 1;
const MULT_PADRAO = 10000;                            // ~20 jogadores -> ~200 mil habitantes
const VALOR_MAX_COMPRA = 50000000;                    // uma compra real nunca passa disso: corta log forjado
const CATEGORIAS = {
  carro: 'Veículos', imovel: 'Imóveis', item: 'Lojas e itens', movel: 'Móveis', tunagem: 'Oficina',
  roupa: 'Roupas e barbearia', combustivel: 'Combustível', documento: 'Documentos e taxas',
  servico: 'Serviços', financiamento: 'Parcelas de financiamento', outros: 'Outros',
};

const OBRAS_PADRAO = [
  { chave: 'sinalizacao', nome: 'Sinalização e trânsito',             valor: 500000000,   ordem: 10 },
  { chave: 'iluminacao',  nome: 'Iluminação pública',                 valor: 1000000000,  ordem: 20 },
  { chave: 'evento',      nome: 'Evento oficial da cidade',           valor: 1500000000,  ordem: 30 },
  { chave: 'praca',       nome: 'Praça ou área pública',              valor: 2000000000,  ordem: 40 },
  { chave: 'reforma',     nome: 'Reforma de um lugar existente',      valor: 3000000000,  ordem: 50 },
  { chave: 'rua',         nome: 'Aumento ou rua nova',                valor: 5000000000,  ordem: 60 },
  { chave: 'predio',      nome: 'Prédio novo',                        valor: 10000000000, ordem: 70 },
  { chave: 'obra_grande', nome: 'Obra grande (bairro, hospital, porto)', valor: 25000000000, ordem: 80 },
];

// Cargos do Governo (servidor do Governo, 19-21/10). Salário nasce 0: o Dono define.
const CARGOS_PADRAO = [
  ['Presidente da República', 100], ['Vice-Presidente', 95], ['Presidente da Câmara', 90],
  ['Presidente do STF', 88], ['Secretário de Estado', 80], ['Ministro da Saúde', 75],
  ['Ministro da Segurança', 74], ['Responsável das Corporações', 70], ['Ministro do STF', 60],
  ['Parlamentar', 50],
];

// ------------------------------------------------------------ puro
function periodoDe(ms) { return Math.floor((ms - ANCORA) / (PERIODO_DIAS * DIA)); }
function inicioDo(p) { return new Date(ANCORA + p * PERIODO_DIAS * DIA); }
function inflar(valor, mult) { return Math.floor(valor) * Math.max(1, Math.floor(mult)); }
// normaliza as compras que vieram do jogo; descarta lixo
function limparCompras(eventos) {
  const out = [];
  for (const e of (eventos || [])) {
    if (!e || e.tipo !== 'compra' || !e.detalhe) continue;
    const v = Math.floor(Number(e.detalhe.valor));
    if (!Number.isFinite(v) || v <= 0 || v > VALOR_MAX_COMPRA) continue;
    const cat = CATEGORIAS[e.detalhe.categoria] ? e.detalhe.categoria : 'outros';
    const rid = Number(e.detalhe.userId) || null;
    const quando = Number(e.t) ? new Date(Number(e.t) * 1000) : new Date();
    out.push({ valor: v, categoria: cat, rid, quando });
  }
  return out;
}

// ------------------------------------------------------------ banco
async function garantir(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS governo_config (
      cidade_id INTEGER PRIMARY KEY REFERENCES cidades(id),
      corporation_id INTEGER REFERENCES corporations(id),
      multiplicador BIGINT NOT NULL DEFAULT ${MULT_PADRAO} CHECK (multiplicador >= 1),
      atualizado_em TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS governo_obras (
      cidade_id INTEGER NOT NULL REFERENCES cidades(id),
      chave VARCHAR(32) NOT NULL,
      nome VARCHAR(120) NOT NULL,
      valor BIGINT NOT NULL CHECK (valor > 0),
      ordem INTEGER NOT NULL DEFAULT 100,
      PRIMARY KEY (cidade_id, chave)
    );
    CREATE TABLE IF NOT EXISTS governo_arrecadacao (
      cidade_id INTEGER NOT NULL REFERENCES cidades(id),
      hora TIMESTAMPTZ NOT NULL,
      categoria VARCHAR(24) NOT NULL,
      compras INTEGER NOT NULL DEFAULT 0,
      valor_real BIGINT NOT NULL DEFAULT 0,
      valor_inflado BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (cidade_id, hora, categoria)
    );
    CREATE TABLE IF NOT EXISTS governo_salarios (
      id SERIAL PRIMARY KEY,
      cidade_id INTEGER NOT NULL REFERENCES cidades(id),
      periodo INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      roblox_id BIGINT,
      nome VARCHAR(128),
      cargo VARCHAR(128),
      valor BIGINT NOT NULL DEFAULT 0,
      status VARCHAR(16) NOT NULL,          -- pago | nao_entrou | sem_saldo | sem_roblox
      fila_id INTEGER,
      criado_em TIMESTAMP DEFAULT NOW(),
      UNIQUE (cidade_id, periodo, user_id)
    );
  `);
  const tem = await pool.query('SELECT 1 FROM cidades WHERE id = $1', [SANTA_FE]);
  if (!tem.rows[0]) return;
  // a corporação Governo do Santa Fé: usa a 'governo' que o jogo já conhece (CorpService) ou cria
  let c = (await pool.query(`SELECT id, tipo FROM corporations WHERE slug = 'governo'`)).rows[0];
  if (!c) {
    c = (await pool.query(
      `INSERT INTO corporations (name, slug, description, color, tipo, cidade_id)
       VALUES ('Governo de Santa Fé', 'governo', 'O tesouro da cidade: arrecadação, obras e salários do Governo.', '#1D3F94', 'governo', $1)
       RETURNING id, tipo`, [SANTA_FE])).rows[0];
  } else if (c.tipo !== 'governo') {
    await pool.query(`UPDATE corporations SET tipo = 'governo', updated_at = NOW() WHERE id = $1`, [c.id]);
  }
  await pool.query(`INSERT INTO corp_caixa (corporation_id, saldo) VALUES ($1, 0) ON CONFLICT DO NOTHING`, [c.id]);
  const nRanks = (await pool.query(`SELECT COUNT(*)::int n FROM ranks WHERE corporation_id = $1`, [c.id])).rows[0].n;
  if (!nRanks) {
    for (const [nome, nivel] of CARGOS_PADRAO) {
      await pool.query(`INSERT INTO ranks (corporation_id, name, level, salary) VALUES ($1,$2,$3,0)`, [c.id, nome, nivel]).catch(() => {});
    }
  }
  await pool.query(
    `INSERT INTO governo_config (cidade_id, corporation_id) VALUES ($1,$2)
     ON CONFLICT (cidade_id) DO UPDATE SET corporation_id = EXCLUDED.corporation_id`, [SANTA_FE, c.id]);
  for (const o of OBRAS_PADRAO) {
    await pool.query(`INSERT INTO governo_obras (cidade_id, chave, nome, valor, ordem) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [SANTA_FE, o.chave, o.nome, o.valor, o.ordem]);
  }
}

async function config(db, cidadeId) {
  const r = await db.query(`SELECT * FROM governo_config WHERE cidade_id = $1`, [cidadeId]);
  return r.rows[0] || null;
}

async function _transacao(pool, fn) {
  const cli = await pool.connect();
  try { await cli.query('BEGIN'); const r = await fn(cli); await cli.query('COMMIT'); return r; }
  catch (e) { try { await cli.query('ROLLBACK'); } catch (_) {} throw e; }
  finally { cli.release(); }
}
async function _travar(cli, corpId) {
  await cli.query(`INSERT INTO corp_caixa (corporation_id, saldo) VALUES ($1, 0) ON CONFLICT DO NOTHING`, [corpId]);
  const r = await cli.query(`SELECT saldo FROM corp_caixa WHERE corporation_id = $1 FOR UPDATE`, [corpId]);
  return Number(r.rows[0].saldo);
}
function erro(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

// ARRECADAR: chamado pelo /api/game/logs com os eventos do lote
async function arrecadar(pool, cidadeId, eventos) {
  const compras = limparCompras(eventos);
  if (!compras.length) return { compras: 0, entrou: 0 };
  const cfg = await config(pool, cidadeId);
  if (!cfg || !cfg.corporation_id) return { compras: 0, entrou: 0, motivo: 'cidade sem governo' };
  const mult = Number(cfg.multiplicador) || MULT_PADRAO;
  // soma por hora + categoria
  const balde = new Map();
  let total = 0;
  for (const c of compras) {
    const h = new Date(c.quando); h.setUTCMinutes(0, 0, 0);
    const k = h.toISOString() + '|' + c.categoria;
    const b = balde.get(k) || { hora: h.toISOString(), categoria: c.categoria, compras: 0, real: 0, inflado: 0 };
    const inf = inflar(c.valor, mult);
    b.compras++; b.real += c.valor; b.inflado += inf; total += inf;
    balde.set(k, b);
  }
  await _transacao(pool, async (cli) => {
    const saldo = await _travar(cli, cfg.corporation_id);
    await cli.query(`UPDATE corp_caixa SET saldo = $2, atualizado_em = NOW() WHERE corporation_id = $1`, [cfg.corporation_id, saldo + total]);
    for (const b of balde.values()) {
      await cli.query(
        `INSERT INTO governo_arrecadacao (cidade_id, hora, categoria, compras, valor_real, valor_inflado) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (cidade_id, hora, categoria) DO UPDATE SET compras = governo_arrecadacao.compras + EXCLUDED.compras,
           valor_real = governo_arrecadacao.valor_real + EXCLUDED.valor_real, valor_inflado = governo_arrecadacao.valor_inflado + EXCLUDED.valor_inflado`,
        [cidadeId, b.hora, b.categoria, b.compras, b.real, b.inflado]);
    }
  });
  return { compras: compras.length, entrou: total };
}

// OBRA: o Dono retira um dos valores fixos
async function retirarObra(pool, cidadeId, { obra, descricao }, staff) {
  const desc = typeof descricao === 'string' ? descricao.trim() : '';
  if (desc.length < 8) throw erro('Escreva o que foi aprovado (o projeto ou a votação), com pelo menos 8 letras');
  if (desc.length > 300) throw erro('Descrição longa demais (máx. 300)');
  const cfg = await config(pool, cidadeId);
  if (!cfg || !cfg.corporation_id) throw erro('Esta cidade não tem Governo', 404);
  const o = (await pool.query(`SELECT * FROM governo_obras WHERE cidade_id = $1 AND chave = $2`, [cidadeId, String(obra || '')])).rows[0];
  if (!o) throw erro('Escolha uma das obras da lista');
  const valor = Number(o.valor);
  const quem = staff.discord_username || ('user#' + staff.id);
  return _transacao(pool, async (cli) => {
    const saldo = await _travar(cli, cfg.corporation_id);
    if (saldo < valor) throw erro('O caixa do Governo não tem o suficiente pra essa obra');
    const novo = saldo - valor;
    await cli.query(`UPDATE corp_caixa SET saldo = $2, atualizado_em = NOW() WHERE corporation_id = $1`, [cfg.corporation_id, novo]);
    const l = await cli.query(
      `INSERT INTO corp_lancamentos (corporation_id, tipo, motivo, valor, saldo_depois, quem, por, detalhe)
       VALUES ($1,'obra',$2,$3,$4,$5,$6,$7) RETURNING id`,
      [cfg.corporation_id, o.chave.slice(0, 24), -valor, novo, o.nome.slice(0, 64), quem.slice(0, 64),
       JSON.stringify({ obra: o.nome, descricao: desc, staff_user_id: staff.id })]);
    return { id: l.rows[0].id, saldo: novo, valor, obra: o.nome };
  });
}

// SALÁRIOS: paga o período que acabou (idempotente; rodar à vontade)
async function pagarSalarios(pool, cidadeId, agoraMs) {
  const agora = Number.isFinite(Number(agoraMs)) ? Number(agoraMs) : Date.now();
  const p = periodoDe(agora) - 1;                     // o período que JÁ FECHOU
  if (p < 0) return { periodo: p, pagos: 0, motivo: 'primeiro período ainda não fechou' };
  const cfg = await config(pool, cidadeId);
  if (!cfg || !cfg.corporation_id) return { periodo: p, pagos: 0, motivo: 'sem governo' };
  const ini = inicioDo(p), fim = inicioDo(p + 1);
  const membros = (await pool.query(
    `SELECT u.id AS user_id, u.roblox_id, COALESCE(u.roblox_username, u.discord_username) AS nome,
            r.name AS cargo, COALESCE(r.salary, 0)::bigint AS salario
       FROM members m JOIN users u ON u.id = m.user_id LEFT JOIN ranks r ON r.id = m.rank_id
      WHERE m.corporation_id = $1 AND COALESCE(r.salary, 0) > 0
      ORDER BY r.level DESC NULLS LAST, u.id`, [cfg.corporation_id])).rows;
  const feito = { periodo: p, inicio: ini, fim, pagos: 0, total: 0, nao_entrou: 0, sem_saldo: 0, sem_roblox: 0, ja: 0 };
  for (const m of membros) {
    await _transacao(pool, async (cli) => {
      const ja = await cli.query(`SELECT 1 FROM governo_salarios WHERE cidade_id = $1 AND periodo = $2 AND user_id = $3`, [cidadeId, p, m.user_id]);
      if (ja.rows[0]) { feito.ja++; return; }
      const base = [cidadeId, p, m.user_id, m.roblox_id, m.nome, m.cargo, Number(m.salario)];
      const marca = async (status, filaId) => {
        const r = await cli.query(
          `INSERT INTO governo_salarios (cidade_id, periodo, user_id, roblox_id, nome, cargo, valor, status, fila_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (cidade_id, periodo, user_id) DO NOTHING RETURNING id`, [...base, status, filaId || null]);
        return !!r.rows[0];
      };
      if (!m.roblox_id) { if (await marca('sem_roblox')) feito.sem_roblox++; return; }
      const entrou = await cli.query(
        `SELECT 1 FROM game_logs WHERE tipo = 'entrou' AND detalhe->>'userId' = $1
            AND COALESCE(ocorrido_em, created_at) >= $2 AND COALESCE(ocorrido_em, created_at) < $3 LIMIT 1`,
        [String(m.roblox_id), ini, fim]);
      if (!entrou.rows[0]) { if (await marca('nao_entrou')) feito.nao_entrou++; return; }
      const saldo = await _travar(cli, cfg.corporation_id);
      const v = Number(m.salario);
      if (saldo < v) { if (await marca('sem_saldo')) feito.sem_saldo++; return; }
      // primeiro a trava (UNIQUE), depois o dinheiro: se outra execução ganhou, nada sai do caixa
      const ok = await marca('pago');
      if (!ok) { feito.ja++; return; }
      const f = await cli.query(`INSERT INTO game_item_fila (roblox_id, item, qtd, criado_por) VALUES ($1,'Dinheiro',$2,NULL) RETURNING id`, [m.roblox_id, v]);
      await cli.query(`UPDATE governo_salarios SET fila_id = $4 WHERE cidade_id = $1 AND periodo = $2 AND user_id = $3`, [cidadeId, p, m.user_id, f.rows[0].id]);
      await cli.query(`UPDATE corp_caixa SET saldo = $2, atualizado_em = NOW() WHERE corporation_id = $1`, [cfg.corporation_id, saldo - v]);
      await cli.query(
        `INSERT INTO corp_lancamentos (corporation_id, tipo, motivo, valor, saldo_depois, quem, por, detalhe)
         VALUES ($1,'salario',$2,$3,$4,$5,'Governo',$6)`,
        [cfg.corporation_id, 'governo', -v, saldo - v, String(m.nome || '').slice(0, 64),
         JSON.stringify({ cargo: m.cargo, periodo: p, roblox_id: Number(m.roblox_id) })]);
      feito.pagos++; feito.total += v;
    });
  }
  return feito;
}

let _timer = null;
function iniciar(pool, ms) {
  if (_timer) return;
  const rodar = () => pagarSalarios(pool, SANTA_FE).catch(e => console.error('[governo] salários:', e.message));
  const t0 = setTimeout(rodar, 15000); if (t0.unref) t0.unref();
  _timer = setInterval(rodar, ms || 10 * 60000);
  if (_timer.unref) _timer.unref();
}

// ------------------------------------------------------------ leitura (painel)
async function painel(pool, cidadeId, agoraMs) {
  const agora = Number.isFinite(Number(agoraMs)) ? Number(agoraMs) : Date.now();
  const cfg = await config(pool, cidadeId);
  if (!cfg || !cfg.corporation_id) return null;
  const cid = cfg.corporation_id;
  const saldo = Number((await pool.query(`SELECT saldo FROM corp_caixa WHERE corporation_id = $1`, [cid])).rows[0]?.saldo || 0);
  const somar = async (dias) => (await pool.query(
    `SELECT categoria, SUM(compras)::int AS compras, SUM(valor_real)::bigint AS real, SUM(valor_inflado)::bigint AS inflado
       FROM governo_arrecadacao WHERE cidade_id = $1 AND hora >= NOW() - ($2 || ' days')::interval GROUP BY categoria ORDER BY inflado DESC`,
    [cidadeId, String(dias)])).rows.map(r => ({ ...r, nome: CATEGORIAS[r.categoria] || r.categoria, real: Number(r.real), inflado: Number(r.inflado) }));
  const porDia = (await pool.query(
    `SELECT to_char(hora AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia, SUM(valor_inflado)::bigint AS inflado, SUM(compras)::int AS compras
       FROM governo_arrecadacao WHERE cidade_id = $1 AND hora >= NOW() - INTERVAL '14 days' GROUP BY 1 ORDER BY 1`, [cidadeId])).rows
    .map(r => ({ dia: r.dia, inflado: Number(r.inflado), compras: r.compras }));
  const obras = (await pool.query(`SELECT chave, nome, valor FROM governo_obras WHERE cidade_id = $1 ORDER BY ordem, chave`, [cidadeId])).rows
    .map(o => ({ ...o, valor: Number(o.valor) }));
  const extrato = (await pool.query(
    `SELECT id, tipo, motivo, valor, saldo_depois, quem, por, detalhe, criado_em FROM corp_lancamentos
      WHERE corporation_id = $1 ORDER BY id DESC LIMIT 80`, [cid])).rows.map(l => ({ ...l, valor: Number(l.valor), saldo_depois: Number(l.saldo_depois) }));
  const pAtual = periodoDe(agora);
  const membros = (await pool.query(
    `SELECT u.id AS user_id, u.roblox_id, COALESCE(u.roblox_username, u.discord_username) AS nome, r.name AS cargo, r.level,
            COALESCE(r.salary, 0)::bigint AS salario,
            EXISTS (SELECT 1 FROM game_logs l WHERE l.tipo = 'entrou' AND l.detalhe->>'userId' = u.roblox_id::text
                      AND COALESCE(l.ocorrido_em, l.created_at) >= $2) AS entrou_no_periodo
       FROM members m JOIN users u ON u.id = m.user_id LEFT JOIN ranks r ON r.id = m.rank_id
      WHERE m.corporation_id = $1 ORDER BY r.level DESC NULLS LAST, nome`, [cid, inicioDo(pAtual)])).rows
    .map(m => ({ ...m, salario: Number(m.salario) }));
  const ultimos = (await pool.query(
    `SELECT periodo, nome, cargo, valor, status, criado_em FROM governo_salarios WHERE cidade_id = $1 ORDER BY periodo DESC, valor DESC LIMIT 60`, [cidadeId])).rows
    .map(s => ({ ...s, valor: Number(s.valor) }));
  const folha = membros.reduce((t, m) => t + m.salario, 0);
  return {
    corporation_id: cid, saldo, multiplicador: Number(cfg.multiplicador),
    arrecadacao: { h24: await somar(1), d7: await somar(7), d30: await somar(30) },
    porDia, obras, extrato,
    salarios: { periodo_dias: PERIODO_DIAS, inicio: inicioDo(pAtual), proximo_pagamento: inicioDo(pAtual + 1), folha, membros, ultimos },
    categorias: CATEGORIAS,
  };
}

// ------------------------------------------------------------ Dono: configuração
async function salvarConfig(pool, cidadeId, b) {
  if (b.multiplicador !== undefined) {
    const m = Math.floor(Number(b.multiplicador));
    if (!(m >= 1 && m <= 1000000)) throw erro('Multiplicador de 1 a 1.000.000');
    await pool.query(`UPDATE governo_config SET multiplicador = $2, atualizado_em = NOW() WHERE cidade_id = $1`, [cidadeId, m]);
  }
}
async function salvarObra(pool, cidadeId, chave, b) {
  const sets = [], vals = [cidadeId, chave];
  if (b.nome !== undefined) { const n = String(b.nome || '').trim(); if (!n || n.length > 120) throw erro('Nome inválido'); vals.push(n); sets.push(`nome = $${vals.length}`); }
  if (b.valor !== undefined) { const v = Math.floor(Number(b.valor)); if (!(v > 0 && v <= 1e15)) throw erro('Valor inválido'); vals.push(v); sets.push(`valor = $${vals.length}`); }
  if (!sets.length) throw erro('Nada pra mudar');
  const r = await pool.query(`UPDATE governo_obras SET ${sets.join(', ')} WHERE cidade_id = $1 AND chave = $2`, vals);
  if (!r.rowCount) throw erro('Obra não existe', 404);
}

module.exports = {
  PERIODO_DIAS, ANCORA, MULT_PADRAO, CATEGORIAS, OBRAS_PADRAO, VALOR_MAX_COMPRA, SANTA_FE,
  periodoDe, inicioDo, inflar, limparCompras,
  garantir, config, arrecadar, retirarObra, pagarSalarios, iniciar, painel, salvarConfig, salvarObra,
};
