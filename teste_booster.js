// Teste do BOOST AUTOMÁTICO (22/10). Discord falso injetado; banco de teste real.
// Rodar: DATABASE_URL=... node teste_booster.js
const assert = require('assert');
const pool = require('./src/db/pool');
const B = require('./src/booster');

let ok = 0, falhou = 0;
async function caso(nome, fn) {
  try { await fn(); ok++; console.log('  ok  ' + nome); }
  catch (e) { falhou++; console.log('  FALHOU  ' + nome + '\n        ' + e.message); }
}
const DIA = 86400000;
// Discord de mentira: discordId -> premium_since (ms) | null | 'fora'
const DISCORD = {};
let chamadasDiscord = 0;
const fetcher = async (url) => {
  chamadasDiscord++;
  const id = url.split('/').pop();
  const v = DISCORD[id];
  if (v === 'fora') return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => ({ premium_since: v ? new Date(v).toISOString() : null }) };
};

async function rodar(players) {
  await pool.query(`UPDATE booster_status SET checado_em = NOW() - INTERVAL '1 hour'`);   // força reconsultar
  return B.aoBatimento(pool, { cidadeId: 1, players, jobId: 'job-A', fetcher });
}
const cmds = async (rid) => (await pool.query(`SELECT * FROM game_commands WHERE target_roblox_id = $1 ORDER BY id`, [rid])).rows;
const fila = async (rid) => (await pool.query(`SELECT * FROM game_item_fila WHERE roblox_id = $1 ORDER BY id`, [rid])).rows;
const ents = async (rid) => (await pool.query(`SELECT * FROM booster_entregas WHERE roblox_id = $1 ORDER BY id`, [rid])).rows;

