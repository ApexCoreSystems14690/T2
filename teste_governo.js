// [23/10] Governo: arrecadação inflada, obras (Dono), salário a cada 3 dias, travas do caixa.
// Rodar com o site no ar: TZ=UTC DATABASE_URL=... BASE=http://localhost:4600 ROBLOX_API_KEY=k123 node teste_governo.js
const assert = require('assert');
const { Pool } = require('pg');
const sig = require('cookie-signature');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.BASE || 'http://localhost:4600';
const KEY = process.env.ROBLOX_API_KEY || 'k123';
const GOV = require('./src/governo');
let ok = 0, falhou = 0;
async function caso(n, f) { try { await f(); ok++; console.log('  ok  ' + n); } catch (e) { falhou++; console.log('  FALHOU  ' + n + '\n        ' + e.message); } }
async function sessao(uid, cidadeId) {
  const sid = 'gv' + uid + 'c' + cidadeId + Math.random().toString(36).slice(2);
  await pool.query(`INSERT INTO session (sid, sess, expire) VALUES ($1,$2,NOW()+interval '1 day')`, [sid, { cookie: { originalMaxAge: 864e5, httpOnly: true, path: '/' }, userId: uid, cidadeId }]);
  return 'connect.sid=' + encodeURIComponent('s:' + sig.sign(sid, 'dev-secret-apenas-local'));
}
async function pedir(c, met, path, body) {
  const r = await fetch(BASE + path, { method: met, redirect: 'manual', headers: { cookie: c || '', accept: 'application/json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { s: r.status, j };
}
const jogo = (path, body) => fetch(BASE + '/api/game' + path, { method: 'POST', headers: { 'x-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const saldo = async (cid) => Number((await pool.query(`SELECT saldo FROM corp_caixa WHERE corporation_id = $1`, [cid])).rows[0].saldo);

(async () => {
  const cfg = await GOV.config(pool, 1);
  const GID = cfg.corporation_id;
  // limpeza
  await pool.query(`DELETE FROM governo_salarios WHERE cidade_id = 1`);
  await pool.query(`DELETE FROM governo_arrecadacao WHERE cidade_id = 1`);
  await pool.query(`DELETE FROM corp_lancamentos WHERE corporation_id = $1`, [GID]);
  await pool.query(`UPDATE corp_caixa SET saldo = 0 WHERE corporation_id = $1`, [GID]);
  await pool.query(`UPDATE governo_config SET multiplicador = 10000 WHERE cidade_id = 1`);
  await pool.query(`DELETE FROM members WHERE corporation_id = $1`, [GID]);
  await pool.query(`DELETE FROM cidade_staff WHERE user_id IN (SELECT id FROM users WHERE discord_id LIKE 'gv_%')`);
  await pool.query(`DELETE FROM game_item_fila WHERE roblox_id BETWEEN 8800 AND 8899`);
  await pool.query(`DELETE FROM game_logs WHERE jogador LIKE 'gv_%'`);
  await pool.query(`DELETE FROM users WHERE discord_id LIKE 'gv_%'`);
  const u = async (d, rid) => (await pool.query(`INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username, roblox_verificado) VALUES ($1,$1,$2,$1,true) RETURNING id`, [d, rid])).rows[0].id;
  const pres = await u('gv_pres', 8801), parl = await u('gv_parl', 8802), semRbx = await u('gv_semrbx', null), civil = await u('gv_civil', 8803), dir = await u('gv_dir', 8804);
  await pool.query(`INSERT INTO cidade_staff (cidade_id, user_id, cargo) VALUES (1,$1,'diretor')`, [dir]);
  const rk = async (nome) => (await pool.query(`SELECT id FROM ranks WHERE corporation_id = $1 AND name = $2`, [GID, nome])).rows[0].id;
  await pool.query(`UPDATE ranks SET salary = 9000 WHERE corporation_id = $1 AND name = 'Presidente da República'`, [GID]);
  await pool.query(`UPDATE ranks SET salary = 4000 WHERE corporation_id = $1 AND name = 'Parlamentar'`, [GID]);
  await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3),($1,$4,$5),($1,$6,$5)`, [GID, pres, await rk('Presidente da República'), parl, await rk('Parlamentar'), semRbx]);
  const dono = (await pool.query(`SELECT id FROM users WHERE discord_id = '111'`)).rows[0].id;
  const DN = await sessao(dono, 1);

  console.log('\nCORPORAÇÃO');
  await caso('existe a corp Governo (tipo governo), 8 obras e os cargos do Governo', async () => {
    const c = (await pool.query(`SELECT tipo, slug FROM corporations WHERE id = $1`, [GID])).rows[0];
    assert.strictEqual(c.tipo, 'governo'); assert.strictEqual(c.slug, 'governo');
    assert.strictEqual((await pool.query(`SELECT COUNT(*)::int n FROM governo_obras WHERE cidade_id = 1`)).rows[0].n, 8);
    assert.ok((await pool.query(`SELECT COUNT(*)::int n FROM ranks WHERE corporation_id = $1`, [GID])).rows[0].n >= 10);
  });

  console.log('\nARRECADAÇÃO');
  await caso('compras do jogo entram x10000; lixo é descartado', async () => {
    const t = Math.floor(Date.now() / 1000);
    await jogo('/logs', { job_id: 'job-gv', eventos: [
      { tipo: 'compra', jogador: 'gv_civil', detalhe: { userId: 8803, valor: 15000, categoria: 'carro' }, t },
      { tipo: 'compra', jogador: 'gv_civil', detalhe: { userId: 8803, valor: 250, categoria: 'combustivel' }, t },
      { tipo: 'compra', jogador: 'gv_civil', detalhe: { userId: 8803, valor: 40, categoria: 'inventada' }, t },
      { tipo: 'compra', jogador: 'gv_civil', detalhe: { userId: 8803, valor: -999999 }, t },
      { tipo: 'compra', jogador: 'gv_civil', detalhe: { userId: 8803, valor: 9e12 }, t },
      { tipo: 'entrou', jogador: 'gv_civil', detalhe: { userId: 8803, valor: 777 }, t },
    ] });
    assert.strictEqual(await saldo(GID), (15000 + 250 + 40) * 10000);
    const outros = (await pool.query(`SELECT SUM(valor_real)::int v FROM governo_arrecadacao WHERE categoria = 'outros'`)).rows[0].v;
    assert.strictEqual(outros, 40);
  });
  await caso('o Dono muda o multiplicador e vale pras próximas compras', async () => {
    assert.strictEqual((await pedir(DN, 'PUT', '/api/governo/config', { multiplicador: 2 })).s, 200);
    const antes = await saldo(GID);
    await jogo('/logs', { job_id: 'job-gv', eventos: [{ tipo: 'compra', jogador: 'gv_civil', detalhe: { userId: 8803, valor: 100, categoria: 'item' } }] });
    assert.strictEqual(await saldo(GID), antes + 200);
    await pedir(DN, 'PUT', '/api/governo/config', { multiplicador: 10000 });
  });

  console.log('\nQUEM VÊ E QUEM MEXE');
  await caso('civil não vê (403); membro do Governo e staff veem', async () => {
    assert.strictEqual((await pedir(await sessao(civil, 1), 'GET', '/api/governo')).s, 403);
    assert.strictEqual((await pedir(await sessao(parl, 1), 'GET', '/api/governo')).s, 200);
    assert.strictEqual((await pedir(await sessao(dir, 1), 'GET', '/api/governo')).s, 200);
  });
  await caso('só o Dono retira obra e mexe no multiplicador (membro e Diretor: 403)', async () => {
    for (const quem of [pres, dir]) {
      const c = await sessao(quem, 1);
      assert.strictEqual((await pedir(c, 'POST', '/api/governo/obra', { obra: 'praca', descricao: 'Projeto aprovado na Câmara' })).s, 403);
      assert.strictEqual((await pedir(c, 'PUT', '/api/governo/config', { multiplicador: 1 })).s, 403);
      assert.strictEqual((await pedir(c, 'PUT', '/api/governo/obras/praca', { valor: 1 })).s, 403);
    }
  });

  console.log('\nOBRAS');
  await caso('sem descrição do que foi aprovado: recusa', async () => {
    assert.strictEqual((await pedir(DN, 'POST', '/api/governo/obra', { obra: 'praca', descricao: 'ok' })).s, 400);
  });
  await caso('retira o valor fixo exato e fica no extrato com a descrição', async () => {
    await pool.query(`UPDATE corp_caixa SET saldo = 2000000000 WHERE corporation_id = $1`, [GID]);
    const antes = await saldo(GID);
    const r = await pedir(DN, 'POST', '/api/governo/obra', { obra: 'sinalizacao', descricao: 'Projeto 3/2026: semáforos na Astorga' });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j));
    assert.strictEqual(await saldo(GID), antes - 500000000);
    const p = (await pedir(DN, 'GET', '/api/governo')).j;
    assert.ok(p.extrato.some(l => l.tipo === 'obra' && l.detalhe.descricao.includes('semáforos')));
  });
  await caso('obra mais cara que o caixa: recusa e não mexe no saldo', async () => {
    const antes = await saldo(GID);
    const r = await pedir(DN, 'POST', '/api/governo/obra', { obra: 'obra_grande', descricao: 'Hospital novo no centro' });
    assert.strictEqual(r.s, 400); assert.strictEqual(await saldo(GID), antes);
  });

  console.log('\nSALÁRIO A CADA 3 DIAS');
  const p0 = GOV.periodoDe(Date.now());
  const ini = GOV.inicioDo(p0), depois = GOV.inicioDo(p0 + 1).getTime() + 60000;
  await caso('só recebe quem entrou no jogo no período; sem Roblox não recebe', async () => {
    await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe, ocorrido_em) VALUES ('entrou','gv_pres',$1,$2)`, [JSON.stringify({ userId: 8801 }), new Date(ini.getTime() + 3600000)]);
    const antes = await saldo(GID);
    const r = await GOV.pagarSalarios(pool, 1, depois);
    assert.strictEqual(r.pagos, 1, JSON.stringify(r)); assert.strictEqual(r.nao_entrou, 1); assert.strictEqual(r.sem_roblox, 1);
    assert.strictEqual(await saldo(GID), antes - 9000);
    const f = (await pool.query(`SELECT item, qtd FROM game_item_fila WHERE roblox_id = 8801`)).rows;
    assert.deepStrictEqual(f.map(x => x.item + ':' + x.qtd), ['Dinheiro:9000']);
  });
  await caso('rodar de novo (restart, 2 servidores) não paga em dobro', async () => {
    const antes = await saldo(GID);
    await Promise.all([GOV.pagarSalarios(pool, 1, depois), GOV.pagarSalarios(pool, 1, depois)]);
    assert.strictEqual(await saldo(GID), antes);
    assert.strictEqual((await pool.query(`SELECT COUNT(*)::int n FROM game_item_fila WHERE roblox_id = 8801`)).rows[0].n, 1);
  });
  await caso('caixa sem saldo: marca sem_saldo e não paga', async () => {
    await pool.query(`UPDATE corp_caixa SET saldo = 100 WHERE corporation_id = $1`, [GID]);
    const p2 = GOV.inicioDo(p0 + 1);
    await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe, ocorrido_em) VALUES ('entrou','gv_parl',$1,$2)`, [JSON.stringify({ userId: 8802 }), new Date(p2.getTime() + 3600000)]);
    const r = await GOV.pagarSalarios(pool, 1, GOV.inicioDo(p0 + 2).getTime() + 60000);
    assert.strictEqual(r.pagos, 0); assert.strictEqual(r.sem_saldo, 1);
    assert.strictEqual(await saldo(GID), 100);
  });

  console.log('\nCAIXA INFLADO NÃO VAZA');
  await caso('painel de corp: bônus/compra/aporte do caixa do Governo -> 403', async () => {
    await pool.query(`UPDATE corp_caixa SET saldo = 999999999 WHERE corporation_id = $1`, [GID]);
    for (const a of ['bonus', 'comprar', 'aporte', 'baixa']) {
      const r = await pedir(DN, 'POST', `/api/corps/${GID}/caixa/${a}`, { roblox_id: 8801, valor: 1000000, item: 'Algema', qtd: 1 });
      assert.strictEqual(r.s, 403, a + ' -> ' + r.s);
    }
  });
  await caso('jogo: debitar caixa e salário de corp do Governo são recusados', async () => {
    const a = await jogo('/corp/caixa/debitar', { corp: 'governo', tipo: 'bonus', valor: 1000, quem: 'x' });
    assert.strictEqual(a.erro, 'governo_pelo_site');
    const b = await jogo('/corp/salario', { corp: 'governo', roblox_id: 8801, quem: 'gv_pres' });
    assert.strictEqual(b.erro, 'governo_pelo_site');
  });
  await caso('o Governo não recebe o repasse semanal', async () => {
    const r = await require('./src/corp-caixa-db').pagarOrcamentoSePendente(GID, 'governo');
    assert.strictEqual(r.pagou, false);
  });

  await pool.query(`DELETE FROM members WHERE corporation_id = $1`, [GID]);
  await pool.query(`DELETE FROM game_item_fila WHERE roblox_id BETWEEN 8800 AND 8899`);
  await pool.end();
  console.log(`\n${ok} ok, ${falhou} falharam`);
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
