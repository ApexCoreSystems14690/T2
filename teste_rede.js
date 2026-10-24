// [24/10] Tela REDE: trocar o Dono de cada cidade.
// [stated] Julio: "Acho perfeito, desde que somente eu possa fazer isso".
// Prova que SÓ a conta da plataforma entra (403 pra todo o resto, inclusive o
// dono de uma cidade e um homônimo do nome do Julio), que a troca vale na hora
// e fica no histórico, e que o boot não desfaz a troca.
// Rodar com o site no ar: TZ=UTC DATABASE_URL=... node teste_rede.js
const B = 'http://localhost:4600';
const { Pool } = require('pg');
const sig = require('cookie-signature');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let ok = 0, falhou = 0;
function t(nome, cond, extra) { if (cond) { ok++; console.log('  ok  ' + nome); } else { falhou++; console.log('  FALHOU  ' + nome, extra || ''); } }
async function sessao(uid, cidadeId) {
  const sid = 'rd' + uid + 'c' + cidadeId + Math.random().toString(36).slice(2);
  const sess = { cookie: { originalMaxAge: 864e5, httpOnly: true, path: '/' }, userId: uid };
  if (cidadeId) sess.cidadeId = cidadeId;
  await pool.query(`INSERT INTO session (sid, sess, expire) VALUES ($1,$2,NOW()+interval '1 day')`, [sid, sess]);
  return 'connect.sid=' + encodeURIComponent('s:' + sig.sign(sid, 'dev-secret-apenas-local'));
}
async function site(c, m, p, body, html) {
  const h = { accept: html ? 'text/html' : 'application/json', 'Content-Type': 'application/json' };
  if (c) h.cookie = c;
  const r = await fetch(B + p, { method: m, redirect: 'manual', headers: h, body: body ? JSON.stringify(body) : undefined });
  let j = null, txt = '';
  try { txt = await r.text(); j = JSON.parse(txt); } catch (e) {}
  return { s: r.status, j, txt, loc: r.headers.get('location') };
}
async function usuario(nome, did) {
  return (await pool.query(`INSERT INTO users (discord_id, discord_username) VALUES ($1, $2)
     ON CONFLICT (discord_id) DO UPDATE SET discord_username = EXCLUDED.discord_username RETURNING id`, [did, nome])).rows[0].id;
}

