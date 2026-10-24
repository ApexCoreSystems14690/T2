// ============================================================================
// [24/10] ISOLAMENTO TOTAL POR CIDADE (fase 2 do plano das cidades)
//
// [stated] Julio: "a cidade de teste ... deveria ser 100%, um santa fe inteiro, so que separado
// ... o painel dela deveria setar tudo para ela ... como 2 mundos diferentes" e "cada cidade deve
// ter sua grade propria de ssu, e literalmente TUDO separado".
//
// Em vez de reescrever as ~290 consultas do site uma a uma (e esquecer alguma), quem separa é o
// PRÓPRIO POSTGRES, com Row-Level Security:
//
//   1. CONTEXTO. Todo pedido do site (cidade da sessão) e todo pedido do jogo (header x-cidade)
//      roda dentro de um contexto { cidadeId } (AsyncLocalStorage). Tarefa de fundo que mexe com
//      dado de cidade roda uma vez por cidade, cada uma no seu contexto (porCidade).
//   2. CONEXÃO. Dentro de um contexto, cada consulta pega uma conexão, faz SET ROLE sf_app e
//      sf.cidade = <id>, roda, e devolve a conexão limpa (RESET). sf_app NÃO é dono das tabelas,
//      então o RLS vale pra ele. Fora de contexto (boot, migrações, tela Cidades) a consulta roda
//      como sempre, com o dono, que enxerga tudo.
//   3. POLÍTICAS. Toda tabela com cidade_id só mostra/aceita as linhas da cidade do contexto.
//      Tabela da corporação (ranks, members, corp_*) só mostra o que é de corporação visível.
//      Sem cidade no contexto = nada visível (falha FECHADA).
//   4. CHAVES. O que era único no jogo todo passa a ser único POR CIDADE: game_players,
//      game_patrimonio, game_bans, game_config (cada cidade tem a SUA config, SSU, temporada...),
//      corporations.slug, eleição, procurados, ficha encerrada, contatos do celular.
//   5. INSERT sem cidade_id cai na cidade do contexto (DEFAULT sf_cidade_padrao()).
//
// Ficam GLOBAIS de propósito: users (a pessoa é uma só na rede), session, user_ips (anti-alt é
// da rede), cidades, cidade_staff (o cargo de cada um em cada cidade, lido explicitamente) e os
// regulamentos (públicos; a rota já filtra pela cidade da URL).
// ============================================================================
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

// ------------------------------------------------------------------ contexto
function run(cidadeId, fn) {
  const id = Number(cidadeId);
  return als.run({ cidadeId: Number.isInteger(id) && id > 0 ? id : null }, fn);
}
// roda SEM cidade (vê tudo): só pra coisa da plataforma (tela Cidades, movimento da rede)
function global(fn) { return als.run({ cidadeId: null }, fn); }
function atual() { const s = als.getStore(); return s ? s.cidadeId : null; }
function middleware(pegaId) {
  return function (req, res, next) { run(pegaId(req), next); };
}

// ------------------------------------------------------------------ conexão
const PREP = `SELECT set_config('sf.cidade', $1, false), set_config('role', 'sf_app', false)`;
const LIMPA = `RESET ROLE; RESET sf.cidade`;
// Se o banco não deixar virar sf_app (usuário sem permissão), o site NÃO cai: grava na cidade
// certa (o DEFAULT do cidade_id lê sf.cidade) mas a leitura fica sem a trava do RLS. O boot avisa
// em letras grandes (ver autoteste no garantir).
const PREP_SEM_PAPEL = `SELECT set_config('sf.cidade', $1, false)`;
const LIMPA_SEM_PAPEL = `RESET sf.cidade`;
let semPapel = false;

function instalar(pool) {
  if (pool.__isolado) return pool;
  pool.__isolado = true;
  const conectar = pool.connect.bind(pool);
  const consultar = pool.query.bind(pool);

  pool.connect = async function (cb) {
    if (typeof cb === 'function') {   // estilo callback (ninguém usa, mas não quebra)
      pool.connect().then(c => cb(null, c, c.release), e => cb(e));
      return undefined;
    }
    const cid = atual();
    const c = await conectar();
    if (!cid) return c;
    try { await c.query(semPapel ? PREP_SEM_PAPEL : PREP, [String(cid)]); }
    catch (e) { c.release(true); throw e; }
    const liberar = c.release.bind(c);
    let liberado = false;
    c.release = function (err) {
      if (liberado) return;
      liberado = true;
      c.release = liberar;
      if (err) return liberar(err);
      c.query(semPapel ? LIMPA_SEM_PAPEL : LIMPA).then(() => liberar(), () => liberar(true));
    };
    return c;
  };

  pool.query = function (texto, valores, cb) {
    if (typeof valores === 'function') { cb = valores; valores = undefined; }
    if (!atual()) return consultar(texto, valores, cb);
    const p = (async () => {
      const c = await pool.connect();
      try { return await c.query(texto, valores); }
      finally { c.release(); }
    })();
    if (typeof cb === 'function') { p.then(r => cb(null, r), e => cb(e)); return undefined; }
    return p;
  };
  return pool;
}

