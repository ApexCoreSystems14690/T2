// [23/10] Loja de Royalties — testes contra o site no ar + Postgres local.
// Rodar: TZ=UTC DATABASE_URL=... BASE=http://localhost:4600 ROBLOX_API_KEY=k123 node teste_royalties.js
const assert = require('assert');
const { Pool } = require('pg');
const sig = require('cookie-signature');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.BASE || 'http://localhost:4600';
const KEY = process.env.ROBLOX_API_KEY || 'k123';
let ok = 0, falhou = 0;
async function caso(n, f) { try { await f(); ok++; console.log('  ok  ' + n); } catch (e) { falhou++; console.log('  FALHOU  ' + n + '\n        ' + e.message); } }
async function sessao(uid, cidadeId) {
  const sid = 'ry' + uid + 'c' + cidadeId + Math.random().toString(36).slice(2);
  await pool.query(`INSERT INTO session (sid, sess, expire) VALUES ($1,$2,NOW()+interval '1 day')`, [sid, { cookie: { originalMaxAge: 864e5, httpOnly: true, path: '/' }, userId: uid, cidadeId }]);
  return 'connect.sid=' + encodeURIComponent('s:' + sig.sign(sid, 'dev-secret-apenas-local'));
}
async function pedir(c, met, path, body) {
  const r = await fetch(BASE + path, { method: met, redirect: 'manual', headers: { cookie: c || '', accept: 'application/json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { s: r.status, j };
}
const RID = 7700001, RID2 = 7700002;

(async () => {
  // ---------------- preparo

  const limpar = async () => {
    const c = await pool.connect();
    try {
      await c.query(`SET royalties.limpeza_de_teste = 'sim'`);
      await c.query(`DELETE FROM royalties_lancamentos WHERE roblox_id IN (${RID},${RID2}) OR cidade_id IN (SELECT id FROM cidades WHERE slug = 'ry-norte')`);
      await c.query(`DELETE FROM royalties_trocas WHERE roblox_id IN (${RID},${RID2}) OR cidade_id IN (SELECT id FROM cidades WHERE slug = 'ry-norte')`);
      await c.query(`DELETE FROM royalties_saldo WHERE roblox_id IN (${RID},${RID2}) OR cidade_id IN (SELECT id FROM cidades WHERE slug = 'ry-norte')`);
      await c.query(`DELETE FROM royalties_catalogo WHERE cidade_id IN (SELECT id FROM cidades WHERE slug = 'ry-norte')`);
      await c.query(`DELETE FROM royalties_motivos WHERE cidade_id IN (SELECT id FROM cidades WHERE slug = 'ry-norte')`);
      await c.query(`DELETE FROM admin_audit WHERE cidade_id IN (SELECT id FROM cidades WHERE slug = 'ry-norte')`);
      await c.query(`DELETE FROM cidade_staff WHERE user_id IN (SELECT id FROM users WHERE discord_id LIKE 'ry_%')`);
      await require('./src/cidades').apagarCidadeDeTeste(pool, 'ry-norte');
      await c.query(`DELETE FROM game_commands WHERE target_roblox_id IN (${RID},${RID2})`);
      await c.query(`DELETE FROM game_item_fila WHERE roblox_id IN (${RID},${RID2})`);
      await c.query(`DELETE FROM game_servers WHERE job_id = 'job-ry'`);
      await c.query(`DELETE FROM users WHERE discord_id LIKE 'ry_%'`);
    } finally { await c.query(`RESET royalties.limpeza_de_teste`).catch(() => {}); c.release(); }
  };
  await limpar();
  await pool.query(`INSERT INTO game_config (key, value) VALUES ('temporada', '{"n":5}') ON CONFLICT (cidade_id, key) DO UPDATE SET value = '{"n":5}'`);
  const u = async (d, rid, verif) => (await pool.query(`INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username, roblox_verificado) VALUES ($1,$1,$2,$1,$3) RETURNING id`, [d, rid, verif])).rows[0].id;
  const jog = await u('ry_jog', RID, true);
  const naoVerif = await u('ry_naoverif', RID2, false);
  const staff = {};
  for (const cargo of ['estagiario', 'moderador', 'administrador', 'supervisor', 'gestor_testers', 'diretor']) {
    staff[cargo] = await u('ry_' + cargo, null, false);
    await pool.query(`INSERT INTO cidade_staff (cidade_id, user_id, cargo) VALUES (1,$1,$2)`, [staff[cargo], cargo]);
  }
  const dono = (await pool.query(`SELECT id FROM users WHERE discord_id = '111'`)).rows[0].id;
  const D = await sessao(staff.diretor, 1);
  const J = await sessao(jog, 1);

  console.log('\nPERMISSÃO');
  await caso('todo cargo abaixo de Diretor toma 403 em TODAS as rotas de staff', async () => {
    const rotas = [['GET', '/api/admin/royalties/config'], ['GET', '/api/admin/royalties/busca?q=ry'], ['GET', '/api/admin/royalties/' + RID],
      ['GET', '/api/admin/royalties/trocas'], ['POST', '/api/admin/royalties/creditar', { roblox_id: RID, motivo: 'voto', comprovacao: 'ticket-1' }],
      ['POST', '/api/admin/royalties/estornar', { lancamento_id: 1, motivo: 'teste' }], ['PUT', '/api/admin/royalties/catalogo/gol', { ativo: true }]];
    for (const cargo of ['estagiario', 'moderador', 'administrador', 'supervisor', 'gestor_testers']) {
      const c = await sessao(staff[cargo], 1);
      for (const [m, p, b] of rotas) { const r = await pedir(c, m, p, b); assert.strictEqual(r.s, 403, cargo + ' ' + m + ' ' + p + ' -> ' + r.s); }
    }
    for (const [m, p, b] of rotas) assert.strictEqual((await pedir(J, m, p, b)).s, 403, 'jogador comum ' + p);
    assert.strictEqual((await pedir(D, 'GET', '/api/admin/royalties/config')).s, 200);
  });
  await caso('Diretor não muda catálogo (só o Dono)', async () => {
    assert.strictEqual((await pedir(D, 'PUT', '/api/admin/royalties/catalogo/gol', { ativo: true })).s, 403);
  });

  console.log('\nCRÉDITO');
  await caso('crédito sem comprovação é recusado', async () => {
    const r = await pedir(D, 'POST', '/api/admin/royalties/creditar', { roblox_id: RID, motivo: 'bug_p1', comprovacao: '' });
    assert.strictEqual(r.s, 400); assert.ok(/comprova/i.test(r.j.error));
  });
  await caso('crédito com motivo da lista: valor vem da tabela (o front não manda valor)', async () => {
    const r = await pedir(D, 'POST', '/api/admin/royalties/creditar', { roblox_id: RID, motivo: 'bug_p1', comprovacao: 'ticket-77', valor: 99999 });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j)); assert.strictEqual(r.j.saldo, 80);
  });
  await caso('ajuste manual: Diretor não pode, Dono pode', async () => {
    assert.strictEqual((await pedir(D, 'POST', '/api/admin/royalties/creditar', { roblox_id: RID, motivo: 'ajuste', comprovacao: 'teste', valor: 5000 })).s, 403);
    const r = await pedir(await sessao(dono, 1), 'POST', '/api/admin/royalties/creditar', { roblox_id: RID, motivo: 'ajuste', comprovacao: 'acerto do evento 20/10', valor: 2000 });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j)); assert.strictEqual(r.j.saldo, 2080);
  });

  console.log('\nTROCA E LIMITES');
  await caso('conta Roblox não verificada não vê nem troca', async () => {
    const c = await sessao(naoVerif, 1);
    assert.strictEqual((await pedir(c, 'GET', '/api/royalties/eu')).s, 409);
    assert.strictEqual((await pedir(c, 'POST', '/api/royalties/trocar', { item: 'dinheiro_5k' })).s, 409);
  });
  await caso('item desligado (Gol) não troca', async () => {
    const r = await pedir(J, 'POST', '/api/royalties/trocar', { item: 'gol' });
    assert.strictEqual(r.s, 400);
  });
  await caso('1º pacote de dinheiro passa; 2º na mesma semana é recusado', async () => {
    assert.strictEqual((await pedir(J, 'POST', '/api/royalties/trocar', { item: 'dinheiro_5k' })).s, 200);
    const r = await pedir(J, 'POST', '/api/royalties/trocar', { item: 'dinheiro_15k' });
    assert.strictEqual(r.s, 400); assert.ok(/pacote de dinheiro/i.test(r.j.error), r.j.error);
  });
  // o Dono liga dois prêmios pra testar o resto
  const DN = await sessao(dono, 1);
  await pedir(DN, 'PUT', '/api/admin/royalties/catalogo/carro_temporada', { carro: 'Opala', ativo: true });
  await pedir(DN, 'PUT', '/api/admin/royalties/catalogo/galao', { ativo: true });
  await caso('Carro da Temporada: 1º passa, 2º na mesma temporada é recusado', async () => {
    assert.strictEqual((await pedir(J, 'POST', '/api/royalties/trocar', { item: 'carro_temporada' })).s, 200);
    // zera a semana pra isolar o limite da temporada
    await pool.query(`UPDATE royalties_trocas SET semana = '2000-W01' WHERE roblox_id = $1`, [RID]);
    const r = await pedir(J, 'POST', '/api/royalties/trocar', { item: 'carro_temporada' });
    assert.strictEqual(r.s, 400); assert.ok(/temporada/i.test(r.j.error), r.j.error);
  });
  await caso('temporada sobe: Carro da Temporada volta a valer', async () => {
    await pool.query(`UPDATE game_config SET value = '{"n":6}' WHERE key = 'temporada'`);
    const r = await pedir(J, 'POST', '/api/royalties/trocar', { item: 'carro_temporada' });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j));
  });
  await caso('4ª troca na semana é recusada', async () => {
    await pool.query(`UPDATE royalties_trocas SET semana = '2000-W01' WHERE roblox_id = $1`, [RID]);
    for (let i = 0; i < 3; i++) assert.strictEqual((await pedir(J, 'POST', '/api/royalties/trocar', { item: 'galao' })).s, 200, 'troca ' + (i + 1));
    const r = await pedir(J, 'POST', '/api/royalties/trocar', { item: 'galao' });
    assert.strictEqual(r.s, 400); assert.ok(/3 trocas/.test(r.j.error), r.j.error);
    const eu = (await pedir(J, 'GET', '/api/royalties/eu')).j;
    assert.strictEqual(eu.semana.usadas, 3);
    assert.ok(eu.catalogo.every(i => !i.pode));
  });
  await caso('concorrência: 2 cliques ao mesmo tempo com saldo pra 1 — só 1 passa, saldo nunca negativo', async () => {
    await pool.query(`UPDATE royalties_saldo SET saldo = 60 WHERE roblox_id = $1 AND cidade_id = 1`, [RID]);   // dá pra 1 pacote de 50
    for (let rodada = 0; rodada < 5; rodada++) {
      await pool.query(`UPDATE royalties_saldo SET saldo = 60 WHERE roblox_id = $1 AND cidade_id = 1`, [RID]);
      const c = await pool.connect();
      try { await c.query(`SET royalties.limpeza_de_teste = 'sim'`); await c.query(`DELETE FROM royalties_lancamentos WHERE roblox_id = $1 AND tipo = 'troca'`, [RID]); await c.query(`DELETE FROM royalties_trocas WHERE roblox_id = $1`, [RID]); }
      finally { await c.query(`RESET royalties.limpeza_de_teste`).catch(() => {}); c.release(); }
      const [a, b] = await Promise.all([pedir(J, 'POST', '/api/royalties/trocar', { item: 'dinheiro_5k' }), pedir(J, 'POST', '/api/royalties/trocar', { item: 'dinheiro_5k' })]);
      const passou = [a, b].filter(x => x.s === 200).length;
      assert.strictEqual(passou, 1, 'rodada ' + rodada + ': ' + a.s + '/' + b.s);
      const s = (await pool.query(`SELECT saldo FROM royalties_saldo WHERE roblox_id = $1 AND cidade_id = 1`, [RID])).rows[0].saldo;
      assert.strictEqual(s, 10);
    }
  });

  console.log('\nESTORNO E EXTRATO IMUTÁVEL');
  await caso('estorno cria linha nova e não apaga nada; não estorna 2x', async () => {
    const r = await pedir(D, 'POST', '/api/admin/royalties/creditar', { roblox_id: RID, motivo: 'voto', comprovacao: 'print-urna.png' });
    const antes = (await pool.query(`SELECT COUNT(*)::int n FROM royalties_lancamentos WHERE roblox_id = $1`, [RID])).rows[0].n;
    const e = await pedir(D, 'POST', '/api/admin/royalties/estornar', { lancamento_id: r.j.id, motivo: 'voto duplicado' });
    assert.strictEqual(e.s, 200, JSON.stringify(e.j));
    const depois = (await pool.query(`SELECT COUNT(*)::int n FROM royalties_lancamentos WHERE roblox_id = $1`, [RID])).rows[0].n;
    assert.strictEqual(depois, antes + 1);
    const orig = (await pool.query(`SELECT valor FROM royalties_lancamentos WHERE id = $1`, [r.j.id])).rows[0];
    assert.strictEqual(orig.valor, 20);
    assert.strictEqual((await pedir(D, 'POST', '/api/admin/royalties/estornar', { lancamento_id: r.j.id, motivo: 'de novo' })).s, 400);
  });
  await caso('o banco recusa UPDATE e DELETE no extrato', async () => {
    await assert.rejects(pool.query(`UPDATE royalties_lancamentos SET valor = 1 WHERE roblox_id = $1`, [RID]), /estorno/);
    await assert.rejects(pool.query(`DELETE FROM royalties_lancamentos WHERE roblox_id = $1`, [RID]), /estorno/);
  });
  await caso('jogador não vê quem lançou nem a comprovação', async () => {
    const eu = (await pedir(J, 'GET', '/api/royalties/eu')).j;
    const txt = JSON.stringify(eu);
    assert.ok(!txt.includes('print-urna') && !txt.includes('ticket-77') && !txt.includes('ry_diretor'));
    assert.ok(eu.extrato.some(x => x.motivo === 'Voto na eleição'));
  });

  console.log('\nENTREGA NO JOGO (caminho do booster)');
  await caso('online: troca vai na hora pro servidor dele; jogo confirma -> entregue', async () => {
    await pool.query(`INSERT INTO game_servers (job_id, players, updated_at, cidade_id) VALUES ('job-ry', $1, NOW(), 1)`, [JSON.stringify([{ userId: RID, name: 'ry_jog' }])]);
    await pool.query(`UPDATE royalties_saldo SET saldo = 500 WHERE roblox_id = $1 AND cidade_id = 1`, [RID]);
    const c = await pool.connect();
    try { await c.query(`SET royalties.limpeza_de_teste = 'sim'`); await c.query(`DELETE FROM royalties_lancamentos WHERE roblox_id = $1 AND tipo = 'troca'`, [RID]); await c.query(`DELETE FROM royalties_trocas WHERE roblox_id = $1`, [RID]); }
    finally { await c.query(`RESET royalties.limpeza_de_teste`).catch(() => {}); c.release(); }
    const r = await pedir(J, 'POST', '/api/royalties/trocar', { item: 'galao' });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j));
    const t = (await pool.query(`SELECT * FROM royalties_trocas WHERE id = $1`, [r.j.troca_id])).rows[0];
    assert.strictEqual(t.status, 'enviando');
    const f = (await pool.query(`SELECT * FROM game_item_fila WHERE id = ANY($1)`, [t.fila_ids])).rows;
    assert.strictEqual(f[0].item, 'Galao de gasolina'); assert.strictEqual(f[0].preso, true);
    const msg = (await pool.query(`SELECT * FROM game_commands WHERE id = ANY($1)`, [t.cmd_ids])).rows;
    // o jogo entrega e confirma
    await pool.query(`UPDATE game_item_fila SET entregue_em = NOW() WHERE id = ANY($1)`, [t.fila_ids]);
    await pool.query(`UPDATE game_commands SET status = 'done' WHERE id = ANY($1)`, [t.cmd_ids]);
    await fetch(BASE + '/api/game/heartbeat', { method: 'POST', headers: { 'x-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: 'job-ry', players: [{ userId: RID, name: 'ry_jog' }] }) });
    await new Promise(r => setTimeout(r, 600));
    assert.strictEqual((await pool.query(`SELECT status FROM royalties_trocas WHERE id = $1`, [t.id])).rows[0].status, 'entregue');
    const eu = (await pedir(J, 'GET', '/api/royalties/eu')).j;
    assert.ok(eu.extrato.some(x => x.status === 'entregue'));
    assert.strictEqual(msg.length, 0);   // galão não tem comando, só fila (a mensagem vai junto)
  });
  await caso('offline: fica pendente e sai quando ele aparece no heartbeat', async () => {
    await pool.query(`DELETE FROM game_servers WHERE job_id = 'job-ry'`);
    await pool.query(`UPDATE royalties_trocas SET semana = '2000-W01' WHERE roblox_id = $1`, [RID]);
    const r = await pedir(J, 'POST', '/api/royalties/trocar', { item: 'dinheiro_15k' });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j));
    assert.strictEqual((await pool.query(`SELECT status FROM royalties_trocas WHERE id = $1`, [r.j.troca_id])).rows[0].status, 'pendente');
    await fetch(BASE + '/api/game/heartbeat', { method: 'POST', headers: { 'x-api-key': KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: 'job-ry', players: [{ userId: RID, name: 'ry_jog' }] }) });
    await new Promise(r => setTimeout(r, 800));
    const t = (await pool.query(`SELECT * FROM royalties_trocas WHERE id = $1`, [r.j.troca_id])).rows[0];
    assert.strictEqual(t.status, 'enviando');
    const cmds = (await pool.query(`SELECT tipo, payload, job_id FROM game_commands WHERE id = ANY($1)`, [t.cmd_ids])).rows;
    assert.strictEqual(cmds[0].tipo, 'dinheiro_add'); assert.strictEqual(cmds[0].payload.valor, 15000); assert.strictEqual(cmds[0].payload.motivo, 'royalties');
    assert.strictEqual(cmds[0].job_id, 'job-ry');
  });
  await caso('estornar troca pendente cancela e devolve; troca já enviada não estorna', async () => {
    await pool.query(`DELETE FROM game_servers WHERE job_id = 'job-ry'`);
    await pool.query(`UPDATE royalties_trocas SET semana = '2000-W01' WHERE roblox_id = $1`, [RID]);
    const s0 = (await pool.query(`SELECT saldo FROM royalties_saldo WHERE roblox_id = $1 AND cidade_id = 1`, [RID])).rows[0].saldo;
    const r = await pedir(J, 'POST', '/api/royalties/trocar', { item: 'galao' });
    const l = (await pool.query(`SELECT id FROM royalties_lancamentos WHERE troca_id = $1 AND tipo = 'troca'`, [r.j.troca_id])).rows[0];
    const e = await pedir(D, 'POST', '/api/admin/royalties/estornar', { lancamento_id: l.id, motivo: 'pediu cancelamento' });
    assert.strictEqual(e.s, 200, JSON.stringify(e.j)); assert.strictEqual(e.j.saldo, s0);
    assert.strictEqual((await pool.query(`SELECT status FROM royalties_trocas WHERE id = $1`, [r.j.troca_id])).rows[0].status, 'cancelada');
    const enviada = (await pool.query(`SELECT l.id FROM royalties_lancamentos l JOIN royalties_trocas t ON t.id = l.troca_id WHERE t.status = 'enviando' AND l.tipo = 'troca' AND l.roblox_id = $1 LIMIT 1`, [RID])).rows[0];
    assert.strictEqual((await pedir(D, 'POST', '/api/admin/royalties/estornar', { lancamento_id: enviada.id, motivo: 'x teste' })).s, 400);
  });

  console.log('\nCIDADES ISOLADAS');
  await caso('2ª cidade não vê saldo, extrato nem troca do Santa Fé', async () => {
    const norte = (await pool.query(`INSERT INTO cidades (slug, nome, sigla, tipo, status, loja_prefixo) VALUES ('ry-norte','Norte','NRT','comunidade','ativa','RYN') RETURNING id`)).rows[0].id;
    await pool.query(`INSERT INTO cidade_staff (cidade_id, user_id, cargo) VALUES ($1,$2,'diretor')`, [norte, staff.diretor]);
    const eu = await pedir(await sessao(jog, norte), 'GET', '/api/royalties/eu');
    assert.strictEqual(eu.s, 200); assert.strictEqual(eu.j.saldo, 0); assert.strictEqual(eu.j.extrato.length, 0); assert.strictEqual(eu.j.catalogo.length, 0);
    const dn = await sessao(staff.diretor, norte);
    const ex = await pedir(dn, 'GET', '/api/admin/royalties/' + RID);
    assert.strictEqual(ex.j.saldo, 0); assert.strictEqual(ex.j.lancamentos.length, 0); assert.strictEqual(ex.j.trocas.length, 0);
    assert.strictEqual((await pedir(dn, 'GET', '/api/admin/royalties/trocas')).j.length, 0);
    // estornar um lançamento do Santa Fé pela sessão da Norte: 404
    const l = (await pool.query(`SELECT id FROM royalties_lancamentos WHERE cidade_id = 1 AND roblox_id = $1 AND tipo = 'credito' LIMIT 1`, [RID])).rows[0];
    assert.strictEqual((await pedir(dn, 'POST', '/api/admin/royalties/estornar', { lancamento_id: l.id, motivo: 'invasão' })).s, 404);
    // sem motivos na Norte: crédito não tem o que lançar
    assert.strictEqual((await pedir(dn, 'POST', '/api/admin/royalties/creditar', { roblox_id: RID, motivo: 'voto', comprovacao: 'xxxx' })).s, 400);
  });
  await caso('Economia do Dono lista os créditos com quem lançou e a prova', async () => {
    const r = await pedir(DN, 'GET', '/api/admin/economia?dias=0');
    assert.strictEqual(r.s, 200, JSON.stringify(r.j));
    assert.ok(r.j.royalties.some(x => x.comprovacao === 'ticket-77' && x.por_nome === 'ry_diretor'), JSON.stringify(r.j.royalties).slice(0, 300) + ' desde=' + r.j.temporadaDesde);
  });

  await pool.query(`UPDATE royalties_catalogo SET ativo = false, conteudo = '{"carro":null}' WHERE cidade_id = 1 AND chave = 'carro_temporada'`);
  await pool.query(`UPDATE royalties_catalogo SET ativo = false WHERE cidade_id = 1 AND chave = 'galao'`);
  await pool.query(`DELETE FROM game_config WHERE key = 'temporada'`);
  await limpar();
  await pool.end();
  console.log(`\n${ok} ok, ${falhou} falharam`);
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
