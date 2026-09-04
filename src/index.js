require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const pool = require('./db/pool');
const { getUserById } = require('./services/discord-auth');

async function start() {
  // Migrar banco ANTES de tudo
  try {
    await pool.query(`
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
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        corporation_id INTEGER REFERENCES corporations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rank_id INTEGER REFERENCES ranks(id) ON DELETE SET NULL,
        joined_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(corporation_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
      CREATE INDEX IF NOT EXISTS idx_members_corp_id ON members(corporation_id);
      CREATE INDEX IF NOT EXISTS idx_users_roblox_id ON users(roblox_id);
      CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL,
        PRIMARY KEY (sid)
      );
      CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
    `);
    console.log('✅ Banco migrado');
  } catch (err) {
    console.error('❌ Migração falhou:', err.message);
    process.exit(1);
  }

  const app = express();
  const PORT = process.env.PORT || 3000;

  // Trust Railway's proxy
  app.set('trust proxy', 1);

  // Middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));

  // Sessão com PostgreSQL
  app.use(session({
    store: new PgSession({ pool, tableName: 'session' }),
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  }));

  // Carrega user da sessão em cada request
  app.use(async (req, res, next) => {
    if (req.session.userId) {
      try {
        req.user = await getUserById(req.session.userId);
      } catch (e) {
        req.user = null;
      }
    }
    next();
  });

  // View engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Rotas
  app.use('/auth', require('./routes/auth'));
  app.use('/api/game', require('./routes/game-api'));
  app.use('/dashboard', require('./routes/dashboard'));
  app.use('/api/corps', require('./routes/corps-api'));

  // Home
  app.get('/', (req, res) => {
    res.render('home', { user: req.user || null });
  });

  // 404
  app.use((req, res) => {
    res.status(404).render('error', { message: 'Página não encontrada', user: req.user || null });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { message: 'Erro interno', user: req.user || null });
  });

  app.listen(PORT, () => {
    console.log(`🏙️ Santa Fé Corps rodando na porta ${PORT}`);
  });
}

start();
