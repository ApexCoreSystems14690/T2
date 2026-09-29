// ============================================================================
// CATÁLOGO DO VESTIÁRIO — o comandante só compra o que o armário dele já dava.
//   PGHOST=/tmp PGPORT=5477 PGUSER=postgres PGDATABASE=t2teste node teste_catalogo.js
// [stated] Julio: o painel tinha "TUDO do jogo praticamente, inclusive armas de
// crime"; "só deve ter como ele comprar exatamente o que o armário já dava".
// Schema do migrate.js de verdade -- já me queimei inventando coluna no teste.
// ============================================================================
const { Pool } = require('pg');
const pool = new Pool({ host: process.env.PGHOST || '/tmp', port: parseInt(process.env.PGPORT) || 5477,
  user: process.env.PGUSER || 'postgres', database: process.env.PGDATABASE || 't2teste' });
const alvo = require.resolve('./src/db/pool');
require.cache[alvo] = { id: alvo, filename: alvo, loaded: true, exports: pool, children: [], paths: [] };
const caixa = require('./src/corp-caixa-db');

let ok = 0; const falhas = [];
const t = (n, c, e) => { if (c) ok++; else falhas.push(n + (e !== undefined ? ' -> ' + JSON.stringify(e) : '')); };

(async () => {
  const fs = require('fs');
  const srcMig = fs.readFileSync(require.resolve('./src/db/migrate.js'), 'utf8');
  const mm = srcMig.match(/const migration = `([\s\S]*?)`;/);
  await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  await pool.query(mm[1]);
  await pool.query(`CREATE TABLE IF NOT EXISTS game_config (key VARCHAR(64) PRIMARY KEY, value JSONB, updated_at TIMESTAMP DEFAULT NOW())`);
  const pm = (await pool.query(`INSERT INTO corporations (name, slug) VALUES ('PM','policia-militar') RETURNING id`)).rows[0].id;

  // ---- 1) sem catálogo publicado: não libera nada (melhor travar que vender AK47)
  t('sem catalogo, catalogo() = null', (await caixa.catalogo('policia-militar')) === null);
  t('sem catalogo, precos(slug) = {}', Object.keys(await caixa.precos('policia-militar')).length === 0);

  // ---- o jogo publica: preços globais (com armas de crime) + catálogo por corp
  await pool.query(
    `INSERT INTO game_config (key, value) VALUES ('precos_itens', $1::jsonb)`,
    [JSON.stringify({ itens: { 'FAL': 8750, 'PT 92': 7366, 'Algema': 425, 'ColetePM': 20000,
                               'AK47': 42000, 'CAR15': 60658, 'MP5': 17509, 'Maca': 0 } })]);
  await pool.query(
    `INSERT INTO game_config (key, value) VALUES ('catalogo_corps', $1::jsonb)`,
    [JSON.stringify({ corps: {
      'policia-militar': ['Algema', 'Boito 84', 'ColetePM', 'FAL', 'IA2', 'MT40', 'PT 92'],
      'samu': ['Barricada', 'Cone', 'Maca', 'Maleta médica'],
      'pavuna': [],
    } })]);

  // ---- 2) o seletor da PM
  const p = await caixa.precos('policia-militar');
  t('PM ve FAL', p['FAL'] === 8750, p);
  t('PM ve o colete dela', p['ColetePM'] === 20000, p);
  t('PM NAO ve AK47', p['AK47'] === undefined, Object.keys(p));
  t('PM NAO ve CAR15', p['CAR15'] === undefined, Object.keys(p));
  t('PM NAO ve MP5', p['MP5'] === undefined, Object.keys(p));
  t('item do catalogo SEM preco nao aparece', p['Boito 84'] === undefined, Object.keys(p));
  t('sem slug continua vendo tudo (uso interno)', Object.keys(await caixa.precos()).length === 8);

  // ---- 3) SAMU não vê arma nenhuma
  const s = await caixa.precos('samu');
  t('SAMU nao ve FAL', s['FAL'] === undefined, Object.keys(s));
  t('Maca com preco 0 nao entra', s['Maca'] === undefined, Object.keys(s));

  // ---- 4) corp sem vestiário
  t('pavuna: catalogo vazio', (await caixa.catalogo('pavuna')).length === 0);
  t('pavuna nao compra nada', Object.keys(await caixa.precos('pavuna')).length === 0);
  t('slug que nao existe no catalogo = []', (await caixa.catalogo('nao-existe')).length === 0);

  // ---- 5) a trava do BANCO: comprar fora do catálogo não pode passar nem por dentro
  await caixa.movDinheiro(pm, 'aporte', 500000, { quem: 'Julio' });
  const rBom = await caixa.comprar(pm, 'FAL', 1, await caixa.precos('policia-militar'), { por: 'Julio' });
  t('compra do catalogo passa', rBom.ok === true, rBom);
  const rRuim = await caixa.comprar(pm, 'AK47', 1, await caixa.precos('policia-militar'), { por: 'Julio' });
  t('AK47 recusada mesmo chamando direto', rRuim.ok === false, rRuim);
  t('AK47 nao debitou o caixa', rRuim.erro === 'sem_preco', rRuim);

  console.log(`\n${ok}/${ok + falhas.length} passaram`);
  falhas.forEach(f => console.log('  X ' + f));
  if (falhas.length) process.exitCode = 1;
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
