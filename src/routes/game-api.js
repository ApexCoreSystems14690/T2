const router = require('express').Router();
const pool = require('../db/pool');
const { requireApiKey } = require('../middleware/auth');

// Todas as rotas aqui precisam da API key
router.use(requireApiKey);

// GET /api/game/player/:robloxId
// Retorna todas as corporações que o jogador pertence, com cargo e salário
// Usado pelo servidor Roblox ao invés de plr:IsInGroup()
router.get('/player/:robloxId', async (req, res) => {
  try {
    const { robloxId } = req.params;
    const result = await pool.query(`
      SELECT
        c.id as corp_id,
        c.name as corp_name,
        c.slug as corp_slug,
        r.name as rank_name,
        r.level as rank_level,
        r.salary as rank_salary,
        r.permissions as rank_permissions
      FROM members m
      JOIN corporations c ON m.corporation_id = c.id
      JOIN users u ON m.user_id = u.id
      LEFT JOIN ranks r ON m.rank_id = r.id
      WHERE u.roblox_id = $1 AND c.is_active = true
    `, [robloxId]);

    res.json({
      roblox_id: parseInt(robloxId),
      // Formato lido pelo CorpService do Roblox (data.corps[].corp_slug / rank_name / ...)
      corps: result.rows.map(row => ({
        corp_id: row.corp_id,
        corp_slug: row.corp_slug,
        corp_name: row.corp_name,
        rank_name: row.rank_name || 'Sem cargo',
        rank_level: row.rank_level || 0,
        salary: row.rank_salary || 0,
        permissions: row.rank_permissions || {},
      })),
      // Formato antigo, mantido por compatibilidade
      corporations: result.rows.map(row => ({
        id: row.corp_id,
        name: row.corp_name,
        slug: row.corp_slug,
        rank: row.rank_name || 'Sem cargo',
        rank_level: row.rank_level || 0,
        salary: row.rank_salary || 0,
        permissions: row.rank_permissions || {},
      })),
    });
  } catch (err) {
    console.error('Erro ao buscar player:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/player/:robloxId/corp/:corpSlug
// Checa se o jogador pertence a uma corporação específica
// Substitui diretamente plr:IsInGroup(groupId)
router.get('/player/:robloxId/corp/:corpSlug', async (req, res) => {
  try {
    const { robloxId, corpSlug } = req.params;
    const result = await pool.query(`
      SELECT
        c.id as corp_id,
        c.name as corp_name,
        r.name as rank_name,
        r.level as rank_level,
        r.salary as rank_salary
      FROM members m
      JOIN corporations c ON m.corporation_id = c.id
      JOIN users u ON m.user_id = u.id
      LEFT JOIN ranks r ON m.rank_id = r.id
      WHERE u.roblox_id = $1 AND c.slug = $2 AND c.is_active = true
    `, [robloxId, corpSlug]);

    if (result.rows.length === 0) {
      return res.json({ is_member: false });
    }

    const row = result.rows[0];
    res.json({
      is_member: true,
      corp_id: row.corp_id,
      corp_name: row.corp_name,
      rank: row.rank_name || 'Sem cargo',
      rank_level: row.rank_level || 0,
      salary: row.rank_salary || 0,
    });
  } catch (err) {
    console.error('Erro ao checar membro:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/corp/:corpSlug/members
// Lista todos os membros de uma corporação (para ranking boards, etc.)
router.get('/corp/:corpSlug/members', async (req, res) => {
  try {
    const { corpSlug } = req.params;
    const result = await pool.query(`
      SELECT
        u.roblox_id,
        u.roblox_username,
        u.discord_username,
        r.name as rank_name,
        r.level as rank_level,
        m.joined_at
      FROM members m
      JOIN corporations c ON m.corporation_id = c.id
      JOIN users u ON m.user_id = u.id
      LEFT JOIN ranks r ON m.rank_id = r.id
      WHERE c.slug = $1 AND c.is_active = true
      ORDER BY r.level DESC NULLS LAST, m.joined_at ASC
    `, [corpSlug]);

    res.json({
      corporation: corpSlug,
      count: result.rows.length,
      members: result.rows,
    });
  } catch (err) {
    console.error('Erro ao listar membros:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/corp/:corpSlug/ranks
// Lista todos os cargos de uma corporação (para salário, etc.)
router.get('/corp/:corpSlug/ranks', async (req, res) => {
  try {
    const { corpSlug } = req.params;
    const result = await pool.query(`
      SELECT r.name, r.level, r.salary
      FROM ranks r
      JOIN corporations c ON r.corporation_id = c.id
      WHERE c.slug = $1 AND c.is_active = true
      ORDER BY r.level DESC
    `, [corpSlug]);

    res.json({ ranks: result.rows });
  } catch (err) {
    console.error('Erro ao listar cargos:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ============================================================
// PAINEL ADMIN — endpoints usados pelo servidor do jogo (API key)
// ============================================================

// POST /api/game/heartbeat  { job_id, place_id, players: [...], catalog?: {...} }
router.post('/heartbeat', async (req, res) => {
  try {
    const { job_id, place_id, players, catalog } = req.body || {};
    if (!job_id || typeof job_id !== 'string' || job_id.length > 64) return res.status(400).json({ error: 'job_id inválido' });
    const lista = Array.isArray(players) ? players.slice(0, 200) : [];
    if (catalog && typeof catalog === 'object') {
      await pool.query(
        `INSERT INTO game_servers (job_id, place_id, players, catalog, updated_at) VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (job_id) DO UPDATE SET place_id = EXCLUDED.place_id, players = EXCLUDED.players, catalog = EXCLUDED.catalog, updated_at = NOW()`,
        [job_id, place_id ? parseInt(place_id) : null, JSON.stringify(lista), JSON.stringify(catalog)]
      );
    } else {
      await pool.query(
        `INSERT INTO game_servers (job_id, place_id, players, updated_at) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (job_id) DO UPDATE SET place_id = EXCLUDED.place_id, players = EXCLUDED.players, updated_at = NOW()`,
        [job_id, place_id ? parseInt(place_id) : null, JSON.stringify(lista)]
      );
    }
    // limpa servidores mortos (sem heartbeat há 2 min)
    await pool.query(`DELETE FROM game_servers WHERE updated_at < NOW() - INTERVAL '2 minutes'`);
    // config persistida (clima etc.) volta no heartbeat: servidor novo já nasce com o estado certo
    const cfg = await pool.query(`SELECT key, value FROM game_config`);
    const config = {};
    for (const r of cfg.rows) config[r.key] = r.value;
    res.json({ ok: true, config });
  } catch (err) {
    console.error('heartbeat:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/commands/pending?job_id=...  -> marca como 'sent' atomicamente e devolve
router.get('/commands/pending', async (req, res) => {
  try {
    const job = String(req.query.job_id || '');
    if (!job) return res.status(400).json({ error: 'job_id obrigatório' });
    const result = await pool.query(
      `UPDATE game_commands SET status = 'sent', sent_at = NOW()
       WHERE id IN (
         SELECT id FROM game_commands
         WHERE status = 'pending' AND (job_id = $1 OR job_id IS NULL)
           AND created_at > NOW() - INTERVAL '10 minutes'
         ORDER BY id ASC LIMIT 20
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, tipo, target_roblox_id, target_name, payload, job_id`,
      [job]
    );
    // comandos globais (job_id NULL) ficam marcados como sent pelo primeiro servidor que pegar;
    // pra broadcast real o painel cria um comando por servidor.
    res.json({ commands: result.rows });
  } catch (err) {
    console.error('commands/pending:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/commands/:id/result  { ok: bool, msg: string }
router.post('/commands/:id/result', async (req, res) => {
  try {
    const { ok, msg } = req.body || {};
    await pool.query(
      `UPDATE game_commands SET status = $1, result = $2, executed_at = NOW() WHERE id = $3 AND status = 'sent'`,
      [ok ? 'done' : 'error', String(msg || '').slice(0, 500), req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('commands/result:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/logs  { job_id, eventos: [{ tipo, jogador, alvo, detalhe, t }] }
router.post('/logs', async (req, res) => {
  try {
    const { job_id, eventos } = req.body || {};
    if (!Array.isArray(eventos) || eventos.length === 0) return res.json({ ok: true, n: 0 });
    const lote = eventos.slice(0, 500);
    const values = [];
    const params = [];
    let i = 1;
    for (const e of lote) {
      if (!e || typeof e.tipo !== 'string') continue;
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, to_timestamp($${i++}))`);
      params.push(
        e.tipo.slice(0, 32),
        e.jogador != null ? String(e.jogador).slice(0, 64) : null,
        e.alvo != null ? String(e.alvo).slice(0, 64) : null,
        JSON.stringify(e.detalhe && typeof e.detalhe === 'object' ? e.detalhe : {}),
        job_id ? String(job_id).slice(0, 64) : null,
        Number(e.t) || Math.floor(Date.now() / 1000)
      );
    }
    if (values.length) {
      await pool.query(`INSERT INTO game_logs (tipo, jogador, alvo, detalhe, job_id, ocorrido_em) VALUES ${values.join(',')}`, params);
    }
    res.json({ ok: true, n: values.length });
  } catch (err) {
    console.error('logs:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
