// [24/10] Facções Vivas no site: nível pro jogo, painel sem caixa, ações, advertências, recursos,
// organização, alto comando, Ficha sem facção e isolamento entre cidades.
// Rodar com o site no ar: TZ=UTC DATABASE_URL=... BASE=http://localhost:4600 ROBLOX_API_KEY=k123 node teste_faccoes.js
const assert = require('assert');
const { Pool } = require('pg');
const sig = require('cookie-signature');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.BASE || 'http://localhost:4600';
const KEY = process.env.ROBLOX_API_KEY || 'k123';
let ok = 0, falhou = 0;
async function caso(n, f) { try { await f(); ok++; console.log('  ok  ' + n); } catch (e) { falhou++; console.log('  FALHOU  ' + n + '\n        ' + e.message); } }
async function sessao(uid, cidadeId) {
  const sid = 'fx' + uid + 'c' + cidadeId + Math.random().toString(36).slice(2);
  await pool.query(`INSERT INTO session (sid, sess, expire) VALUES ($1,$2,NOW()+interval '1 day')`, [sid, { cookie: { originalMaxAge: 864e5, httpOnly: true, path: '/' }, userId: uid, cidadeId }]);
  return 'connect.sid=' + encodeURIComponent('s:' + sig.sign(sid, 'dev-secret-apenas-local'));
}
async function pedir(c, met, path, body) {
  const r = await fetch(BASE + path, { method: met, redirect: 'manual', headers: { cookie: c || '', accept: 'application/json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { s: r.status, j };
}
const jogo = (met, path, body, cidade) => fetch(BASE + '/api/game' + path, { method: met, headers: { 'x-api-key': KEY, 'Content-Type': 'application/json', ...(cidade ? { 'x-cidade': cidade } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ s: r.status, j: await r.json().catch(() => null) }));
const PROVA = 'https://cdn.exemplo.com/print.png';

(async () => {
  // limpeza
  await pool.query(`DELETE FROM corporations WHERE slug LIKE 'fxt-%'`);
  await pool.query(`DELETE FROM faccao_pedidos WHERE nome LIKE 'FXT %'`);
  await pool.query(`DELETE FROM cidade_staff WHERE user_id IN (SELECT id FROM users WHERE discord_id LIKE 'fxt_%')`);
  await pool.query(`DELETE FROM game_patrimonio WHERE roblox_id BETWEEN 6600 AND 6699`).catch(() => {});
  await pool.query(`DELETE FROM users WHERE discord_id LIKE 'fxt_%' OR discord_id = '986522825219260446'`);
  const u = async (d, rid) => (await pool.query(`INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username, roblox_verificado) VALUES ($1,$1,$2,$1,true) RETURNING id`, [d, rid])).rows[0].id;
  const lider = await u('fxt_lider', 6601), membro = await u('fxt_membro', 6602), org = await u('fxt_org', 6603), orgMembro = await u('fxt_orgm', 6604),
        estag = await u('fxt_estag', 6605), admin = await u('fxt_admin', 6606), policial = await u('fxt_pol', 6607);
  const alto = (await pool.query(`INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username) VALUES ('986522825219260446','davix0001',6608,'davi') RETURNING id`)).rows[0].id;
  await pool.query(`INSERT INTO cidade_staff (cidade_id, user_id, cargo) VALUES (1,$1,'org_faccoes'),(1,$2,'org_faccoes'),(1,$3,'estagiario'),(1,$4,'administrador')`, [org, orgMembro, estag, admin]);
  const mk = async (slug, nome, nivel, cidade) => {
    const id = (await pool.query(`INSERT INTO corporations (name, slug, tipo, cidade_id, owner_id, color) VALUES ($1,$2,'faccao',$3,$4,'#AA2233') RETURNING id`, [nome, slug, cidade || 1, lider])).rows[0].id;
    await pool.query(`INSERT INTO faccao_info (corporation_id, nivel) VALUES ($1,$2) ON CONFLICT (corporation_id) DO UPDATE SET nivel = $2`, [id, nivel]);
    const r = [];
    for (const [n, l] of [['Líder', 3], ['Sub-líder', 2], ['Membro', 1]]) r.push((await pool.query(`INSERT INTO ranks (corporation_id, name, level, salary) VALUES ($1,$2,$3,0) RETURNING id`, [id, n, l])).rows[0].id);
    return { id, r };
  };
  const A = await mk('fxt-alfa', 'FXT Alfa', 2);
  await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3),($1,$4,$5),($1,$6,$5)`, [A.id, lider, A.r[0], membro, A.r[2], orgMembro]);
  const B = await mk('fxt-beta', 'FXT Beta', 3);
  await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3)`, [B.id, policial, B.r[2]]);
  let pm = (await pool.query(`SELECT id FROM corporations WHERE slug = 'fxt-pm'`)).rows[0];
  pm = (await pool.query(`INSERT INTO corporations (name, slug, tipo, cidade_id) VALUES ('FXT PM','fxt-pm','corp',1) RETURNING id`)).rows[0];
  await pool.query(`INSERT INTO members (corporation_id, user_id) VALUES ($1,$2)`, [pm.id, policial]);
  const S = { lider: await sessao(lider, 1), membro: await sessao(membro, 1), org: await sessao(org, 1), orgM: await sessao(orgMembro, 1),
              estag: await sessao(estag, 1), admin: await sessao(admin, 1) };

  console.log('\nJOGO');
  await caso('o jogo recebe `nivel` da facção (2 e 3) e nada pra corp normal', async () => {
    const r1 = await jogo('GET', '/player/6601'); const e1 = r1.j.corps.find(c => c.corp_slug === 'fxt-alfa');
    assert.strictEqual(e1.nivel, 2);
    const r2 = await jogo('GET', '/player/6607');
    assert.strictEqual(r2.j.corps.find(c => c.corp_slug === 'fxt-beta').nivel, 3);
    assert.strictEqual(r2.j.corps.find(c => c.corp_slug === 'fxt-pm').nivel, undefined);
  });
  await caso('facção nova sem linha de nível vai como Nível 1', async () => {
    await pool.query(`DELETE FROM faccao_info WHERE corporation_id = $1`, [B.id]);
    assert.strictEqual((await jogo('GET', '/player/6607')).j.corps.find(c => c.corp_slug === 'fxt-beta').nivel, 1);
    await pool.query(`INSERT INTO faccao_info (corporation_id, nivel) VALUES ($1, 3)`, [B.id]);
  });
  await caso('caixa aceita `apreensao` e credita inteiro (o jogo já manda os 50%)', async () => {
    await pool.query(`INSERT INTO corp_caixa (corporation_id, saldo) VALUES ($1,0) ON CONFLICT (corporation_id) DO UPDATE SET saldo = 0`, [pm.id]);
    const r = await jogo('POST', '/corp/caixa', { corp: 'fxt-pm', tipo: 'apreensao', valor_pago: 25000, quem: 'pol', por: 'apreensao de boca' });
    assert.strictEqual(r.j.creditado, 25000, JSON.stringify(r.j));
    const l = (await pool.query(`SELECT tipo FROM corp_lancamentos WHERE corporation_id = $1 ORDER BY id DESC LIMIT 1`, [pm.id])).rows[0];
    assert.strictEqual(l.tipo, 'apreensao');
  });

  console.log('\nFACÇÃO NÃO TEM CAIXA');
  await caso('caixa, estoque e vestiário da facção dão 403 até pela rota direta', async () => {
    assert.strictEqual((await pedir(S.lider, 'GET', `/api/corps/${A.id}/caixa`)).s, 403);
    assert.strictEqual((await pedir(S.lider, 'POST', `/api/corps/${A.id}/caixa/comprar`, { item: 'AK47', qtd: 1 })).s, 403);
    assert.strictEqual((await pedir(S.lider, 'POST', `/api/corps/${A.id}/caixa/bonus`, { valor: 10 })).s, 403);
  });
  await caso('cargo de facção não guarda salário', async () => {
    const r = await pedir(S.lider, 'POST', `/api/corps/${A.id}/ranks`, { name: 'Vapor', level: 0, salary: 9000 });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j)); assert.strictEqual(Number(r.j.rank.salary), 0);
  });
  await caso('membro comum abre o painel da facção; quem é de fora não', async () => {
    const r = await pedir(S.membro, 'GET', `/api/faccao/${A.id}/painel`);
    assert.strictEqual(r.s, 200); assert.strictEqual(r.j.faccao.nivel, 2); assert.ok(r.j.requisitos.proximo === 3);
    assert.strictEqual((await pedir(await sessao(policial, 1), 'GET', `/api/faccao/${A.id}/painel`)).s, 403);
    const pg = await fetch(BASE + '/dashboard/corp/' + A.id, { redirect: 'manual', headers: { cookie: S.membro } });
    assert.strictEqual(pg.status, 200);
  });

  console.log('\nAÇÕES REGISTRADAS');
  let acaoId;
  await caso('membro registra ação com prova; sem prova é recusada', async () => {
    assert.strictEqual((await pedir(S.membro, 'POST', `/api/faccao/${A.id}/acoes`, { tipo: 'assalto', data: '2026-10-23', prova: 'sem link' })).s, 400);
    const r = await pedir(S.membro, 'POST', `/api/faccao/${A.id}/acoes`, { tipo: 'assalto', data: '2026-10-23', prova: PROVA });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j)); acaoId = r.j.id;
  });
  await caso('organização aprova; membro da facção não decide a ação dela', async () => {
    assert.strictEqual((await pedir(S.orgM, 'POST', `/api/admin/faccoes/acoes/${acaoId}`, { aprovar: true })).s, 403);
    assert.strictEqual((await pedir(S.org, 'POST', `/api/admin/faccoes/acoes/${acaoId}`, { aprovar: true })).s, 200);
  });

  console.log('\nADVERTÊNCIAS');
  await caso('sem o poder: estagiário toma 403 na aba Facções; organização não julga recurso', async () => {
    assert.strictEqual((await pedir(S.estag, 'GET', '/api/admin/faccoes')).s, 403);
    assert.strictEqual((await pedir(S.org, 'GET', '/api/admin/faccoes-recursos')).s, 403);
    assert.strictEqual((await pedir(S.admin, 'GET', '/api/admin/faccoes-recursos')).s, 200);
  });
  await caso('advertência sem prova é recusada', async () => {
    const r = await pedir(S.org, 'POST', `/api/admin/faccoes/${A.id}/advertencias`, { artigo: '5.3', motivo: 'chegou atirando na boca' });
    assert.strictEqual(r.s, 400);
  });
  await caso('membro da facção punida não adverte ela (Art. 9.2)', async () => {
    const r = await pedir(S.orgM, 'POST', `/api/admin/faccoes/${A.id}/advertencias`, { artigo: '5.3', motivo: 'chegou atirando', prova: PROVA });
    assert.strictEqual(r.s, 403);
  });
  let adv1;
  await caso('2 advertências ativas: desce um nível', async () => {
    adv1 = (await pedir(S.org, 'POST', `/api/admin/faccoes/${A.id}/advertencias`, { artigo: '5.3', motivo: 'chegou atirando na boca', prova: PROVA })).j.id;
    const r = await pedir(S.org, 'POST', `/api/admin/faccoes/${A.id}/advertencias`, { artigo: '7.1', motivo: 'guerra sem declarar', prova: PROVA });
    assert.strictEqual(r.j.consequencia, 'desceu_nivel', JSON.stringify(r.j));
    assert.strictEqual(Number((await pool.query(`SELECT nivel FROM faccao_info WHERE corporation_id = $1`, [A.id])).rows[0].nivel), 1);
  });
  await caso('advertência vencida (mais de 30 dias) não conta', async () => {
    await pool.query(`UPDATE faccao_advertencias SET vence_em = NOW() - INTERVAL '1 day' WHERE corporation_id = $1`, [A.id]);
    const r = await pedir(S.org, 'POST', `/api/admin/faccoes/${A.id}/advertencias`, { artigo: '4.1', motivo: 'convite pelo discord', prova: PROVA });
    assert.strictEqual(r.j.consequencia, null);
    assert.strictEqual((await pedir(S.membro, 'GET', `/api/faccao/${A.id}/painel`)).j.faccao.advertencias_ativas, 1);
  });
  await caso('recurso: só líder/sub; até 72 h; depois de 72 h é recusado; a staff decide', async () => {
    const adv = (await pool.query(`SELECT id FROM faccao_advertencias WHERE corporation_id = $1 ORDER BY id DESC LIMIT 1`, [A.id])).rows[0].id;
    assert.strictEqual((await pedir(S.membro, 'POST', `/api/faccao/${A.id}/advertencias/${adv}/recurso`, { texto: 'não fomos nós, o print é de outra facção' })).s, 403);
    await pool.query(`UPDATE faccao_advertencias SET aplicada_em = NOW() - INTERVAL '73 hours' WHERE id = $1`, [adv1]);
    const tarde = await pedir(S.lider, 'POST', `/api/faccao/${A.id}/advertencias/${adv1}/recurso`, { texto: 'recurso fora do prazo de propósito' });
    assert.strictEqual(tarde.s, 400); assert.ok(/72/.test(tarde.j.error));
    assert.strictEqual((await pedir(S.lider, 'POST', `/api/faccao/${A.id}/advertencias/${adv}/recurso`, { texto: 'não fomos nós, o print é de outra facção' })).s, 200);
    const lista = (await pedir(S.admin, 'GET', '/api/admin/faccoes-recursos')).j.recursos;
    assert.ok(lista.some(x => x.id === adv));
    assert.strictEqual((await pedir(S.admin, 'POST', `/api/admin/faccoes-recursos/${adv}`, { aceitar: true, motivo: 'print era de outra facção' })).s, 200);
    assert.strictEqual((await pedir(S.membro, 'GET', `/api/faccao/${A.id}/painel`)).j.faccao.advertencias_ativas, 0);
  });
  await caso('3 advertências ativas: desoficializa', async () => {
    let r;
    for (let i = 0; i < 3; i++) r = await pedir(S.org, 'POST', `/api/admin/faccoes/${B.id}/advertencias`, { artigo: '6.1', motivo: 'ação sem anúncio ' + i, prova: PROVA });
    assert.strictEqual(r.j.consequencia, 'desoficializada', JSON.stringify(r.j));
    assert.strictEqual((await pool.query(`SELECT is_active FROM corporations WHERE id = $1`, [B.id])).rows[0].is_active, false);
    const log = (await pool.query(`SELECT acao FROM faccao_log WHERE corporation_id = $1 ORDER BY id DESC LIMIT 1`, [B.id])).rows[0];
    assert.strictEqual(log.acao, 'desoficializada');
  });

  console.log('\nOFICIALIZAÇÃO E ALTO COMANDO');
  await caso('pedido aprovado cria a facção no Nível 1 com o líder dentro; recusa exige motivo', async () => {
    const p = await pedir(S.membro, 'POST', '/api/faccao/pedido', { nome: 'FXT Gama', sigla: 'GMA', cor: '#22AA55', sublider: 'fulano', membros: 'a, b, c' });
    assert.strictEqual(p.s, 200, JSON.stringify(p.j));
    assert.strictEqual((await pedir(S.org, 'POST', `/api/admin/faccoes/pedidos/${p.j.id}`, { aprovar: false })).s, 400);
    const r = await pedir(S.org, 'POST', `/api/admin/faccoes/pedidos/${p.j.id}`, { aprovar: true });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j));
    await pool.query(`UPDATE corporations SET slug = 'fxt-gama' WHERE id = $1`, [r.j.corporation_id]);
    assert.strictEqual(Number((await pool.query(`SELECT nivel FROM faccao_info WHERE corporation_id = $1`, [r.j.corporation_id])).rows[0].nivel), 1);
    assert.ok((await pool.query(`SELECT 1 FROM members WHERE corporation_id = $1 AND user_id = $2`, [r.j.corporation_id, membro])).rows[0]);
  });
  await caso('alto comando não entra em facção (Art. 1.10): 403 ao adicionar e ao pedir', async () => {
    const r = await pedir(S.lider, 'POST', `/api/corps/${A.id}/members`, { user_id: alto, rank_id: A.r[2] });
    assert.strictEqual(r.s, 403, JSON.stringify(r.j));
    assert.strictEqual((await pedir(await sessao(alto, 1), 'POST', '/api/faccao/pedido', { nome: 'FXT Delta', sigla: 'DLT', cor: '#112233' })).s, 403);
  });
  await caso('a aba Facções lista quem do alto comando está dentro de facção', async () => {
    await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3)`, [A.id, alto, A.r[2]]);
    const d = (await pedir(S.org, 'GET', '/api/admin/faccoes')).j;
    assert.ok(d.faccoes.find(f => f.id === A.id).alto_comando_dentro.includes('davi'));
    await pool.query(`DELETE FROM members WHERE corporation_id = $1 AND user_id = $2`, [A.id, alto]);
  });

  console.log('\nFICHA E ISOLAMENTO');
  await caso('a Ficha da Polícia Civil (dossiê) não devolve a facção', async () => {
    await pool.query(`INSERT INTO game_patrimonio (roblox_id, nome) VALUES (6602, 'fxt_membro') ON CONFLICT (roblox_id) DO NOTHING`);
    const r = await jogo('GET', '/dossie/fxt_membro');
    assert.ok(r.j && r.j.ok, JSON.stringify(r.j));
    const txt = JSON.stringify(r.j);
    assert.ok(!/faccao|FXT Alfa|fxt-alfa/i.test(txt), txt.slice(0, 300));
  });
  await caso('2ª cidade não vê nem mexe nas facções do Santa Fé', async () => {
    const dono = (await pool.query(`SELECT id FROM users WHERE discord_id = '111'`)).rows[0].id;
    let c2 = (await pool.query(`SELECT id FROM cidades WHERE slug = 'teste-sal2'`)).rows[0];
    if (!c2) c2 = (await pool.query(`INSERT INTO cidades (slug, nome, sigla, tipo, status, loja_prefixo, dono_user_id) VALUES ('teste-sal2','Sal2','SL2','comunidade','ativa','SL2',$1) RETURNING id`, [dono])).rows[0];
    const c = await sessao(dono, c2.id);
    const l = (await pedir(c, 'GET', '/api/admin/faccoes')).j;
    assert.ok(!l.faccoes.some(f => String(f.slug).startsWith('fxt-')));
    assert.strictEqual((await pedir(c, 'GET', `/api/faccao/${A.id}/painel`)).s, 404);
    assert.strictEqual((await pedir(c, 'POST', `/api/admin/faccoes/${A.id}/advertencias`, { artigo: '5.3', motivo: 'teste isolamento', prova: PROVA })).s, 404);
  });

  console.log(`\n${ok} ok, ${falhou} falharam`);
  await pool.end();
  process.exit(falhou ? 1 : 0);
})();
