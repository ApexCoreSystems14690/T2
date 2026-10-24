// [22/10] Regulamentos por cidade: página pública, editor só do Dono, isolamento entre cidades.
// Rodar com o site no ar: DATABASE_URL=... BASE=http://localhost:4600 node teste_regras.js
const assert = require('assert');
const { Pool } = require('pg');
const sig = require('cookie-signature');
const RG = require('./src/regulamentos');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.BASE || 'http://localhost:4600';
const SEGREDO = process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32 ? process.env.SESSION_SECRET : 'dev-secret-apenas-local';
let ok = 0, falhou = 0;
async function caso(nome, fn) {
  try { await fn(); ok++; console.log('  ok  ' + nome); }
  catch (e) { falhou++; console.log('  FALHOU  ' + nome + '\n        ' + e.message); }
}
async function sessao(userId, cidadeId) {
  const sid = 'tr' + userId + 'c' + (cidadeId || 0) + 'x' + Math.random().toString(36).slice(2);
  const sess = { cookie: { originalMaxAge: 864e5, expires: new Date(Date.now() + 864e5).toISOString(), httpOnly: true, path: '/' }, userId };
  if (cidadeId) sess.cidadeId = cidadeId;
  await pool.query(`INSERT INTO session (sid, sess, expire) VALUES ($1, $2, NOW() + interval '1 day')`, [sid, sess]);
  return 'connect.sid=s%3A' + encodeURIComponent(sig.sign(sid, SEGREDO));
}
async function pedir(cookie, metodo, path, body, tipo) {
  const o = { method: metodo, headers: { cookie: cookie || '', accept: 'application/json' }, redirect: 'manual' };
  if (body !== undefined) { o.headers['Content-Type'] = tipo || 'application/json'; o.body = tipo ? body : JSON.stringify(body); }
  const r = await fetch(BASE + path, o);
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { s: r.status, j, t };
}

