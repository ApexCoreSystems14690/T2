// Verifica se o usuário está logado (para rotas do dashboard)
function requireAuth(req, res, next) {
  if (req.user) return next();
  res.redirect('/auth/discord');
}

// Verifica API key do Roblox (para rotas da game API)
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apikey;
  if (!key || key !== process.env.ROBLOX_API_KEY) {
    return res.status(401).json({ error: 'API key inválida' });
  }
  next();
}

// Verifica se o usuário é dono ou co-gerente da corporação
async function requireCorpOwner(req, res, next) {
  const pool = require('../db/pool');
  const corpId = req.params.corpId || req.body.corporation_id;

  try {
    // Primeiro tenta como dono
    let result = await pool.query(
      'SELECT * FROM corporations WHERE id = $1 AND owner_id = $2',
      [corpId, req.user.id]
    );
    if (result.rows.length > 0) {
      req.corporation = result.rows[0];
      req.isOwner = true;
      return next();
    }
    // Depois tenta como co-gerente
    const mgr = await pool.query(
      'SELECT c.* FROM corporations c JOIN corp_managers cm ON cm.corporation_id = c.id WHERE c.id = $1 AND cm.user_id = $2',
      [corpId, req.user.id]
    );
    if (mgr.rows.length > 0) {
      req.corporation = mgr.rows[0];
      req.isOwner = false;
      return next();
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
