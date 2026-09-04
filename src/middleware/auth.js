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

// Verifica se o usuário é dono da corporação
async function requireCorpOwner(req, res, next) {
  const pool = require('../db/pool');
  const corpId = req.params.corpId || req.body.corporation_id;

  try {
    const result = await pool.query(
      'SELECT * FROM corporations WHERE id = $1 AND owner_id = $2',
      [corpId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Você não é dono desta corporação' });
    }
    req.corporation = result.rows[0];
    next();
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
