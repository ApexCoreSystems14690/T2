// ============================================================================
// TESTE DE INTEGRAÇÃO DO CAIXA — contra Postgres DE VERDADE, não mock.
//
//   PGHOST=/tmp PGPORT=5433 PGUSER=postgres PGDATABASE=t2teste node teste_caixa_db.js
//
// Prova o que teste unitário não prova: transação, lock por corporação, o CHECK
// do banco, e o caminho inteiro compra -> retirada -> perda -> painel.
// ============================================================================
const { Pool } = require('pg');
const path = require('path');

const pool = new Pool({
  host: process.env.PGHOST || '/tmp',
  port: parseInt(process.env.PGPORT) || 5433,
  user: process.env.PGUSER || 'postgres',
  database: process.env.PGDATABASE || 't2teste',
});
// o pool do projeto exige DATABASE_URL + ssl; aqui trocamos por este, local
const alvo = require.resolve('./src/db/pool');
require.cache[alvo] = { id: alvo, filename: alvo, loaded: true, exports: pool, children: [], paths: [] };

const caixa = require('./src/corp-caixa-db');

let ok = 0; const falhas = [];
function t(nome, cond, extra) {
  if (cond) ok++; else falhas.push(nome + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''));
}

(async () => {
  // corp limpa pra cada rodada
  await pool.query(`INSERT INTO corporations (name, slug) VALUES ('QA Caixa','qa-caixa') ON CONFLICT (slug) DO NOTHING`);
  const cid = (await pool.query(`SELECT id FROM corporations WHERE slug='qa-caixa'`)).rows[0].id;
  for (const tb of ['corp_lancamentos', 'corp_emprestimos', 'corp_estoque', 'corp_caixa']) {
    await pool.query(`DELETE FROM ${tb} WHERE corporation_id = $1`, [cid]);
  }
  await pool.query(
    `INSERT INTO game_config (key, value, updated_at) VALUES ('precos_itens', $1::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $1::jsonb`,
    [JSON.stringify({ itens: { 'FAL': 8750, 'Colete': 20000, 'Algema': 425 } })]);

  // ---- 1. o caixa começa zerado e o dinheiro entra
  let r = await caixa.movDinheiro(cid, 'multa', 200, { quem: 'Julio', por: 'Ana' });
  t('multa credita', r.ok && r.saldo === 200, r.saldo);
  r = await caixa.movDinheiro(cid, 'patio', 4950, { quem: 'Bia', por: 'Ana' });
  t('patio credita', r.ok && r.saldo === 5150, r.saldo);

  // ---- 2. gastar mais do que tem é RECUSADO e não deixa rastro
  const antes = (await pool.query(`SELECT COUNT(*)::int c FROM corp_lancamentos WHERE corporation_id=$1`, [cid])).rows[0].c;
  r = await caixa.movDinheiro(cid, 'bonus', 999999, { quem: 'Ana' });
  t('bonus sem saldo recusa', r.ok === false && r.erro === 'saldo', r);
  const depois = (await pool.query(`SELECT COUNT(*)::int c FROM corp_lancamentos WHERE corporation_id=$1`, [cid])).rows[0].c;
  t('recusa NAO grava lancamento', antes === depois, { antes, depois });
  t('saldo intacto', (await pool.query(`SELECT saldo FROM corp_caixa WHERE corporation_id=$1`, [cid])).rows[0].saldo === '5150');

  // ---- 3. comprar move dinheiro E estoque na mesma transação
  const precos = await caixa.precos();
  t('precos vieram do game_config', precos.FAL === 8750, precos);
  r = await caixa.comprar(cid, 'Algema', 4, precos, { por: 'Delegado' });
  t('comprou 4 algemas', r.ok && r.total === 1700 && r.prateleira === 4, r);
  t('saldo desceu', r.saldo === 5150 - 1700, r.saldo);

  r = await caixa.comprar(cid, 'FAL', 1, precos, { por: 'Delegado' });
  t('FAL custa mais que o caixa', r.ok === false && r.erro === 'saldo', r);
  const est = await pool.query(`SELECT qtd FROM corp_estoque WHERE corporation_id=$1 AND item='FAL'`, [cid]);
  t('compra recusada nao criou estoque', est.rows.length === 0, est.rows);

  r = await caixa.comprar(cid, 'Bazuca', 1, precos, { por: 'Delegado' });
  t('item sem preco recusa', r.ok === false && r.erro === 'sem_preco');

  // ---- 4. o ciclo do empréstimo
  r = await caixa.movEstoque(cid, 'retirou', 'Julio', 'Algema', { roblox_id: 123 });
  t('retirou', r.ok && r.lancamento.sobrou === 3, r);
  const e1 = await pool.query(`SELECT qtd, roblox_id FROM corp_emprestimos WHERE corporation_id=$1 AND nome='Julio'`, [cid]);
  t('emprestimo gravado com roblox_id', e1.rows[0] && e1.rows[0].qtd === 1 && String(e1.rows[0].roblox_id) === '123', e1.rows[0]);

  r = await caixa.movEstoque(cid, 'retirou', 'Julio', 'Algema');
  t('segunda peca recusada', r.ok === false && r.erro === 'ja_tem', r);

  r = await caixa.movEstoque(cid, 'saiu', 'Julio', 'Algema');
  t('saiu de servico devolve', r.ok && r.lancamento.sobrou === 4, r);
  const e2 = await pool.query(`SELECT 1 FROM corp_emprestimos WHERE corporation_id=$1 AND nome='Julio'`, [cid]);
  t('linha do emprestimo sumiu', e2.rows.length === 0);

  // ---- 5. A REGRA DO JULIO: roubada e morte nao devolvem
  await caixa.movEstoque(cid, 'retirou', 'Bia', 'Algema');
  r = await caixa.movEstoque(cid, 'roubada', 'Bia', 'Algema');
  t('roubada nao devolve', r.ok && r.lancamento.sobrou === 3, r.lancamento);
  await caixa.movEstoque(cid, 'retirou', 'Caio', 'Algema');
  r = await caixa.movEstoque(cid, 'morreu', 'Caio', 'Algema');
  t('morte nao devolve', r.ok && r.lancamento.sobrou === 2, r.lancamento);
  const perd = await pool.query(`SELECT perdidos FROM corp_estoque WHERE corporation_id=$1 AND item='Algema'`, [cid]);
  t('2 perdas contadas na tabela', perd.rows[0].perdidos === 2, perd.rows[0]);

  // ---- 6. LOCK: 6 policiais correndo pra ultima peca
  await pool.query(`UPDATE corp_estoque SET qtd = 1 WHERE corporation_id=$1 AND item='Algema'`, [cid]);
  await pool.query(`DELETE FROM corp_emprestimos WHERE corporation_id=$1`, [cid]);
  const corrida = await Promise.all(
    ['p1','p2','p3','p4','p5','p6'].map(n => caixa.movEstoque(cid, 'retirou', n, 'Algema')));
  const levaram = corrida.filter(x => x.ok).length;
  t('so UM leva a ultima peca', levaram === 1, { levaram, erros: corrida.filter(x => !x.ok).map(x => x.erro) });
  const sobra = await pool.query(`SELECT qtd FROM corp_estoque WHERE corporation_id=$1 AND item='Algema'`, [cid]);
  t('estoque zerado, nunca negativo', sobra.rows[0].qtd === 0, sobra.rows[0]);

  // ---- 7. o painel
  const p = await caixa.painel(cid);
  const alg = p.itens.find(i => i.item === 'Algema');
  t('painel: prateleira 0', alg && alg.prateleira === 0, alg);
  t('painel: 1 na rua', alg && alg.rua === 1, alg);
  t('painel: 2 perdidas', alg && alg.perdido === 2, alg);
  t('painel: extrato tem linhas', p.extrato.length > 8, p.extrato.length);
  t('painel: balanco fecha com o saldo',
    p.balanco.entrou - p.balanco.saiu === p.saldo, { bal: p.balanco, saldo: p.saldo });
  t('painel: emprestimo listado', p.emprestimos.length === 1, p.emprestimos);

  // ---- 8. o CHECK do banco é a segunda rede
  let estourou = false;
  try {
    await pool.query(`UPDATE corp_estoque SET qtd = -1 WHERE corporation_id=$1 AND item='Algema'`, [cid]);
  } catch (e) { estourou = /check|viola/i.test(e.message); }
  t('banco recusa estoque negativo', estourou);

  // ---- fim
  await pool.end();
  const total = ok + falhas.length;
  if (falhas.length) {
    console.log(`\n${ok}/${total} — FALHAS:`);
    for (const f of falhas) console.log('  ✗ ' + f);
    process.exit(1);
  }
  console.log(`\n${ok}/${total} — todos passaram ✅`);
})().catch(e => { console.error('EXPLODIU:', e); process.exit(1); });
