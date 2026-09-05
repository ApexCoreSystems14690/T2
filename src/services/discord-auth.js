const pool = require('../db/pool');

const DISCORD_API = 'https://discord.com/api/v10';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const CALLBACK_URL = process.env.DISCORD_CALLBACK_URL;

// Gera a URL de login do Discord
function getAuthURL() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    response_type: 'code',
    scope: 'identify',
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

// Troca o code por access_token
async function exchangeCode(code) {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: CALLBACK_URL,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord token error: ${res.status} ${text}`);
  }
  return res.json();
}

// Busca dados do usuário no Discord
async function getDiscordUser(accessToken) {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Discord user error: ${res.status}`);
  return res.json();
}

// Cria ou atualiza usuário no banco
async function findOrCreateUser(profile) {
  const existing = await pool.query(
    'SELECT * FROM users WHERE discord_id = $1', [profile.id]
  );

  if (existing.rows.length > 0) {
    const updated = await pool.query(
      `UPDATE users SET discord_username = $1, discord_avatar = $2, updated_at = NOW()
       WHERE discord_id = $3 RETURNING *`,
      [profile.username, profile.avatar, profile.id]
    );
    return updated.rows[0];
  }

  const newUser = await pool.query(
    `INSERT INTO users (discord_id, discord_username, discord_avatar)
     VALUES ($1, $2, $3) RETURNING *`,
    [profile.id, profile.username, profile.avatar]
  );
  return newUser.rows[0];
}

// Busca user por ID (pra sessão)
async function getUserById(id) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

// Define/remove admin global
async function setAdmin(id, value) {
  const result = await pool.query('UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [!!value, id]);
  return result.rows[0];
}

module.exports = { getAuthURL, exchangeCode, getDiscordUser, findOrCreateUser, getUserById, setAdmin };
