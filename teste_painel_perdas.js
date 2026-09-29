// ============================================================================
// O QUE O COMANDANTE PODE VER — Postgres de verdade.
//   PGHOST=/tmp PGPORT=5477 PGUSER=postgres PGDATABASE=t2orc node teste_painel_perdas.js
// [stated] Julio: ele "só pode ver quantas armas foram perdidas no dia etc
// quantas tinham e pa, ele que descubra e cobre seus agentes".
// Então o teste prova o NEGATIVO: nenhum movimento de equipamento com nome
// aparece no extrato, e a perda vira número por dia.
// ============================================================================
const { Pool } = require('pg');
const pool = new Pool({ host: process.env.PGHOST || '/tmp', port: parseInt(process.env.PGPORT) || 5477,
  user: process.env.PGUSER || 'postgres', database: process.env.PGDATABASE || 't2orc' });
const alvo = require.resolve('./src/db/pool');
require.cache[alvo] = { id: alvo, filename: alvo, loaded: true, exports: pool, children: [], paths: [] };
const caixa = require('./src/corp-caixa-db');

let ok = 0; const falhas = [];
const t = (n, c, e) => { if (c) ok++; else falhas.push(n + (e !== undefined ? ' -> ' + JSON.stringify(e) : '')); };

(async () => {
  // [29/09] O SCHEMA VEM DO migrate.js DE VERDADE, nao de um CREATE TABLE que eu
  // escrevo aqui. Eu ja me queimei: inventei a coluna `em` no teste enquanto a
  // real se chama `criado_em`, o teste passou e a query do painel estava quebrada.
  const fs = require('fs');
  const srcMig = fs.readFileSync(require.resolve('./src/db/migrate.js'), 'utf8');
  const mm = srcMig.match(/const migration = `([\s\S]*?)`;/);
  if (!mm) throw new Error('nao achei o SQL do migrate.js');
  await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  await pool.query(mm[1]);

  const pm = (await pool.query(`INSERT INTO corporations (name, slug) VALUES ('PM','policia-militar') RETURNING id`)).rows[0].id;

  // comando compra 5 FAL e 2 T4; dinheiro entra de multa
  await caixa.movDinheiro(pm, 'aporte', 500000, { quem: 'Julio', por: 'Julio' });
  for (let i = 0; i < 5; i++) await caixa.movEstoque(pm, 'comprou', 'comando', 'FAL');
  for (let i = 0; i < 2; i++) await caixa.movEstoque(pm, 'comprou', 'comando', 'T4');
  await caixa.movDinheiro(pm, 'multa', 360, { quem: 'Bandido', por: 'PolicialA' });

  // tres policiais retiram
  await caixa.movEstoque(pm, 'retirou', 'PolicialA', 'FAL');
  await caixa.movEstoque(pm, 'retirou', 'PolicialB', 'FAL');
  await caixa.movEstoque(pm, 'retirou', 'PolicialC', 'T4');
  // A foi assaltado de verdade; B DESVIOU (manda o mesmo 'roubada'); C morreu
  await caixa.movEstoque(pm, 'roubada', 'PolicialA', 'FAL');
  await caixa.movEstoque(pm, 'roubada', 'PolicialB', 'FAL');
  await caixa.movEstoque(pm, 'morreu',  'PolicialC', 'T4');
  // comando dá baixa numa peça encostada
  await caixa.movEstoque(pm, 'baixa', 'comando', 'FAL');

  const d = await caixa.painel(pm, 200);

  // ---- 1) o extrato NÃO pode ter movimento de equipamento
  t('extrato sem linha de estoque', d.extrato.every(l => l.tipo !== 'estoque'), d.extrato.map(l => l.tipo));
  t('extrato nao cita PolicialA/B/C',
    !d.extrato.some(l => ['PolicialB', 'PolicialC'].includes(l.quem)),
    d.extrato.map(l => l.quem));
  t('extrato ainda tem o dinheiro', d.extrato.some(l => l.tipo === 'multa') && d.extrato.some(l => l.tipo === 'aporte'));
  t('balanco continua certo', d.balanco.entrou === 500360, d.balanco);

  // ---- 2) as perdas viram NÚMERO por dia, sem nome
  const total = d.perdas_dia.reduce((a, p) => a + p.qtd, 0);
  t('perdas_dia existe', Array.isArray(d.perdas_dia), d.perdas_dia);
  t('3 perdas de rua no total', total === 3, d.perdas_dia);
  t('2 FAL perdidos', (d.perdas_dia.find(p => p.item === 'FAL') || {}).qtd === 2, d.perdas_dia);
  t('1 T4 perdido', (d.perdas_dia.find(p => p.item === 'T4') || {}).qtd === 1, d.perdas_dia);
  t('baixa do comando NAO entra nas perdas de rua', total === 3, d.perdas_dia);
  t('nenhum nome nas perdas', !JSON.stringify(d.perdas_dia).match(/Policial/), d.perdas_dia);
  t('nao da pra separar desvio de assalto',
    !JSON.stringify(d.perdas_dia).match(/desvi/i) && !JSON.stringify(d.extrato).match(/desvi/i));

  // ---- 3) o que ele PODE ver continua lá
  const fal = d.itens.find(i => i.item === 'FAL');
  t('sabe quantas tinha/tem na prateleira', fal.prateleira === 2, fal);   // 5 - 2 retiradas - 1 baixa
  t('sabe quantas estao na rua', fal.rua === 0, fal);
  t('sabe o total perdido do item', fal.perdido === 3, fal);             // 2 roubadas + 1 baixa
  t('sabe quem esta com equipamento AGORA', Array.isArray(d.emprestimos));

  console.log(`\n${ok}/${ok + falhas.length} passaram`);
  falhas.forEach(f => console.log('  X ' + f));
  if (falhas.length) process.exitCode = 1;
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
