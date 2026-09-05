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
       WHERE $2::boolean
          OR c.owner_id = $1
          OR c.id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)
          OR c.id IN (
            SELECT m.corporation_id FROM members m
            JOIN ranks r ON m.rank_id = r.id
            WHERE m.user_id = $1
            AND (SELECT COUNT(DISTINCT r2.level) FROM ranks r2 WHERE r2.corporation_id = m.corporation_id AND r2.level > r.level) < 2
          )
       ORDER BY c.name`,
      [req.user.id, !!req.user.is_admin]
    );
    res.render('dashboard', { user: req.user, corporations: corps.rows });
  } catch (err) {
    console.error('Dashboard error:', err.message, err.stack);
    res.render('error', { message: 'Erro ao carregar dashboard', user: req.user });
  }
});

// Gerenciar corporação específica
router.get('/corp/:corpId', async (req, res) => {
  try {
    const corp = await pool.query(
      `SELECT *, (icon_data IS NOT NULL) as has_icon_file FROM corporations WHERE id = $1
       AND (
         $3::boolean
         OR owner_id = $2
         OR id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $2)
         OR id IN (
           SELECT m.corporation_id FROM members m
           JOIN ranks r ON m.rank_id = r.id
           WHERE m.user_id = $2
           AND (SELECT COUNT(DISTINCT r2.level) FROM ranks r2 WHERE r2.corporation_id = m.corporation_id AND r2.level > r.level) < 2
         )
       )`,
      [req.params.corpId, req.user.id, !!req.user.is_admin]
    );
    if (corp.rows.length === 0) return res.redirect('/dashboard');

    const corpData = corp.rows[0];
    const isOwner = corpData.owner_id === req.user.id || !!req.user.is_admin;

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
    console.error('Corp manage error:', err.message, err.stack);
    res.render('error', { message: 'Erro ao carregar corporação', user: req.user });
  }
});

// Vincular Roblox ID
router.get('/link-roblox', (req, res) => {
  res.render('link-roblox', { user: req.user });
});

router.post('/link-roblox', async (req, res) => {
  const { roblox_id, roblox_username } = req.body;
  const rid = parseInt(roblox_id);
  if (!rid) return res.redirect('/dashboard/link-roblox?error=id_required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Existe outro usuário com esse Roblox ID?
    const outro = await client.query('SELECT * FROM users WHERE roblox_id = $1 AND id <> $2', [rid, req.user.id]);
    if (outro.rows.length > 0) {
      const ph = outro.rows[0];
      if (!String(ph.discord_id).startsWith('roblox_')) {
        // Conta real de outra pessoa já usa esse ID
        await client.query('ROLLBACK');
        return res.redirect('/dashboard/link-roblox?error=already_linked');
      }
      // É um "placeholder" criado quando alguém te adicionou por Roblox ID:
      // transfere tudo dele pra tua conta e apaga o placeholder.
      await client.query(
        `UPDATE members SET user_id = $1 WHERE user_id = $2
         AND corporation_id NOT IN (SELECT corporation_id FROM members WHERE user_id = $1)`,
        [req.user.id, ph.id]);
      await client.query('DELETE FROM members WHERE user_id = $1', [ph.id]);
      await client.query(
        `UPDATE corp_managers SET user_id = $1 WHERE user_id = $2
         AND corporation_id NOT IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)`,
        [req.user.id, ph.id]);
      await client.query('DELETE FROM corp_managers WHERE user_id = $1', [ph.id]);
      await client.query('UPDATE corporations SET owner_id = $1 WHERE owner_id = $2', [req.user.id, ph.id]);
      await client.query('DELETE FROM users WHERE id = $1', [ph.id]);
    }

    await client.query(
      'UPDATE users SET roblox_id = $1, roblox_username = $2, updated_at = NOW() WHERE id = $3',
      [rid, roblox_username || null, req.user.id]
    );
    await client.query('COMMIT');
    res.redirect('/dashboard');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('link-roblox:', err.message);
    if (err.code === '23505') return res.redirect('/dashboard/link-roblox?error=already_linked');
    res.redirect('/dashboard/link-roblox?error=internal');
  } finally {
    client.release();
  }
});

module.exports = router;
