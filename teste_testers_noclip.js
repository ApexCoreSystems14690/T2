// [22/10] Noclip + Modo Deus na liberação de tester.
// Rodar depois de teste_testers.js (usa as tabelas que ele cria): DATABASE_URL=... node teste_testers_noclip.js
const assert = require('assert');
const pool = require('./src/db/pool');
const T = require('./src/testers');

let ok = 0, falhou = 0;
async function caso(nome, fn) {
  try { await fn(); ok++; console.log('  ok  ' + nome); }
  catch (e) { falhou++; console.log('  FALHOU  ' + nome + '\n        ' + e.message); }
}
const nc = async (rid) => (await pool.query(`SELECT payload, job_id FROM game_commands WHERE tipo = 'noclip' AND target_roblox_id = $1 ORDER BY id`, [rid])).rows;
const online = (lista) => pool.query(`INSERT INTO game_servers (job_id, players, updated_at) VALUES ('job-N', $1, NOW())
  ON CONFLICT (job_id) DO UPDATE SET players = EXCLUDED.players, updated_at = NOW()`, [JSON.stringify(lista)]);

(async () => {
  await T.garantir(pool);
  await pool.query(`DELETE FROM tester_liberacoes; DELETE FROM game_commands; DELETE FROM game_servers`);
  await pool.query(`DELETE FROM users WHERE discord_id LIKE 'tn_%'`);
  const u = async (d, rid) => (await pool.query(`INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username) VALUES ($1,$1,$2,$1) RETURNING *`, [d, rid])).rows[0];
  const gestor = Object.assign(await u('tn_g', 8001), { cidade_id: 1 });
  const on = await u('tn_on', 8101), off = await u('tn_off', 8102), sem = await u('tn_sem', null);
  await online([{ userId: 8101, name: 'tn_on' }]);

  await caso('normalizar: só noclip já é um pedido válido', async () => {
    const n = T.normalizarPedido({ user_id: on.id, horas: 2, noclip: true });
    assert.ok(!n.erro, n.erro); assert.strictEqual(n.pedido.noclip, true);
    assert.ok(T.normalizarPedido({ user_id: on.id, horas: 2 }).erro);
  });
  await caso('sem Roblox vinculado: recusa', async () => {
    const r = await T.conceder(pool, gestor, T.normalizarPedido({ user_id: sem.id, horas: 2, noclip: true }).pedido);
    assert.ok(r.erro && /Roblox/.test(r.erro));
  });
  let idOn, idOff;
  await caso('online: manda noclip ligado na hora, no servidor dele', async () => {
    const r = await T.conceder(pool, gestor, T.normalizarPedido({ user_id: on.id, horas: 2, noclip: true }).pedido);
    assert.ok(r.ok, r.erro); idOn = r.id;
    const c = await nc(8101);
    assert.strictEqual(c.length, 1); assert.strictEqual(c[0].payload.ativar, true); assert.strictEqual(c[0].job_id, 'job-N');
    assert.strictEqual(r.resumo.noclip, 'ligado');
  });
  await caso('relógio não manda de novo na mesma sessão', async () => {
    await T.tick(pool); await T.tick(pool);
    assert.strictEqual((await nc(8101)).length, 1);
  });
  await caso('ele saiu e entrou de novo: relógio religa', async () => {
    await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe, ocorrido_em) VALUES ('entrou','tn_on', $1, NOW() + INTERVAL '1 second')`, [JSON.stringify({ userId: 8101 })]);
    await T.tick(pool);
    const c = await nc(8101);
    assert.strictEqual(c.length, 2); assert.strictEqual(c[1].payload.ativar, true);
  });
  await caso('offline: não manda nada; liga quando ele aparecer', async () => {
    const r = await T.conceder(pool, gestor, T.normalizarPedido({ user_id: off.id, horas: 2, noclip: true }).pedido);
    idOff = r.id; assert.strictEqual(r.resumo.noclip, 'liga quando ele entrar');
    assert.strictEqual((await nc(8102)).length, 0);
    await online([{ userId: 8101, name: 'tn_on' }, { userId: 8102, name: 'tn_off' }]);
    await T.tick(pool);
    assert.strictEqual((await nc(8102)).length, 1);
  });
  await caso('botão Tirar noclip desliga e o relógio NÃO religa', async () => {
    const r = await T.noclip(pool, idOff, false, 'gestor', 1);
    assert.ok(r.ok && r.online);
    const c = await nc(8102); assert.strictEqual(c[c.length - 1].payload.ativar, false);
    await T.tick(pool);
    assert.strictEqual((await nc(8102)).length, 2);
  });
  await caso('outra cidade não mexe na liberação', async () => {
    assert.ok((await T.noclip(pool, idOn, false, 'x', 99)).erro);
  });
  await caso('encerrar com ele online: desliga o noclip', async () => {
    const r = await T.encerrar(pool, idOn, 'gestor', 1);
    assert.ok(r.ok);
    const c = await nc(8101); assert.strictEqual(c[c.length - 1].payload.ativar, false);
    const l = (await pool.query('SELECT status, noclip FROM tester_liberacoes WHERE id = $1', [idOn])).rows[0];
    assert.strictEqual(l.noclip.ligado, false); assert.strictEqual(l.status, 'encerrada');
  });
  await caso('prazo vence: desliga e não religa mais', async () => {
    await T.noclip(pool, idOff, true, 'gestor', 1);
    const antes = (await nc(8102)).length;
    await pool.query(`UPDATE tester_liberacoes SET expira_em = NOW() - INTERVAL '1 minute' WHERE id = $1`, [idOff]);
    await T.tick(pool);
    const c = await nc(8102);
    assert.strictEqual(c.length, antes + 1); assert.strictEqual(c[c.length - 1].payload.ativar, false);
    await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe, ocorrido_em) VALUES ('entrou','tn_off', $1, NOW() + INTERVAL '2 second')`, [JSON.stringify({ userId: 8102 })]);
    await T.tick(pool);
    assert.strictEqual((await nc(8102)).length, antes + 1);
  });

  await pool.query(`DELETE FROM tester_liberacoes; DELETE FROM game_commands WHERE target_roblox_id IN (8101,8102); DELETE FROM game_servers WHERE job_id = 'job-N'`);
  await pool.query(`DELETE FROM game_logs WHERE jogador LIKE 'tn_%'`);
  await pool.query(`DELETE FROM users WHERE discord_id LIKE 'tn_%'`);
  await pool.end();
  console.log(`\n${ok} ok, ${falhou} falharam`);
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
