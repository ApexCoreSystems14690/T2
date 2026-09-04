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

module.exports = router;
