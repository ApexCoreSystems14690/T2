// [16/10] Teste ponta a ponta da aba PDs + reverter, contra Postgres de verdade e o
// servidor de verdade rodando (node src/index.js). Uso:
//   DATABASE_URL=... ROBLOX_API_KEY=... SESSION_SECRET=... BASE=http://localhost:3999 node teste_pds.js
const { Pool } = require('pg');
const sig = require('cookie-signature');
const crypto = require('crypto');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.BASE || 'http://localhost:3999';
const KEY = process.env.ROBLOX_API_KEY;

let falhas = 0, total = 0;
function ok(c, nome, extra) { total++; if (!c) { falhas++; console.log('  FALHOU:', nome, extra !== undefined ? JSON.stringify(extra) : ''); } else console.log('  ok', nome); }

async function jogo(method, path, body) {
  const r = await fetch(BASE + '/api/game' + path, { method, headers: { 'x-api-key': KEY, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json().catch(() => null) };
}
let COOKIE = '';
async function admin(method, path, body, cookie) {
  const r = await fetch(BASE + '/api/admin' + path, { method, redirect: 'manual', headers: { cookie: cookie || COOKIE, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json().catch(() => null) };
}
async function sessao(userId) {
  const sid = crypto.randomBytes(16).toString('hex');
  await pool.query(`INSERT INTO session (sid, sess, expire) VALUES ($1, $2, NOW() + INTERVAL '1 day')`,
    [sid, JSON.stringify({ cookie: { originalMaxAge: 86400000, httpOnly: true, path: '/' }, userId })]);
  return 'connect.sid=' + encodeURIComponent('s:' + sig.sign(sid, process.env.SESSION_SECRET));
}
const q = (s, p) => pool.query(s, p).then(r => r.rows);

async function main() {
  // ---------- cenário
  await q(`DELETE FROM fichas_encerradas; DELETE FROM procurados WHERE roblox_id IN (9001,9002); DELETE FROM corp_vinculos_hist; DELETE FROM game_logs WHERE tipo IN ('pd_revertido','pd_faccao');`);
  await q(`DELETE FROM users WHERE discord_id IN ('d-dono','d-vit','d-estag','d-vit2')`);
  await q(`DELETE FROM corporations WHERE slug IN ('pm-teste','pc-teste')`);
  const dono = (await q(`INSERT INTO users (discord_id, discord_username, is_admin) VALUES ('d-dono','julio14690',true) RETURNING id`))[0].id;
  const estag = (await q(`INSERT INTO users (discord_id, discord_username, is_admin, admin_cargo) VALUES ('d-estag','estag',true,'estagiario') RETURNING id`))[0].id;
  const vit = (await q(`INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username) VALUES ('d-vit','vit',9001,'Vitima') RETURNING id`))[0].id;
  const vit2 = (await q(`INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username) VALUES ('d-vit2','vit2',9002,'Velho') RETURNING id`))[0].id;
  const pm = (await q(`INSERT INTO corporations (name, slug) VALUES ('PM Teste','pm-teste') RETURNING id`))[0].id;
  const pc = (await q(`INSERT INTO corporations (name, slug) VALUES ('PC Teste','pc-teste') RETURNING id`))[0].id;
  const soldado = (await q(`INSERT INTO ranks (corporation_id, name, level) VALUES ($1,'Soldado',1) RETURNING id`, [pm]))[0].id;
  const sargento = (await q(`INSERT INTO ranks (corporation_id, name, level) VALUES ($1,'Sargento',3) RETURNING id`, [pm]))[0].id;
  const delegado = (await q(`INSERT INTO ranks (corporation_id, name, level) VALUES ($1,'Delegado',5) RETURNING id`, [pc]))[0].id;
  await q(`INSERT INTO members (corporation_id, user_id, rank_id, joined_at) VALUES ($1,$2,$3,'2026-09-01'),($4,$2,$5,'2026-09-10')`, [pm, vit, sargento, pc, delegado]);
  await q(`INSERT INTO corp_managers (corporation_id, user_id) VALUES ($1,$2)`, [pm, vit]);
  await q(`INSERT INTO procurados (roblox_id, nome, motivo, estado) VALUES (9001,'Vitima','roubo','ativo')`);
  await q(`DELETE FROM game_servers`);
  await q(`INSERT INTO game_servers (job_id, players, updated_at) VALUES ('job-A', $1, NOW()), ('job-B', '[]', NOW())`, [JSON.stringify([{ userId: 9001, name: 'Vitima' }])]);
  COOKIE = await sessao(dono);
  const cookieEstag = await sessao(estag);

  console.log('\n1) PD chega do jogo (encerrar-personagem)');
  let r = await jogo('POST', '/player/9001/encerrar-personagem', { chave: '9001:1000', nome: 'Vitima', motivo: 'PD de faccao (ferro velho)', por_nome: 'Exec', corp: 'cv', pd: true, resumo: { dinheiro: 50000, banco: 9000, level: 12, carros: 2, snapshot: '9001:1000' } });
  ok(r.status === 200 && r.j.ok && r.j.saiu_de.length === 2, 'encerrar tira das 2 corps', r.j);
  const f1 = (await q(`SELECT * FROM fichas_encerradas WHERE chave = '9001:1000'`))[0];
  ok(f1 && f1.pd === true && f1.vinculos.length === 2 && f1.gerencias.length === 1 && f1.procurados_ids.length === 1, 'ficha guardou vinculos/gerencia/mandado', f1 && { v: f1.vinculos, g: f1.gerencias, p: f1.procurados_ids });
  ok((await q(`SELECT 1 FROM members WHERE user_id = $1`, [vit])).length === 0, 'membros apagados');
  ok((await q(`SELECT 1 FROM corp_vinculos_hist WHERE user_id = $1`, [vit])).length === 2, 'gatilho escreveu 2 saídas no histórico');
  ok((await q(`SELECT estado FROM procurados WHERE roblox_id = 9001`))[0].estado === 'encerrado', 'mandado encerrado');
  r = await jogo('POST', '/player/9001/encerrar-personagem', { chave: '9001:1000', nome: 'Vitima' });
  ok(r.j && r.j.repetido === true, 'mesmo PD 2x = 1 registro');
  await q(`INSERT INTO game_logs (tipo, jogador, alvo, detalhe, ocorrido_em) VALUES ('pd_faccao','Exec','Vitima',$1,NOW())`, [JSON.stringify({ desfecho: 'concluido', presentes: ['Exec', 'Amigo'] })]);

  console.log('\n2) Aba PDs');
  r = await admin('GET', '/pds');
  ok(r.status === 200 && r.j.pds.length === 1, 'lista 1 PD', r);
  let p = r.j.pds[0];
  ok(p.tipo === 'pd_faccao' && p.backup && p.pode_reverter && r.j.pode_reverter, 'tipo pneu, com backup, pode reverter', p);
  ok(Array.isArray(p.presentes) && p.presentes.includes('Amigo'), 'mostra quem estava na roda', p.presentes);
  r = await admin('GET', '/pds', null, cookieEstag);
  ok(r.status === 200 && r.j.pode_reverter === false, 'estagiário VÊ mas não reverte');
  r = await admin('POST', '/pds/' + p.id + '/reverter', { motivo: 'x' }, cookieEstag);
  ok(r.status === 403, 'estagiário barrado no back (403)', r.status);
  r = await admin('POST', '/pds/' + p.id + '/reverter', {});
  ok(r.status === 400, 'sem motivo = recusado');
  r = await admin('POST', '/pds/' + p.id + '/reverter', { motivo: 'denúncia #1: sem RP' });
  ok(r.status === 200 && r.j.ok && r.j.servidores === 2, 'pedido aceito', r.j);
  r = await admin('POST', '/pds/' + p.id + '/reverter', { motivo: 'de novo' });
  ok(r.status === 409, 'clicar 2x não duplica', r.status);
  ok((await q(`SELECT 1 FROM members WHERE user_id = $1`, [vit])).length === 0, 'site NÃO mexeu antes do jogo confirmar');

  console.log('\n3) Jogo pega o pedido');
  r = await jogo('GET', '/pds/reverter/proximo?job_id=job-B');
  ok(r.status === 200 && r.j.pedido === null, 'servidor onde ele NÃO está não pega', r.j);
  r = await jogo('GET', '/pds/reverter/proximo?job_id=job-A');
  ok(r.j.pedido && r.j.pedido.chave === '9001:1000' && r.j.pedido.roblox_id === 9001, 'servidor dele pega com a chave', r.j);
  r = await jogo('GET', '/pds/reverter/proximo?job_id=job-A');
  ok(r.j.pedido === null, 'não entrega o mesmo 2x');
  r = await admin('GET', '/pds');
  ok(r.j.pds[0].rev.estado === 'executando' && !r.j.pds[0].pode_reverter, 'painel mostra DEVOLVENDO');
  r = await admin('POST', '/pds/' + p.id + '/cancelar');
  ok(r.status === 409, 'não cancela o que já está executando');

  console.log('\n4) Jogo confirma → site devolve o dele');
  r = await jogo('POST', '/pds/' + p.id + '/reverter/resultado', { job_id: 'job-A', ok: true, msg: 'personagem devolvido (offline)', detalhe: { casas_voltaram: [1] } });
  ok(r.status === 200 && r.j.estado === 'feito', 'resultado aceito', r.j);
  const mem = await q(`SELECT c.slug, r.name AS cargo, m.joined_at FROM members m JOIN corporations c ON c.id = m.corporation_id LEFT JOIN ranks r ON r.id = m.rank_id WHERE m.user_id = $1 ORDER BY c.slug`, [vit]);
  ok(mem.length === 2 && mem.find(m => m.slug === 'pm-teste').cargo === 'Sargento' && mem.find(m => m.slug === 'pc-teste').cargo === 'Delegado', 'voltou pras 2 corps COM o cargo', mem);
  const jt = (await q(`SELECT to_char(m.joined_at,'YYYY-MM-DD HH24:MI') AS t FROM members m WHERE m.user_id = $1 AND m.corporation_id = $2`, [vit, pm]))[0].t;
  ok(jt === '2026-09-01 00:00', 'data de entrada original (exata)', jt);
  ok((await q(`SELECT 1 FROM corp_managers WHERE user_id = $1`, [vit])).length === 1, 'co-gerência de volta');
  ok((await q(`SELECT estado FROM procurados WHERE roblox_id = 9001`))[0].estado === 'ativo', 'mandado reaberto');
  ok((await q(`SELECT 1 FROM corp_vinculos_hist WHERE user_id = $1`, [vit])).length === 0, 'saídas falsas sumiram do histórico');
  const f1b = (await q(`SELECT * FROM fichas_encerradas WHERE id = $1`, [p.id]))[0];
  ok(f1b.estado === 'revertido' && f1b.rev_estado === 'feito' && f1b.rev_detalhe.site.corps.length === 2, 'ficha marcada revertida');
  ok((await q(`SELECT 1 FROM game_logs WHERE tipo = 'pd_revertido' AND alvo = 'Vitima'`)).length === 1, 'log pd_revertido');
  r = await jogo('GET', '/player/9001/fichas-encerradas');
  ok(r.j.fichas.length === 0, 'PC da Ficha não mostra PD revertido');
  r = await jogo('POST', '/pds/' + p.id + '/reverter/resultado', { job_id: 'job-A', ok: true });
  ok(r.status === 200 && r.j.repetido, 'resultado repetido não faz nada');
  r = await admin('GET', '/pds');
  ok(r.j.pds[0].estado === 'revertido' && !r.j.pds[0].pode_reverter && r.j.pds[0].motivo_nao === 'já revertido', 'painel: REVERTIDO, sem botão');

  console.log('\n5) Falha no jogo, fila presa e tentar de novo');
  r = await jogo('POST', '/player/9001/encerrar-personagem', { chave: '9001:2000', nome: 'Vitima', motivo: 'wipe de personagem', resumo: { snapshot: '9001:2000' } });
  const f2 = (await q(`SELECT id FROM fichas_encerradas WHERE chave = '9001:2000'`))[0].id;
  await admin('POST', '/pds/' + f2 + '/reverter', { motivo: 'teste' });
  r = await jogo('GET', '/pds/reverter/proximo?job_id=job-A');
  r = await jogo('POST', '/pds/' + f2 + '/reverter/resultado', { job_id: 'job-A', ok: false, msg: 'casas: DataStore fora' });
  ok(r.j.estado === 'erro', 'erro registrado');
  ok((await q(`SELECT 1 FROM members WHERE user_id = $1`, [vit])).length === 0, 'erro no jogo = site não mexe');
  r = await admin('GET', '/pds');
  let p2 = r.j.pds.find(x => x.id === f2);
  ok(p2.rev.estado === 'erro' && p2.pode_reverter && p2.rev.msg.includes('DataStore'), 'painel mostra FALHOU e deixa tentar de novo', p2.rev);
  r = await admin('POST', '/pds/' + f2 + '/reverter', { motivo: 'tentando de novo' });
  r = await jogo('GET', '/pds/reverter/proximo?job_id=job-A');
  ok(r.j.pedido && r.j.pedido.id === f2, 'volta pra fila');
  // jogo pegou e morreu: depois de 3 min volta pra fila sozinho
  await q(`UPDATE fichas_encerradas SET rev_claim_em = NOW() - INTERVAL '4 minutes' WHERE id = $1`, [f2]);
  await q(`UPDATE game_servers SET players = '[]'`);   // agora ele está offline
  r = await jogo('GET', '/pds/reverter/proximo?job_id=job-B');
  ok(r.j.pedido && r.j.pedido.id === f2, 'travado há 4 min: outro servidor assume (offline vai pra qualquer um)');
  r = await jogo('POST', '/pds/' + f2 + '/reverter/resultado', { job_id: 'job-B', ok: true, msg: 'ja estava revertido (pedido repetido)' });
  ok(r.j.estado === 'feito', 'concluiu');

  console.log('\n6) Só o mais novo reverte; sem backup não reverte; ficha antiga (antes de 16/10)');
  await jogo('POST', '/player/9001/encerrar-personagem', { chave: '9001:3000', nome: 'Vitima', resumo: { snapshot: '9001:3000' } });
  await jogo('POST', '/player/9001/encerrar-personagem', { chave: '9001:4000', nome: 'Vitima', resumo: {} });
  r = await admin('GET', '/pds?q=Vitima');
  const p3 = r.j.pds.find(x => x.resumo && x.resumo.snapshot === '9001:3000');
  const p4 = r.j.pds.find(x => x.id !== p3.id && x.estado !== 'revertido');
  ok(!p3.pode_reverter && /mais novo/.test(p3.motivo_nao), 'antigo bloqueado: tem um mais novo', p3.motivo_nao);
  ok(!p4.pode_reverter && /sem backup/.test(p4.motivo_nao), 'sem backup bloqueado', p4.motivo_nao);
  r = await admin('POST', '/pds/' + p3.id + '/reverter', { motivo: 'forçando' });
  ok(r.status === 409, 'back também barra o antigo');
  // ficha "antiga": PD feito pela rota velha (sem vinculos) — reverter acha pelo histórico
  await q(`INSERT INTO members (corporation_id, user_id, rank_id, joined_at) VALUES ($1,$2,$3,'2026-08-01')`, [pm, vit2, sargento]);
  await q(`INSERT INTO procurados (roblox_id, nome, motivo, estado) VALUES (9002,'Velho','furto','ativo')`);
  await jogo('POST', '/player/9002/encerrar-personagem', { chave: '9002:1000', nome: 'Velho', motivo: 'PD de faccao (ferro velho)', resumo: { snapshot: '9002:1000' } });
  await q(`UPDATE fichas_encerradas SET vinculos = NULL, gerencias = NULL, procurados_ids = NULL, pd = NULL WHERE chave = '9002:1000'`);
  await q(`UPDATE ranks SET name = 'Sargento' WHERE id = $1`, [sargento]);
  const f5 = (await q(`SELECT id FROM fichas_encerradas WHERE chave = '9002:1000'`))[0].id;
  await admin('POST', '/pds/' + f5 + '/reverter', { motivo: 'antiga' });
  await jogo('GET', '/pds/reverter/proximo?job_id=job-A');
  r = await jogo('POST', '/pds/' + f5 + '/reverter/resultado', { job_id: 'job-A', ok: true, msg: 'ok' });
  const mem2 = await q(`SELECT r.name FROM members m LEFT JOIN ranks r ON r.id = m.rank_id WHERE m.user_id = $1`, [vit2]);
  ok(mem2.length === 1 && mem2[0].name === 'Sargento', 'ficha antiga: corp + cargo achados pelo histórico', mem2);
  ok((await q(`SELECT estado FROM procurados WHERE roblox_id = 9002`))[0].estado === 'ativo', 'ficha antiga: mandado reaberto pela janela de tempo');

  console.log('\n7) Mandado novo aberto depois do PD não quebra');
  await q(`UPDATE procurados SET estado = 'encerrado' WHERE roblox_id = 9001`);
  await jogo('POST', '/player/9001/encerrar-personagem', { chave: '9001:5000', nome: 'Vitima', resumo: { snapshot: '9001:5000' } });
  await q(`INSERT INTO procurados (roblox_id, nome, motivo, estado) VALUES (9001,'Vitima','novo','ativo')`);
  const f6 = (await q(`SELECT id FROM fichas_encerradas WHERE chave = '9001:5000'`))[0].id;
  await q(`UPDATE fichas_encerradas SET procurados_ids = '[999999]' WHERE id = $1`, [f6]);
  await admin('POST', '/pds/' + f6 + '/reverter', { motivo: 'x' });
  await jogo('GET', '/pds/reverter/proximo?job_id=job-A');
  r = await jogo('POST', '/pds/' + f6 + '/reverter/resultado', { job_id: 'job-A', ok: true });
  ok(r.status === 200 && r.j.estado === 'feito', 'conclui mesmo com mandado novo aberto', r.j);

  console.log(`\n${total - falhas}/${total} ok`);
  await pool.end();
  process.exit(falhas ? 1 : 0);
}
main().catch(e => { console.error('ERRO NO TESTE:', e); process.exit(2); });
