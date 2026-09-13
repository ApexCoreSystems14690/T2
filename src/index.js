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
        icon_data BYTEA,
        icon_mime VARCHAR(64),
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
      CREATE TABLE IF NOT EXISTS corp_managers (
        id SERIAL PRIMARY KEY,
        corporation_id INTEGER REFERENCES corporations(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(corporation_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_corp_managers_user ON corp_managers(user_id);
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
    // Adiciona colunas que podem faltar em tabelas já existentes
    await pool.query(`
      ALTER TABLE corporations ADD COLUMN IF NOT EXISTS icon_data BYTEA;
      ALTER TABLE corporations ADD COLUMN IF NOT EXISTS icon_mime VARCHAR(64);
    `);
    // Painel admin: fila de comandos, logs do jogo, servidores online, auditoria
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_servers (
        job_id VARCHAR(64) PRIMARY KEY,
        place_id BIGINT,
        players JSONB DEFAULT '[]',
        catalog JSONB,
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS game_commands (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(48) NOT NULL,
        target_roblox_id BIGINT,
        target_name VARCHAR(64),
        payload JSONB DEFAULT '{}',
        job_id VARCHAR(64),
        status VARCHAR(16) DEFAULT 'pending',
        result TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        sent_at TIMESTAMP,
        executed_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_game_commands_status ON game_commands(status, job_id);
      CREATE TABLE IF NOT EXISTS game_logs (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(32) NOT NULL,
        jogador VARCHAR(64),
        alvo VARCHAR(64),
        detalhe JSONB DEFAULT '{}',
        job_id VARCHAR(64),
        ocorrido_em TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_game_logs_tipo ON game_logs(tipo, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_game_logs_jogador ON game_logs(jogador);
      CREATE TABLE IF NOT EXISTS game_config (
        key VARCHAR(32) PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS admin_audit (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        admin_nome VARCHAR(128),
        acao VARCHAR(64) NOT NULL,
        detalhe JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    // Registro de jogadores (todo mundo que já entrou, online ou não) + fila de itens pra offline
    await pool.query(`
      CREATE TABLE IF NOT EXISTS game_players (
        roblox_id BIGINT PRIMARY KEY,
        nome VARCHAR(64),
        primeira_vez TIMESTAMP DEFAULT NOW(),
        ultima_vez TIMESTAMP DEFAULT NOW(),
        visitas INTEGER DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_game_players_ultima ON game_players(ultima_vez DESC);
      CREATE INDEX IF NOT EXISTS idx_game_players_nome ON game_players(LOWER(nome));
      CREATE TABLE IF NOT EXISTS game_item_fila (
        id SERIAL PRIMARY KEY,
        roblox_id BIGINT NOT NULL,
        item VARCHAR(64) NOT NULL,
        qtd INTEGER NOT NULL DEFAULT 1,
        criado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
        criado_em TIMESTAMP DEFAULT NOW(),
        entregue_em TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_item_fila_pend ON game_item_fila(roblox_id) WHERE entregue_em IS NULL;
    `);
    // Backfill: popula game_players a partir dos logs de "entrou" que já existem,
    // pra aba Registro já nascer com histórico. Roda toda vez, mas é idempotente.
    try {
      await pool.query(`
        INSERT INTO game_players (roblox_id, nome, primeira_vez, ultima_vez, visitas)
        SELECT (detalhe->>'userId')::bigint AS rid,
               MAX(jogador) AS nome,
               MIN(COALESCE(ocorrido_em, created_at)) AS pv,
               MAX(COALESCE(ocorrido_em, created_at)) AS uv,
               COUNT(*) AS n
        FROM game_logs
        WHERE tipo = 'entrou' AND detalhe->>'userId' ~ '^[0-9]+$'
        GROUP BY (detalhe->>'userId')::bigint
        ON CONFLICT (roblox_id) DO UPDATE SET
          nome = COALESCE(EXCLUDED.nome, game_players.nome),
          primeira_vez = LEAST(game_players.primeira_vez, EXCLUDED.primeira_vez),
          ultima_vez = GREATEST(game_players.ultima_vez, EXCLUDED.ultima_vez),
          visitas = GREATEST(game_players.visitas, EXCLUDED.visitas);
      `);
    } catch (e) { console.error('backfill game_players:', e.message); }
    // PF virou PC (set/2026): no painel a corporação da Polícia Federal foi renomeada pra Polícia Civil,
    // mas o SLUG (que é o que o jogo consulta em /api/game/player) continuou 'policia-federal', e a corp
    // 'policia-civil' original ficou vazia. Aqui: aposenta a 'policia-civil' vazia e passa o slug da antiga
    // PF pra 'policia-civil'. Idempotente — depois da primeira execução não faz nada.
    try {
      await pool.query(`
        UPDATE corporations SET slug = 'policia-civil-vazia', is_active = false, updated_at = NOW()
         WHERE slug = 'policia-civil'
           AND EXISTS (SELECT 1 FROM corporations c2 WHERE c2.slug = 'policia-federal')
           AND NOT EXISTS (SELECT 1 FROM members m WHERE m.corporation_id = corporations.id);
        UPDATE corporations SET slug = 'policia-civil',
               name = CASE WHEN name ILIKE '%federal%' THEN 'Polícia Civil' ELSE name END,
               updated_at = NOW()
         WHERE slug = 'policia-federal'
           AND NOT EXISTS (SELECT 1 FROM corporations c2 WHERE c2.slug = 'policia-civil');
      `);
    } catch (e) { console.error('migração PF->PC:', e.message); }
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
  app.use('/api/admin', require('./routes/admin-api'));
  app.use('/admin', require('./routes/admin'));

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
