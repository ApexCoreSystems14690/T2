// Verifica se o usuário está logado (para rotas do dashboard)
function requireAuth(req, res, next) {
  if (req.user) return next();
  res.redirect('/auth/discord');
}

// Verifica API key do Roblox (para rotas da game API)
function requireApiKey(req, res, next) {
  // Ignora espaços/quebras de linha dos dois lados: um paste com quebra a cada
  // 30 caracteres no Railway (já aconteceu) não pode derrubar o jogo inteiro.
  const clean = v => String(v || '').replace(/\s+/g, '');
  const key = clean(req.headers['x-api-key'] || req.query.apikey);
  const expected = clean(process.env.ROBLOX_API_KEY);
  if (!expected) {
    console.error('[game-api] ROBLOX_API_KEY não configurada no ambiente');
    return res.status(500).json({ error: 'API key não configurada no servidor' });
  }
  if (!key || key !== expected) {
    return res.status(401).json({ error: 'API key inválida' });
  }
  next();
}

// Verifica se o usuário é dono, co-gerente ou top 2 cargos da corporação
async function requireCorpOwner(req, res, next) {
  const pool = require('../db/pool');
  const corpId = req.params.corpId || req.body.corporation_id;

  try {
    // 0. Admin global tem acesso total a qualquer corporação
    if (req.user && req.user.is_admin) {
      const adm = await pool.query('SELECT * FROM corporations WHERE id = $1', [corpId]);
      if (adm.rows.length === 0) return res.status(404).json({ error: 'Corporação não encontrada' });
      req.corporation = adm.rows[0];
      req.isOwner = true;
      req.isHighRank = false;
      req.userRankLevel = Infinity;
      return next();
    }

    // 1. Tenta como dono
    let result = await pool.query(
      'SELECT * FROM corporations WHERE id = $1 AND owner_id = $2',
      [corpId, req.user.id]
    );
    if (result.rows.length > 0) {
      req.corporation = result.rows[0];
      req.isOwner = true;
      req.isHighRank = false;
      req.userRankLevel = Infinity;
      return next();
    }

    // 2. Tenta como co-gerente
    const mgr = await pool.query(
      'SELECT c.* FROM corporations c JOIN corp_managers cm ON cm.corporation_id = c.id WHERE c.id = $1 AND cm.user_id = $2',
      [corpId, req.user.id]
    );
    if (mgr.rows.length > 0) {
      req.corporation = mgr.rows[0];
      req.isOwner = false;
      req.isHighRank = false;
      req.userRankLevel = Infinity;
      return next();
    }

    // 3. Tenta como membro com top 2 cargos
    // Busca os 2 maiores níveis de cargo da corp
    const topRanks = await pool.query(
      'SELECT level FROM ranks WHERE corporation_id = $1 ORDER BY level DESC LIMIT 2',
      [corpId]
    );
    if (topRanks.rows.length > 0) {
      const topLevels = topRanks.rows.map(r => r.level);
      // Verifica se o usuário é membro com um desses cargos
      const memberCheck = await pool.query(
        `SELECT m.*, r.level as rank_level, c.*
         FROM members m
         JOIN ranks r ON m.rank_id = r.id
         JOIN corporations c ON m.corporation_id = c.id
         WHERE m.corporation_id = $1 AND m.user_id = $2 AND r.level = ANY($3)`,
        [corpId, req.user.id, topLevels]
      );
      if (memberCheck.rows.length > 0) {
        req.corporation = memberCheck.rows[0];
        req.isOwner = false;
        req.isHighRank = true;
        req.userRankLevel = memberCheck.rows[0].rank_level;
        return next();
      }
    }

    return res.status(403).json({ error: 'Você não tem acesso a esta corporação' });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
}

// Verifica se é admin global
function requireAdmin(req, res, next) {
  if (req.user && req.user.is_admin) return next();
  res.status(403).json({ error: 'Acesso negado' });
}

module.exports = { requireAuth, requireApiKey, requireCorpOwner, requireAdmin };
