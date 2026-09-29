// ============================================================================
// O QUE CONTA COMO ATIVIDADE — a definição, testada.
//   PGHOST=/tmp PGPORT=5477 PGUSER=postgres PGDATABASE=t2teste node teste_atividade.js
// Julio: "nao e definido nem setado em momento algum oque seria uma operacao da
// policia, uma prisao? multa? e do jornal?". Este teste É a definição executável.
// ============================================================================
const { Pool } = require('pg');
const pool = new Pool({ host: process.env.PGHOST || '/tmp', port: parseInt(process.env.PGPORT) || 5477,
  user: process.env.PGUSER || 'postgres', database: process.env.PGDATABASE || 't2teste' });
const alvo = require.resolve('./src/db/pool');
require.cache[alvo] = { id: alvo, filename: alvo, loaded: true, exports: pool, children: [], paths: [] };
const caixa = require('./src/corp-caixa-db');
const ORC = require('./src/corp-orcamento');

let ok = 0; const falhas = [];
const t = (n, c, e) => { if (c) ok++; else falhas.push(n + (e !== undefined ? ' -> ' + JSON.stringify(e) : '')); };
const conta = async (id) => (await pool.query(`SELECT COUNT(*)::int n FROM corp_atividade WHERE corporation_id=$1`, [id])).rows[0].n;

(async () => {
  const fs = require('fs');
  const mm = fs.readFileSync(require.resolve('./src/db/migrate.js'), 'utf8').match(/const migration = `([\s\S]*?)`;/);
  await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  await pool.query(mm[1]);
  const pm = (await pool.query(`INSERT INTO corporations (name, slug) VALUES ('PM','policia-militar') RETURNING id`)).rows[0].id;

  // a lista que a rota aceita, lida do proprio arquivo (a definicao mora la)
  const src = fs.readFileSync(require.resolve('./src/routes/game-api.js'), 'utf8');
  const lista = JSON.parse(src.match(/const ATIVIDADES_VALIDAS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  t('a definicao tem 5 tipos', lista.length === 5, lista);
  for (const tipo of ['prisao', 'multa', 'apreensao', 'reanimacao', 'estabilizacao']) {
    t('conta ' + tipo, lista.includes(tipo), lista);
  }
  // o que NAO pode contar: dinheiro que cai depois, ou clique do comando
  for (const tipo of ['divida', 'venda', 'patio', 'aporte', 'bonus', 'compra']) {
    t('NAO conta ' + tipo, !lista.includes(tipo), lista);
  }

  // multa credita caixa E conta atividade; divida credita e NAO conta
  await caixa.movDinheiro(pm, 'multa', 360, { quem: 'Bandido', por: 'PolicialA' });
  await caixa.registrarAtividade(pm, 'multa', 'PolicialA');
  t('multa virou 1 atividade', (await conta(pm)) === 1);
  await caixa.movDinheiro(pm, 'divida', 500, { quem: 'Bandido', por: 'PolicialA' });
  await caixa.movDinheiro(pm, 'venda', 9000, { quem: 'Patio', por: 'Comando' });
  t('divida e venda NAO criam atividade', (await conta(pm)) === 1, await conta(pm));

  // o efeito no repasse: cada ocorrencia vale POR_ATIVIDADE, com teto
  const base = ORC.baseDe('policia-militar');
  t('10 ocorrencias = base + 10x', ORC.valorDe('policia-militar', 10).total === base + 10 * ORC.ORC.POR_ATIVIDADE);
  t('teto corta em ' + ORC.ORC.TETO_ATIVIDADE, ORC.valorDe('policia-militar', 5000).atividade === ORC.ORC.TETO_ATIVIDADE);

  // jornal e governo: sem fonte de atividade, vivem da base
  const jornal = (await pool.query(`INSERT INTO corporations (name, slug) VALUES ('Jornal','jornal') RETURNING id`)).rows[0].id;
  t('jornal sem atividade nenhuma', (await conta(jornal)) === 0);
  t('jornal recebe so a base', ORC.valorDe('jornal', 0).total === ORC.baseDe('jornal') && ORC.baseDe('jornal') > 0);

  console.log(`\n${ok}/${ok + falhas.length} passaram`);
  falhas.forEach(f => console.log('  X ' + f));
  if (falhas.length) process.exitCode = 1;
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
