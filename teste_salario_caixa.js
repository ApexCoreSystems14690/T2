// [23/10] Salário saindo do caixa da corp (minutos trabalhados) + emprego civil pelo tesouro.
// Rodar com o site no ar: TZ=UTC DATABASE_URL=... BASE=http://localhost:4600 ROBLOX_API_KEY=k123 node teste_salario_caixa.js
const assert = require('assert');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.BASE || 'http://localhost:4600';
const KEY = process.env.ROBLOX_API_KEY || 'k123';
const GOV = require('./src/governo');
let ok = 0, falhou = 0;
async function caso(n, f) { try { await f(); ok++; console.log('  ok  ' + n); } catch (e) { falhou++; console.log('  FALHOU  ' + n + '\n        ' + e.message); } }
const jogo = (path, body, cidade) => fetch(BASE + '/api/game' + path, {
  method: 'POST', headers: { 'x-api-key': KEY, 'Content-Type': 'application/json', ...(cidade ? { 'x-cidade': cidade } : {}) },
  body: JSON.stringify(body) }).then(async r => ({ s: r.status, j: await r.json().catch(() => null) }));
const saldo = async (cid) => Number((await pool.query(`SELECT saldo FROM corp_caixa WHERE corporation_id = $1`, [cid])).rows[0].saldo);
const setSaldo = (cid, v) => pool.query(`INSERT INTO corp_caixa (corporation_id, saldo) VALUES ($1,$2) ON CONFLICT (corporation_id) DO UPDATE SET saldo = $2`, [cid, v]);

