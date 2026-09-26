require('dotenv').config();
// NOTA [17/09]: as tabelas do CELULAR agora também nascem no boot (src/index.js),
// porque o Procfile roda `node src/index.js` e este arquivo só roda à mão
// (`npm run db:migrate`) — por isso elas nunca existiram no Railway e toda rota
// /celular/* devolvia 500. Manter os dois em sincronia.
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
  icon_data BYTEA,
  icon_mime VARCHAR(64),
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  max_members INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- [20/09] Facção = corporação com tipo = 'faccao' (painel separado no site).
ALTER TABLE corporations ADD COLUMN IF NOT EXISTS tipo VARCHAR(16) NOT NULL DEFAULT 'corp';
CREATE INDEX IF NOT EXISTS idx_corporations_tipo ON corporations(tipo);

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

-- Co-gerentes (acesso compartilhado a corporações)
CREATE TABLE IF NOT EXISTS corp_managers (
  id SERIAL PRIMARY KEY,
  corporation_id INTEGER REFERENCES corporations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(corporation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_corp_managers_user ON corp_managers(user_id);

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

-- ===== CELULAR (Aparelho com uid) — F2 CelularV2 =====
-- Registro dos aparelhos (identidade). O CONTEUDO (mensagens/galeria) entra em tabelas proprias depois.
-- apagado_em marca o wipe e e a base da janela de retencao pra pericia da Policia Civil.
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

-- Histórico de posse (aba "Rastreio" da perícia da PC). [17/09]
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

-- Contatos por número (agenda de cada aparelho)
CREATE TABLE IF NOT EXISTS celular_contatos (
  id SERIAL PRIMARY KEY,
  dono_numero VARCHAR(24) NOT NULL,
  numero VARCHAR(24) NOT NULL,
  apelido VARCHAR(64),
  criado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(dono_numero, numero)
);
CREATE INDEX IF NOT EXISTS idx_contatos_dono ON celular_contatos(dono_numero);

-- Mensagens entre números (DM). par_key = par ordenado, acha a conversa rápido.
-- pos_/rua = rastreio (toda mensagem salva onde foi enviada) pra perícia da PC.
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

-- Deepweb: mural. chip_nome = nome ANÔNIMO do chip (é o que aparece no feed, tipo @corvo_71).
-- autor_numero/roblox_id + pos/rua = SÓ pra perícia da PC (nunca vão pro feed). corpo <=200.
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

-- ===== NAVEGADOR (Santa Fe Net) — editais + candidaturas (mantido em sync com src/index.js) =====
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

-- ===== PROCURADOS (26/09) =====
-- A policia marca alguem A MAO. Nao confundir com a aba "Procurados" antiga
-- da Ficha, que e DERIVADA (quem deve dinheiro). Esta aqui e a lista de
-- caca: descricao escrita pelo policial (roupa, cor, cabelo, carro).
-- O CADASTRO DE CIDADAOS NAO PRECISOU DE TABELA NOVA: game_players ja e
-- todo mundo que entrou (roblox_id, nome, primeira_vez, ultima_vez, visitas),
-- alimentado pelo log 'entrou'. A foto sai do roblox_id no lado do jogo.
-- estado: 'ativo' (valendo) | 'aguardo' (marcado por NOME, o dono ainda nao
-- entrou nenhuma vez -- "em aguardo de dados", sem prazo pra vencer) |
-- 'encerrado'.
CREATE TABLE IF NOT EXISTS procurados (
  id SERIAL PRIMARY KEY,
  roblox_id BIGINT,
  nome VARCHAR(64) NOT NULL,
  descricao TEXT,
  motivo VARCHAR(160),
  por_roblox_id BIGINT,
  por_nome VARCHAR(64),
  corp VARCHAR(64),
  estado VARCHAR(16) NOT NULL DEFAULT 'ativo',
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  encerrado_em TIMESTAMP,
  encerrado_por VARCHAR(64)
);
CREATE INDEX IF NOT EXISTS idx_procurados_estado ON procurados(estado, id DESC);
CREATE INDEX IF NOT EXISTS idx_procurados_nome ON procurados(LOWER(nome));
-- um alvo so pode ter UM mandado aberto por vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_procurados_aberto
  ON procurados(roblox_id) WHERE estado <> 'encerrado' AND roblox_id IS NOT NULL;

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
