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
    // [19/09] DONO VIROU CONTA FIXA. Julio: "somente o discord julio14690 vai ter
    // poder de DONO, essa db de dono ai nao tem que existir, e quem ja ta de dono
    // tira". Antes, is_admin com admin_cargo NULL significava Dono -- ou seja, TODO
    // admin que ja existia virou Dono no deploy anterior. Aqui isso e desfeito:
    //   (a) o Julio fica com is_admin (varias rotas antigas ainda olham essa coluna);
    //   (b) todo o resto que estava "Dono por banco" PERDE o admin, por decisao dele.
    // Quem ja tem um cargo de verdade (dado pelo painel) nao e tocado. Roda em todo
    // boot e e idempotente: depois da primeira vez nao sobra ninguem pra rebaixar.
    try {
      const perm = require('./permissoes');
      // [FIX 23/09 seguranca] Nome de usuario do Discord SE TROCA; id numerico nao.
      // Com DONO_DISCORD_ID no ambiente a migracao passa a casar por ID.
      const donosId = perm.DONO_DISCORD_ID;
      const donos = perm.DONO_DISCORD;
      const porId = donosId.length > 0;
      if (!porId) {
        console.warn('[seguranca] DONO_DISCORD_ID nao configurada: o Dono ainda e reconhecido pelo NOME do Discord, que qualquer um pode copiar. Defina DONO_DISCORD_ID com o id numerico.');
      }
      await pool.query(porId
        ? `UPDATE users SET is_admin = true, updated_at = NOW() WHERE discord_id = ANY($1::text[])`
        : `UPDATE users SET is_admin = true, updated_at = NOW()
           WHERE LOWER(TRIM(COALESCE(discord_username, ''))) = ANY($1::text[])`,
        [porId ? donosId : donos]);
      const r = await pool.query(porId
        ? `UPDATE users SET is_admin = false, admin_cargo = NULL, updated_at = NOW()
           WHERE is_admin = true AND admin_cargo IS NULL AND discord_id <> ALL($1::text[])`
        : `UPDATE users SET is_admin = false, admin_cargo = NULL, updated_at = NOW()
           WHERE is_admin = true AND admin_cargo IS NULL
             AND LOWER(TRIM(COALESCE(discord_username, ''))) <> ALL($1::text[])`,
        [porId ? donosId : donos]);
      if (r.rowCount > 0) console.log('[migracao] ' + r.rowCount + ' "dono por banco" perderam o admin (so ' + donos.join(', ') + ' e Dono)');
    } catch (e) { console.error('migracao dono fixo:', e.message); }
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
      -- [25/09] Snapshots de jogadores online ao longo do tempo, pra aba ANÁLISE
      -- (média, pico, mínimo e crescimento por noite/SSU). Uma linha a cada ~2min
      -- durante as sessões; gravada no /heartbeat.
      CREATE TABLE IF NOT EXISTS player_snapshots (
        id SERIAL PRIMARY KEY,
        criado_em TIMESTAMP DEFAULT NOW(),
        jogadores INTEGER NOT NULL DEFAULT 0,
        servidores INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_player_snapshots_ts ON player_snapshots(criado_em);
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

      -- ===== NAVEGADOR (Santa Fe Net) — editais estilo formulario + candidaturas =====
      -- Editais de recrutamento das corporacoes (o "Portal do Governo" in-game). campos = perguntas.
      CREATE TABLE IF NOT EXISTS net_editais (
        id SERIAL PRIMARY KEY,
        corporation_id INTEGER REFERENCES corporations(id) ON DELETE CASCADE,
        titulo VARCHAR(120) NOT NULL,
        descricao TEXT,
        vaga VARCHAR(80),
        campos JSONB NOT NULL DEFAULT '[]',
        aberto BOOLEAN DEFAULT true,
        criado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
        criado_em TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_net_editais_corp ON net_editais(corporation_id);
      CREATE INDEX IF NOT EXISTS idx_net_editais_aberto ON net_editais(aberto) WHERE aberto = true;
      -- Candidaturas. O UNIQUE(edital_id, roblox_id) e a TRAVA DE ENVIO DUPLO: ninguem
      -- se candidata duas vezes ao mesmo edital, mesmo burlando o cliente.
      CREATE TABLE IF NOT EXISTS net_candidaturas (
        id SERIAL PRIMARY KEY,
        edital_id INTEGER REFERENCES net_editais(id) ON DELETE CASCADE,
        roblox_id BIGINT NOT NULL,
        roblox_nome VARCHAR(64),
        respostas JSONB NOT NULL DEFAULT '{}',
        criado_em TIMESTAMP DEFAULT NOW(),
        UNIQUE(edital_id, roblox_id)
      );
      CREATE INDEX IF NOT EXISTS idx_net_cand_edital ON net_candidaturas(edital_id, id);
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
    // ===== FACÇÕES (20/09/2026, pedido do Julio) =====
    // Facção é uma corporação com tipo = 'faccao'. Tudo que já existe (cargos,
    // membros, ícone, API do jogo) continua valendo — muda só em qual painel ela
    // aparece: /dashboard lista as corps, /faccoes lista as facções.
    try {
      await pool.query(`
        ALTER TABLE corporations ADD COLUMN IF NOT EXISTS tipo VARCHAR(16) NOT NULL DEFAULT 'corp';
        CREATE INDEX IF NOT EXISTS idx_corporations_tipo ON corporations(tipo);
      `);
    } catch (e) { console.error('migração coluna tipo:', e.message); }

    // Pavuna — a facção inicial. O jogo já a conhece pelo slug 'pavuna'
    // (CorpService traduz o grupo 35175874 pra esse slug) e paga pelo nome do cargo,
    // então os 14 cargos abaixo são IGUAIS à tabela SalariosPavuna do RemotesHandler.
    // Mexer num dos dois lados sem o outro faz o salário sair nil no jogo.
    // Ícone: textura da MascaraCaveira do vestuário da Pavuna, tirada do próprio jogo.
    try {
      await pool.query(`
        DO $$
        DECLARE
          cid INTEGER;
          cargos TEXT[][] := ARRAY[
            ['Dono do Morro','21000'], ['Frente','18000'], ['Gerente Geral','15000'],
            ['Gerente de Boca','12000'], ['Contenção','9500'], ['Fiel','8000'],
            ['Soldado','6000'], ['Endolador','4500'], ['Vapor','3500'],
            ['Avião','2500'], ['Olheiro','2000'], ['Fogueteiro','1600'],
            ['Radinho','1200'], ['Novato','1200']
          ];
          i INTEGER; n INTEGER;
        BEGIN
          SELECT id INTO cid FROM corporations WHERE slug = 'pavuna';
          IF cid IS NULL THEN
            INSERT INTO corporations (name, slug, description, color, max_members, is_active, tipo, icon_url)
            VALUES ('Pavuna', 'pavuna',
                    'Facção da Pavuna. Domínio do morro, boca de venda e o que vier junto.',
                    '#8B1A1A', 100, true, 'faccao',
                    'https://www.roblox.com/asset-thumbnail/image?assetId=12867403810&width=420&height=420&format=png')
            RETURNING id INTO cid;
          END IF;
          UPDATE corporations SET tipo = 'faccao', is_active = true, updated_at = NOW()
           WHERE id = cid AND (tipo <> 'faccao' OR is_active = false);
          -- ícone só se ainda não tiver nenhum (não sobrescreve upload do Julio)
          UPDATE corporations
             SET icon_url = 'https://www.roblox.com/asset-thumbnail/image?assetId=12867403810&width=420&height=420&format=png',
                 updated_at = NOW()
           WHERE id = cid AND icon_url IS NULL AND icon_data IS NULL;
          -- cargos: só semeia se a facção não tem nenhum
          IF NOT EXISTS (SELECT 1 FROM ranks WHERE corporation_id = cid) THEN
            n := array_length(cargos, 1);
            FOR i IN 1..n LOOP
              INSERT INTO ranks (corporation_id, name, level, salary)
              VALUES (cid, cargos[i][1], n - i + 1, cargos[i][2]::INTEGER)
              ON CONFLICT (corporation_id, name) DO NOTHING;
            END LOOP;
          END IF;
        END $$;
      `);
    } catch (e) { console.error('migração facção Pavuna:', e.message); }

    // Ícone do Jornal: o ícone do Microfone da imprensa, tirado do próprio jogo
    // (ServerStorage.Tools.Microfone). Só entra se o Jornal ainda não tem imagem.
    try {
      await pool.query(`
        UPDATE corporations
           SET icon_url = 'https://www.roblox.com/asset-thumbnail/image?assetId=7560648021&width=420&height=420&format=png',
               updated_at = NOW()
         WHERE slug = 'jornal' AND icon_url IS NULL AND icon_data IS NULL;
      `);
    } catch (e) { console.error('migração ícone Jornal:', e.message); }

    // ===== CARGOS DA POLÍCIA CIVIL — MODELO DE CARREIRA (20/09/2026) =====
    // Reclamação do lançamento: os cargos da PC no site não eram uma carreira, eram
    // uma lista solta herdada da antiga Polícia Federal. Aqui entra o modelo real:
    // Direção → Delegados (1ª/2ª/3ª classe) → Inquéritos → Perícia (1ª/2ª/3ª) →
    // Papiloscopia → Agentes de Polícia Judiciária (1ª/2ª/3ª) → Escola.
    // Ninguém fica sem cargo: cada cargo antigo tem destino no mapa, e quem sobrar
    // cai em Instruendo. Idempotente: só roda se '[DG] Delegado-Geral' ainda não existe.
    try {
      await pool.query(`
        DO $$
        DECLARE
          cid INTEGER;
          novos TEXT[][] := ARRAY[
            ['[DG] Delegado-Geral','19000'],
            ['[DGA] Delegado-Geral Adjunto','17500'],
            ['[CG] Corregedor-Geral','16500'],
            ['[DD] Diretor de Departamento','15500'],
            ['[DP-1] Delegado de Polícia 1ª Classe','14500'],
            ['[DP-2] Delegado de Polícia 2ª Classe','13500'],
            ['[DP-3] Delegado de Polícia 3ª Classe','12500'],
            ['[DINV] Diretor de Investigação','12000'],
            ['[PER-1] Perito Criminal 1ª Classe','10500'],
            ['[PER-2] Perito Criminal 2ª Classe','9500'],
            ['[PER-3] Perito Criminal 3ª Classe','8500'],
            ['[INV-1] Investigador 1ª Classe','10500'],
            ['[INV-2] Investigador 2ª Classe','9500'],
            ['[INV-3] Investigador 3ª Classe','8500'],
            ['[PAP] Papiloscopista Policial','8000'],
            ['[AUX] Auxiliar de Investigação','7000'],
            ['[APJ-1] Agente de Polícia Judiciária 1ª Classe','7000'],
            ['[APJ-2] Agente de Polícia Judiciária 2ª Classe','5500'],
            ['[APJ-3] Agente de Polícia Judiciária 3ª Classe','4000'],
            ['[ESPC] Instruendo','2210'],
            ['Holder','2125']
          ];
          mapa TEXT[][] := ARRAY[
            ['[DLG-G] Delegado Geral','[DG] Delegado-Geral'],
            ['[DLG-ADJ] Delegado Adjunto','[DGA] Delegado-Geral Adjunto'],
            ['[DLG-1º] Delegado de Primeira Classe','[DP-1] Delegado de Polícia 1ª Classe'],
            ['[DLG-2º] Delegado de Segunda Classe','[DP-2] Delegado de Polícia 2ª Classe'],
            ['[DLG-3º] Delegado de Terceira Classe','[DP-3] Delegado de Polícia 3ª Classe'],
            ['[ESC] Escrivão','[AUX] Auxiliar de Investigação'],
            ['[PRT-C] Perito Criminal','[PER-1] Perito Criminal 1ª Classe'],
            ['[LEG] Legista','[PER-2] Perito Criminal 2ª Classe'],
            ['[INV-1º] Investigador de Primeira Classe','[INV-1] Investigador 1ª Classe'],
            ['[INV-2º] Investigador de Segunda Classe','[INV-2] Investigador 2ª Classe'],
            ['[INV-3º] Investigador de Terceira Classe','[INV-3] Investigador 3ª Classe'],
            ['[INV] Investigador','[INV-3] Investigador 3ª Classe'],
            ['[AGT-1º] Agente de Primeira Classe','[APJ-1] Agente de Polícia Judiciária 1ª Classe'],
            ['[AGT-2º] Agente de Segunda Classe','[APJ-2] Agente de Polícia Judiciária 2ª Classe'],
            ['[AGT-3º] Agente de Terceira Classe','[APJ-3] Agente de Polícia Judiciária 3ª Classe'],
            ['[AGT-P] Agente de Polícia','[APJ-3] Agente de Polícia Judiciária 3ª Classe'],
            ['Aluno','[ESPC] Instruendo'],
            ['Holder','Holder']
          ];
          i INTEGER; n INTEGER; velho_id INTEGER; novo_id INTEGER;
        BEGIN
          SELECT id INTO cid FROM corporations WHERE slug = 'policia-civil' AND is_active = true;
          IF cid IS NULL THEN RETURN; END IF;
          IF EXISTS (SELECT 1 FROM ranks WHERE corporation_id = cid AND name = '[DG] Delegado-Geral') THEN RETURN; END IF;
          n := array_length(novos, 1);
          -- 1) cria os novos em níveis temporários (100+) pra não colidir com os antigos
          FOR i IN 1..n LOOP
            INSERT INTO ranks (corporation_id, name, level, salary)
            VALUES (cid, novos[i][1], 100 + (n - i + 1), novos[i][2]::INTEGER)
            ON CONFLICT (corporation_id, name) DO UPDATE SET level = EXCLUDED.level, salary = EXCLUDED.salary;
          END LOOP;
          -- 2) move cada membro pro cargo equivalente
          FOR i IN 1..array_length(mapa, 1) LOOP
            SELECT id INTO velho_id FROM ranks WHERE corporation_id = cid AND name = mapa[i][1] AND level < 100;
            SELECT id INTO novo_id  FROM ranks WHERE corporation_id = cid AND name = mapa[i][2] AND level >= 100;
            IF velho_id IS NOT NULL AND novo_id IS NOT NULL THEN
              UPDATE members SET rank_id = novo_id WHERE corporation_id = cid AND rank_id = velho_id;
            END IF;
          END LOOP;
          -- 3) quem sobrou em cargo sem destino vira Instruendo (ninguém fica sem cargo)
          SELECT id INTO novo_id FROM ranks WHERE corporation_id = cid AND name = '[ESPC] Instruendo' AND level >= 100;
          UPDATE members SET rank_id = novo_id
           WHERE corporation_id = cid
             AND (rank_id IS NULL OR rank_id IN (SELECT id FROM ranks WHERE corporation_id = cid AND level < 100));
          -- 4) apaga os antigos e renumera os novos de 21 (topo) até 1
          DELETE FROM ranks WHERE corporation_id = cid AND level < 100;
          UPDATE ranks SET level = level - 100 WHERE corporation_id = cid AND level >= 100;
        END $$;
      `);
    } catch (e) { console.error('migração carreira PC:', e.message); }
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

  // [FIX 23/09 seguranca] CORS era cors() cru = qualquer origem podia chamar a
  // API. O jogo fala por HttpService (servidor, sem Origin, CORS nao se aplica) e
  // o painel e mesma origem -- entao restringir nao quebra nada e fecha o resto.
  const origensOk = [process.env.BASE_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(Boolean);
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || origensOk.includes(origin)),
    credentials: true,
  }));

  // [FIX 23/09 seguranca] corpo grande e DoS barato: 100 KB cobre tudo que o site
  // manda (o upload de icone passa pelo multer, que tem limite proprio de 2 MB).
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // [FIX 23/09 seguranca] LIMITADOR. Nao havia nenhum: a API do jogo inteira e
  // protegida por UMA chave, e dava pra tentar chave a vontade. Balde de fichas em
  // memoria, sem dependencia nova (mexer no package.json e arriscar o deploy).
  const baldes = new Map();
  function limitar(nome, cap, janelaSeg) {
    return function (req, res, next) {
      const ip = req.ip || (req.connection && req.connection.remoteAddress) || '?';
      const chave = nome + '|' + ip;
      const agora = Date.now() / 1000;
      let b = baldes.get(chave);
      if (!b) { b = { fichas: cap, t: agora }; baldes.set(chave, b); }
      b.fichas = Math.min(cap, b.fichas + (agora - b.t) * (cap / janelaSeg));
      b.t = agora;
      if (b.fichas < 1) {
        res.set('Retry-After', String(Math.ceil(janelaSeg / cap)));
        return res.status(429).json({ error: 'Devagar.' });
      }
      b.fichas -= 1;
      next();
    };
  }
  // limpeza: balde parado ha mais de 10 min sai da memoria
  setInterval(() => {
    const corte = Date.now() / 1000 - 600;
    for (const [k, b] of baldes) if (b.t < corte) baldes.delete(k);
  }, 300000).unref();
  app.locals.limitar = limitar;
  app.use(express.static(path.join(__dirname, 'public')));

  // Sessão com PostgreSQL
  app.use(session({
    store: new PgSession({ pool, tableName: 'session' }),
    // [FIX 23/09 seguranca] antes era `|| 'dev-secret'`: faltando a variavel no
    // Railway o site subia EM SILENCIO assinando sessao com uma constante publica,
    // e dava pra forjar cookie de qualquer conta, admin inclusive. Agora nao sobe.
    secret: (function () {
      const s = process.env.SESSION_SECRET;
      if (s && s.length >= 16) return s;
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SESSION_SECRET ausente ou curta demais. O site NAO sobe assim: sessao assinada com segredo publico e conta de admin forjavel.');
      }
      console.warn('[seguranca] SESSION_SECRET ausente -- usando segredo de desenvolvimento. NUNCA em producao.');
      return 'dev-secret-apenas-local';
    })(),
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
  // [FIX 23/09 seguranca] o limitador entra AQUI, no ponto de montagem, pra
  // nenhuma rota nova nascer sem ele. Numeros folgados de proposito: o jogo manda
  // heartbeat de varios servidores e nao pode apanhar.
  app.use('/auth', limitar('auth', 20, 60), require('./routes/auth'));
  app.use('/api/game', limitar('game', 300, 60), require('./routes/game-api'));
  app.use('/api/game/net', limitar('game', 300, 60), require('./routes/net-api'));
  // vincular Roblox e a rota de tomada de conta: aperta de verdade.
  app.use('/dashboard/link-roblox', limitar('link', 10, 300));
  app.use('/dashboard', require('./routes/dashboard'));
  app.use('/net', require('./routes/net'));
  app.use('/api/corps', require('./routes/corps-api'));
  app.use('/api/admin', require('./routes/admin-api'));
  app.use('/admin', require('./routes/admin'));
  app.use('/faccoes', require('./routes/faccoes'));

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