(async () => {
  // corp de teste na Santa Fé (cidade 1), com 2 cargos
  await pool.query(`DELETE FROM members WHERE user_id IN (SELECT id FROM users WHERE discord_id LIKE 'sc_%')`);
  await pool.query(`DELETE FROM users WHERE discord_id LIKE 'sc_%'`);
  let c = (await pool.query(`SELECT id FROM corporations WHERE slug = 'teste-salcaixa'`)).rows[0];
  if (!c) c = (await pool.query(`INSERT INTO corporations (name, slug, tipo, cidade_id) VALUES ('Teste SalCaixa','teste-salcaixa','corp',1) RETURNING id`)).rows[0];
  const CID = c.id;
  await pool.query(`DELETE FROM corp_lancamentos WHERE corporation_id = $1`, [CID]);
  await pool.query(`DELETE FROM ranks WHERE corporation_id = $1`, [CID]);
  const rk = async (n, l, s) => (await pool.query(`INSERT INTO ranks (corporation_id, name, level, salary) VALUES ($1,$2,$3,$4) RETURNING id`, [CID, n, l, s])).rows[0].id;
  const rCabo = await rk('Cabo', 2, 4000), rZero = await rk('Voluntario', 1, 0);
  const u = async (d, rid) => (await pool.query(`INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username, roblox_verificado) VALUES ($1,$1,$2,$1,true) RETURNING id`, [d, rid])).rows[0].id;
  const a = await u('sc_a', 7701), b = await u('sc_b', 7702), z = await u('sc_z', 7703); await u('sc_fora', 7704);
  await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3),($1,$4,$3),($1,$5,$6)`, [CID, a, rCabo, b, z, rZero]);

  console.log('\nSALÁRIO PELO CAIXA DA CORP');
  await caso('40 de 40 min: paga o ranks.salary inteiro e debita o caixa', async () => {
    await setSaldo(CID, 10000);
    const r = await jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7701, quem: 'sc_a', minutos: 40 });
    assert.strictEqual(r.j.ok, true, JSON.stringify(r.j)); assert.strictEqual(r.j.pago, 4000);
    assert.strictEqual(await saldo(CID), 6000);
  });
  await caso('pedido repetido em menos de 30 min = ja_pago (não paga 2 vezes)', async () => {
    const r = await jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7701, quem: 'sc_a', minutos: 40 });
    assert.strictEqual(r.j.erro, 'ja_pago'); assert.strictEqual(await saldo(CID), 6000);
  });
  await caso('20 de 40 min: paga metade', async () => {
    const r = await jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7702, quem: 'sc_b', minutos: 20 });
    assert.strictEqual(r.j.pago, 2000); assert.strictEqual(await saldo(CID), 4000);
  });
  await caso('minutos acima de 40 viram 40 (não paga a mais)', async () => {
    await pool.query(`DELETE FROM corp_lancamentos WHERE corporation_id = $1`, [CID]);
    const r = await jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7702, quem: 'sc_b', minutos: 999 });
    assert.strictEqual(r.j.pago, 4000); assert.strictEqual(r.j.minutos, 40);
  });
  await caso('cargo sem salário = sem_salario; quem não é membro = nao_e_membro; 0 minuto = sem_minutos', async () => {
    assert.strictEqual((await jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7703, minutos: 40 })).j.erro, 'sem_salario');
    assert.strictEqual((await jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7704, minutos: 40 })).j.erro, 'nao_e_membro');
    await pool.query(`DELETE FROM corp_lancamentos WHERE corporation_id = $1`, [CID]);
    assert.strictEqual((await jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7701, minutos: 0 })).j.erro, 'sem_minutos');
  });
  await caso('caixa sem saldo = sem_saldo e o saldo não mexe', async () => {
    await setSaldo(CID, 1000);
    const r = await jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7701, minutos: 40 });
    assert.strictEqual(r.j.erro, 'sem_saldo'); assert.strictEqual(await saldo(CID), 1000);
  });
  await caso('CONCORRÊNCIA: 2 salários ao mesmo tempo, saldo pra 1 só -> exatamente 1 paga, saldo nunca negativo', async () => {
    for (let k = 0; k < 5; k++) {
      await pool.query(`DELETE FROM corp_lancamentos WHERE corporation_id = $1`, [CID]);
      await setSaldo(CID, 5000);
      const [r1, r2] = await Promise.all([
        jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7701, minutos: 40 }),
        jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7702, minutos: 40 }),
      ]);
      const pagos = [r1.j, r2.j].filter(x => x.ok).length;
      assert.strictEqual(pagos, 1, JSON.stringify([r1.j, r2.j]));
      assert.strictEqual(await saldo(CID), 1000);
    }
  });
  await caso('jeito antigo do Mercado Fechado (sem minutos) continua: paga o ranks.salary inteiro, sem trava de 30 min', async () => {
    await setSaldo(CID, 20000);
    const r1 = await jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7701, quem: 'sc_a' });
    assert.strictEqual(r1.j.ok, true); assert.strictEqual(r1.j.pago, 4000); assert.strictEqual(r1.j.adicional, 4000);
    assert.strictEqual((await jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7703 })).j.erro, 'sem_adicional');
  });
  await caso('aba Caixa: folha da semana soma os salários e diz quantos dias o caixa cobre', async () => {
    const caixa = require('./src/corp-caixa-db');
    const f = await caixa.folhaSemana(CID);
    assert.ok(f.semana >= 4000, JSON.stringify(f)); assert.ok(f.cobre_dias > 0);
  });

  console.log('\nEMPREGO CIVIL PELO TESOURO');
  const cfg = await GOV.config(pool, 1); const GID = cfg.corporation_id;
  await caso('gari dentro do teto: sai do tesouro', async () => {
    await setSaldo(GID, 1000);
    const r = await jogo('/governo/salario-emprego', { emprego: 'Lixeiro', roblox_id: 7701, quem: 'sc_a', valor: 45, tarefas: 3 });
    assert.strictEqual(r.j.ok, true, JSON.stringify(r.j)); assert.strictEqual(await saldo(GID), 955);
    const l = (await pool.query(`SELECT tipo FROM corp_lancamentos WHERE corporation_id = $1 ORDER BY id DESC LIMIT 1`, [GID])).rows[0];
    assert.strictEqual(l.tipo, 'salario_emprego');
  });
  await caso('valor acima do teto é recusado inteiro', async () => {
    const r = await jogo('/governo/salario-emprego', { emprego: 'Lixeiro', roblox_id: 7701, valor: 5000, tarefas: 1 });
    assert.strictEqual(r.j.erro, 'acima_do_teto'); assert.strictEqual(await saldo(GID), 955);
    assert.strictEqual((await jogo('/governo/salario-emprego', { emprego: 'Lixeiro', roblox_id: 7701, valor: 30, tarefas: 999 })).j.erro, 'tarefas_invalidas');
  });
  await caso('emprego desconhecido e tesouro vazio são recusados', async () => {
    assert.strictEqual((await jogo('/governo/salario-emprego', { emprego: 'Hacker', roblox_id: 7701, valor: 10 })).j.erro, 'emprego_desconhecido');
    await setSaldo(GID, 5);
    assert.strictEqual((await jogo('/governo/salario-emprego', { emprego: 'Lixeiro', roblox_id: 7701, valor: 20 })).j.erro, 'sem_saldo');
    assert.strictEqual(await saldo(GID), 5);
  });
  await caso('o teto mexe pelo governo.salvarEmprego (Dono)', async () => {
    await GOV.salvarEmprego(pool, 1, 'Lixeiro', { teto: 10 });
    await setSaldo(GID, 1000);
    assert.strictEqual((await jogo('/governo/salario-emprego', { emprego: 'Lixeiro', roblox_id: 7701, valor: 15 })).j.erro, 'acima_do_teto');
    await GOV.salvarEmprego(pool, 1, 'Lixeiro', { teto: 25 });
  });

  console.log('\nISOLAMENTO ENTRE CIDADES');
  await caso('servidor de outra cidade não acha a corp nem o tesouro da Santa Fé', async () => {
    const dono = (await pool.query(`SELECT id FROM users WHERE discord_id = '111'`)).rows[0].id;
    let c2 = (await pool.query(`SELECT id, slug FROM cidades WHERE slug = 'teste-sal2'`)).rows[0];
    if (!c2) c2 = (await pool.query(`INSERT INTO cidades (slug, nome, sigla, tipo, status, loja_prefixo, dono_user_id) VALUES ('teste-sal2','Sal2','SL2','comunidade','ativa','SL2',$1) RETURNING id, slug`, [dono])).rows[0];
    await setSaldo(CID, 99999);
    const r = await jogo('/corp/salario', { corp: 'teste-salcaixa', roblox_id: 7702, minutos: 40 }, 'teste-sal2');
    assert.strictEqual(r.s, 404, JSON.stringify(r));
    assert.strictEqual(await saldo(CID), 99999);
    const g = await jogo('/governo/salario-emprego', { emprego: 'Lixeiro', roblox_id: 7701, valor: 10 }, 'teste-sal2');
    assert.ok(g.j.erro === 'sem_governo' || g.j.erro === 'emprego_desconhecido', JSON.stringify(g.j));
  });

  console.log(`\n${ok} ok, ${falhou} falharam`);
  await pool.end();
  process.exit(falhou ? 1 : 0);
})();
