// [15/10] ECONOMIA DA CIDADE — aba do Dono no painel admin.
//
// [stated] Julio: "ver todo o dinheiro que ta circulando na cidade, quantos % e a quantidade
// exata que foi setada e por quem foi setado, etc, para mim poder administrar a corrupcao da staff".
//
// De onde vem cada número:
//   CIRCULANDO  = carteira + banco de cada jogador (game_patrimonio: a foto que o jogo manda quando
//                 a pessoa sai) + caixa de cada corp/empresa (corp_caixa).
//   STAFF       = dinheiro que a staff CRIOU ou TIROU, de 3 portas:
//     1. painel do site (dinheiro_set / dinheiro_add / banco_set) -> o jogo devolve um log
//        'dinheiro_staff' com antes/depois e o cmd_id; quem clicou = game_commands.created_by;
//     2. comando dentro do jogo (/setardinheiro, /adicionardinheiro, /tirardinheiro) -> mesmo log,
//        com o UserId de quem digitou;
//     3. aporte no caixa de corp feito pela staff no site (corp_lancamentos tipo 'aporte' que não é
//        repasse do Governo nem depósito de sócio).
//   Comando do painel de ANTES desta mudança não tem antes/depois: entra com o valor pedido e,
//   quando é "setar", com delta desconhecido (não dá pra inventar quanto nasceu).
//
// SÓ O DONO VÊ. A rota confere perm.ehDono no servidor.
const pool = require('./db/pool');
const perm = require('./permissoes');

const TIPOS_CMD = ['dinheiro_set', 'dinheiro_add', 'banco_set'];

function nomeUser(u) {
  if (!u) return null;
  return u.roblox_username || u.discord_username || ('user#' + u.id);
}

// Puro: recebe as linhas já normalizadas e monta ranking + sinais. Testável sem banco.
//   mov = { quando, staff, staffKey, staffRobloxId, cargo, origem, alvo, alvoId, conta, acao,
//           valor, antes, depois, delta (null = desconhecido), motivo }
function montar(movs, totalCirculando) {
  const porStaff = new Map();
  const vezesAlvo = new Map();            // staffKey|alvo -> n (favorecimento repetido)
  for (const m of movs) {
    const k = m.staffKey + '|' + (m.alvoId || m.alvo);
    vezesAlvo.set(k, (vezesAlvo.get(k) || 0) + 1);
  }
  for (const m of movs) {
    m.paraSi = !!(m.staffRobloxId && m.alvoId && Number(m.staffRobloxId) === Number(m.alvoId));
    m.repetido = (vezesAlvo.get(m.staffKey + '|' + (m.alvoId || m.alvo)) || 0) >= 3;
    m.pct = (m.delta != null && totalCirculando > 0) ? m.delta / totalCirculando : null;
    let s = porStaff.get(m.staffKey);
    if (!s) {
      s = { staff: m.staff, cargo: m.cargo, criado: 0, tirado: 0, acoes: 0, desconhecidos: 0,
            maior: 0, alvos: new Set(), paraSi: 0, paraSiValor: 0, paraSiSetado: 0, setadoSemAntes: 0, ultimo: null };
      porStaff.set(m.staffKey, s);
    }
    s.acoes++;
    // 'setar' antigo sem antes: o valor setado é o TETO do que pode ter nascido (setar pra V cria no máximo V)
    if (m.delta == null) { s.desconhecidos++; s.setadoSemAntes += Math.max(0, m.valor || 0); }
    else if (m.delta > 0) { s.criado += m.delta; s.maior = Math.max(s.maior, m.delta); }
    else s.tirado += -m.delta;
    s.alvos.add(m.alvoId || m.alvo);
    if (m.paraSi) { s.paraSi++; s.paraSiValor += Math.max(0, m.delta || 0); if (m.delta == null) s.paraSiSetado += Math.max(0, m.valor || 0); }
    if (!s.ultimo || new Date(m.quando) > new Date(s.ultimo)) s.ultimo = m.quando;
  }
  const ranking = [...porStaff.values()].map(s => ({
    ...s, alvos: s.alvos.size,
    liquido: s.criado - s.tirado,
    pct: totalCirculando > 0 ? (s.criado - s.tirado) / totalCirculando : 0,
    teto: s.criado - s.tirado + s.setadoSemAntes,
    pctTeto: totalCirculando > 0 ? (s.criado - s.tirado + s.setadoSemAntes) / totalCirculando : 0,
  })).sort((a, b) => b.teto - a.teto);
  const criado = movs.reduce((t, m) => t + (m.delta > 0 ? m.delta : 0), 0);
  const tirado = movs.reduce((t, m) => t + (m.delta < 0 ? -m.delta : 0), 0);
  return {
    ranking,
    totais: { criado, tirado, liquido: criado - tirado, acoes: movs.length,
      desconhecidos: movs.filter(m => m.delta == null).length,
      semAntesValor: movs.reduce((t, m) => t + (m.delta == null ? Math.max(0, m.valor || 0) : 0), 0),
      pct: totalCirculando > 0 ? (criado - tirado) / totalCirculando : 0 },
  };
}

