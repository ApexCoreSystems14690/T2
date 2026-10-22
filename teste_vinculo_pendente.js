// [22/10] Vincular Roblox que já está numa conta SEM prova (caso _viniciusbr01).
// Rodar com o site no ar (ROBLOX_API_KEY=k123): DATABASE_URL=... node teste_vinculo_pendente.js
const assert = require('assert');
const { Pool } = require('pg'); const sig = require('cookie-signature');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.BASE || 'http://localhost:4600';
const KEY = process.env.ROBLOX_API_KEY || 'k123';
let ok = 0, falhou = 0;
async function caso(n, f) { try { await f(); ok++; console.log('  ok  ' + n); } catch (e) { falhou++; console.log('  FALHOU  ' + n + '\n        ' + e.message); } }
async function sessao(uid) {
  const sid = 'vp' + uid + Math.random().toString(36).slice(2);
  await pool.query(`INSERT INTO session (sid, sess, expire) VALUES ($1,$2,NOW()+interval '1 day')`, [sid, { cookie: { originalMaxAge: 864e5, httpOnly: true, path: '/' }, userId: uid, cidadeId: 1 }]);
  return 'connect.sid=' + encodeURIComponent('s:' + sig.sign(sid, 'dev-secret-apenas-local'));
}
const post = (c, path, body) => fetch(BASE + path, { method: 'POST', redirect: 'manual', headers: { cookie: c, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
const RID = 979045496;
(async () => {
  await pool.query(`DELETE FROM members WHERE user_id IN (SELECT id FROM users WHERE discord_id IN ('roblox_${RID}','vp_vini','vp_outro'))`);
  await pool.query(`DELETE FROM users WHERE discord_id IN ('roblox_${RID}','vp_vini','vp_outro','vin_t')`);
  await pool.query(`DELETE FROM corporations WHERE slug = 'vp-corp'`);
  const ph = (await pool.query(`INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username) VALUES ('roblox_${RID}','viniciusBR1980',$1,'viniciusBR1980') RETURNING id`, [RID])).rows[0].id;
  const corp = (await pool.query(`INSERT INTO corporations (name, slug, tipo) VALUES ('VP Corp','vp-corp','corp') RETURNING id`)).rows[0].id;
  await pool.query(`INSERT INTO members (corporation_id, user_id) VALUES ($1,$2)`, [corp, ph]);
  const vini = (await pool.query(`INSERT INTO users (discord_id, discord_username) VALUES ('vp_vini','_viniciusbr01') RETURNING id`)).rows[0].id;
  const c = await sessao(vini);

  await caso('vincular um Roblox que está num placeholder: vira pendente com código, não dá erro', async () => {
    const r = await post(c, '/dashboard/link-roblox', { roblox_username: 'viniciusBR1980', roblox_id: String(RID) });
    assert.ok(r.headers.get('location').includes('ok=provar'), r.headers.get('location'));
    const u = (await pool.query('SELECT roblox_id, vinculo_pendente_rid, vinculo_codigo FROM users WHERE id = $1', [vini])).rows[0];
    assert.strictEqual(u.roblox_id, null); assert.strictEqual(Number(u.vinculo_pendente_rid), RID); assert.ok(u.vinculo_codigo);
  });
  await caso('a tela mostra o aviso e o código pra provar', async () => {
    const t = await (await fetch(BASE + '/dashboard/link-roblox?ok=provar', { headers: { cookie: c } })).text();
    const cod = (await pool.query('SELECT vinculo_codigo FROM users WHERE id = $1', [vini])).rows[0].vinculo_codigo;
    assert.ok(t.includes('ninguém provou que é dono')); assert.ok(t.includes('/vincular ' + cod));
  });
  await caso('/vincular no jogo prova: conta passa pra ele, corp junto, placeholder solto', async () => {
    const cod = (await pool.query('SELECT vinculo_codigo FROM users WHERE id = $1', [vini])).rows[0].vinculo_codigo;
    const r = await fetch(BASE + '/api/game/vincular', { method: 'POST', headers: { 'x-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ roblox_id: RID, nome: 'viniciusBR1980', codigo: cod }) });
    const j = await r.json(); assert.ok(j.ok, JSON.stringify(j));
    const u = (await pool.query('SELECT roblox_id, roblox_verificado, vinculo_pendente_rid FROM users WHERE id = $1', [vini])).rows[0];
    assert.strictEqual(Number(u.roblox_id), RID); assert.strictEqual(u.roblox_verificado, true); assert.strictEqual(u.vinculo_pendente_rid, null);
    assert.strictEqual((await pool.query('SELECT roblox_id FROM users WHERE id = $1', [ph])).rows[0].roblox_id, null);
    assert.strictEqual((await pool.query('SELECT user_id FROM members WHERE corporation_id = $1', [corp])).rows[0].user_id, vini);
  });
  await caso('Roblox já VERIFICADO em outra conta: continua recusando', async () => {
    const outro = (await pool.query(`INSERT INTO users (discord_id, discord_username) VALUES ('vp_outro','ladrao') RETURNING id`)).rows[0].id;
    const r = await post(await sessao(outro), '/dashboard/link-roblox', { roblox_username: 'x', roblox_id: String(RID) });
    assert.ok(r.headers.get('location').includes('error=already_linked'));
    const u = (await pool.query('SELECT vinculo_pendente_rid FROM users WHERE id = $1', [outro])).rows[0];
    assert.strictEqual(u.vinculo_pendente_rid, null);
  });
  await caso('vincular normal (Roblox livre) segue igual', async () => {
    const r = await post(c, '/dashboard/link-roblox', { roblox_username: 'y', roblox_id: '123123123' });
    assert.strictEqual(r.headers.get('location'), '/dashboard');
  });
  await pool.query(`DELETE FROM members WHERE corporation_id = $1`, [corp]);
  await pool.query(`DELETE FROM corporations WHERE id = $1`, [corp]);
  await pool.query(`DELETE FROM users WHERE discord_id IN ('roblox_${RID}','vp_vini','vp_outro')`);
  await pool.end(); console.log(`\n${ok} ok, ${falhou} falharam`); process.exit(falhou ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
