const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Dashboard principal — lista corporações do usuário
router.get('/', async (req, res) => {
  try {
    const corps = await pool.query(
      `SELECT c.*, (SELECT COUNT(*) FROM members WHERE corporation_id = c.id) as member_count,
              (icon_data IS NOT NULL) as has_icon_file
       FROM corporations c
       WHERE c.owner_id = $1
          OR c.id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)
          OR c.id IN (
            SELECT m.corporation_id FROM members m
            JOIN ranks r ON m.rank_id = r.id
            WHERE m.user_id = $1
            AND (SELECT COUNT(DISTINCT r2.level) FROM ranks r2 WHERE r2.corporation_id = m.corporation_id AND r2.level > r.level) < 2
          )
       ORDER BY c.name`,
      [req.user.id]
    );
    res.render('dashboard', { user: req.user, corporations: corps.rows });
  } catch (err) {
    res.render('error', { message: 'Erro ao carregar dashboard', user: req.user });
  }
});

// Gerenciar corporação específica
router.get('/corp/:corpId', async (req, res) => {
  try {
    const corp = await pool.query(
      `SELECT *, (icon_data IS NOT NULL) as has_icon_file FROM corporations WHERE id = $1
       AND (
         owner_id = $2
         OR id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $2)
         OR id IN (
           SELECT m.corporation_id FROM members m
           JOIN ranks r ON m.rank_id = r.id
           WHERE m.user_id = $2
           AND (SELECT COUNT(DISTINCT r2.level) FROM ranks r2 WHERE r2.corporation_id = m.corporation_id AND r2.level > r.level) < 2
         )
       )`,
      [req.params.corpId, req.user.id]
    );
    if (corp.rows.length === 0) return res.redirect('/dashboard');

    const corpData = corp.rows[0];
    const isOwner = corpData.owner_id === req.user.id;

    // Checa se é co-gerente
    let isManager = false;
    if (!isOwner) {
      const mgrCheck = await pool.query(
        'SELECT 1 FROM corp_managers WHERE corporation_id = $1 AND user_id = $2',
        [req.params.corpId, req.user.id]
      );
      isManager = mgrCheck.rows.length > 0;
    }

    const isHighRank = !isOwner && !isManager; // se chegou aqui e não é dono nem co-gerente, é highRank

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
      ORDER BY r.level DESC NULLS LAST, m.joined_at ASC
    `, [req.params.corpId]);

    res.render('corp-manage', {
      user: req.user,
      corporation: corpData,
      ranks: ranks.rows,
      members: members.rows,
      isOwner,
      isHighRank,
    });
  } catch (err) {
    res.render('error', { message: 'Erro ao carregar corporação', user: req.user });
  }
});

// Vincular Roblox ID
router.get('/link-roblox', (req, res) => {
  res.render('link-roblox', { user: req.user });
});

router.post('/link-roblox', async (req, res) => {
  try {
    const { roblox_id, roblox_username } = req.body;
    if (!roblox_id) return res.redirect('/dashboard/link-roblox?error=id_required');

    await pool.query(
      'UPDATE users SET roblox_id = $1, roblox_username = $2, updated_at = NOW() WHERE id = $3',
      [parseInt(roblox_id), roblox_username || null, req.user.id]
    );
    res.redirect('/dashboard');
  } catch (err) {
    if (err.code === '23505') {
      return res.redirect('/dashboard/link-roblox?error=already_linked');
    }
    res.redirect('/dashboard/link-roblox?error=internal');
  }
});

module.exports = router;
