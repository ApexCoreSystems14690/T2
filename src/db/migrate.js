require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const migration = `
-- Usuários (vinculados via Discord)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  discord_id VARCHAR(32) UNIQUE NOT NULL,
  discord_username VARCHAR(128),
  discord_avatar VARCHAR(256),
  roblox_id BIGINT UNIQUE,
  roblox_username VARCHAR(64),
  email VARCHAR(256),
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Corporações
CREATE TABLE IF NOT EXISTS corporations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(128) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  icon_url TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  max_members INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cargos dentro de cada corporação
CREATE TABLE IF NOT EXISTS ranks (
  id SERIAL PRIMARY KEY,
  corporation_id INTEGER REFERENCES corporations(id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL,
  level INTEGER NOT NULL DEFAULT 0,
  salary INTEGER DEFAULT 0,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(corporation_id, name),
  UNIQUE(corporation_id, level)
);

-- Membros (associação jogador <-> corporação com cargo)
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  corporation_id INTEGER REFERENCES corporations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  rank_id INTEGER REFERENCES ranks(id) ON DELETE SET NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(corporation_id, user_id)
);

-- Índices para consultas rápidas do jogo
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_corp_id ON members(corporation_id);
CREATE INDEX IF NOT EXISTS idx_users_roblox_id ON users(roblox_id);
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);

-- Sessões do Express
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL,
  PRIMARY KEY (sid)
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
`;

async function run() {
  const client = await pool.connect();
  try {
    await client.query(migration);
    console.log('✅ Migração executada com sucesso!');
  } catch (err) {
    console.error('❌ Erro na migração:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