(async () => {
  process.env.DISCORD_BOT_TOKEN = 'teste';
  await B.garantir(pool);
  await pool.query(`DELETE FROM booster_entregas; DELETE FROM booster_status; DELETE FROM game_config WHERE key IN ('booster','temporada');`);
  await pool.query(`DELETE FROM game_commands WHERE target_roblox_id BETWEEN 9100 AND 9199; DELETE FROM game_item_fila WHERE roblox_id BETWEEN 9100 AND 9199`);
  await pool.query(`DELETE FROM users WHERE discord_id LIKE 'bt_%'`);
  const u = async (did, rid, verif) => (await pool.query(
    `INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username, roblox_verificado) VALUES ($1,$1,$2,$1,$3) RETURNING id`,
    [did, rid, verif])).rows[0].id;
  await u('bt_semvinculo', 9101, false);   // boostando, mas vínculo NÃO verificado
  await u('bt_novato', 9102, true);        // boostou ontem
  await u('bt_fiel', 9103, true);          // boosta há 10 dias
  await u('bt_nada', 9104, true);          // não boosta
  await u('bt_saiu', 9105, true);          // saiu do servidor do Discord
  DISCORD.bt_semvinculo = Date.now() - 10 * DIA;
  DISCORD.bt_novato = Date.now() - 1 * DIA;
  DISCORD.bt_fiel = Date.now() - 10 * DIA;
  DISCORD.bt_nada = null;
  DISCORD.bt_saiu = 'fora';
  const todos = [9101, 9102, 9103, 9104, 9105].map(n => ({ userId: n, name: 'J' + n }));

  console.log('\nQUEM RECEBE');
  await caso('primeira rodada: só o boost de 10 dias com vínculo verificado leva o kit', async () => {
    const r = await rodar(todos);
    assert.strictEqual(r.kits, 1, JSON.stringify(r));
    assert.strictEqual((await ents(9103)).length, 1);
    for (const n of [9101, 9102, 9104, 9105]) assert.strictEqual((await ents(n)).length, 0, 'recebeu: ' + n);
  });
  await caso('kit = dinheiro + carro + mensagem no servidor dele + 3 itens na fila', async () => {
    const c = await cmds(9103);
    assert.deepStrictEqual(c.map(x => x.tipo), ['dinheiro_add', 'carro_add', 'mensagem']);
    assert.strictEqual(c[0].payload.valor, 30000);
    assert.strictEqual(c[1].payload.carro, 'Gol');
    assert.ok(c.every(x => x.job_id === 'job-A'));
    assert.deepStrictEqual((await fila(9103)).map(f => f.item + 'x' + f.qtd), ['Mochilax1', 'Galao de gasolinax2', 'Kit de reparox2']);
  });
  await caso('sem vínculo verificado não recebe (mesmo boostando)', async () => {
    assert.strictEqual((await cmds(9101)).length, 0);
  });
  await caso('carência: boostou ontem, ainda não recebe', async () => {
    assert.strictEqual((await cmds(9102)).length, 0);
  });

  console.log('\nNADA EM DOBRO');
  await caso('segunda rodada logo depois: nada novo', async () => {
    const antes = (await cmds(9103)).length;
    const r = await rodar(todos);
    assert.strictEqual(r.kits, 0); assert.strictEqual(r.mesadas, 0);
    assert.strictEqual((await cmds(9103)).length, antes);
  });
  await caso('dez rodadas seguidas ao mesmo tempo: um kit só', async () => {
    await pool.query(`DELETE FROM booster_entregas WHERE roblox_id = 9103`);
    await Promise.all(Array.from({ length: 10 }, () => rodar(todos)));
    await rodar(todos);
    assert.strictEqual((await ents(9103)).filter(e => e.tipo === 'kit').length, 1);
  });
  await caso('trocar o vínculo pra outro Discord não dá outro kit pra mesma conta Roblox', async () => {
    await pool.query(`UPDATE users SET roblox_id = NULL WHERE discord_id = 'bt_fiel'`);
    await u('bt_outro', 9103, true);
    DISCORD.bt_outro = Date.now() - 10 * DIA;
    await rodar(todos);
    assert.strictEqual((await ents(9103)).filter(e => e.tipo === 'kit').length, 1);
    await pool.query(`DELETE FROM users WHERE discord_id = 'bt_outro'`);
    await pool.query(`UPDATE users SET roblox_id = 9103 WHERE discord_id = 'bt_fiel'`);
  });
  await caso('o Discord só é consultado de novo depois de 10 min (cache)', async () => {
    await B.aoBatimento(pool, { cidadeId: 1, players: todos, jobId: 'job-A', fetcher });   // deixa todo mundo fresco
    const antes = chamadasDiscord;
    await B.aoBatimento(pool, { cidadeId: 1, players: todos, jobId: 'job-A', fetcher });
    assert.strictEqual(chamadasDiscord, antes);
  });

  console.log('\nMESADA');
  await caso('7 dias depois do kit, ainda boostando: mesada de 5.000', async () => {
    await pool.query(`UPDATE booster_entregas SET criado_em = NOW() - INTERVAL '8 days' WHERE roblox_id = 9103`);
    const r = await rodar(todos);
    assert.strictEqual(r.mesadas, 1);
    const m = (await ents(9103)).find(e => e.tipo === 'mesada');
    assert.strictEqual(m.conteudo.dinheiro, 5000);
  });
  await caso('mesada não repete antes de mais 7 dias', async () => {
    const r = await rodar(todos);
    assert.strictEqual(r.mesadas, 0);
  });
  await caso('tirou o boost: a mesada para', async () => {
    await pool.query(`UPDATE booster_entregas SET criado_em = NOW() - INTERVAL '8 days' WHERE roblox_id = 9103`);
    DISCORD.bt_fiel = null;
    const r = await rodar(todos);
    assert.strictEqual(r.mesadas, 0);
  });
  await caso('boostou de novo: a carência recomeça (sem mesada no dia)', async () => {
    DISCORD.bt_fiel = Date.now() - 1 * DIA;
    const r = await rodar(todos);
    assert.strictEqual(r.mesadas, 0);
  });

  console.log('\nTEMPORADA');
  await caso('temporada nova + boost passou da carência: kit de novo', async () => {
    await pool.query(`INSERT INTO game_config (key, value) VALUES ('temporada', '{"n":2}') ON CONFLICT (cidade_id, key) DO UPDATE SET value = '{"n":2}'`);
    DISCORD.bt_fiel = Date.now() - 4 * DIA;
    const r = await rodar(todos);
    assert.strictEqual(r.kits, 1);
    assert.strictEqual((await ents(9103)).filter(e => e.tipo === 'kit').length, 2);
  });

  console.log('\nENTREGA NO JOGO');
  const ultimaKit = async () => (await ents(9103)).filter(e => e.tipo === 'kit').pop();
  await caso('jogo confirma tudo: entrega fecha como entregue', async () => {
    const e = await ultimaKit();
    await pool.query(`UPDATE game_commands SET status = 'done' WHERE id = ANY($1)`, [e.cmd_ids]);
    await pool.query(`UPDATE game_item_fila SET entregue_em = NOW() WHERE id = ANY($1)`, [e.fila_ids]);
    await rodar(todos);
    assert.strictEqual((await ultimaKit()).status, 'entregue');
  });
  await caso('jogo diz que falhou (saiu antes): reenvia quando ele está online', async () => {
    await pool.query(`INSERT INTO game_config (key, value) VALUES ('temporada', '{"n":3}') ON CONFLICT (cidade_id, key) DO UPDATE SET value = '{"n":3}'`);
    await rodar(todos);
    const e = await ultimaKit();
    await pool.query(`UPDATE game_commands SET status = 'error' WHERE id = $1`, [e.cmd_ids[0]]);
    await pool.query(`UPDATE game_commands SET status = 'done' WHERE id = ANY($1)`, [e.cmd_ids.slice(1)]);
    await rodar(todos);
    const e2 = await ultimaKit();
    assert.strictEqual(e2.tentativas, 1);
    assert.ok(!e2.cmd_ids.includes(e.cmd_ids[0]), 'o comando que falhou continua na lista');
    const novo = (await pool.query(`SELECT tipo, payload FROM game_commands WHERE id = $1`, [e2.cmd_ids.find(id => !e.cmd_ids.includes(id))])).rows[0];
    assert.strictEqual(novo.tipo, 'dinheiro_add'); assert.strictEqual(novo.payload.valor, 30000);
  });
  await caso('comando "sent" sem resposta há 10 min: vai pra revisão, NUNCA reenvia', async () => {
    const e = await ultimaKit();
    await pool.query(`UPDATE game_commands SET status = 'sent', sent_at = NOW() - INTERVAL '11 minutes' WHERE id = $1`, [e.cmd_ids[e.cmd_ids.length - 1]]);
    const antes = (await cmds(9103)).length;
    await rodar(todos);
    const e2 = await ultimaKit();
    assert.strictEqual(e2.status, 'revisar');
    assert.strictEqual((await cmds(9103)).length, antes);
  });

  console.log('\nCONFIG');
  await caso('Dono desliga: ninguém recebe nada', async () => {
    await pool.query(`INSERT INTO game_config (key, value) VALUES ('booster', '{"ligado":false}') ON CONFLICT (cidade_id, key) DO UPDATE SET value = '{"ligado":false}'`);
    await pool.query(`INSERT INTO game_config (key, value) VALUES ('temporada', '{"n":9}') ON CONFLICT (cidade_id, key) DO UPDATE SET value = '{"n":9}'`);
    const r = await rodar(todos);
    assert.strictEqual(r.kits, 0);
    await pool.query(`DELETE FROM game_config WHERE key = 'booster'`);
  });
  await caso('sem DISCORD_BOT_TOKEN: não entrega nada e não quebra', async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    const r = await rodar(todos);
    assert.strictEqual(r.kits, 0);
    process.env.DISCORD_BOT_TOKEN = 'teste';
  });

  await pool.query(`DELETE FROM game_config WHERE key IN ('temporada','booster')`);
  await pool.end();
  console.log(`\n${ok} ok, ${falhou} falharam`);
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
