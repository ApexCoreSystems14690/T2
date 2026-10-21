// Teste do Painel Testers (21/10). Sobe o admin-api de verdade num express de
// teste, contra um Postgres local, e roda o fluxo inteiro:
// cargo/permissão -> liberar (online e offline) -> estender -> encerrar/vencer
// -> relógio tirando item/carro quando o tester aparece online.
// Rodar: DATABASE_URL=... node teste_testers.js
const assert = require('assert');
const express = require('express');
const pool = require('./src/db/pool');
const T = require('./src/testers');
const perm = require('./src/permissoes');

let ok = 0, falhou = 0;
async function caso(nome, fn) {
  try { await fn(); ok++; console.log('  ok  ' + nome); }
  catch (e) { falhou++; console.log('  FALHOU  ' + nome + '\n        ' + e.message); }
}

async function preparar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_servers (job_id VARCHAR(64) PRIMARY KEY, place_id BIGINT, players JSONB DEFAULT '[]', catalog JSONB, updated_at TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS game_commands (id SERIAL PRIMARY KEY, tipo VARCHAR(48) NOT NULL, target_roblox_id BIGINT, target_name VARCHAR(64), payload JSONB DEFAULT '{}', job_id VARCHAR(64), status VARCHAR(16) DEFAULT 'pending', result TEXT, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT NOW(), sent_at TIMESTAMP, executed_at TIMESTAMP);
    CREATE TABLE IF NOT EXISTS game_item_fila (id SERIAL PRIMARY KEY, roblox_id BIGINT NOT NULL, item VARCHAR(64) NOT NULL, qtd INTEGER NOT NULL DEFAULT 1, criado_por INTEGER REFERENCES users(id) ON DELETE SET NULL, criado_em TIMESTAMP DEFAULT NOW(), entregue_em TIMESTAMP);
    CREATE TABLE IF NOT EXISTS game_patrimonio (roblox_id BIGINT PRIMARY KEY, nome VARCHAR(64), bolso BIGINT DEFAULT 0, banco BIGINT DEFAULT 0, level INTEGER DEFAULT 1, xp BIGINT DEFAULT 0, emprego VARCHAR(64), carros JSONB DEFAULT '{}'::jsonb, casas JSONB DEFAULT '[]'::jsonb, atualizado_em TIMESTAMP DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS admin_audit (id SERIAL PRIMARY KEY, admin_id INTEGER, admin_nome VARCHAR(128), acao VARCHAR(64), detalhe JSONB, criado_em TIMESTAMP DEFAULT NOW());
    ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_cargo VARCHAR(24);
    DELETE FROM game_commands; DELETE FROM game_item_fila; DELETE FROM game_servers; DELETE FROM game_patrimonio;
  `);
  await T.garantir(pool);
  await require('./src/cidades').garantir(pool);
  await pool.query(`DELETE FROM tester_liberacoes`);
  await pool.query(`DELETE FROM members WHERE user_id IN (SELECT id FROM users WHERE discord_id LIKE 'tt_%')`);
  await pool.query(`DELETE FROM users WHERE discord_id LIKE 'tt_%'`);
  await pool.query(`DELETE FROM corporations WHERE slug LIKE 'tt-%'`);
  const u = async (did, nome, cargo, rid) => (await pool.query(
    `INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username, is_admin, admin_cargo) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [did, nome, rid, rid ? nome + '_rbx' : null, !!cargo, cargo])).rows[0];
  const U = {
    gestor: await u('tt_1', 'gestorzinho', 'gestor_testers', 9001),
    diretor: await u('tt_2', 'diretorzao', 'diretor', 9002),
    super: await u('tt_3', 'supervisor1', 'supervisor', 9003),
    tester: await u('tt_4', 'tester1', null, 7001),
    offline: await u('tt_5', 'tester2', null, 7002),
    semRoblox: await u('tt_6', 'tester3', null, null),
  };
  const c = async (slug, nome, tipo, cargos) => {
    const id = (await pool.query(`INSERT INTO corporations (name, slug, tipo) VALUES ($1,$2,$3) RETURNING id`, [nome, slug, tipo])).rows[0].id;
    const ranks = [];
    for (const [n, l] of cargos) ranks.push((await pool.query(`INSERT INTO ranks (corporation_id, name, level) VALUES ($1,$2,$3) RETURNING *`, [id, n, l])).rows[0]);
    return { id, ranks };
  };
  const C = {
    pm: await c('tt-pm', 'TT PM', 'corp', [['Soldado', 1], ['Sargento', 5], ['Comandante', 10]]),
    samu: await c('tt-samu', 'TT SAMU', 'corp', [['Socorrista', 1], ['Diretor', 9]]),
    fac: await c('tt-fac', 'TT Facção', 'faccao', [['Vapor', 1], ['Patrão', 7]]),
    emp: await c('tt-emp', 'TT Loja', 'empresa', [['Caixa', 1], ['Dono', 5]]),
  };
  // o tester já é Soldado da PM (tem que voltar a Soldado no fim)
  await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3)`, [C.pm.id, U.tester.id, C.pm.ranks[0].id]);
  // tester1 online num servidor; tester2 offline
  await pool.query(`INSERT INTO game_servers (job_id, players, updated_at) VALUES ('job-A', $1, NOW())`,
    [JSON.stringify([{ userId: 7001, name: 'tester1_rbx' }])]);
  // tester1 já tem o Gol no patrimônio
  await pool.query(`INSERT INTO game_patrimonio (roblox_id, carros) VALUES (7001, '{"Gol": {}}')`);
  return { U, C };
}

function app(comoQuem) {
  const a = express();
  a.use(express.json());
  // [21/10 Cidades] o painel roda dentro do Santa Fé Oficial
  a.use((req, res, next) => { req.cidade = { id: 1, slug: 'santa-fe', nome: 'Santa Fé' }; req.user = Object.assign({}, comoQuem(), { cidade_id: 1 }); next(); });
  a.use('/api/admin', require('./src/routes/admin-api'));
  return a;
}

async function chamar(srv, metodo, path, body) {
  const r = await fetch('http://127.0.0.1:' + srv.address().port + '/api/admin' + path,
    { method: metodo, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, j };
}

(async () => {
  const { U, C } = await preparar();
  let quem = U.gestor;
  const srv = app(() => quem).listen(0);
  await new Promise(r => srv.once('listening', r));
  const membro = async (uid, cid) => (await pool.query('SELECT rank_id FROM members WHERE user_id = $1 AND corporation_id = $2', [uid, cid])).rows[0];
  const cmds = async (rid, tipo) => (await pool.query('SELECT * FROM game_commands WHERE target_roblox_id = $1 AND tipo = $2 ORDER BY id', [rid, tipo])).rows;

  console.log('\nPERMISSÃO');
  await caso('gestor tem só o poder testers', () => assert.deepStrictEqual(perm.poderesDe(U.gestor), { testers: true }));
  await caso('gestor NÃO dá item pelo /command (403)', async () => {
    const r = await chamar(srv, 'POST', '/command', { tipo: 'item_add', target_roblox_id: 7001, payload: { item: 'Pistola', qtd: 1 } });
    assert.strictEqual(r.status, 403);
  });
  await caso('gestor NÃO vê registro nem usuários (403)', async () => {
    assert.strictEqual((await chamar(srv, 'GET', '/registro')).status, 403);
    assert.strictEqual((await chamar(srv, 'GET', '/users')).status, 403);
  });
  await caso('supervisor NÃO usa o painel testers (403)', async () => {
    quem = U.super; const r = await chamar(srv, 'GET', '/testers'); quem = U.gestor;
    assert.strictEqual(r.status, 403);
  });
  await caso('diretor usa o painel testers', async () => {
    quem = U.diretor; const r = await chamar(srv, 'GET', '/testers'); quem = U.gestor;
    assert.strictEqual(r.status, 200);
  });
  await caso('diretor concede Gestor testers; supervisor não', () => {
    assert.ok(perm.podeDarCargo(U.diretor, 'gestor_testers'));
    assert.ok(!perm.podeDarCargo(U.super, 'gestor_testers'));
    assert.ok(!perm.podeMexerEm(U.gestor, U.tester));
  });

  console.log('\nLIBERAR (tester online)');
  let lib1;
  await caso('um clique: 4 corps, 2 itens, 2 carros', async () => {
    const r = await chamar(srv, 'POST', '/testers/conceder', {
      user_id: U.tester.id, horas: 24, tipos: ['corp', 'faccao', 'empresa'], nivel: 'alto',
      itens: [{ item: 'Pistola', qtd: 1 }, 'Bandagem', 'Bandagem'], carros: ['Gol', 'Hilux', 'Hilux'], motivo: 'teste samu' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.j));
    lib1 = r.j.id;
    assert.strictEqual(r.j.resumo.itens, 2);          // Bandagem somou
    assert.strictEqual(r.j.resumo.carros, 1);         // Gol ele já tinha
    assert.strictEqual(r.j.resumo.carros_pulados, 1);
    assert.ok(r.j.resumo.corps >= 4);
  });
  await caso('entrou no cargo MAIS ALTO de cada corp', async () => {
    assert.strictEqual((await membro(U.tester.id, C.pm.id)).rank_id, C.pm.ranks[2].id);
    assert.strictEqual((await membro(U.tester.id, C.samu.id)).rank_id, C.samu.ranks[1].id);
    assert.strictEqual((await membro(U.tester.id, C.fac.id)).rank_id, C.fac.ranks[1].id);
    assert.strictEqual((await membro(U.tester.id, C.emp.id)).rank_id, C.emp.ranks[1].id);
  });
  await caso('online: item_add, carro_add e corp_refresh foram pro servidor dele', async () => {
    const it = await cmds(7001, 'item_add');
    assert.deepStrictEqual(it.map(c => c.payload.item + 'x' + c.payload.qtd).sort(), ['Bandagemx2', 'Pistolax1']);
    assert.ok(it.every(c => c.job_id === 'job-A'));
    assert.deepStrictEqual((await cmds(7001, 'carro_add')).map(c => c.payload.carro), ['Hilux']);
    assert.strictEqual((await cmds(7001, 'corp_refresh')).length, 1);
  });
  await caso('segunda liberação pro mesmo tester é recusada', async () => {
    const r = await chamar(srv, 'POST', '/testers/conceder', { user_id: U.tester.id, horas: 2, tipos: ['corp'] });
    assert.strictEqual(r.status, 400); assert.ok(/já tem uma liberação ativa/.test(r.j.error));
  });
  await caso('registrado no admin_audit', async () => {
    const a = await pool.query(`SELECT * FROM admin_audit WHERE acao = 'testers:liberar' AND admin_id = $1`, [U.gestor.id]);
    assert.strictEqual(a.rows.length, 1);
  });

  console.log('\nVALIDAÇÃO');
  await caso('sem Roblox vinculado + item = recusado', async () => {
    const r = await chamar(srv, 'POST', '/testers/conceder', { user_id: U.semRoblox.id, horas: 2, itens: ['Pistola'] });
    assert.strictEqual(r.status, 400);
  });
  await caso('sem Roblox vinculado, só corps = aceito', async () => {
    const r = await chamar(srv, 'POST', '/testers/conceder', { user_id: U.semRoblox.id, horas: 2, tipos: ['corp'], nivel: 'baixo' });
    assert.strictEqual(r.status, 200, JSON.stringify(r.j));
    assert.strictEqual((await membro(U.semRoblox.id, C.pm.id)).rank_id, C.pm.ranks[0].id);   // mais baixo
  });
  await caso('prazo fora de 1..168 h = recusado', async () => {
    assert.strictEqual((await chamar(srv, 'POST', '/testers/conceder', { user_id: U.offline.id, horas: 500, tipos: ['corp'] })).status, 400);
    assert.strictEqual((await chamar(srv, 'POST', '/testers/conceder', { user_id: U.offline.id, horas: 0, tipos: ['corp'] })).status, 400);
  });
  await caso('pedido vazio = recusado', async () => {
    assert.strictEqual((await chamar(srv, 'POST', '/testers/conceder', { user_id: U.offline.id, horas: 2 })).status, 400);
  });

  console.log('\nLIBERAR (tester offline)');
  let lib2;
  await caso('offline: itens vão pra fila, carro fica pendente', async () => {
    const r = await chamar(srv, 'POST', '/testers/conceder', { user_id: U.offline.id, horas: 6, tipos: [], itens: ['Pistola', 'Radio'], carros: ['Hilux'] });
    assert.strictEqual(r.status, 200, JSON.stringify(r.j)); lib2 = r.j.id;
    const f = await pool.query('SELECT item FROM game_item_fila WHERE roblox_id = 7002 AND entregue_em IS NULL ORDER BY item');
    assert.deepStrictEqual(f.rows.map(x => x.item), ['Pistola', 'Radio']);
    assert.strictEqual((await cmds(7002, 'carro_add')).length, 0);
    assert.strictEqual(r.j.resumo.carros_pendentes, 1);
  });
  await caso('relógio com ele ainda offline: nada muda', async () => {
    await T.tick(pool);
    assert.strictEqual((await cmds(7002, 'carro_add')).length, 0);
  });
  await caso('ele entra e pega 1 item da fila; relógio entrega o carro', async () => {
    await pool.query(`UPDATE game_item_fila SET entregue_em = NOW() WHERE roblox_id = 7002 AND item = 'Pistola'`);
    await pool.query(`INSERT INTO game_servers (job_id, players, updated_at) VALUES ('job-B', $1, NOW())`, [JSON.stringify([{ userId: 7002, name: 'tester2_rbx' }])]);
    await T.tick(pool);
    const c = await cmds(7002, 'carro_add');
    assert.strictEqual(c.length, 1); assert.strictEqual(c[0].job_id, 'job-B');
    await T.tick(pool);                                   // idempotente
    assert.strictEqual((await cmds(7002, 'carro_add')).length, 1);
  });
  await caso('ele sai do jogo', async () => { await pool.query(`DELETE FROM game_servers WHERE job_id = 'job-B'`); });

  console.log('\nESTENDER / ENCERRAR / VENCER');
  await caso('estender soma o prazo', async () => {
    const antes = (await pool.query('SELECT expira_em FROM tester_liberacoes WHERE id = $1', [lib1])).rows[0].expira_em;
    const r = await chamar(srv, 'POST', '/testers/' + lib1 + '/estender', { horas: 12 });
    assert.strictEqual(r.status, 200);
    assert.ok(Math.abs((new Date(r.j.expira_em) - antes) / 3600000 - 12) < 0.01);
  });
  await caso('alguém mexe no cargo dele na SAMU no meio do teste', async () => {
    await pool.query('UPDATE members SET rank_id = $3 WHERE user_id = $1 AND corporation_id = $2', [U.tester.id, C.samu.id, C.samu.ranks[0].id]);
  });
  await caso('ENCERRAR (online): corps voltam na hora e o jogo tira itens/carro', async () => {
    const r = await chamar(srv, 'POST', '/testers/' + lib1 + '/encerrar');
    assert.strictEqual(r.status, 200, JSON.stringify(r.j));
    assert.strictEqual((await membro(U.tester.id, C.pm.id)).rank_id, C.pm.ranks[0].id, 'PM volta a Soldado');
    assert.strictEqual(await membro(U.tester.id, C.fac.id), undefined, 'saiu da facção');
    assert.strictEqual(await membro(U.tester.id, C.emp.id), undefined, 'saiu da empresa');
    assert.strictEqual(await membro(U.tester.id, C.samu.id), undefined, 'saiu da SAMU (não era membro antes)');
    const rm = await cmds(7001, 'item_remove');
    assert.deepStrictEqual(rm.map(c => c.payload.item + 'x' + c.payload.qtd).sort(), ['Bandagemx2', 'Pistolax1']);
    assert.deepStrictEqual((await cmds(7001, 'carro_remove')).map(c => c.payload.carro), ['Hilux'], 'Gol (que já era dele) NÃO sai');
    const st = (await pool.query('SELECT status FROM tester_liberacoes WHERE id = $1', [lib1])).rows[0].status;
    assert.strictEqual(st, 'encerrada');
  });
  await caso('encerrar de novo = recusado (nada em dobro)', async () => {
    assert.strictEqual((await chamar(srv, 'POST', '/testers/' + lib1 + '/encerrar')).status, 400);
    await T.tick(pool);
    assert.strictEqual((await cmds(7001, 'item_remove')).length, 2);
  });
  await caso('VENCER (offline): item da fila cancelado, resto espera ele entrar', async () => {
    await pool.query(`UPDATE tester_liberacoes SET expira_em = NOW() - INTERVAL '1 minute' WHERE id = $1`, [lib2]);
    const t = await T.tick(pool);
    assert.strictEqual(t.venceu, 1);
    const f = await pool.query(`SELECT item FROM game_item_fila WHERE roblox_id = 7002 AND entregue_em IS NULL`);
    assert.strictEqual(f.rows.length, 0, 'Radio (não entregue) saiu da fila');
    const l = (await pool.query('SELECT * FROM tester_liberacoes WHERE id = $1', [lib2])).rows[0];
    assert.strictEqual(l.status, 'revertendo');
    assert.strictEqual(l.fim_motivo, 'expirou');
    assert.strictEqual((await cmds(7002, 'item_remove')).length, 0);
  });
  await caso('ele volta online: relógio tira a Pistola e o carro, e fecha', async () => {
    await pool.query(`INSERT INTO game_servers (job_id, players, updated_at) VALUES ('job-C', $1, NOW())`, [JSON.stringify([{ userId: 7002, name: 'tester2_rbx' }])]);
    await T.tick(pool);
    assert.deepStrictEqual((await cmds(7002, 'item_remove')).map(c => c.payload.item), ['Pistola']);
    assert.deepStrictEqual((await cmds(7002, 'carro_remove')).map(c => c.payload.carro), ['Hilux']);
    assert.strictEqual((await pool.query('SELECT status FROM tester_liberacoes WHERE id = $1', [lib2])).rows[0].status, 'encerrada');
    await T.tick(pool);
    assert.strictEqual((await cmds(7002, 'item_remove')).length, 1, 'não tira em dobro');
  });
  await caso('histórico guarda cada passo', async () => {
    const l = (await pool.query('SELECT historico FROM tester_liberacoes WHERE id = $1', [lib2])).rows[0];
    assert.ok(l.historico.length >= 4, JSON.stringify(l.historico));
  });
  await caso('depois de encerrada, dá pra liberar de novo', async () => {
    const r = await chamar(srv, 'POST', '/testers/conceder', { user_id: U.tester.id, horas: 2, tipos: ['faccao'] });
    assert.strictEqual(r.status, 200, JSON.stringify(r.j));
  });
  await caso('GET /testers lista tudo', async () => {
    const r = await chamar(srv, 'GET', '/testers');
    assert.strictEqual(r.status, 200);
    assert.ok(r.j.liberacoes.length >= 4);
    assert.strictEqual(r.j.liberacoes[0].status, 'ativa');
  });

  srv.close(); await pool.end();
  console.log(`\n${ok} ok, ${falhou} falharam`);
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
