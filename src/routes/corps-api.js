const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, requireCorpOwner, requireAdmin } = require('../middleware/auth');

// Todas as rotas precisam de login
router.use(requireAuth);

// GET /api/corps — listar corporações do usuário (que ele é dono)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, (SELECT COUNT(*) FROM members WHERE corporation_id = c.id) as member_count
       FROM corporations c WHERE c.owner_id = $1 ORDER BY c.name`,
      [req.user.id]
    );
    res.json({ corporations: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/corps/:corpId — detalhes de uma corporação
router.get('/:corpId', requireCorpOwner, async (req, res) => {
  try {
    const ranks = await pool.query(
      'SELECT * FROM ranks WHERE corporation_id = $1 ORDER BY level DESC',
      [req.params.corpId]
    );
    const members = await pool.query(`
      SELECT m.*, u.discord_username, u.roblox_id, u.roblox_username, r.name as rank_name, r.level as rank_level
      FROM members m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN ranks r ON m.rank_id = r.id
      WHERE m.corporation_id = $1
      ORDER BY r.level DESC NULLS LAST
    `, [req.params.corpId]);

    res.json({
      corporation: req.corporation,
      ranks: ranks.rows,
      members: members.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/corps/:corpId/ranks — criar cargo
router.post('/:corpId/ranks', requireCorpOwner, async (req, res) => {
  try {
    const { name, level, salary } = req.body;
    if (!name || level === undefined) {
      return res.status(400).json({ error: 'Nome e nível são obrigatórios' });
    }
    const result = await pool.query(
      'INSERT INTO ranks (corporation_id, name, level, salary) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.corpId, name, parseInt(level), parseInt(salary) || 0]
    );
    res.json({ rank: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Cargo com esse nome ou nível já existe' });
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/corps/:corpId/ranks/:rankId — editar cargo
router.put('/:corpId/ranks/:rankId', requireCorpOwner, async (req, res) => {
  try {
    const { name, level, salary } = req.body;
    const result = await pool.query(
      `UPDATE ranks SET name = COALESCE($1, name), level = COALESCE($2, level),
       salary = COALESCE($3, salary) WHERE id = $4 AND corporation_id = $5 RETURNING *`,
      [name, level !== undefined ? parseInt(level) : null, salary !== undefined ? parseInt(salary) : null,
       req.params.rankId, req.params.corpId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cargo não encontrado' });
    res.json({ rank: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/corps/:corpId/ranks/:rankId — remover cargo
router.delete('/:corpId/ranks/:rankId', requireCorpOwner, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM ranks WHERE id = $1 AND corporation_id = $2',
      [req.params.rankId, req.params.corpId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/corps/:corpId/members — adicionar membro (por roblox_id ou roblox_username)
router.post('/:corpId/members', requireCorpOwner, async (req, res) => {
  try {
    const { roblox_id, roblox_username, rank_id } = req.body;

    // Busca ou cria o usuário pelo roblox_id
    let user;
    if (roblox_id) {
      let result = await pool.query('SELECT * FROM users WHERE roblox_id = $1', [roblox_id]);
      if (result.rows.length === 0) {
        // Cria um usuário placeholder (sem Discord linkado ainda)
        result = await pool.query(
          'INSERT INTO users (discord_id, roblox_id, roblox_username) VALUES ($1, $2, $3) RETURNING *',
          [`roblox_${roblox_id}`, parseInt(roblox_id), roblox_username || null]
        );
      }
      user = result.rows[0];
    } else {
      return res.status(400).json({ error: 'roblox_id é obrigatório' });
    }

    // Adiciona como membro
    const member = await pool.query(
      'INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1, $2, $3) RETURNING *',
      [req.params.corpId, user.id, rank_id || null]
    );

    res.json({ member: member.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Jogador já é membro desta corporação' });
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/corps/:corpId/members/:memberId — alterar cargo de um membro
router.put('/:corpId/members/:memberId', requireCorpOwner, async (req, res) => {
  try {
    const { rank_id } = req.body;
    const result = await pool.query(
      'UPDATE members SET rank_id = $1 WHERE id = $2 AND corporation_id = $3 RETURNING *',
      [rank_id, req.params.memberId, req.params.corpId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Membro não encontrado' });
    res.json({ member: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/corps/:corpId/members/:memberId — remover membro
router.delete('/:corpId/members/:memberId', requireCorpOwner, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM members WHERE id = $1 AND corporation_id = $2',
      [req.params.memberId, req.params.corpId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/corps — criar corporação (qualquer usuário logado)
router.post('/', async (req, res) => {
  try {
    const { name, slug, description, color, max_members } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'Nome e slug são obrigatórios' });
    }
    // Slug deve ser lowercase e sem espaços
    const cleanSlug = slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const result = await pool.query(
      `INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, cleanSlug, description || null, req.user.id, color || '#3B82F6', max_members || 100]
    );
    res.json({ corporation: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Slug já existe' });
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
