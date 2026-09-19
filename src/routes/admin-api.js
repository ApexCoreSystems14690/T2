// API do Painel Admin. TUDO aqui exige login + is_admin (checado no servidor, em cada request).
// [19/09] Cada rota exige, ALÉM disso, o PODER correspondente ao cargo do admin
// (ver src/permissoes.js). O painel esconde o botão; quem barra é o servidor.
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, requireAdmin, requirePoder } = require('../middleware/auth');
const perm = require('../permissoes');

router.use(requireAuth);
router.use(requireAdmin);

// ------------------------------------------------------------
// Whitelist de comandos que o jogo sabe executar + validação do payload
// ------------------------------------------------------------
const num = (v, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (min != null && n < min) return null;
  if (max != null && n > max) return null;
  return n;
};
const str = (v, max) => (typeof v === 'string' && v.trim().length > 0 && v.length <= (max || 64)) ? v.trim() : null;

const COMANDOS = {
  // alvo obrigatório (jogador online)
  dinheiro_set:   { alvo: true,  valida: p => ({ valor: num(p.valor, 0, 1e12) }) },
  dinheiro_add:   { alvo: true,  valida: p => ({ valor: num(p.valor, -1e12, 1e12) }) },
  banco_set:      { alvo: true,  valida: p => ({ valor: num(p.valor, 0, 1e12) }) },
  item_add:       { alvo: true,  valida: p => ({ item: str(p.item), qtd: num(p.qtd, 1, 99) || 1 }) },
  item_remove:    { alvo: true,  valida: p => ({ item: str(p.item), qtd: num(p.qtd, 1, 99) || 1 }) },
  emprego:        { alvo: true,  valida: p => ({ emprego: typeof p.emprego === 'string' && p.emprego.length <= 64 ? p.emprego : null }) },
  level_set:      { alvo: true,  valida: p => ({ level: num(p.level, 1, 9999) }) },
  slots_set:      { alvo: true,  valida: p => ({ slots: num(p.slots, 1, 6) }) },
  tp_local:       { alvo: true,  valida: p => ({ local: str(p.local) }) },
  tp_jogador:     { alvo: true,  valida: p => ({ para: str(p.para) }) },
  tp_coord:       { alvo: true,  valida: p => ({ x: num(p.x), y: num(p.y), z: num(p.z) }) },
  trazer:         { alvo: true,  valida: p => ({ de: str(p.de) }) }, // traz "de" até o alvo
  curar:          { alvo: true,  valida: () => ({}) },
  matar:          { alvo: true,  valida: () => ({}) },
  kick:           { alvo: true,  valida: p => ({ motivo: str(p.motivo, 200) || 'Expulso por um administrador' }) },
  mensagem:       { alvo: true,  valida: p => ({ texto: str(p.texto, 300) }) },
  carro_add:      { alvo: true,  valida: p => ({ carro: str(p.carro) }) },
  carro_remove:   { alvo: true,  valida: p => ({ carro: str(p.carro) }) },
  resetar_dados:  { alvo: true,  valida: () => ({}) },
  corp_refresh:   { alvo: true,  valida: () => ({}) },
  noclip:         { alvo: true,  valida: p => ({ ativar: !!p.ativar, velocidade: num(p.velocidade, 16, 800) || 80 }) }, // voar / atravessar paredes
  // alvo por roblox_id, pode estar offline
  ban:            { alvo: 'id',  valida: p => ({ roblox_id: num(p.roblox_id, 1), motivo: str(p.motivo, 200) || 'Banido por um administrador' }) },
  unban:          { alvo: 'id',  valida: p => ({ roblox_id: num(p.roblox_id, 1) }) },
  // servidor inteiro
  hora:           { alvo: false, valida: p => ({ clock: num(p.clock, 0, 24) }) },
  clima:          { alvo: false, valida: p => ({ chuva: num(p.chuva, -1, 3) }), persiste: 'clima' }, // -1 automático (ciclo aleatório), 0 sem chuva, 1 fraca, 2 média, 3 forte
  anuncio:        { alvo: false, valida: p => ({ titulo: str(p.titulo, 40) || 'Aviso', texto: str(p.texto, 300) }) },
};

