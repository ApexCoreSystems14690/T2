// ============================================================================
// CIDADES — a camada acima de tudo (21/10/2026)
//
// Pedido do Julio: o site abre numa tela "Cidades". Hoje só existe uma, o
// Santa Fé Oficial, mas a ideia é virar uma rede de servidores: cada cidade
// com as próprias corporações, cargos, staff e saves. Um mesmo jogador pode
// ser Soldado numa, Dono de outra, e NADA de uma cidade aparece na outra.
//
// O que este arquivo faz (fase 1, a base):
//   - tabelas `cidades` e `cidade_staff` (o cargo de admin agora é POR cidade);
//   - coluna `cidade_id` em toda tabela que pertence a uma cidade, com o
//     Santa Fé Oficial (id 1) como dono de tudo que já existe;
//   - o CONTEXTO do pedido: a cidade escolhida fica na sessão, vira
//     `req.cidade`, e o `req.user` passa a carregar o cargo de staff DAQUELA
//     cidade (is_admin/admin_cargo). Todo o código de permissão que já existia
//     continua igual e, de graça, passa a ser por cidade;
//   - a trava de aba: a página manda `X-Cidade` em todo fetch; se a sessão já
//     está em outra cidade (trocou em outra aba), o pedido é RECUSADO em vez de
//     cair na cidade errada.
//
// O que fica pra fase 2 está no plano (claude/cidades-plano.md no Project):
// filtrar por cidade_id as consultas do jogo (game-api), do painel admin e das
// tabelas do celular/eleição/PD. Enquanto a fase 2 não fecha, NÃO existe
// caminho pra criar uma segunda cidade — o site só tem a Santa Fé Oficial.
// ============================================================================

const SANTA_FE = 1;   // id fixo da cidade oficial (tudo que existia antes é dela)

// Tabelas que pertencem a UMA cidade. As que têm corporation_id (ranks,
// members, corp_*) herdam a cidade da corporação e não precisam da coluna.
const TABELAS_DA_CIDADE = [
  'corporations',
  'game_players', 'game_patrimonio', 'game_logs', 'game_commands', 'game_item_fila',
  'game_servers', 'game_config', 'game_bans', 'admin_audit', 'player_snapshots',
  'aparelhos', 'aparelho_donos', 'celular_contatos', 'celular_mensagens', 'deepweb_posts',
  'alertas_compra', 'procurados', 'veiculos_procurados', 'fichas_encerradas',
  'eleicao_config', 'eleicao_estado', 'eleicao_votantes', 'eleicao_votos',
  'net_editais', 'net_candidaturas', 'olx_anuncios', 'olx_vendas', 'mf_reembolsos',
  'tester_liberacoes',
];

// ------------------------------------------------------------ núcleo puro

const SLUG_OK = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
function slugValido(s) { return typeof s === 'string' && SLUG_OK.test(s); }

// Nome da loja do ProfileService de uma cidade numa temporada. É o MESMO
// contrato que o módulo Temporada do jogo vai usar (ver o plano):
//   Santa Fé Oficial, temporada 1  -> 'CBRP_V1.2'      (a loja de hoje, intocada)
//   Santa Fé Oficial, temporada n  -> 'CBRP_V1.2_Tn'
//   outra cidade (prefixo P), temp n -> 'P_V1_Tn'
function nomeDaLoja(cidade, temporada) {
  const n = Math.max(1, parseInt(temporada) || 1);
  if (!cidade || cidade.id === SANTA_FE) return n === 1 ? 'CBRP_V1.2' : 'CBRP_V1.2_T' + n;
  return String(cidade.loja_prefixo) + '_V1_T' + n;
}

// A cidade que um pedido do JOGO diz ser (header x-cidade). Sem header = Santa
// Fé Oficial: é o que o jogo de hoje manda (nada), e não pode quebrar.
function slugDoJogo(header) {
  const s = String(header || '').trim().toLowerCase();
  return s ? s : null;
}