async function relatorio(dias) {
  const janela = dias > 0 ? `NOW() - ($1 || ' days')::interval` : `'-infinity'::timestamp`;
  const pj = dias > 0 ? [String(dias)] : [];

  // ---------------------------------------------------------------- CIRCULANDO
  const jog = (await pool.query(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(GREATEST(bolso,0)),0)::bigint AS carteira,
            COALESCE(SUM(GREATEST(banco,0)),0)::bigint AS banco FROM game_patrimonio`)).rows[0];
  const corps = (await pool.query(
    `SELECT c.id, c.name AS nome, c.tipo, COALESCE(cx.saldo,0)::bigint AS saldo
       FROM corp_caixa cx JOIN corporations c ON c.id = cx.corporation_id
      ORDER BY cx.saldo DESC`).catch(() => ({ rows: [] }))).rows;
  const carteira = Number(jog.carteira), banco = Number(jog.banco);
  const caixas = corps.reduce((t, c) => t + Number(c.saldo), 0);
  const total = carteira + banco + caixas;
  const ricos = (await pool.query(
    `SELECT roblox_id, nome, bolso, banco, (GREATEST(bolso,0) + GREATEST(banco,0))::bigint AS total, atualizado_em
       FROM game_patrimonio ORDER BY total DESC LIMIT 15`)).rows
    .map(r => ({ ...r, total: Number(r.total), bolso: Number(r.bolso), banco: Number(r.banco),
      pct: total > 0 ? Number(r.total) / total : 0 }));

  // ---------------------------------------------------------------- STAFF
  const usuarios = (await pool.query(
    `SELECT id, discord_id, discord_username, roblox_username, roblox_id, is_admin, admin_cargo FROM users
      WHERE is_admin = true OR id IN (SELECT DISTINCT created_by FROM game_commands WHERE tipo = ANY($1))`,
    [TIPOS_CMD])).rows;
  const porId = new Map(usuarios.map(u => [u.id, u]));
  const porRoblox = new Map(usuarios.filter(u => u.roblox_id).map(u => [String(u.roblox_id), u]));
  // [15/10] o mesmo staff aparecia 2x (uma pelo id, outra só pelo nome no extrato da corp / no jogo)
  const porNome = new Map();
  for (const u of usuarios) for (const n of [u.roblox_username, u.discord_username]) if (n) porNome.set(String(n).toLowerCase(), u);
  const acharNome = n => (n ? porNome.get(String(n).toLowerCase()) : null) || null;
  const cargoNome = u => { if (u && perm.ehDono(u)) return 'Dono'; const c = u ? perm.cargoDe(u) : null; return c ? ((perm.CARGOS[c] || {}).nome || c) : null; };

  const logs = (await pool.query(
    `SELECT l.id, l.jogador, l.alvo, l.detalhe, COALESCE(l.ocorrido_em, l.created_at) AS quando,
            gc.created_by
       FROM game_logs l
       LEFT JOIN game_commands gc ON gc.id = NULLIF(l.detalhe->>'cmd_id','')::int
      WHERE l.tipo = 'dinheiro_staff' AND COALESCE(l.ocorrido_em, l.created_at) > ${janela}
      ORDER BY l.id DESC LIMIT 2000`, pj)).rows;
  const cmdsComLog = new Set(logs.map(l => Number(l.detalhe && l.detalhe.cmd_id)).filter(Boolean));

  const movs = [];
  for (const l of logs) {
    const d = l.detalhe || {};
    let u = null, staff = l.jogador, chave;
    if (d.origem === 'painel') {
      u = porId.get(l.created_by) || null;
      staff = nomeUser(u) || 'painel (usuário apagado)';
      chave = 'u' + (l.created_by || '?');
    } else {
      u = (d.staffId ? porRoblox.get(String(d.staffId)) : null) || acharNome(l.jogador);
      staff = l.jogador || (u && nomeUser(u)) || '?';
      chave = u ? 'u' + u.id : 'r' + (d.staffId || l.jogador);
    }
    movs.push({
      quando: l.quando, staff, staffKey: chave, staffRobloxId: (u && u.roblox_id) || d.staffId || null,
      cargo: cargoNome(u), origem: d.origem === 'painel' ? 'Painel do site' : 'Comando no jogo',
      alvo: l.alvo, alvoId: d.alvoId || null, conta: d.conta || 'carteira', acao: d.acao || 'setar',
      valor: Number(d.valor) || 0, antes: d.antes, depois: d.depois,
      delta: d.delta != null ? Number(d.delta) : null, motivo: d.motivo || null,
    });
  }

  // comandos do painel que não voltaram com log (antes de 15/10, ou jogo antigo)
  const cmds = (await pool.query(
    `SELECT id, tipo, target_roblox_id, target_name, payload, created_by, result,
            COALESCE(executed_at, created_at) AS quando
       FROM game_commands WHERE tipo = ANY($1) AND status = 'done' AND created_at > ${janela.replace('$1', '$2')}
      ORDER BY id DESC LIMIT 2000`, [TIPOS_CMD, ...pj])).rows;
  for (const c of cmds) {
    if (cmdsComLog.has(c.id)) continue;
    const u = porId.get(c.created_by) || null;
    const v = Number((c.payload || {}).valor) || 0;
    // a mensagem nova do jogo traz "R$antes -> R$depois": se tiver, usa
    const m = /R\$(-?\d+)\s*->\s*R\$(-?\d+)/.exec(c.result || '');
    let antes = null, depois = null, delta = null;
    if (m) { antes = Number(m[1]); depois = Number(m[2]); delta = depois - antes; }
    else if (c.tipo === 'dinheiro_add') delta = v;
    movs.push({
      quando: c.quando, staff: nomeUser(u) || 'painel (usuário apagado)', staffKey: 'u' + (c.created_by || '?'),
      staffRobloxId: u && u.roblox_id, cargo: cargoNome(u), origem: 'Painel do site',
      alvo: c.target_name, alvoId: c.target_roblox_id ? Number(c.target_roblox_id) : null,
      conta: c.tipo === 'banco_set' ? 'banco' : 'carteira',
      acao: c.tipo === 'dinheiro_add' ? (v >= 0 ? 'dar' : 'tirar') : 'setar',
      valor: Math.abs(v), antes, depois, delta, motivo: null, semRegistro: !m,
    });
  }

  // aporte da staff em caixa de corp
  const aportes = (await pool.query(
    `SELECT l.criado_em AS quando, l.valor, l.saldo_depois, l.por, l.detalhe, c.name AS corp
       FROM corp_lancamentos l JOIN corporations c ON c.id = l.corporation_id
      WHERE l.tipo = 'aporte' AND COALESCE(l.por,'') <> 'Governo'
        AND l.detalhe->>'origem' IS NULL AND l.detalhe->>'orcamento' IS NULL
        AND l.criado_em > ${janela}
      ORDER BY l.id DESC LIMIT 1000`, pj).catch(() => ({ rows: [] }))).rows;
  for (const a of aportes) {
    const d = a.detalhe || {};
    const u = (d.staff_user_id ? porId.get(Number(d.staff_user_id)) : null) || acharNome(a.por);
    const v = Number(a.valor) || 0;
    movs.push({
      quando: a.quando, staff: (u && nomeUser(u)) || a.por || '?', staffKey: u ? 'u' + u.id : 'n' + a.por,
      staffRobloxId: u && u.roblox_id, cargo: cargoNome(u), origem: 'Caixa de corp',
      alvo: a.corp, alvoId: null, conta: 'caixa', acao: 'dar', valor: v,
      antes: a.saldo_depois != null ? Number(a.saldo_depois) - v : null,
      depois: a.saldo_depois != null ? Number(a.saldo_depois) : null, delta: v, motivo: null,
    });
  }

  movs.sort((a, b) => new Date(b.quando) - new Date(a.quando));
  const r = montar(movs, total);

  // série por dia (criado - tirado) pra ver pico
  const porDia = new Map();
  for (const m of movs) {
    if (m.delta == null) continue;
    const k = new Date(m.quando).toISOString().slice(0, 10);
    const e = porDia.get(k) || { dia: k, criado: 0, tirado: 0 };
    if (m.delta > 0) e.criado += m.delta; else e.tirado += -m.delta;
    porDia.set(k, e);
  }

  return {
    dias,
    circulando: { total, carteira, banco, caixas, jogadores: jog.n, corps },
    ricos,
    staff: r.totais,
    ranking: r.ranking,
    movimentos: movs.slice(0, 500),
    porDia: [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia)),
  };
}

module.exports = { montar, relatorio };
