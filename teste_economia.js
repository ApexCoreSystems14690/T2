// [22/10] Economia só soma a temporada atual e a cidade atual.
const assert = require('assert');
const pool = require('./src/db/pool');
const E = require('./src/economia');
const CID = require('./src/cidades');
(async () => {
  const q = (s, p) => pool.query(s, p);
  await CID.garantir(pool);
  await q(`DELETE FROM game_patrimonio WHERE roblox_id BETWEEN 9900 AND 9999`);
  await q(`DELETE FROM game_config WHERE key IN ('wipe_em','temporada')`);
  // velho (wipe passado, tester rico), novo online e novo offline
  await q(`INSERT INTO game_patrimonio (roblox_id, nome, bolso, banco, atualizado_em) VALUES
    (9901,'tester_velho',5000000,9000000, NOW() - INTERVAL '10 days'),
    (9902,'novo_online',1000,2000, NOW()),
    (9903,'novo_offline',300,700, NOW() - INTERVAL '2 days')`);
  const sem = await E.relatorio(0, 1);
  const tinhaVelho = sem.ricos.some(r => r.nome === 'tester_velho');
  await q(`INSERT INTO game_config (key, value) VALUES ('wipe_em', $1::jsonb)`, [JSON.stringify({ em: new Date(Date.now() - 5 * 86400000).toISOString() })]);
  const com = await E.relatorio(0, 1);
  const nomes = com.ricos.map(r => r.nome).filter(n => /^(tester|novo)/.test(n));
  assert.ok(tinhaVelho, 'sem wipe registrado o velho ainda aparece');
  assert.deepStrictEqual(nomes.sort(), ['novo_offline', 'novo_online']);
  const r7 = await E.relatorio(7, 1);   // janela de dias também funciona
  assert.ok(r7.circulando.total >= 4000);
  console.log('ok: velho some, offline da temporada fica. total =', com.circulando.total);
  await q(`DELETE FROM game_patrimonio WHERE roblox_id BETWEEN 9900 AND 9999`);
  await q(`DELETE FROM game_config WHERE key IN ('wipe_em','temporada')`);
  await pool.end();
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