// [24/10] Senha de entrada da cidade (cidade de teste). Formato 'scrypt$sal$hash'.
// Cidade sem senha_hash = aberta (devolve true). Comparação em tempo constante.
const crypto = require('crypto');
function senhaConfere(cidade, senha) {
  if (!cidade || !cidade.senha_hash) return true;
  const p = String(cidade.senha_hash).split('$');
  if (p.length !== 3 || p[0] !== 'scrypt') return false;
  const s = String(senha == null ? '' : senha);
  if (!s || s.length > 64) return false;
  const h = crypto.scryptSync(s, p[1], 32);
  const alvo = Buffer.from(p[2], 'hex');
  return alvo.length === h.length && crypto.timingSafeEqual(h, alvo);
}

// Trava de aba: a página foi desenhada pra cidade X e a sessão está em Y.
function abaTrocada(headerCidade, cidadeDaSessao) {
  if (headerCidade === undefined || headerCidade === null || headerCidade === '') return false;
  if (!cidadeDaSessao) return true;
  return String(headerCidade) !== String(cidadeDaSessao.id);
}

// ------------------------------------------------------------ banco

async function garantir(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cidades (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(40) UNIQUE NOT NULL,
      nome VARCHAR(80) NOT NULL,
      sigla VARCHAR(8) NOT NULL DEFAULT 'SFE',
      tipo VARCHAR(16) NOT NULL DEFAULT 'comunidade',    -- oficial | comunidade
      status VARCHAR(16) NOT NULL DEFAULT 'ativa',       -- ativa | obras | fechada
      dono_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      loja_prefixo VARCHAR(40) NOT NULL,                 -- lojas do Roblox desta cidade
      cor VARCHAR(7) NOT NULL DEFAULT '#1D3F94',
      descricao VARCHAR(200),
      ordem INTEGER NOT NULL DEFAULT 100,
      criado_em TIMESTAMP DEFAULT NOW()
    );
    -- [21/10] 1 cidade = 1 servidor. Vagas fixas (100) e a identidade do servidor
    -- reservado dela no Roblox (preenchida quando a cidade for aberta no jogo).
    ALTER TABLE cidades ADD COLUMN IF NOT EXISTS vagas INTEGER NOT NULL DEFAULT 100;
    ALTER TABLE cidades ADD COLUMN IF NOT EXISTS servidor_privado_id VARCHAR(64);
    -- [22/10] servidor do Discord de cada cidade (boost automático, avisos)
    ALTER TABLE cidades ADD COLUMN IF NOT EXISTS discord_guild_id VARCHAR(32);
    UPDATE cidades SET discord_guild_id = '1544515870154293290' WHERE id = 1 AND discord_guild_id IS NULL;
    INSERT INTO cidades (id, slug, nome, sigla, tipo, status, loja_prefixo, cor, descricao, ordem)
    VALUES (1, 'santa-fe', 'Santa Fé', 'SFE', 'oficial', 'ativa', 'CBRP', '#1D3F94',
            'A cidade oficial. Polícia, SAMU, facções, empresas e eleição.', 0)
    ON CONFLICT (id) DO NOTHING;
    SELECT setval(pg_get_serial_sequence('cidades', 'id'), GREATEST((SELECT MAX(id) FROM cidades), 1));

    -- [24/10] CIDADE DE TESTE. [stated] Julio: "uma segunda cidade, porem essa segunda vai ter
    -- uma senha que abre ali na lateral ... a senha vai ser 146901, ela e uma place de teste,
    -- onde os testers podem testar". A senha mora aqui só como hash (scrypt), nunca em texto.
    -- isolada: a cidade já tem TODAS as consultas do jogo filtradas por cidade (fase 2 do
    -- plano). Só o Santa Fé é. Cidade não isolada fala com o site por uma lista curta de
    -- rotas de leitura (ver LIVRES_SEM_ISOLAMENTO em routes/game-api.js): nada que ela faça
    -- no jogo escreve no banco do Santa Fé.
    ALTER TABLE cidades ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(200);
    ALTER TABLE cidades ADD COLUMN IF NOT EXISTS isolada BOOLEAN NOT NULL DEFAULT false;
    UPDATE cidades SET isolada = true WHERE id = 1 AND isolada = false;
    INSERT INTO cidades (slug, nome, sigla, tipo, status, loja_prefixo, cor, descricao, ordem, vagas, senha_hash)
    VALUES ('testes', 'Santa Fé Testes', 'TST', 'teste', 'ativa', 'TST', '#8A6A1C',
            'Servidor de testes da equipe. Entrada com senha.', 50, 50,
            'scrypt$8c41726922ab84004dd6e95fa0ebaa99$4142538eb2056825d83dc9f3e8e93f78e3ffca2a98f16b1eab26910543fb8334')
    ON CONFLICT (slug) DO NOTHING;

    CREATE TABLE IF NOT EXISTS cidade_staff (
      cidade_id INTEGER NOT NULL REFERENCES cidades(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cargo VARCHAR(24) NOT NULL,
      dado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
      dado_em TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (cidade_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_cidade_staff_user ON cidade_staff(user_id);

    CREATE TABLE IF NOT EXISTS plataforma_migracoes (
      nome VARCHAR(64) PRIMARY KEY,
      em TIMESTAMP DEFAULT NOW()
    );
  `);

  // cidade_id em toda tabela da cidade. Tabela que ainda não existe (é criada
  // depois, sob demanda) entra no próximo boot.
  for (const t of TABELAS_DA_CIDADE) {
    const ex = await pool.query('SELECT to_regclass($1) AS r', [t]);
    if (!ex.rows[0].r) continue;
    await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS cidade_id INTEGER NOT NULL DEFAULT ${SANTA_FE} REFERENCES cidades(id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_${t}_cidade ON ${t}(cidade_id)`);
  }

  // UMA VEZ: o staff de hoje (users.is_admin/admin_cargo) vira staff do Santa
  // Fé Oficial. Roda uma vez só de propósito: se rodasse todo boot, quem fosse
  // tirado do cargo pelo painel voltaria no deploy seguinte (a coluna antiga
  // continua dizendo is_admin).
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const ja = await cli.query(
      `INSERT INTO plataforma_migracoes (nome) VALUES ('staff_para_santa_fe') ON CONFLICT DO NOTHING RETURNING nome`);
    if (ja.rows.length) {
      const r = await cli.query(
        `INSERT INTO cidade_staff (cidade_id, user_id, cargo)
         SELECT $1, id, CASE WHEN admin_cargo IS NULL OR admin_cargo = '' OR admin_cargo = 'dono' THEN 'estagiario' ELSE admin_cargo END
           FROM users
          WHERE is_admin = true AND discord_id NOT LIKE 'roblox_%'
         ON CONFLICT DO NOTHING`, [SANTA_FE]);
      console.log(`[cidades] staff de hoje copiado pro Santa Fé Oficial: ${r.rowCount} pessoa(s)`);
    }
    await cli.query('COMMIT');
  } catch (e) {
    try { await cli.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally { cli.release(); }
}

// Cache curto: a lista de cidades quase nunca muda e é lida em TODO pedido.
let _cache = null, _cacheEm = 0;
async function todas(pool) {
  if (_cache && Date.now() - _cacheEm < 5000) return _cache;
  const r = await pool.query(`SELECT * FROM cidades ORDER BY ordem, id`);
  _cache = r.rows; _cacheEm = Date.now();
  return _cache;
}
function limparCache() { _cache = null; }
// Não achou no cache? Relê uma vez (cidade recém-criada não pode esperar 30 s).
async function achar(pool, f) {
  let c = (await todas(pool)).find(f);
  if (!c && Date.now() - _cacheEm > 500) { limparCache(); c = (await todas(pool)).find(f); }
  return c || null;
}
async function porId(pool, id) { return achar(pool, c => c.id === Number(id)); }
async function porSlug(pool, slug) { return achar(pool, c => c.slug === String(slug)); }

// Quantos estão jogando em cada cidade agora (pra tela Cidades). Cada cidade é
// UM servidor; `servidores` > 1 é anomalia (dois servidores dizendo ser a mesma
// cidade) e aparece só pra quem investiga, nunca na tela.
async function movimento(pool) {
  const out = {};
  try {
    const r = await pool.query(
      `SELECT cidade_id, COUNT(*)::int AS servidores,
              COALESCE(SUM(jsonb_array_length(COALESCE(players, '[]'::jsonb))), 0)::int AS online
         FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds' GROUP BY cidade_id`);
    for (const x of r.rows) out[x.cidade_id] = { servidores: x.servidores, online: x.online };
  } catch (e) { /* base sem game_servers ainda */ }
  return out;
}

// O cargo de staff do usuário em cada cidade (pra tela Cidades mostrar "você é X aqui").
async function meusCargos(pool, userId) {
  if (!userId) return {};
  const r = await pool.query('SELECT cidade_id, cargo FROM cidade_staff WHERE user_id = $1', [userId]);
  const out = {};
  for (const x of r.rows) out[x.cidade_id] = x.cargo;
  return out;
}

// ------------------------------------------------------------ middlewares

// Roda em TODO pedido, logo depois de carregar o usuário da sessão.
function contexto(pool) {
  return async function (req, res, next) {
    try {
      const id = req.session && req.session.cidadeId;
      let cidade = id ? await porId(pool, id) : null;
      if (cidade && cidade.status !== 'ativa') { cidade = null; delete req.session.cidadeId; }
      req.cidade = cidade;
      res.locals.cidade = cidade;

      // trava de aba trocada (só vale pra quem manda o header: as páginas do site).
      // O JOGO manda outro header (x-cidade, com o slug) e não passa por aqui.
      if (abaTrocada(req.get('x-cidade-pagina'), cidade)) {
        return res.status(409).json({
          error: 'Você trocou de cidade em outra aba. Recarregue a página pra continuar.',
          cidade_trocada: true,
        });
      }

      // O cargo de staff passa a ser o DESTA cidade. O resto do site (permissoes,
      // requireAdmin, requirePoder, corp-poderes) continua lendo is_admin/admin_cargo
      // e, sem saber, fica isolado por cidade.
      if (req.user) {
        const base = req.user;
        let cargo = null;
        if (cidade) {
          const s = await pool.query('SELECT cargo FROM cidade_staff WHERE cidade_id = $1 AND user_id = $2', [cidade.id, base.id]);
          cargo = s.rows[0] ? s.rows[0].cargo : null;
        }
        req.usuarioPlataforma = base;
        req.user = Object.assign({}, base, {
          is_admin: !!cargo,
          admin_cargo: cargo,
          cidade_id: cidade ? cidade.id : null,
          cidade_oficial: !!(cidade && cidade.tipo === 'oficial'),
          dono_da_cidade: !!(cidade && cidade.dono_user_id && cidade.dono_user_id === base.id),
        });
      }
      next();
    } catch (e) {
      console.error('[cidades] contexto:', e.message);
      res.status(500).json({ error: 'Erro interno' });
    }
  };
}

// Portão das áreas que pertencem a uma cidade. Sem cidade escolhida: página
// volta pra tela Cidades (e depois de escolher, volta pra cá); API recebe 409.
function exigeCidade(opts) {
  const livres = (opts && opts.livres) || [];
  return function (req, res, next) {
    if (req.cidade) return next();
    if (livres.some(p => (p instanceof RegExp) ? p.test(req.path) : (req.path === p || req.path.startsWith(p + '/')))) return next();
    const ehApi = req.originalUrl.startsWith('/api/') || req.xhr || (req.get('accept') || '').includes('application/json');
    if (ehApi || req.method !== 'GET') {
      return res.status(409).json({ error: 'Escolha a cidade primeiro.', escolher_cidade: true });
    }
    return res.redirect('/?voltar=' + encodeURIComponent(req.originalUrl));
  };
}

// Pra onde mandar depois de escolher a cidade: só caminho interno do site.
function voltarSeguro(v) {
  const s = String(v || '');
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return null;
  if (s.startsWith('/auth') || s.startsWith('/cidade/')) return null;
  return s.slice(0, 300);
}

module.exports = {
  SANTA_FE, TABELAS_DA_CIDADE,
  slugValido, nomeDaLoja, slugDoJogo, abaTrocada, voltarSeguro, senhaConfere,
  garantir, todas, porId, porSlug, limparCache, movimento, meusCargos,
  contexto, exigeCidade,
};