async function audit(req, acao, detalhe) {
  try {
    await pool.query('INSERT INTO admin_audit (admin_id, admin_nome, acao, detalhe) VALUES ($1, $2, $3, $4)',
      [req.user.id, req.user.discord_username || ('user#' + req.user.id), acao, JSON.stringify(detalhe || {})]);
  } catch (e) { console.error('audit:', e.message); }
}

// ------------------------------------------------------------
// Estado ao vivo: servidores, jogadores online, catálogo
// ------------------------------------------------------------
router.get('/state', async (req, res) => {
  try {
    const servers = await pool.query(`SELECT job_id, place_id, players, catalog, updated_at FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds' ORDER BY updated_at DESC`);
    let catalog = null;
    const players = [];
    for (const s of servers.rows) {
      if (!catalog && s.catalog) catalog = s.catalog;
      for (const p of (s.players || [])) players.push(Object.assign({ job_id: s.job_id }, p));
    }
    const cfgRows = await pool.query(`SELECT key, value FROM game_config`);
    const config = {};
    for (const r of cfgRows.rows) config[r.key] = r.value;
    res.json({ servers: servers.rows.map(s => ({ job_id: s.job_id, place_id: s.place_id, n: (s.players || []).length, updated_at: s.updated_at })), players, catalog, config });
  } catch (err) {
    console.error('state:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ------------------------------------------------------------
// Quem sou eu: cargo, poderes e a escada inteira. O painel usa isto pra
// esconder o que este admin nao pode fazer. (Esconder e conforto; quem barra
// de verdade e o requirePoder de cada rota.)
// ------------------------------------------------------------
router.get('/eu', (req, res) => {
  const cargo = perm.cargoDe(req.user);
  res.json({
    id: req.user.id,
    nome: req.user.discord_username || req.user.roblox_username || ('user#' + req.user.id),
    cargo,
    cargo_nome: (perm.CARGOS[cargo] || {}).nome || null,
    cargo_cor: (perm.CARGOS[cargo] || {}).cor || null,
    nivel: perm.nivelDoCargo(cargo),
    poderes: perm.poderesDe(req.user),
    CARGOS: perm.CARGOS,
    ORDEM: perm.ORDEM,
    ATRIBUIVEIS: perm.CARGOS_ATRIBUIVEIS,
    PODERES: perm.PODERES,
    PODER_DO_COMANDO: perm.PODER_DO_COMANDO,
    matriz: perm.matriz(),
  });
});

// ------------------------------------------------------------
// Enviar comando pro jogo
// ------------------------------------------------------------
router.post('/command', async (req, res) => {
  try {
    const { tipo, target_roblox_id, target_name, payload } = req.body || {};
    const spec = COMANDOS[tipo];
    if (!spec) return res.status(400).json({ error: 'Comando desconhecido' });

    // [19/09] PORTÃO POR CARGO. Comando sem poder mapeado é RECUSADO: esquecer
    // de mapear um comando novo não pode virar "liberado pra qualquer cargo".
    const poder = perm.PODER_DO_COMANDO[tipo];
    if (!poder) return res.status(403).json({ error: 'Comando sem permissão definida: ' + tipo });
    if (!perm.pode(req.user, poder)) {
      const p = perm.PODERES[poder] || {};
      await audit(req, 'negado:' + tipo, { poder, cargo: perm.cargoDe(req.user) });
      return res.status(403).json({
        error: 'Seu cargo não permite: ' + (p.rotulo || poder),
        seu_cargo: (perm.CARGOS[perm.cargoDe(req.user)] || {}).nome || null,
        precisa: (perm.CARGOS[p.min] || {}).nome || null,
      });
    }

    const dados = spec.valida(payload || {});
    for (const k of Object.keys(dados)) {
      if (dados[k] === null || dados[k] === undefined) return res.status(400).json({ error: 'Parâmetro inválido: ' + k });
    }

    // Descobre em que servidor o alvo está (comando vai só pra ele)
    let jobId = null;
    let alvoId = null, alvoNome = null;
    if (spec.alvo === true) {
      const servers = await pool.query(`SELECT job_id, players FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds'`);
      for (const s of servers.rows) {
        for (const p of (s.players || [])) {
          if ((target_roblox_id && Number(p.userId) === Number(target_roblox_id)) || (target_name && p.name === target_name)) {
            jobId = s.job_id; alvoId = p.userId; alvoNome = p.name;
          }
        }
      }
      if (!jobId) return res.status(400).json({ error: 'Jogador não está online em nenhum servidor' });
    } else if (spec.alvo === 'id') {
      alvoId = dados.roblox_id;
      alvoNome = target_name || null;
    }

    if (spec.alvo === false) {
      // config persistida (ex.: clima): grava sempre, mesmo sem servidor online — o heartbeat entrega depois
      if (spec.persiste) {
        await pool.query(
          `INSERT INTO game_config (key, value, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [spec.persiste, JSON.stringify(dados)]);
      }
      // servidor inteiro: um comando por servidor ativo
      const servers = await pool.query(`SELECT job_id FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds'`);
      if (servers.rows.length === 0) {
        if (spec.persiste) { await audit(req, 'comando:' + tipo, { payload: dados, servidores: 0, salvo: true }); return res.json({ ok: true, ids: [], salvo: true }); }
        return res.status(400).json({ error: 'Nenhum servidor online' });
      }
      const ids = [];
      for (const s of servers.rows) {
        const r = await pool.query(
          'INSERT INTO game_commands (tipo, payload, job_id, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
          [tipo, JSON.stringify(dados), s.job_id, req.user.id]);
        ids.push(r.rows[0].id);
      }
      await audit(req, 'comando:' + tipo, { payload: dados, servidores: servers.rows.length });
      return res.json({ ok: true, ids });
    }

    if (spec.alvo === 'id') {
      // ban/unban: manda pra todos os servidores (o online executa kick; todos podem gravar o DataStore, mas só um precisa)
      const servers = await pool.query(`SELECT job_id FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds' ORDER BY updated_at DESC LIMIT 1`);
      if (servers.rows.length === 0) return res.status(400).json({ error: 'Nenhum servidor online pra executar' });
      jobId = servers.rows[0].job_id;
    }

    const r = await pool.query(
      'INSERT INTO game_commands (tipo, target_roblox_id, target_name, payload, job_id, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [tipo, alvoId, alvoNome, JSON.stringify(dados), jobId, req.user.id]);
    await audit(req, 'comando:' + tipo, { alvo: alvoNome || alvoId, payload: dados });
    res.json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    console.error('command:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Histórico de comandos (com resultado)
router.get('/commands', requirePoder('ver_registro'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.*, u.discord_username AS admin FROM game_commands c LEFT JOIN users u ON u.id = c.created_by
       ORDER BY c.id DESC LIMIT 100`);
    res.json({ commands: r.rows });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

// ------------------------------------------------------------
// Logs do jogo
// ------------------------------------------------------------
router.get('/logs', requirePoder('ver_registro'), async (req, res) => {
  try {
    const tipo = str(req.query.tipo, 32);
    const q = str(req.query.q, 64);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 200, 1), 1000);
    const where = [];
    const params = [];
    if (tipo && tipo !== 'todos') { params.push(tipo); where.push(`tipo = $${params.length}`); }
    if (q) { params.push('%' + q + '%'); where.push(`(jogador ILIKE $${params.length} OR alvo ILIKE $${params.length})`); }
    params.push(limit);
    const r = await pool.query(
      `SELECT id, tipo, jogador, alvo, detalhe, job_id, COALESCE(ocorrido_em, created_at) AS quando FROM game_logs
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT $${params.length}`, params);
    const counts = await pool.query(`SELECT tipo, COUNT(*)::int AS n FROM game_logs GROUP BY tipo`);
    res.json({ logs: r.rows, counts: counts.rows });
  } catch (err) {
    console.error('logs:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.delete('/logs', requirePoder('logs'), async (req, res) => {
  try {
    const tipo = str(req.query.tipo, 32);
    let r;
    if (tipo && tipo !== 'todos') r = await pool.query('DELETE FROM game_logs WHERE tipo = $1', [tipo]);
    else r = await pool.query('DELETE FROM game_logs');
    await audit(req, 'logs:resetar', { tipo: tipo || 'todos', apagados: r.rowCount });
    res.json({ ok: true, apagados: r.rowCount });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

// ------------------------------------------------------------
// Auditoria das ações do painel
// ------------------------------------------------------------
router.get('/audit', requirePoder('admins'), async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM admin_audit ORDER BY id DESC LIMIT 200');
    res.json({ audit: r.rows });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

// ------------------------------------------------------------
// Usuários do site: conceder/retirar admin
// ------------------------------------------------------------
router.get('/users', requirePoder('admins'), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, discord_username, discord_id, discord_avatar, roblox_id, roblox_username, is_admin, admin_cargo, created_at,
              (discord_id LIKE 'roblox_%') AS is_placeholder
       FROM users ORDER BY is_admin DESC, LOWER(COALESCE(discord_username, roblox_username, '')) ASC`);
    // cargo resolvido no servidor: is_admin com admin_cargo vazio = DONO (setado direto no banco)
    res.json({ users: r.rows.map(u => {
      const cargo = perm.cargoDe(u);
      return Object.assign({}, u, {
        cargo,
        cargo_nome: (perm.CARGOS[cargo] || {}).nome || null,
        cargo_cor: (perm.CARGOS[cargo] || {}).cor || null,
        nivel: perm.nivelDoCargo(cargo),
        posso_mexer: perm.podeMexerEm(req.user, u),
      });
    }) });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

// [19/09] CARGO DE ADMIN. Substitui o antigo liga/desliga.
//   cargo = null            -> tira o admin
//   cargo = 'moderador'...  -> concede/altera
//   'dono' NUNCA sai daqui: dono e quem tem is_admin com admin_cargo NULL no
//   banco, ou seja, quem foi setado por SQL. Pra criar um dono:
//       UPDATE users SET is_admin = true, admin_cargo = NULL WHERE id = <id>;
// Regras: nao mexe em si mesmo, nao mexe em quem tem cargo igual ou maior, e
// nao concede cargo igual ou acima do proprio.
async function definirCargo(req, res, id, cargo) {
  try {
    if (!id) return res.status(400).json({ error: 'id inválido' });
    if (cargo === '' || cargo === undefined) cargo = null;

    const q = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    const alvo = q.rows[0];

    if (id === req.user.id) return res.status(400).json({ error: 'Você não pode mudar o seu próprio cargo' });
    if (!perm.podeMexerEm(req.user, alvo)) {
      const c = perm.CARGOS[perm.cargoDe(alvo)];
      return res.status(403).json({ error: c ? ('Você não pode mexer em um ' + c.nome) : 'Você não pode mexer nesse usuário' });
    }

    if (cargo === null) {
      await pool.query('UPDATE users SET is_admin = false, admin_cargo = NULL, updated_at = NOW() WHERE id = $1', [id]);
      await audit(req, 'admin:retirar', { user_id: id, nome: alvo.discord_username || alvo.roblox_username });
      return res.json({ ok: true, cargo: null });
    }

    if (!perm.podeDarCargo(req.user, cargo)) {
      return res.status(403).json({ error: 'Você não pode conceder o cargo ' + ((perm.CARGOS[cargo] || {}).nome || cargo) });
    }
    if (String(alvo.discord_id).startsWith('roblox_')) {
      return res.status(400).json({ error: 'Esse usuário ainda não entrou com Discord; não pode ser admin' });
    }

    await pool.query('UPDATE users SET is_admin = true, admin_cargo = $1, updated_at = NOW() WHERE id = $2', [cargo, id]);
    await audit(req, 'admin:cargo', { user_id: id, nome: alvo.discord_username || alvo.roblox_username, de: perm.cargoDe(alvo), para: cargo });
    res.json({ ok: true, cargo });
  } catch (err) {
    console.error('users/cargo:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
}

router.post('/users/:id/cargo', requirePoder('admins'), (req, res) =>
  definirCargo(req, res, parseInt(req.params.id), req.body && req.body.cargo));

// Compatibilidade: o toggle antigo (value true/false) continua respondendo, pra
// quem estiver com a pagina velha aberta. Conceder por aqui da o cargo mais
// baixo — nunca dono.
router.post('/users/:id/admin', requirePoder('admins'), (req, res) =>
  definirCargo(req, res, parseInt(req.params.id), (req.body && req.body.value) ? 'moderador' : null));

// ------------------------------------------------------------
// Cargo em corporação (atalho do painel): user_id + corp_id + rank_id
// ------------------------------------------------------------
router.get('/corps', requirePoder('corp'), async (req, res) => {
  try {
    const corps = await pool.query('SELECT id, name, slug FROM corporations WHERE is_active = true ORDER BY name');
    const ranks = await pool.query('SELECT id, corporation_id, name, level FROM ranks ORDER BY corporation_id, level DESC');
    res.json({ corps: corps.rows, ranks: ranks.rows });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

router.post('/cargo', requirePoder('corp'), async (req, res) => {
  try {
    const user_id = parseInt(req.body.user_id), corp_id = parseInt(req.body.corp_id);
    const rank_id = req.body.rank_id ? parseInt(req.body.rank_id) : null;
    if (!user_id || !corp_id) return res.status(400).json({ error: 'user_id e corp_id são obrigatórios' });
    if (rank_id) {
      const rk = await pool.query('SELECT 1 FROM ranks WHERE id = $1 AND corporation_id = $2', [rank_id, corp_id]);
      if (rk.rows.length === 0) return res.status(400).json({ error: 'Cargo não pertence a essa corporação' });
    }
    if (req.body.remover) {
      await pool.query('DELETE FROM members WHERE user_id = $1 AND corporation_id = $2', [user_id, corp_id]);
    } else {
      await pool.query(
        `INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1, $2, $3)
         ON CONFLICT (corporation_id, user_id) DO UPDATE SET rank_id = EXCLUDED.rank_id`,
        [corp_id, user_id, rank_id]);
    }
    await audit(req, req.body.remover ? 'cargo:remover' : 'cargo:definir', { user_id, corp_id, rank_id });
    res.json({ ok: true });
  } catch (err) {
    console.error('cargo:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ------------------------------------------------------------
// REGISTRO — todo mundo que já passou pelo servidor (online ou não)
// ------------------------------------------------------------
async function idsOnline() {
  const s = await pool.query(`SELECT players FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds'`);
  const set = new Set();
  for (const row of s.rows) for (const p of (row.players || [])) { const n = Number(p.userId); if (n) set.add(n); }
  return set;
}

router.get('/registro', requirePoder('ver_registro'), async (req, res) => {
  try {
    const q = str(req.query.q, 64);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 500, 1), 2000);
    const params = [];
    let where = '';
    if (q) { params.push('%' + q + '%'); where = 'WHERE nome ILIKE $1 OR CAST(roblox_id AS TEXT) LIKE $1'; }
    params.push(limit);
    const r = await pool.query(
      `SELECT roblox_id, nome, primeira_vez, ultima_vez, visitas FROM game_players
       ${where} ORDER BY ultima_vez DESC NULLS LAST LIMIT $${params.length}`, params);
    const fila = await pool.query(`SELECT roblox_id, COUNT(*)::int AS n, COALESCE(SUM(qtd),0)::int AS itens FROM game_item_fila WHERE entregue_em IS NULL GROUP BY roblox_id`);
    const pend = {};
    for (const f of fila.rows) pend[f.roblox_id] = { n: f.n, itens: f.itens };
    const online = await idsOnline();
    const total = await pool.query(`SELECT COUNT(*)::int AS n FROM game_players`);
    res.json({
      total: total.rows[0].n,
      mostrando: r.rows.length,
      players: r.rows.map(p => ({
        roblox_id: p.roblox_id, nome: p.nome, primeira_vez: p.primeira_vez, ultima_vez: p.ultima_vez, visitas: p.visitas,
        online: online.has(Number(p.roblox_id)),
        fila: pend[p.roblox_id] || null,
      })),
    });
  } catch (err) { console.error('registro:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// Dar item pra um jogador do registro. Online = na hora; offline = entra na fila.
router.post('/registro/item', requirePoder('item'), async (req, res) => {
  try {
    const roblox_id = num(req.body.roblox_id, 1);
    const item = str(req.body.item, 64);
    const qtd = num(req.body.qtd, 1, 99) || 1;
    if (!roblox_id) return res.status(400).json({ error: 'roblox_id inválido' });
    if (!item) return res.status(400).json({ error: 'Escolha um item' });
    const servers = await pool.query(`SELECT job_id, players FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds'`);
    let jobId = null, nome = null;
    for (const s of servers.rows) for (const p of (s.players || [])) {
      if (Number(p.userId) === Number(roblox_id)) { jobId = s.job_id; nome = p.name; }
    }
    if (jobId) {
      const r = await pool.query(
        'INSERT INTO game_commands (tipo, target_roblox_id, target_name, payload, job_id, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
        ['item_add', roblox_id, nome, JSON.stringify({ item, qtd }), jobId, req.user.id]);
      await audit(req, 'registro:item', { roblox_id, item, qtd, modo: 'online' });
      return res.json({ ok: true, modo: 'online', id: r.rows[0].id });
    }
    await pool.query('INSERT INTO game_item_fila (roblox_id, item, qtd, criado_por) VALUES ($1,$2,$3,$4)', [roblox_id, item, qtd, req.user.id]);
    await audit(req, 'registro:item', { roblox_id, item, qtd, modo: 'fila' });
    res.json({ ok: true, modo: 'fila' });
  } catch (err) { console.error('registro/item:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// Apagar registro(s): aceita um só (roblox_id) ou vários (roblox_ids: [...])
//
// [CONSERTO 19/09 — "apagar jogadores não funciona"]
// Causa medida, e eram DUAS, as duas ressuscitando o jogador:
//   1. O BACKFILL DO BOOT (src/index.js) repovoa game_players a partir de
//      game_logs tipo 'entrou'. Apagar só o game_players não adiantava nada:
//      no próximo deploy/restart do Railway todo mundo voltava, com visitas e
//      datas. Agora o apagar leva junto os logs do jogador.
//   2. O HEARTBEAT (routes/game-api.js) faz INSERT ... ON CONFLICT com quem
//      está online. Quem está dentro do servidor AGORA volta em segundos, e
//      isso é correto — ele está lá. Por isso a resposta devolve quantos dos
//      apagados estavam online, pro painel avisar em vez de mentir.
// Leva junto: fila de itens (inclusive as já entregues, que ficavam órfãs),
// comandos pendentes e o aparelho de celular do jogador.
router.post('/registro/apagar', requirePoder('registro'), async (req, res) => {
  const cli = await pool.connect();
  try {
    let ids = req.body && req.body.roblox_ids;
    if (!Array.isArray(ids)) ids = (req.body && req.body.roblox_id != null) ? [req.body.roblox_id] : [];
    ids = ids.map(Number).filter(n => Number.isFinite(n) && n > 0).slice(0, 1000);
    if (!ids.length) return res.status(400).json({ error: 'Nenhum jogador selecionado' });

    const online = await idsOnline();
    const aindaOnline = ids.filter(i => online.has(i));

    await cli.query('BEGIN');
    await cli.query('DELETE FROM game_item_fila WHERE roblox_id = ANY($1)', [ids]);
    await cli.query(`DELETE FROM game_commands WHERE target_roblox_id = ANY($1) AND status = 'pending'`, [ids]);
    // os logs SÃO a fonte do backfill: sem apagar isto, o jogador volta no boot
    const lg = await cli.query(`DELETE FROM game_logs WHERE (detalhe->>'userId') ~ '^[0-9]+$' AND (detalhe->>'userId')::bigint = ANY($1)`, [ids]);
    // celular do jogador (aparelho, histórico de posse e posts da deepweb)
    let aparelhos = 0;
    try {
      const ap = await cli.query('DELETE FROM aparelhos WHERE dono_roblox_id = ANY($1)', [ids]);
      aparelhos = ap.rowCount;
      await cli.query('DELETE FROM aparelho_donos WHERE de_roblox_id = ANY($1) OR para_roblox_id = ANY($1)', [ids]);
      await cli.query('DELETE FROM deepweb_posts WHERE autor_roblox_id = ANY($1)', [ids]);
    } catch (e) { /* base antiga sem as tabelas do celular: segue */ }
    const r = await cli.query('DELETE FROM game_players WHERE roblox_id = ANY($1)', [ids]);
    await cli.query('COMMIT');

    await audit(req, 'registro:apagar', { quantidade: ids.length, apagados: r.rowCount, logs: lg.rowCount, aparelhos, online: aindaOnline.length });
    res.json({ ok: true, apagados: r.rowCount, logs: lg.rowCount, aparelhos, online: aindaOnline.length });
  } catch (err) {
    try { await cli.query('ROLLBACK'); } catch (e) {}
    console.error('registro/apagar:', err.message);
    res.status(500).json({ error: 'Erro interno: ' + err.message });
  } finally { cli.release(); }
});

// WIPE GERAL — apaga TODO o registro escrito do jogo (jogadores + fila de itens + logs). Para temporadas/wipe.
// Exige body.confirm === 'WIPE' pra evitar acidente. NAO mexe em corporacoes/usuarios/cargos.
// OBS: NAO apaga o save do jogador (dinheiro/inventario) — isso fica no DataStore do Roblox, resetado pelo jogo.
// ===========================================================================
// WIPE GERAL — reset de TEMPORADA
//
// Julio, 19/09: "o wipe deve deletar tudo de TODO MUNDO, não só quem tá online,
// deve apagar o banco de dados por completo in game, zerar tudo; só não deve
// tocar nos cargos de corp, isso mantém após wipe; e quem tiver no servidor na
// hora deve ser derrubado".
//
// O PULO DO GATO: o save de verdade (dinheiro, inventário, casa, carro) NÃO
// mora aqui. Mora no DataStore do Roblox, numa loja do ProfileService chamada
// "CBRP_V1.2". O site não alcança aquilo, e apagar save por save de milhares de
// jogadores offline é inviável. Então o wipe não apaga saves: ele VIRA A
// TEMPORADA. Incrementa game_config.temporada, o jogo passa a usar a loja
// "CBRP_V1.2_T2", e TODO MUNDO — online, offline, quem sumiu faz meses — nasce
// zerado no próximo login, de uma vez. O save antigo fica intacto na loja
// antiga, então um wipe por engano se desfaz baixando o número de volta.
//
// O que ele apaga aqui no banco do site: registro, fila de itens, logs,
// comandos, auditoria, celular (aparelhos, posse, contatos, mensagens) e
// deepweb. Ou seja, todo o rastro in-game.
//
// O que ele NUNCA toca: corporações, cargos e membros (pedido explícito dele),
// e os usuários/admins do site — apagar isso derrubaria o acesso dele junto.
//
// Quem está no servidor na hora: um comando 'wipe' por servidor ativo, e o jogo
// derruba todo mundo. Não precisa bloquear o save de saída: quando eles saem, o
// perfil é gravado na loja ANTIGA, que ninguém mais vai ler.
//
// Tudo numa transação: ou apaga tudo, ou não apaga nada.
// ===========================================================================
router.post('/registro/wipe', requirePoder('wipe'), async (req, res) => {
  const cli = await pool.connect();
  try {
    if ((req.body && req.body.confirm) !== 'WIPE') return res.status(400).json({ error: 'Confirmação inválida (digite WIPE)' });

    const conta = {};
    await cli.query('BEGIN');

    const del = async (nome, sql) => {
      try { const r = await cli.query(sql); conta[nome] = r.rowCount; }
      catch (e) {
        if (e.code === '42P01') { conta[nome] = null; }   // tabela não existe nesta base: segue
        else throw e;
      }
    };

    // --- todo o rastro in-game ---
    await del('jogadores', 'DELETE FROM game_players');
    await del('fila',      'DELETE FROM game_item_fila');
    await del('logs',      'DELETE FROM game_logs');
    await del('comandos',  'DELETE FROM game_commands');
    await del('aparelhos', 'DELETE FROM aparelhos');
    await del('posse',     'DELETE FROM aparelho_donos');
    await del('contatos',  'DELETE FROM celular_contatos');
    await del('mensagens', 'DELETE FROM celular_mensagens');
    await del('deepweb',   'DELETE FROM deepweb_posts');
    await del('auditoria', 'DELETE FROM admin_audit');

    // --- TEMPORADA NOVA: é isto que zera o save de TODO MUNDO, online ou não ---
    const t = await cli.query(`SELECT value FROM game_config WHERE key = 'temporada' FOR UPDATE`);
    const atual = Math.max(1, parseInt(t.rows[0] && t.rows[0].value && t.rows[0].value.n) || 1);
    const nova = atual + 1;
    const agora = new Date().toISOString();
    await cli.query(
      `INSERT INTO game_config (key, value, updated_at) VALUES ('temporada', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify({ n: nova, em: agora, por: req.user.id })]);
    await cli.query(
      `INSERT INTO game_config (key, value, updated_at) VALUES ('wipe_em', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [JSON.stringify({ em: agora, por: req.user.id, temporada: nova })]);

    // --- derruba quem está dentro: um comando por servidor ativo ---
    // Vai DEPOIS do DELETE de game_commands, senão ele apagaria estes.
    const servers = await cli.query(`SELECT job_id, players FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds'`);
    let derrubados = 0;
    for (const sv of servers.rows) {
      derrubados += (sv.players || []).length;
      await cli.query(
        'INSERT INTO game_commands (tipo, payload, job_id, created_by) VALUES ($1,$2,$3,$4)',
        ['wipe', JSON.stringify({ temporada: nova, motivo: 'Temporada nova — o servidor foi zerado.' }), sv.job_id, req.user.id]);
    }
    conta.temporada = nova;
    conta.servidores = servers.rows.length;
    conta.derrubados = derrubados;

    await cli.query('COMMIT');

    // a auditoria do próprio wipe entra DEPOIS do commit, senão ela mesma some
    await audit(req, 'registro:wipe', conta);
    res.json(Object.assign({ ok: true }, conta));
  } catch (err) {
    try { await cli.query('ROLLBACK'); } catch (e) {}
    console.error('registro/wipe:', err.message);
    res.status(500).json({ error: 'Wipe abortado, nada foi apagado: ' + err.message });
  } finally { cli.release(); }
});

// DAR PRA TODOS — item ou carro geral pra todo mundo.
// tipo: 'item_add' (item + qtd) ou 'carro_add' (carro). Manda um comando por jogador ONLINE em cada servidor.
// item + offline:true tambem enfileira (game_item_fila) pra quem esta no registro e nao esta online (pega no proximo login).
// carro so vai pros online (nao existe fila de carro; offline precisaria de peca no jogo).
router.post('/registro/dar-todos', requirePoder('item_todos'), async (req, res) => {
  try {
    const tipo = req.body && req.body.tipo;
    if (tipo !== 'item_add' && tipo !== 'carro_add') return res.status(400).json({ error: 'tipo inválido' });
    let payload;
    if (tipo === 'item_add') {
      payload = { item: str(req.body.item, 64), qtd: num(req.body.qtd, 1, 99) || 1 };
      if (!payload.item) return res.status(400).json({ error: 'Escolha um item' });
    } else {
      payload = { carro: str(req.body.carro, 64) };
      if (!payload.carro) return res.status(400).json({ error: 'Escolha um carro' });
    }
    const offline = tipo === 'item_add' && !!(req.body && req.body.offline);

    // ONLINE: um comando por jogador em cada servidor ativo
    const servers = await pool.query(`SELECT job_id, players FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds'`);
    let online = 0; const onlineIds = new Set();
    for (const s of servers.rows) {
      for (const p of (s.players || [])) {
        const rid = Number(p.userId); if (!rid) continue;
        onlineIds.add(rid);
        await pool.query(
          'INSERT INTO game_commands (tipo, target_roblox_id, target_name, payload, job_id, created_by) VALUES ($1,$2,$3,$4,$5,$6)',
          [tipo, rid, p.name || null, JSON.stringify(payload), s.job_id, req.user.id]);
        online++;
      }
    }

    // OFFLINE (só item): fila pra todo mundo do registro que não está online
    let fila = 0;
    if (offline) {
      const r = await pool.query(
        `INSERT INTO game_item_fila (roblox_id, item, qtd, criado_por)
         SELECT gp.roblox_id, $1, $2, $3 FROM game_players gp
         WHERE gp.roblox_id <> ALL($4::bigint[])`,
        [payload.item, payload.qtd, req.user.id, Array.from(onlineIds)]);
      fila = r.rowCount;
    }

    await audit(req, 'dar-todos:' + tipo, { payload, online, fila });
    res.json({ ok: true, online, fila });
  } catch (err) { console.error('registro/dar-todos:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

module.exports = router;