// ------------------------------------------------------------------ tarefa de fundo, cidade a cidade
async function porCidade(pool, fn) {
  const cidades = (await global(() => pool.query(`SELECT id, slug FROM cidades WHERE status <> 'fechada' ORDER BY id`))).rows;
  for (const c of cidades) {
    try { await run(c.id, () => fn(c)); }
    catch (e) { console.error(`[isolamento] tarefa na cidade ${c.slug}:`, e.message); }
  }
}

// ------------------------------------------------------------------ banco
// Tabelas que NÃO ganham RLS (globais da rede, ou lidas explicitamente por cidade da URL)
const GLOBAIS = new Set(['cidades', 'cidade_staff', 'users', 'session', 'user_ips', 'plataforma_migracoes',
  'cidade_regulamentos', 'cidade_regulamentos_hist']);

// Chaves únicas que viram "por cidade". [tabela, nome antigo, tipo, definição nova]
//   tipo 'pk' troca a chave primária; 'uq' é constraint UNIQUE; 'ix' é índice único.
const CHAVES = [
  ['game_players',      'game_players_pkey',      'pk', '(cidade_id, roblox_id)'],
  ['game_patrimonio',   'game_patrimonio_pkey',   'pk', '(cidade_id, roblox_id)'],
  ['game_bans',         'game_bans_pkey',         'pk', '(cidade_id, roblox_id)'],
  ['game_config',       'game_config_pkey',       'pk', '(cidade_id, key)'],
  ['eleicao_config',    'eleicao_config_pkey',    'pk', '(cidade_id, id)'],
  ['eleicao_estado',    'eleicao_estado_pkey',    'pk', '(cidade_id, id)'],
  ['corporations',      'corporations_slug_key',  'uq', 'uq_corporations_cidade_slug ON corporations (cidade_id, slug)'],
  ['corporations',      'idx_corporations_cnpj',  'ix', 'idx_corporations_cidade_cnpj ON corporations (cidade_id, cnpj) WHERE cnpj IS NOT NULL'],
  ['celular_contatos',  'celular_contatos_dono_numero_numero_key', 'uq', 'uq_celular_contatos_cidade ON celular_contatos (cidade_id, dono_numero, numero)'],
  ['eleicao_votantes',  'eleicao_votantes_user_id_turno_cargo_key', 'uq', 'uq_eleicao_votantes_cidade ON eleicao_votantes (cidade_id, user_id, turno, cargo)'],
  ['fichas_encerradas', 'fichas_encerradas_chave_key', 'uq', 'uq_fichas_encerradas_cidade ON fichas_encerradas (cidade_id, chave)'],
  ['procurados',        'uq_procurados_aberto',   'ix', "uq_procurados_aberto_cidade ON procurados (cidade_id, roblox_id) WHERE estado <> 'encerrado' AND roblox_id IS NOT NULL"],
  ['tester_liberacoes', 'idx_tester_lib_uma_ativa', 'ix', "idx_tester_lib_uma_ativa_cidade ON tester_liberacoes (cidade_id, user_id) WHERE status = 'ativa'"],
  ['veiculos_procurados', 'uq_veiculos_procurados_aberto', 'ix', "uq_veiculos_procurados_aberto_cidade ON veiculos_procurados (cidade_id, lower(dono_nome), carro_id) WHERE estado <> 'encerrado'"],
];

async function temColuna(pool, tabela, coluna) {
  const r = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [tabela, coluna]);
  return !!r.rows[0];
}