(async () => {
  const TST = (await pool.query(`SELECT id, dono_user_id FROM cidades WHERE slug = 'testes'`)).rows[0];
  const donoAntes = TST.dono_user_id;
  const histAntes = (await pool.query(`SELECT COALESCE(MAX(id),0) m FROM cidade_donos_hist`)).rows[0].m;
  const JULIO = (await pool.query(`SELECT id FROM users WHERE discord_id = '111'`)).rows[0].id;   // dono da plataforma no banco local
  const sfx = Date.now().toString(36);
  const COMUM = await usuario('rede_comum_' + sfx, 'rd-comum-' + sfx);
  const NOVO = await usuario('rede_novodono_' + sfx, 'rd-novo-' + sfx);
  const HOMONIMO = (await pool.query(`SELECT id FROM users WHERE lower(discord_username) = 'julio14690' AND discord_id <> '111' LIMIT 1`)).rows[0];
  const DIRETOR = await usuario('rede_diretor_' + sfx, 'rd-dir-' + sfx);
  await pool.query(`INSERT INTO cidade_staff (cidade_id, user_id, cargo) VALUES (1, $1, 'diretor') ON CONFLICT DO NOTHING`, [DIRETOR]);

  const cJ = await sessao(JULIO, 1), cJt = await sessao(JULIO, TST.id), cJsem = await sessao(JULIO, null);
  const cC = await sessao(COMUM, 1), cD = await sessao(DIRETOR, 1);
  const cNt = await sessao(NOVO, TST.id), cNsf = await sessao(NOVO, 1);
  const cH = HOMONIMO ? await sessao(HOMONIMO.id, 1) : null;

  const rotas = [['GET', '/api/rede/cidades'], ['GET', '/api/rede/usuarios?q=rede'], ['PUT', `/api/rede/cidades/${TST.id}/dono`, { user_id: COMUM }], ['GET', `/api/rede/cidades/${TST.id}/historico`]];

  console.log('\nPORTÃO (só a conta da plataforma)');
  let tudo401 = true; for (const [m, p, b] of rotas) if ((await site(null, m, p, b)).s !== 401) tudo401 = false;
  t('sem login: as 4 rotas da API = 401', tudo401);
  const pg0 = await site(null, 'GET', '/rede', null, true);
  t('sem login: a página manda pro login do Discord', pg0.s === 302 && /auth\/discord/.test(pg0.loc || ''), pg0.s + ' ' + pg0.loc);
  for (const [quem, c] of [['jogador comum', cC], ['Diretor Geral da staff do Santa Fé', cD], ['homônimo "julio14690" com outro Discord', cH]]) {
    if (!c) { t(quem + ' (sem conta homônima no banco local, pulado)', true); continue; }
    let todos = true; for (const [m, p, b] of rotas) { const r = await site(c, m, p, b); if (r.s !== 403) { todos = false; console.log('    ', m, p, r.s); } }
    t(quem + ': as 4 rotas = 403', todos);
    t(quem + ': a página /rede = 403', (await site(c, 'GET', '/rede', null, true)).s === 403);
  }
  t('a troca do jogador comum não gravou nada', (await pool.query(`SELECT dono_user_id FROM cidades WHERE id = $1`, [TST.id])).rows[0].dono_user_id === donoAntes);

  console.log('\nTELA CIDADES');
  t('o atalho "Rede" aparece pra você', (await site(cJsem, 'GET', '/', null, true)).txt.includes('href="/rede"'));
  t('...e não aparece pro jogador comum', !(await site(cC, 'GET', '/', null, true)).txt.includes('href="/rede"'));

  console.log('\nLISTA E BUSCA');
  const l = await site(cJ, 'GET', '/api/rede/cidades');
  const sf = (l.j.cidades || []).find(c => c.slug === 'santa-fe'), tt = (l.j.cidades || []).find(c => c.slug === 'testes');
  t('lista todas as cidades; na oficial o Dono é a conta da plataforma', l.s === 200 && sf && sf.oficial && sf.dono.plataforma && tt && !tt.oficial, JSON.stringify(l.j).slice(0, 300));
  t('abre a página /rede de qualquer cidade (ou sem cidade)', (await site(cJt, 'GET', '/rede', null, true)).s === 200 && (await site(cJsem, 'GET', '/rede', null, true)).s === 200);
  const bu = await site(cJ, 'GET', '/api/rede/usuarios?q=' + encodeURIComponent('novodono_' + sfx));
  t('a busca acha a conta pelo nome do Discord', bu.s === 200 && bu.j.usuarios.length === 1 && bu.j.usuarios[0].id === NOVO, JSON.stringify(bu.j));
  const bp = await site(cJ, 'GET', '/api/rede/usuarios?q=' + encodeURIComponent('%%'));
  t('"%" na busca não vira curinga (não lista todo mundo)', bp.s === 200 && bp.j.usuarios.length === 0, JSON.stringify(bp.j).slice(0, 200));

  console.log('\nTROCAR O DONO');
  t('na cidade oficial não troca (400)', (await site(cJ, 'PUT', '/api/rede/cidades/1/dono', { user_id: NOVO })).s === 400);
  t('cidade que não existe = 404', (await site(cJ, 'PUT', '/api/rede/cidades/999999/dono', { user_id: NOVO })).s === 404);
  t('usuário que não existe = 404', (await site(cJ, 'PUT', `/api/rede/cidades/${TST.id}/dono`, { user_id: 99999999 })).s === 404);
  t('id torto = 400', (await site(cJ, 'PUT', `/api/rede/cidades/${TST.id}/dono`, { user_id: 'abc' })).s === 400);
  t('antes da troca, o futuro dono NÃO é Dono na cidade de teste (economia = 403)', (await site(cNt, 'GET', '/api/admin/economia')).s === 403);
  const tr = await site(cJ, 'PUT', `/api/rede/cidades/${TST.id}/dono`, { user_id: NOVO, motivo: 'pagou a taxa (teste)' });
  t('você troca o Dono da cidade de teste', tr.s === 200, JSON.stringify(tr.j));
  t('no banco a cidade passou a ter o novo dono', (await pool.query(`SELECT dono_user_id FROM cidades WHERE id = $1`, [TST.id])).rows[0].dono_user_id === NOVO);
  t('na hora: o novo dono abre a economia (só Dono) da cidade dele', (await site(cNt, 'GET', '/api/admin/economia')).s === 200);
  // [24/10] bug do print do Julio: Dono sem linha de staff via "Painel admin" trancado e /admin 403
  const home = await site(cNt, 'GET', '/painel', null, true);
  t('...a home dele mostra o Painel admin destrancado', home.s === 200 && home.txt.includes('href="/admin"'), home.s);
  t('...e a página /admin abre (200)', (await site(cNt, 'GET', '/admin', null, true)).s === 200);
  const dg = await site(cNt, 'POST', `/api/admin/users/${COMUM}/cargo`, { cargo: 'diretor' });
  t('...e ele dá Diretor Geral pra alguém na staff da cidade dele', dg.s === 200 && (await pool.query(`SELECT cargo FROM cidade_staff WHERE cidade_id = $1 AND user_id = $2`, [TST.id, COMUM])).rows[0]?.cargo === 'diretor', JSON.stringify(dg.j));
  t('...e esse cargo não vale no Santa Fé', !(await pool.query(`SELECT 1 FROM cidade_staff WHERE cidade_id = 1 AND user_id = $1`, [COMUM])).rows.length);
  await pool.query(`DELETE FROM cidade_staff WHERE user_id = $1`, [COMUM]);
  t('...e no Santa Fé o Painel admin continua trancado pra ele', !(await site(cNsf, 'GET', '/painel', null, true)).txt.includes('href="/admin"'));
  t('...e no Santa Fé ele continua sem nada (403)', (await site(cNsf, 'GET', '/api/admin/economia')).s === 403);
  t('...e mesmo sendo dono de cidade, NÃO entra na tela Rede (403)', (await site(cNt, 'PUT', `/api/rede/cidades/${TST.id}/dono`, { user_id: COMUM })).s === 403 && (await site(cNt, 'GET', '/api/rede/cidades')).s === 403);
  t('trocar pra mesma pessoa de novo = 409', (await site(cJ, 'PUT', `/api/rede/cidades/${TST.id}/dono`, { user_id: NOVO })).s === 409);
  const h = await site(cJ, 'GET', `/api/rede/cidades/${TST.id}/historico`);
  const ult = (h.j.historico || [])[0];
  t('o histórico registra quem trocou, pra quem e o motivo', ult && ult.para_nome === 'rede_novodono_' + sfx && ult.por_nome === 'julio14690' && ult.motivo === 'pagou a taxa (teste)', JSON.stringify(ult));

  console.log('\nTIRAR O DONO E O BOOT');
  t('deixar sem dono', (await site(cJ, 'PUT', `/api/rede/cidades/${TST.id}/dono`, { user_id: null })).s === 200);
  t('...o ex-dono perde o painel de Dono na hora', (await site(cNt, 'GET', '/api/admin/economia')).s === 403);
  await require('./src/cidades').montarTodas(pool);
  t('o boot NÃO devolve o dono antigo depois que você mexeu', (await pool.query(`SELECT dono_user_id FROM cidades WHERE id = $1`, [TST.id])).rows[0].dono_user_id === null);

  // limpeza: volta como estava
  await pool.query(`UPDATE cidades SET dono_user_id = $2 WHERE id = $1`, [TST.id, donoAntes]);
  await pool.query(`DELETE FROM cidade_donos_hist WHERE id > $1`, [histAntes]);
  await pool.query(`DELETE FROM cidade_staff WHERE user_id = $1`, [DIRETOR]);
  await pool.query(`DELETE FROM session WHERE sid LIKE 'rd%'`);
  await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [[COMUM, NOVO, DIRETOR]]);

  console.log(`\n== ${ok} ok, ${falhou} falharam`);
  await pool.end();
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