(async () => {
  // donos e cidades de teste
  const dono = (await pool.query(`SELECT id FROM users WHERE discord_id = '111'`)).rows[0].id;
  await pool.query(`DELETE FROM users WHERE discord_id IN ('tr_norte','tr_civil')`);
  const donoNorte = (await pool.query(`INSERT INTO users (discord_id, discord_username) VALUES ('tr_norte','donoNorte') RETURNING id`)).rows[0].id;
  const civil = (await pool.query(`INSERT INTO users (discord_id, discord_username) VALUES ('tr_civil','civil') RETURNING id`)).rows[0].id;
  await pool.query(`DELETE FROM admin_audit WHERE cidade_id IN (SELECT id FROM cidades WHERE slug = 'tr-norte')`);
  await pool.query(`DELETE FROM cidade_regulamentos WHERE cidade_id IN (SELECT id FROM cidades WHERE slug = 'tr-norte')`);
  await require('./src/cidades').apagarCidadeDeTeste(pool, 'tr-norte');
  const norte = (await pool.query(`INSERT INTO cidades (slug, nome, sigla, tipo, status, dono_user_id, loja_prefixo) VALUES ('tr-norte','Cidade Norte','NRT','comunidade','ativa',$1,'TRN') RETURNING id`, [donoNorte])).rows[0].id;
  require('./src/cidades').limparCache && require('./src/cidades').limparCache();

  console.log('\nPÁGINA PÚBLICA');
  await caso('Santa Fé tem os 2 documentos e o Oficial tem os 207 artigos (v2.4)', async () => {
    const r = await pedir('', 'GET', '/cidade/santa-fe/regras/oficial');
    assert.strictEqual(r.s, 200);
    assert.strictEqual((r.t.match(/class="rg-art"/g) || []).length, 207);
    assert.ok(r.t.includes('id="art-2-5"') && r.t.includes('id="cap-14"'));
    const f = await pedir('', 'GET', '/cidade/santa-fe/regras/faccoes');
    assert.ok(f.t.includes('Aprovado na votação de 22/10/2026') && !f.t.includes('Rascunho: entra em vigor'));
    assert.ok(f.t.includes('href="/cidade/santa-fe/regras/oficial#art-7-3"'), 'citação do Oficial não virou link');
  });
  await caso('sem login abre, e NÃO muda a cidade da sessão', async () => {
    const c = await sessao(civil, norte);
    await pedir(c, 'GET', '/cidade/santa-fe/regras/oficial');
    const sid = decodeURIComponent(c.split('=')[1]).slice(2).split('.')[0];
    const s = await pool.query('SELECT sess FROM session WHERE sid = $1', [sid]);
    assert.strictEqual(s.rows[0].sess.cidadeId, norte);
  });
  await caso('cidade sem regulamento: lista vazia, documento de outra cidade não aparece', async () => {
    const r = await pedir('', 'GET', '/cidade/tr-norte/regras');
    assert.strictEqual(r.s, 200);
    assert.ok(r.t.includes('ainda não publicou'));
    assert.strictEqual((await pedir('', 'GET', '/cidade/tr-norte/regras/oficial')).s, 404);
    assert.strictEqual((await pedir('', 'GET', '/cidade/tr-norte/regras/oficial/pdf')).s, 404);
  });
  await caso('HTML do texto é escapado (sem injeção)', async () => {
    const r = RG.renderizar('**Art. 1.1** — <script>alert(1)</script> "x" & <b>');
    assert.ok(!r.html.includes('<script>') && r.html.includes('&lt;script&gt;'));
  });

  console.log('\nEDITOR');
  await caso('sem login: 401; civil: 403; staff comum não edita', async () => {
    assert.strictEqual((await pedir('', 'GET', '/api/regras')).s, 401);
    assert.strictEqual((await pedir(await sessao(civil, 1), 'GET', '/api/regras')).s, 403);
    assert.strictEqual((await pedir(await sessao(civil, 1), 'PUT', '/api/regras/oficial', { titulo: 'hack' })).s, 403);
  });
  await caso('Dono da Norte cria o regulamento DELE; aparece só na Norte', async () => {
    const c = await sessao(donoNorte, norte);
    let r = await pedir(c, 'PUT', '/api/regras/geral', { titulo: 'Regras da Norte', versao: '1', status: 'vigente', vigente_desde: '2026-10-22', meta: [{ k: 'Dono', v: 'donoNorte' }] });
    assert.strictEqual(r.s, 200, r.t);
    r = await pedir(c, 'PUT', '/api/regras/geral/texto', '## Capítulo 1 · Geral\n\n**Art. 1.1** [NOVO] — Respeite o Art. 1.1.', 'text/plain');
    assert.strictEqual(r.s, 200, r.t); assert.strictEqual(r.j.artigos, 1);
    const pub = await pedir('', 'GET', '/cidade/tr-norte/regras/geral');
    assert.strictEqual(pub.s, 200); assert.ok(pub.t.includes('Regras da Norte') && pub.t.includes('rg-tag rg-novo'));
    assert.strictEqual((await pedir('', 'GET', '/cidade/santa-fe/regras/geral')).s, 404);
  });
  await caso('Dono da Norte NÃO enxerga nem mexe no regulamento do Santa Fé', async () => {
    const c = await sessao(donoNorte, norte);
    const lista = await pedir(c, 'GET', '/api/regras');
    assert.deepStrictEqual(lista.j.docs.map(d => d.slug), ['geral']);
    assert.strictEqual((await pedir(c, 'GET', '/api/regras/oficial')).s, 404);
    // "editar oficial" na sessão da Norte cria um doc NA NORTE, nunca toca o do Santa Fé
    const antes = (await pool.query(`SELECT titulo, conteudo FROM cidade_regulamentos WHERE cidade_id = 1 AND slug = 'oficial'`)).rows[0];
    await pedir(c, 'PUT', '/api/regras/oficial', { titulo: 'Tomei' });
    const depois = (await pool.query(`SELECT titulo, conteudo FROM cidade_regulamentos WHERE cidade_id = 1 AND slug = 'oficial'`)).rows[0];
    assert.deepStrictEqual(depois, antes);
    await pool.query(`DELETE FROM cidade_regulamentos WHERE cidade_id = $1 AND slug = 'oficial'`, [norte]);
  });
  await caso('Dono do Santa Fé (conta da plataforma) não é Dono na Norte', async () => {
    assert.strictEqual((await pedir(await sessao(dono, norte), 'GET', '/api/regras')).s, 403);
  });
  await caso('Dono do Santa Fé edita, guarda a versão anterior e restaura', async () => {
    const c = await sessao(dono, 1);
    const antes = (await pedir(c, 'GET', '/api/regras/faccoes')).j;
    let r = await pedir(c, 'PUT', '/api/regras/faccoes', { versao: '3.2' });
    assert.strictEqual(r.s, 200, r.t);
    const h = (await pedir(c, 'GET', '/api/regras/faccoes/historico')).j;
    assert.ok(h.length >= 1 && h[0].versao === '3.1');
    r = await pedir(c, 'POST', '/api/regras/faccoes/restaurar/' + h[0].id);
    assert.strictEqual(r.s, 200, r.t);
    const depois = (await pedir(c, 'GET', '/api/regras/faccoes')).j;
    assert.strictEqual(depois.versao, antes.versao);
    assert.strictEqual(depois.conteudo, antes.conteudo);
  });
  await caso('PDF: aceita PDF de verdade, recusa outra coisa', async () => {
    const c = await sessao(donoNorte, norte);
    assert.strictEqual((await pedir(c, 'POST', '/api/regras/geral/pdf', 'não sou pdf', 'application/pdf')).s, 400);
    const r = await pedir(c, 'POST', '/api/regras/geral/pdf', '%PDF-1.4 teste', 'application/pdf');
    assert.strictEqual(r.s, 200, r.t);
    const p = await fetch(BASE + '/cidade/tr-norte/regras/geral/pdf');
    assert.strictEqual(p.status, 200); assert.ok((await p.text()).startsWith('%PDF'));
  });
  await caso('arquivado some da página pública', async () => {
    const c = await sessao(donoNorte, norte);
    await pedir(c, 'PUT', '/api/regras/geral', { status: 'arquivado' });
    assert.strictEqual((await pedir('', 'GET', '/cidade/tr-norte/regras/geral')).s, 404);
  });
  await caso('tela Cidades mostra a placa de regras só pra cidade que tem', async () => {
    const r = await pedir('', 'GET', '/');
    assert.ok(r.t.includes('href="/cidade/santa-fe/regras"'));
    assert.ok(!r.t.includes('href="/cidade/tr-norte/regras"'));
  });

  await pool.query(`DELETE FROM cidade_regulamentos WHERE cidade_id = $1`, [norte]);
  await pool.query(`DELETE FROM admin_audit WHERE cidade_id = $1`, [norte]);
  await require('./src/cidades').apagarCidadeDeTeste(pool, 'tr-norte');
  await pool.query(`DELETE FROM users WHERE id IN ($1,$2)`, [donoNorte, civil]);
  await pool.end();
  console.log(`\n${ok} ok, ${falhou} falharam`);
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
