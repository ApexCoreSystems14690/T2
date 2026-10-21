// Teste das CIDADES (21/10): isolamento entre duas cidades no site rodando.
// Sobe contra um site de pé (BASE) e um Postgres de teste (DATABASE_URL).
// Cria uma 2ª cidade SÓ NO BANCO DE TESTE (o site não tem caminho pra criar)
// e confere que staff, corps e painéis de uma não aparecem na outra.
// Rodar: DATABASE_URL=... BASE=http://localhost:4600 SESSION_SECRET=... node teste_cidades.js
const assert = require('assert');
const { Pool } = require('pg');
const sig = require('cookie-signature');
const CID = require('./src/cidades');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.BASE || 'http://localhost:4600';
const SEGREDO = process.env.SESSION_SECRET || 'dev-secret-apenas-local';
let ok = 0, falhou = 0;
async function caso(nome, fn) {
  try { await fn(); ok++; console.log('  ok  ' + nome); }
  catch (e) { falhou++; console.log('  FALHOU  ' + nome + '\n        ' + e.message); }
}

async function sessao(userId, cidadeId) {
  const sid = 'tc' + userId + 'c' + (cidadeId || 0) + 'x' + Math.random().toString(36).slice(2);
  const sess = { cookie: { originalMaxAge: 864e5, expires: new Date(Date.now() + 864e5).toISOString(), httpOnly: true, path: '/' }, userId };
  if (cidadeId) sess.cidadeId = cidadeId;
  await pool.query(`INSERT INTO session (sid, sess, expire) VALUES ($1, $2, NOW() + interval '1 day')`, [sid, sess]);
  return 'connect.sid=s%3A' + encodeURIComponent(sig.sign(sid, SEGREDO));
}
async function pedir(cookie, metodo, path, body, extra) {
  const r = await fetch(BASE + path, {
    method: metodo, redirect: 'manual',
    headers: Object.assign({ cookie, 'Content-Type': 'application/json', accept: 'application/json' }, extra || {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null, t = '';
  try { t = await r.text(); j = JSON.parse(t); } catch (_) {}
  return { status: r.status, j, t, loc: r.headers.get('location') };
}

(async () => {
  // --- cenário ---
  await pool.query(`DELETE FROM members WHERE user_id IN (SELECT id FROM users WHERE discord_id LIKE 'tc_%')`);
  await pool.query(`DELETE FROM corporations WHERE slug LIKE 'tc-%'`);
  await pool.query(`DELETE FROM cidade_staff WHERE user_id IN (SELECT id FROM users WHERE discord_id LIKE 'tc_%')`);
  await pool.query(`DELETE FROM users WHERE discord_id LIKE 'tc_%'`);
  await pool.query(`DELETE FROM cidades WHERE slug = 'teste-norte'`);
  const u = async (did, nome) => (await pool.query(
    `INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username) VALUES ($1,$2,$3,$2) RETURNING id`,
    [did, nome, 8000 + Number(did.replace(/\D/g, ''))])).rows[0].id;
  const ana = await u('tc_1', 'ana_tc');      // Diretor no Santa Fé, nada na Norte
  const beto = await u('tc_2', 'beto_tc');    // DONO da cidade Norte, nada no Santa Fé
  const caio = await u('tc_3', 'caio_tc');    // membro de corp nas duas
  const norte = (await pool.query(
    `INSERT INTO cidades (slug, nome, sigla, tipo, status, loja_prefixo, dono_user_id) VALUES ('teste-norte','Norte','NRT','comunidade','ativa','NRT',$1) RETURNING *`, [beto])).rows[0];
  CID.limparCache();
  await new Promise(r => setTimeout(r, 5500));   // o site guarda a lista de cidades por 5 s
  await pool.query(`INSERT INTO cidade_staff (cidade_id, user_id, cargo) VALUES (1, $1, 'diretor')`, [ana]);
  const corp = async (slug, nome, cid) => {
    const id = (await pool.query(`INSERT INTO corporations (name, slug, tipo, cidade_id) VALUES ($1,$2,'corp',$3) RETURNING id`, [nome, slug, cid])).rows[0].id;
    const rk = (await pool.query(`INSERT INTO ranks (corporation_id, name, level) VALUES ($1,'Soldado',1) RETURNING id`, [id])).rows[0].id;
    return { id, rk };
  };
  const pmSF = await corp('tc-pm-sf', 'PM Santa Fé TC', 1);
  const pmN = await corp('tc-pm-norte', 'PM Norte TC', norte.id);
  await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3),($4,$2,$5)`, [pmSF.id, caio, pmSF.rk, pmN.id, pmN.rk]);

  console.log('\nENTRADA');
  await caso('sem cidade escolhida: /admin manda pra tela Cidades', async () => {
    const c = await sessao(ana, null);
    const r = await pedir(c, 'GET', '/admin', null, { accept: 'text/html' });
    assert.strictEqual(r.status, 302); assert.ok(r.loc.startsWith('/?voltar='), r.loc);
  });
  await caso('sem cidade escolhida: API toma 409', async () => {
    const c = await sessao(ana, null);
    const r = await pedir(c, 'GET', '/api/admin/eu');
    assert.strictEqual(r.status, 409);
  });
  await caso('tela Cidades mostra as duas e o cargo de cada uma', async () => {
    const c = await sessao(ana, null);
    const r = await pedir(c, 'GET', '/', null, { accept: 'text/html' });
    assert.strictEqual(r.status, 200);
    assert.ok(r.t.includes('Santa Fé') && r.t.includes('Norte'));
    assert.ok(r.t.includes('Você: Diretor Geral'));
  });
  await caso('escolher a cidade grava na sessão e vai pro painel', async () => {
    const c = await sessao(ana, null);
    const r = await pedir(c, 'GET', '/cidade/santa-fe', null, { accept: 'text/html' });
    assert.strictEqual(r.status, 302); assert.strictEqual(r.loc, '/painel');
    const s = await pool.query(`SELECT sess FROM session WHERE sid = $1`, [decodeURIComponent(c.split('=')[1]).slice(2).split('.')[0]]);
    assert.strictEqual(s.rows[0].sess.cidadeId, 1);
  });
  await caso('voltar= só aceita caminho interno', () => {
    assert.strictEqual(CID.voltarSeguro('/admin'), '/admin');
    assert.strictEqual(CID.voltarSeguro('//mal.com'), null);
    assert.strictEqual(CID.voltarSeguro('https://mal.com'), null);
    assert.strictEqual(CID.voltarSeguro('/\\mal.com'), null);
  });

  console.log('\nSTAFF POR CIDADE');
  await caso('Ana é Diretor no Santa Fé', async () => {
    const r = await pedir(await sessao(ana, 1), 'GET', '/api/admin/eu');
    assert.strictEqual(r.status, 200); assert.strictEqual(r.j.cargo, 'diretor');
  });
  await caso('Ana NÃO é staff na Norte (403 no painel)', async () => {
    const r = await pedir(await sessao(ana, norte.id), 'GET', '/api/admin/eu');
    assert.strictEqual(r.status, 403);
  });
  await caso('Beto é DONO da Norte', async () => {
    const r = await pedir(await sessao(beto, norte.id), 'GET', '/api/admin/eu');
    assert.strictEqual(r.status, 200); assert.strictEqual(r.j.cargo, 'dono'); assert.strictEqual(r.j.souDono, true);
  });
  await caso('Beto NÃO é nada no Santa Fé', async () => {
    const r = await pedir(await sessao(beto, 1), 'GET', '/api/admin/eu');
    assert.strictEqual(r.status, 403);
  });
  await caso('Beto dá Moderador pra Ana na Norte: vale SÓ na Norte', async () => {
    const r = await pedir(await sessao(beto, norte.id), 'POST', '/api/admin/users/' + ana + '/cargo', { cargo: 'moderador' });
    assert.strictEqual(r.status, 200, r.t);
    assert.strictEqual((await pedir(await sessao(ana, norte.id), 'GET', '/api/admin/eu')).j.cargo, 'moderador');
    assert.strictEqual((await pedir(await sessao(ana, 1), 'GET', '/api/admin/eu')).j.cargo, 'diretor');
  });
  await caso('lista de usuários do painel mostra o cargo DESTA cidade', async () => {
    const r = await pedir(await sessao(beto, norte.id), 'GET', '/api/admin/users');
    const a = r.j.users.find(x => x.id === ana);
    assert.strictEqual(a.cargo, 'moderador');
  });
  await caso('Ana (Diretor do Santa Fé) não mexe no staff da Norte', async () => {
    const r = await pedir(await sessao(ana, norte.id), 'POST', '/api/admin/users/' + beto + '/cargo', { cargo: 'moderador' });
    assert.strictEqual(r.status, 403);
  });

  await caso('dev da rede (conta da plataforma) é Dono no Santa Fé Oficial', async () => {
    const jl = (await pool.query(`SELECT id FROM users WHERE lower(discord_username) = 'julio14690'`)).rows[0];
    assert.ok(jl, 'precisa da conta julio14690 no banco de teste');
    const r = await pedir(await sessao(jl.id, 1), 'GET', '/api/admin/eu');
    assert.strictEqual(r.status, 200); assert.strictEqual(r.j.cargo, 'dono');
  });
  await caso('dev da rede NÃO é staff de RP na cidade dos outros (403)', async () => {
    const jl = (await pool.query(`SELECT id FROM users WHERE lower(discord_username) = 'julio14690'`)).rows[0];
    const r = await pedir(await sessao(jl.id, norte.id), 'GET', '/api/admin/eu');
    assert.strictEqual(r.status, 403, r.t);
  });
  await caso('tela Cidades não mostra "Você: Dono" pro dev na cidade dos outros', async () => {
    const jl = (await pool.query(`SELECT id FROM users WHERE lower(discord_username) = 'julio14690'`)).rows[0];
    const r = await pedir(await sessao(jl.id, null), 'GET', '/', null, { accept: 'text/html' });
    const pedacoNorte = r.t.slice(r.t.indexOf('>Norte<') - 900, r.t.indexOf('>Norte<'));
    assert.ok(!pedacoNorte.includes('Você: Dono'), 'apareceu Dono na Norte');
    assert.ok(r.t.includes('Você: Dono'), 'Dono no Santa Fé sumiu');
  });

  console.log('\nCORPORAÇÕES');
  await caso('Caio no Santa Fé só vê a PM do Santa Fé', async () => {
    const r = await pedir(await sessao(caio, 1), 'GET', '/dashboard', null, { accept: 'text/html' });
    assert.strictEqual(r.status, 200);
    assert.ok(r.t.includes('PM Santa Fé TC')); assert.ok(!r.t.includes('PM Norte TC'));
  });
  await caso('Caio na Norte só vê a PM da Norte', async () => {
    const r = await pedir(await sessao(caio, norte.id), 'GET', '/dashboard', null, { accept: 'text/html' });
    assert.ok(r.t.includes('PM Norte TC')); assert.ok(!r.t.includes('PM Santa Fé TC'));
  });
  await caso('Diretor do Santa Fé não abre corp da Norte pelo id (volta pro dashboard)', async () => {
    const r = await pedir(await sessao(ana, 1), 'GET', '/dashboard/corp/' + pmN.id, null, { accept: 'text/html' });
    assert.strictEqual(r.status, 302); assert.strictEqual(r.loc, '/dashboard');
  });
  await caso('API de corp de outra cidade = 404', async () => {
    const r = await pedir(await sessao(ana, 1), 'GET', '/api/corps/' + pmN.id);
    assert.strictEqual(r.status, 404, r.t);
  });
  await caso('staff dando cargo em corp de outra cidade = 404', async () => {
    const r = await pedir(await sessao(ana, 1), 'POST', '/api/admin/cargo', { user_id: caio, corp_id: pmN.id, rank_id: pmN.rk });
    assert.strictEqual(r.status, 404, r.t);
  });
  await caso('lista de corps do painel admin é só da cidade', async () => {
    const r = await pedir(await sessao(ana, 1), 'GET', '/api/admin/corps');
    assert.ok(r.j.corps.some(c => c.id === pmSF.id)); assert.ok(!r.j.corps.some(c => c.id === pmN.id));
  });
  await caso('corp criada nasce na cidade da sessão', async () => {
    const r = await pedir(await sessao(beto, norte.id), 'POST', '/api/corps', { name: 'TC Bombeiros', slug: 'tc-bombeiros' });
    assert.strictEqual(r.status, 200, r.t);
    assert.strictEqual(r.j.corporation.cidade_id, norte.id);
  });

  console.log('\nTRAVA DE ABA');
  await caso('página aberta no Santa Fé, sessão já na Norte: 409', async () => {
    const r = await pedir(await sessao(beto, norte.id), 'GET', '/api/admin/eu', null, { 'X-Cidade-Pagina': '1' });
    assert.strictEqual(r.status, 409); assert.strictEqual(r.j.cidade_trocada, true);
  });
  await caso('mesma cidade: passa', async () => {
    const r = await pedir(await sessao(beto, norte.id), 'GET', '/api/admin/eu', null, { 'X-Cidade-Pagina': String(norte.id) });
    assert.strictEqual(r.status, 200);
  });

  console.log('\nJOGO');
  await caso('jogo sem header = Santa Fé; staff do SSU é o do Santa Fé', async () => {
    const r = await fetch(BASE + '/api/game/ssu', { headers: { 'x-api-key': process.env.ROBLOX_API_KEY || 'k123' } });
    const j = await r.json();
    assert.ok(j.staff.includes(8001), JSON.stringify(j.staff));      // Ana (diretor no SF)
    assert.ok(!j.staff.includes(8002));                               // Beto não é staff no SF
  });
  await caso('jogo com x-cidade de cidade que não existe = 400', async () => {
    const r = await fetch(BASE + '/api/game/ssu', { headers: { 'x-api-key': process.env.ROBLOX_API_KEY || 'k123', 'x-cidade': 'nao-existe' } });
    assert.strictEqual(r.status, 400);
  });
  await caso('loja do Roblox por cidade', () => {
    assert.strictEqual(CID.nomeDaLoja({ id: 1 }, 1), 'CBRP_V1.2');
    assert.strictEqual(CID.nomeDaLoja({ id: 1 }, 3), 'CBRP_V1.2_T3');
    assert.strictEqual(CID.nomeDaLoja({ id: 7, loja_prefixo: 'NRT' }, 1), 'NRT_V1_T1');
  });

  // limpa a cidade de teste
  await pool.query(`DELETE FROM members WHERE user_id IN (SELECT id FROM users WHERE discord_id LIKE 'tc_%')`);
  await pool.query(`DELETE FROM corporations WHERE slug LIKE 'tc-%'`);
  await pool.query(`DELETE FROM cidades WHERE slug = 'teste-norte'`);
  await pool.end();
  console.log(`\n${ok} ok, ${falhou} falharam`);
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
