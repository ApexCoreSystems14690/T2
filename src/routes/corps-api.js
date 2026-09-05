const router = require('express').Router();
const pool = require('../db/pool');
const multer = require('multer');
const { requireAuth, requireCorpOwner, requireAdmin } = require('../middleware/auth');

// Upload config — armazena em memória (vai pro banco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// GET /api/corps/:corpId/icon — servir imagem da corp (público)
router.get('/:corpId/icon', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT icon_data, icon_mime FROM corporations WHERE id = $1 AND icon_data IS NOT NULL',
      [req.params.corpId]
    );
    if (result.rows.length === 0) return res.status(404).send('Sem imagem');
    res.set('Content-Type', result.rows[0].icon_mime);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(result.rows[0].icon_data);
  } catch (err) {
    res.status(500).send('Erro');
  }
});

// Todas as rotas precisam de login
router.use(requireAuth);

// GET /api/corps — listar corporações do usuário (que ele é dono)
router.get('/', async (req, res) => {
  try {
    const result = req.user.is_admin
      ? await pool.query(
          `SELECT c.*, (SELECT COUNT(*) FROM members WHERE corporation_id = c.id) as member_count
           FROM corporations c ORDER BY c.name`)
      : await pool.query(
          `SELECT c.*, (SELECT COUNT(*) FROM members WHERE corporation_id = c.id) as member_count
           FROM corporations c WHERE c.owner_id = $1 ORDER BY c.name`,
          [req.user.id]);
    res.json({ corporations: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/corps/users/list — todos os usuários registrados na plataforma (pro seletor de membros)
// Precisa estar logado; só quem gerencia alguma corporação (ou admin) enxerga.
router.get('/users/list', async (req, res) => {
  try {
    if (!req.user.is_admin) {
      const gerencia = await pool.query(
        `SELECT 1 FROM corporations WHERE owner_id = $1
         UNION SELECT 1 FROM corp_managers WHERE user_id = $1
         UNION SELECT 1 FROM members m JOIN ranks r ON m.rank_id = r.id
           WHERE m.user_id = $1
           AND (SELECT COUNT(DISTINCT r2.level) FROM ranks r2 WHERE r2.corporation_id = m.corporation_id AND r2.level > r.level) < 2
         LIMIT 1`,
        [req.user.id]
      );
      if (gerencia.rows.length === 0) return res.status(403).json({ error: 'Acesso negado' });
    }
    const result = await pool.query(
      `SELECT id, discord_username, discord_avatar, discord_id, roblox_id, roblox_username, is_admin,
              (discord_id LIKE 'roblox_%') AS is_placeholder
       FROM users
       ORDER BY (discord_id LIKE 'roblox_%') ASC, LOWER(COALESCE(discord_username, roblox_username, '')) ASC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('users/list:', err.message);
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

// PUT /api/corps/:corpId — editar configurações da corporação
router.put('/:corpId', requireCorpOwner, async (req, res) => {
  try {
    const { name, description, icon_url, color, max_members } = req.body;
    // Se mandou uma URL, limpa a imagem do banco
    const extraCols = icon_url ? ', icon_data = NULL, icon_mime = NULL' : '';
    const result = await pool.query(
      `UPDATE corporations SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        icon_url = $3,
        color = COALESCE($4, color),
        max_members = COALESCE($5, max_members),
        updated_at = NOW()
        ${extraCols}
       WHERE id = $6 AND ($8::boolean OR owner_id = $7 OR id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $7)) RETURNING *`,
      [name || null, description || null, icon_url || null, color || null,
       max_members ? parseInt(max_members) : null, req.params.corpId, req.user.id, !!req.user.is_admin]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Corporação não encontrada' });
    res.json({ corporation: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/corps/:corpId/icon — upload de imagem da corp
router.post('/:corpId/icon', requireCorpOwner, upload.single('icon'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie uma imagem (PNG, JPG, GIF ou WebP, máx 2MB)' });
    const result = await pool.query(
      'UPDATE corporations SET icon_data = $1, icon_mime = $2, icon_url = NULL, updated_at = NOW() WHERE id = $3 RETURNING id',
      [req.file.buffer, req.file.mimetype, req.params.corpId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Corporação não encontrada' });
    res.json({ ok: true, icon_url: '/api/corps/' + req.params.corpId + '/icon' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar imagem' });
  }
});

// DELETE /api/corps/:corpId/icon — remover imagem da corp
router.delete('/:corpId/icon', requireCorpOwner, async (req, res) => {
  try {
    await pool.query(
      'UPDATE corporations SET icon_data = NULL, icon_mime = NULL, icon_url = NULL, updated_at = NOW() WHERE id = $1',
      [req.params.corpId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover imagem' });
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

// Busca o username no Roblox a partir do ID (melhor esforço)
async function fetchRobloxUsername(robloxId) {
  try {
    const r = await fetch('https://users.roblox.com/v1/users/' + robloxId);
    if (!r.ok) return null;
    const j = await r.json();
    return j.name || null;
  } catch (e) { return null; }
}

// POST /api/corps/:corpId/members — adicionar membro
// Aceita { user_id } (usuário registrado, escolhido no seletor) OU { roblox_id, roblox_username } (fallback)
router.post('/:corpId/members', requireCorpOwner, async (req, res) => {
  try {
    const { user_id, roblox_id, roblox_username, rank_id } = req.body;

    let user;
    if (user_id) {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [parseInt(user_id)]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
      user = result.rows[0];
    } else if (roblox_id) {
      const rid = parseInt(roblox_id);
      if (!rid) return res.status(400).json({ error: 'Roblox ID inválido' });
      let result = await pool.query('SELECT * FROM users WHERE roblox_id = $1', [rid]);
      if (result.rows.length === 0) {
        const nome = roblox_username || await fetchRobloxUsername(rid);
        // Usuário placeholder (sem Discord ainda). Quando a pessoa vincular o Roblox, é mesclado.
        result = await pool.query(
          'INSERT INTO users (discord_id, roblox_id, roblox_username) VALUES ($1, $2, $3) RETURNING *',
          [`roblox_${rid}`, rid, nome]
        );
      }
      user = result.rows[0];
    } else {
      return res.status(400).json({ error: 'Selecione um usuário' });
    }

    // Quem é apenas alto cargo não pode adicionar alguém com cargo >= ao seu
    if (req.isHighRank && rank_id) {
      const newRank = await pool.query('SELECT level FROM ranks WHERE id = $1 AND corporation_id = $2', [rank_id, req.params.corpId]);
      if (newRank.rows.length > 0 && newRank.rows[0].level >= req.userRankLevel) {
        return res.status(403).json({ error: 'Você não pode atribuir um cargo igual ou superior ao seu' });
      }
    }

    // Limite de membros
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM members WHERE corporation_id = $1', [req.params.corpId]);
    if (req.corporation && req.corporation.max_members && count.rows[0].n >= req.corporation.max_members) {
      return res.status(400).json({ error: 'A corporação atingiu o máximo de membros' });
    }

    const member = await pool.query(
      'INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1, $2, $3) RETURNING *',
      [req.params.corpId, user.id, rank_id || null]
    );

    res.json({ member: member.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Jogador já é membro desta corporação' });
    }
    console.error('add member:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/corps/:corpId/members/:memberId — alterar cargo de um membro
router.put('/:corpId/members/:memberId', requireCorpOwner, async (req, res) => {
  try {
    const { rank_id } = req.body;
    // Se é highRank, não pode editar membro com cargo >= ao seu
    if (req.isHighRank) {
      const target = await pool.query(
        `SELECT r.level FROM members m LEFT JOIN ranks r ON m.rank_id = r.id
         WHERE m.id = $1 AND m.corporation_id = $2`,
        [req.params.memberId, req.params.corpId]
      );
      if (target.rows.length > 0 && target.rows[0].level >= req.userRankLevel) {
        return res.status(403).json({ error: 'Você não pode alterar o cargo de alguém com cargo igual ou superior ao seu' });
      }
      // Também não pode dar um cargo >= ao seu
      if (rank_id) {
        const newRank = await pool.query('SELECT level FROM ranks WHERE id = $1 AND corporation_id = $2', [rank_id, req.params.corpId]);
        if (newRank.rows.length > 0 && newRank.rows[0].level >= req.userRankLevel) {
          return res.status(403).json({ error: 'Você não pode atribuir um cargo igual ou superior ao seu' });
        }
      }
    }
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
    // Se é highRank, não pode remover membro com cargo >= ao seu
    if (req.isHighRank) {
      const target = await pool.query(
        `SELECT r.level FROM members m LEFT JOIN ranks r ON m.rank_id = r.id
         WHERE m.id = $1 AND m.corporation_id = $2`,
        [req.params.memberId, req.params.corpId]
      );
      if (target.rows.length > 0 && target.rows[0].level >= req.userRankLevel) {
        return res.status(403).json({ error: 'Você não pode remover alguém com cargo igual ou superior ao seu' });
      }
    }
    await pool.query(
      'DELETE FROM members WHERE id = $1 AND corporation_id = $2',
      [req.params.memberId, req.params.corpId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/corps/:corpId — excluir corporação (somente dono)
router.delete('/:corpId', requireCorpOwner, async (req, res) => {
  try {
    if (!req.isOwner) {
      return res.status(403).json({ error: 'Apenas o dono pode excluir a corporação' });
    }
    await pool.query('DELETE FROM corporations WHERE id = $1', [req.params.corpId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/corps/:corpId/managers — listar co-gerentes
router.get('/:corpId/managers', requireCorpOwner, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cm.id, cm.added_at, u.id as user_id, u.discord_username, u.roblox_username, u.roblox_id
       FROM corp_managers cm JOIN users u ON cm.user_id = u.id
       WHERE cm.corporation_id = $1 ORDER BY cm.added_at`,
      [req.params.corpId]
    );
    res.json({ managers: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/corps/:corpId/managers — adicionar co-gerente (só dono)
router.post('/:corpId/managers', requireCorpOwner, async (req, res) => {
  try {
    if (!req.isOwner) return res.status(403).json({ error: 'Apenas o dono pode gerenciar co-gerentes' });
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id é obrigatório' });
    const result = await pool.query(
      'INSERT INTO corp_managers (corporation_id, user_id) VALUES ($1, $2) RETURNING *',
      [req.params.corpId, user_id]
    );
    res.json({ manager: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Usuário já é co-gerente' });
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/corps/:corpId/managers/:managerId — remover co-gerente (só dono)
router.delete('/:corpId/managers/:managerId', requireCorpOwner, async (req, res) => {
  try {
    if (!req.isOwner) return res.status(403).json({ error: 'Apenas o dono pode gerenciar co-gerentes' });
    await pool.query(
      'DELETE FROM corp_managers WHERE id = $1 AND corporation_id = $2',
      [req.params.managerId, req.params.corpId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/corps — criar corporação (SOMENTE admin)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, slug, description, color, icon_url, max_members } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'Nome e slug são obrigatórios' });
    }
    // Slug deve ser lowercase e sem espaços
    const cleanSlug = slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const result = await pool.query(
      `INSERT INTO corporations (name, slug, description, owner_id, color, icon_url, max_members)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, cleanSlug, description || null, req.user.id, color || '#3B82F6', icon_url || null, max_members || 100]
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
