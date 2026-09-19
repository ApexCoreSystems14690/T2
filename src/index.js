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
      -- [19/09] CARGOS DE ADMIN. O admin deixou de ser liga/desliga.
      -- REGRA: is_admin = true com admin_cargo NULL significa DONO (poder
      -- absoluto, inclusive wipe). O painel SEMPRE grava um cargo, entao NULL
      -- so acontece quando alguem foi setado direto no banco por SQL -- que e
      -- exatamente a definicao que o Julio pediu.
      -- DE PROPOSITO NAO EXISTE BACKFILL: todo admin que ja existia continua
      -- com admin_cargo NULL, ou seja, vira DONO. Ninguem perde acesso no
      -- deploy. Rebaixar quem nao deveria ser dono e um clique no painel.
      ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_cargo VARCHAR(24);
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

      -- ===== CELULAR (Aparelho com uid) =====
      -- [fix 17/09] Estas tabelas só existiam em src/db/migrate.js, que roda com
      -- 'npm run db:migrate'. O Procfile e 'node src/index.js', entao no Railway
      -- elas NUNCA foram criadas: toda rota /celular/* respondia HTTP 500
      -- ("relation does not exist"). Agora nascem no boot, como o resto.
      CREATE TABLE IF NOT EXISTS aparelhos (
        uid VARCHAR(64) PRIMARY KEY,
        numero VARCHAR(24) NOT NULL,
        dono_roblox_id BIGINT,
        dono_nome VARCHAR(64),
        criado_em TIMESTAMP DEFAULT NOW(),
        apagado_em TIMESTAMP,
        ativo BOOLEAN DEFAULT true,
        atualizado_em TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_aparelhos_numero ON aparelhos(numero);
      CREATE INDEX IF NOT EXISTS idx_aparelhos_dono ON aparelhos(dono_roblox_id);

      -- Histórico de posse: quem teve o aparelho, quando, por quê e onde.
      -- É a base da aba "Rastreio" da perícia da Polícia Civil. O jogo já manda
      -- motivo/de/pos em POST /celular/dono desde 17/09.
      CREATE TABLE IF NOT EXISTS aparelho_donos (
        id SERIAL PRIMARY KEY,
        aparelho_uid VARCHAR(64) NOT NULL,
        de_roblox_id BIGINT,
        de_nome VARCHAR(64),
        para_roblox_id BIGINT,
        para_nome VARCHAR(64),
        motivo VARCHAR(24),
        pos_x REAL, pos_y REAL, pos_z REAL,
        criado_em TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_aparelho_donos_uid ON aparelho_donos(aparelho_uid, id DESC);

      CREATE TABLE IF NOT EXISTS celular_contatos (
        id SERIAL PRIMARY KEY,
        dono_numero VARCHAR(24) NOT NULL,
        numero VARCHAR(24) NOT NULL,
        apelido VARCHAR(64),
        criado_em TIMESTAMP DEFAULT NOW(),
        UNIQUE(dono_numero, numero)
      );
      CREATE INDEX IF NOT EXISTS idx_contatos_dono ON celular_contatos(dono_numero);

      CREATE TABLE IF NOT EXISTS celular_mensagens (
        id SERIAL PRIMARY KEY,
        de_numero VARCHAR(24) NOT NULL,
        para_numero VARCHAR(24) NOT NULL,
        par_key VARCHAR(49) NOT NULL,
        texto VARCHAR(300) NOT NULL,
        pos_x REAL, pos_y REAL, pos_z REAL, rua VARCHAR(64),
        criado_em TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_msg_par ON celular_mensagens(par_key, id);
      CREATE INDEX IF NOT EXISTS idx_msg_de ON celular_mensagens(de_numero);

      CREATE TABLE IF NOT EXISTS deepweb_posts (
        id SERIAL PRIMARY KEY,
        chip_nome VARCHAR(32) NOT NULL,
        autor_numero VARCHAR(24),
        autor_roblox_id BIGINT,
        corpo VARCHAR(200) NOT NULL,
        pos_x REAL, pos_y REAL, pos_z REAL, rua VARCHAR(64),
        criado_em TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_deepweb_id ON deepweb_posts(id DESC);
      CREATE INDEX IF NOT EXISTS idx_deepweb_autor ON deepweb_posts(autor_numero);
    `);
    // Backfill: popula game_players a partir dos logs de "entrou" que já existem,
    // pra aba Registro já nascer com histórico. Roda toda vez, mas é idempotente.
    try {
      // [19/09] TEMPORADA. Comeca em 1 e so sobe, pelo wipe. O jogo usa este numero
    // pra escolher a loja do ProfileService: 1 = "CBRP_V1.2" (a de hoje, nada muda),
    // 2 = "CBRP_V1.2_T2", etc. E assim que o wipe zera o save de TODO MUNDO de uma
    // vez, inclusive quem esta offline -- sem varrer save nenhum.
    try {
      await pool.query(
        `INSERT INTO game_config (key, value, updated_at) VALUES ('temporada', '{"n":1}'::jsonb, NOW())
         ON CONFLICT (key) DO NOTHING`);
    } catch (e) { console.error('seed temporada:', e.message); }

    // [CONSERTO 19/09] O backfill era o motivo de "apagar jogador nao
      // funciona": ele repovoa game_players a partir dos logs a CADA boot, e o
      // Railway reinicia em todo deploy. Apagou o jogador, subiu uma versao,
      // ele voltava. Agora so considera log posterior ao ultimo wipe, e o
      // /registro/apagar leva os logs do jogador junto.
      let desde = '1970-01-01';
      try {
        const w = await pool.query(`SELECT value->>'em' AS em FROM game_config WHERE key = 'wipe_em'`);
        if (w.rows[0] && w.rows[0].em) desde = w.rows[0].em;
      } catch (e) {}
      await pool.query(`
        INSERT INTO game_players (roblox_id, nome, primeira_vez, ultima_vez, visitas)
        SELECT (detalhe->>'userId')::bigint AS rid,
               MAX(jogador) AS nome,
               MIN(COALESCE(ocorrido_em, created_at)) AS pv,
               MAX(COALESCE(ocorrido_em, created_at)) AS uv,
               COUNT(*) AS n
        FROM game_logs
        WHERE tipo = 'entrou' AND detalhe->>'userId' ~ '^[0-9]+$'
          AND COALESCE(ocorrido_em, created_at) > $1::timestamptz
        GROUP BY (detalhe->>'userId')::bigint
        ON CONFLICT (roblox_id) DO UPDATE SET
          nome = COALESCE(EXCLUDED.nome, game_players.nome),
          primeira_vez = LEAST(game_players.primeira_vez, EXCLUDED.primeira_vez),
          ultima_vez = GREATEST(game_players.ultima_vez, EXCLUDED.ultima_vez),
          visitas = GREATEST(game_players.visitas, EXCLUDED.visitas);
      `, [desde]);
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
    // Cargos da PC (13/09/2026, pedido do Julio): a corp herdou os cargos da antiga PF (Diretor Geral...).
    // Aqui: cria os 18 cargos da Polícia Civil (mesmos nomes/salários da tabela SalariosPC do jogo),
    // move cada membro do cargo PF pro cargo PC equivalente e apaga os cargos da PF.
    // Idempotente: só roda se a corp 'policia-civil' ainda não tem '[DLG-G] Delegado Geral'.
    try {
      await pool.query(`
        DO $$
        DECLARE
          cid INTEGER;
          novos TEXT[][] := ARRAY[
            ['[DLG-G] Delegado Geral','19000'], ['[DLG-ADJ] Delegado Adjunto','17000'],
            ['[DLG-1º] Delegado de Primeira Classe','15000'], ['[DLG-2º] Delegado de Segunda Classe','14500'],
            ['[DLG-3º] Delegado de Terceira Classe','13500'], ['[ESC] Escrivão','11500'],
            ['[PRT-C] Perito Criminal','11000'], ['[LEG] Legista','10500'],
            ['[INV-1º] Investigador de Primeira Classe','10000'], ['[INV-2º] Investigador de Segunda Classe','9500'],
            ['[INV-3º] Investigador de Terceira Classe','9000'], ['[INV] Investigador','8650'],
            ['[AGT-1º] Agente de Primeira Classe','7650'], ['[AGT-2º] Agente de Segunda Classe','5950'],
            ['[AGT-3º] Agente de Terceira Classe','4250'], ['[AGT-P] Agente de Polícia','2550'],
            ['Aluno','2210'], ['Holder','2125']
          ];
          mapa TEXT[][] := ARRAY[
            ['Diretor Geral','[DLG-G] Delegado Geral'], ['Diretor','[DLG-ADJ] Delegado Adjunto'],
            ['Diretor Adjunto','[DLG-1º] Delegado de Primeira Classe'], ['Perito Criminal','[PRT-C] Perito Criminal'],
            ['Investigador','[INV] Investigador'], ['Sub-Investigador','[AGT-1º] Agente de Primeira Classe'],
            ['Escrivão','[ESC] Escrivão'], ['Agente Especial','[AGT-1º] Agente de Primeira Classe'],
            ['Agente Operacional','[AGT-2º] Agente de Segunda Classe'], ['Agente 1º Classe','[AGT-3º] Agente de Terceira Classe'],
            ['Agente 2º Classe','[AGT-P] Agente de Polícia'], ['Agente 3º Classe','[AGT-P] Agente de Polícia'],
            ['Aluno','Aluno']
          ];
          i INTEGER; n INTEGER; velho_id INTEGER; novo_id INTEGER;
        BEGIN
          SELECT id INTO cid FROM corporations WHERE slug = 'policia-civil' AND is_active = true;
          IF cid IS NULL THEN RETURN; END IF;
          IF EXISTS (SELECT 1 FROM ranks WHERE corporation_id = cid AND name = '[DLG-G] Delegado Geral') THEN RETURN; END IF;
          n := array_length(novos, 1);
          -- 1) cria os cargos novos em níveis temporários (100+) pra não colidir com os da PF
          FOR i IN 1..n LOOP
            INSERT INTO ranks (corporation_id, name, level, salary)
            VALUES (cid, novos[i][1], 100 + (n - i + 1), novos[i][2]::INTEGER)
            ON CONFLICT (corporation_id, name) DO NOTHING;
          END LOOP;
          -- 2) move os membros do cargo PF pro equivalente PC
          FOR i IN 1..array_length(mapa, 1) LOOP
            SELECT id INTO velho_id FROM ranks WHERE corporation_id = cid AND name = mapa[i][1] AND level < 100;
            SELECT id INTO novo_id  FROM ranks WHERE corporation_id = cid AND name = mapa[i][2];
            IF velho_id IS NOT NULL AND novo_id IS NOT NULL THEN
              UPDATE members SET rank_id = novo_id WHERE corporation_id = cid AND rank_id = velho_id;
            END IF;
          END LOOP;
          -- quem sobrou num cargo PF sem mapa vira Aluno (não fica sem cargo)
          SELECT id INTO novo_id FROM ranks WHERE corporation_id = cid AND name = 'Aluno' AND level >= 100;
          UPDATE members SET rank_id = novo_id
           WHERE corporation_id = cid AND rank_id IN (SELECT id FROM ranks WHERE corporation_id = cid AND level < 100);
          -- 3) apaga os cargos da PF e renumera os da PC de 18 (topo) até 1
          DELETE FROM ranks WHERE corporation_id = cid AND level < 100;
          UPDATE ranks SET level = level - 100 WHERE corporation_id = cid AND level >= 100;
        END $$;
      `);
    } catch (e) { console.error('migração cargos PC:', e.message); }
    // Jornal Nacional (15/09/2026, pedido do Julio): garante a corp 'jornal' (grupo antigo 15258756 no jogo)
    // e a regra de quem publica matérias no celular: os 3 cargos de nível mais alto (permissions.publicar_materias).
    // O jogo já recebe rank.permissions em /api/game/player. Idempotente; a regra é recalculada a cada boot.
    try {
      await pool.query(`
        DO $$
        DECLARE
          cid INTEGER;
        BEGIN
          -- 1) garante a corp (só cria se não existir; nunca mexe numa que já existe)
          SELECT id INTO cid FROM corporations WHERE slug = 'jornal';
          IF cid IS NULL THEN
            INSERT INTO corporations (name, slug, description, color, max_members, is_active)
            VALUES ('Jornal Nacional', 'jornal', 'Jornal Nacional. Cobertura jornalística e reportagens da cidade.', '#F59E0B', 100, true)
            RETURNING id INTO cid;
          END IF;
          UPDATE corporations SET is_active = true, updated_at = NOW() WHERE id = cid AND is_active = false;
          -- 2) cargos iniciais (mesmos nomes/salários da tabela SalariosJN do jogo), só se a corp não tem nenhum
          IF NOT EXISTS (SELECT 1 FROM ranks WHERE corporation_id = cid) THEN
            INSERT INTO ranks (corporation_id, name, level, salary) VALUES
              (cid, 'Diretores', 3, 9350), (cid, 'Jornalista', 2, 1700), (cid, 'Holder', 1, 2125);
          END IF;
          -- 3) regra de publicação: os 3 cargos de nível mais alto publicam matérias.
          --    Recalculada a cada boot, então vale também pra cargos criados/renomeados depois no painel.
          UPDATE ranks r
             SET permissions = COALESCE(r.permissions, '{}'::jsonb)
                               || jsonb_build_object('publicar_materias',
                                    r.id IN (SELECT id FROM ranks WHERE corporation_id = cid ORDER BY level DESC LIMIT 3))
           WHERE r.corporation_id = cid;
        END $$;
      `);
    } catch (e) { console.error('migração Jornal:', e.message); }
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