// Roda no COMEÇO do boot (as migrações antigas já usam ON CONFLICT (cidade_id, ...)) e de novo
// no fim (banco novo: as tabelas só existem depois). Idempotente.
async function chaves(pool) {
  return global(async () => {
    for (const [tab, antigo, tipo, def] of CHAVES) {
      if (!(await temColuna(pool, tab, 'cidade_id'))) continue;
      try {
        if (tipo === 'pk') {
          const pk = (await pool.query(
            `SELECT conname, pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'p'`, [tab])).rows[0];
          if (pk && /cidade_id/.test(pk.d)) continue;
          await pool.query(`ALTER TABLE ${tab} ALTER COLUMN cidade_id SET NOT NULL`);
          if (pk) await pool.query(`ALTER TABLE ${tab} DROP CONSTRAINT ${pk.conname}`);
          await pool.query(`ALTER TABLE ${tab} ADD PRIMARY KEY ${def}`);
        } else {
          const nomeNovo = def.split(' ')[0];
          const ja = (await pool.query(`SELECT 1 FROM pg_class WHERE relname = $1`, [nomeNovo])).rows[0];
          if (!ja) await pool.query(`CREATE UNIQUE INDEX ${def}`);
          if (tipo === 'uq') await pool.query(`ALTER TABLE ${tab} DROP CONSTRAINT IF EXISTS ${antigo}`);
          await pool.query(`DROP INDEX IF EXISTS ${antigo}`);
        }
      } catch (e) { console.error(`[isolamento] chave ${tab}/${antigo}:`, e.message); throw e; }
    }
  });
}

async function garantir(pool) {
  return global(async () => {
    await chaves(pool);
    // o papel do site dentro de uma cidade
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sf_app') THEN CREATE ROLE sf_app NOLOGIN; END IF;
      END $$;
    `);
    await pool.query(`DO $$ BEGIN EXECUTE 'GRANT sf_app TO ' || quote_ident(current_user); EXCEPTION WHEN others THEN NULL; END $$;`);
    await pool.query(`
      CREATE OR REPLACE FUNCTION sf_cidade() RETURNS INTEGER LANGUAGE sql STABLE AS
        $f$ SELECT NULLIF(current_setting('sf.cidade', true), '')::INTEGER $f$;
      CREATE OR REPLACE FUNCTION sf_cidade_padrao() RETURNS INTEGER LANGUAGE sql STABLE AS
        $f$ SELECT COALESCE(NULLIF(current_setting('sf.cidade', true), '')::INTEGER, 1) $f$;
      GRANT USAGE ON SCHEMA public TO sf_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sf_app;
      GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO sf_app;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO sf_app;
    `);
    const tabs = (await pool.query(`
      SELECT t.table_name AS t,
             bool_or(c.column_name = 'cidade_id') AS cid,
             bool_or(c.column_name = 'corporation_id') AS corp
        FROM information_schema.tables t
        JOIN information_schema.columns c ON c.table_schema = 'public' AND c.table_name = t.table_name
       WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
       GROUP BY t.table_name`)).rows;
    let n = 0;
    for (const { t, cid, corp } of tabs) {
      if (GLOBAIS.has(t)) continue;
      let regra = null;
      if (cid) {
        await pool.query(`ALTER TABLE ${t} ALTER COLUMN cidade_id SET DEFAULT sf_cidade_padrao()`);
        regra = `cidade_id = sf_cidade()`;
      } else if (corp) {
        regra = `EXISTS (SELECT 1 FROM corporations c WHERE c.id = ${t}.corporation_id)`;
      } else if (t === 'governo_votos') {
        regra = `EXISTS (SELECT 1 FROM governo_propostas p WHERE p.id = governo_votos.proposta_id)`;
      }
      if (!regra) continue;
      await pool.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
      await pool.query(`DROP POLICY IF EXISTS sf_cidade_iso ON ${t}`);
      await pool.query(`CREATE POLICY sf_cidade_iso ON ${t} USING (${regra}) WITH CHECK (${regra})`);
      n++;
    }
    // autoteste: o site consegue mesmo virar sf_app?
    const cli = await pool.connect();
    try {
      await cli.query(`SET ROLE sf_app`);
      await cli.query(`RESET ROLE`);
      semPapel = false;
      console.log(`[isolamento] ${n} tabelas separadas por cidade (RLS ligado)`);
    } catch (e) {
      semPapel = true;
      console.error('❌❌ [isolamento] o banco NÃO deixou usar o papel sf_app (' + e.message + '). '
        + 'As gravações vão pra cidade certa, mas a LEITURA não está travada por cidade. Conferir o usuário do banco.');
    } finally { cli.release(); }
    return n;
  });
}

function rlsLigado() { return !semPapel; }
module.exports = { rlsLigado, als, run, global, atual, middleware, instalar, porCidade, chaves, garantir, GLOBAIS, CHAVES };
