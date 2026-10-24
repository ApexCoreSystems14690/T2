// [24/10] Cidade de teste = um Santa Fé INTEIRO e SEPARADO (isolamento por Row-Level Security).
// [stated] Julio: "deveria ser 100%, um santa fe inteiro, so que separado" / "literalmente TUDO
// separado" / "os saves dos jogadores e por cidade, literalmente nada passa de uma para outra".
// Rodar com o site no ar: TZ=UTC DATABASE_URL=... node teste_cidade_teste.js
const B = 'http://localhost:4600';
const { Pool } = require('pg');
const sig = require('cookie-signature');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let ok = 0, falhou = 0;
function t(nome, cond, extra) { if (cond) { ok++; console.log('  ok  ' + nome); } else { falhou++; console.log('  FALHOU  ' + nome, extra || ''); } }
async function jogo(m, p, body, cidade) {
  const h = { 'x-api-key': 'k123', 'content-type': 'application/json' };
  if (cidade) h['x-cidade'] = cidade;
  const r = await fetch(B + '/api/game' + p, { method: m, headers: h, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { s: r.status, j };
}
async function sessao(uid, cidadeId) {
  const sid = 'ct' + uid + 'c' + cidadeId + Math.random().toString(36).slice(2);
  await pool.query(`INSERT INTO session (sid, sess, expire) VALUES ($1,$2,NOW()+interval '1 day')`, [sid, { cookie: { originalMaxAge: 864e5, httpOnly: true, path: '/' }, userId: uid, cidadeId }]);
  return 'connect.sid=' + encodeURIComponent('s:' + sig.sign(sid, 'dev-secret-apenas-local'));
}
async function site(c, m, p, body) {
  const r = await fetch(B + p, { method: m, redirect: 'manual', headers: { cookie: c, accept: 'application/json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { s: r.status, j };
}

(async () => {
  const TST = (await pool.query(`SELECT id FROM cidades WHERE slug = 'testes'`)).rows[0].id;
  const RID = 970000000 + Math.floor(Math.random() * 1e6);

  console.log('\nLOBBY E SENHA');
  const l = await jogo('GET', '/cidades');
  const tst = (l.j.cidades || []).find(c => c.slug === 'testes');
  const sf = (l.j.cidades || []).find(c => c.slug === 'santa-fe');
  t('a lista tem o Santa Fé e a cidade de teste (restrita)', sf && sf.restrita === false && tst && tst.restrita === true && tst.teste === true, JSON.stringify(l.j));
  t('a lista não entrega a senha nem o hash', !JSON.stringify(l.j).includes('scrypt'));
  t('senha errada = 403', (await jogo('POST', '/cidades/testes/senha', { roblox_id: RID, senha: '000000' })).s === 403);
  t('senha certa = 200', (await jogo('POST', '/cidades/testes/senha', { roblox_id: RID, senha: '146901' })).s === 200);
  for (let i = 0; i < 6; i++) await jogo('POST', '/cidades/testes/senha', { roblox_id: RID + 1, senha: 'x' + i });
  t('6 erros travam a 7ª tentativa (429), mesmo certa', (await jogo('POST', '/cidades/testes/senha', { roblox_id: RID + 1, senha: '146901' })).s === 429);

  console.log('\nPRÉ-MODELO');
  const corpsSF = (await pool.query(`SELECT slug FROM corporations WHERE cidade_id = 1 AND is_active AND tipo IN ('corp','governo') ORDER BY slug`)).rows.map(r => r.slug);
  const corpsT = (await pool.query(`SELECT slug FROM corporations WHERE cidade_id = $1 AND is_active AND tipo IN ('corp','governo') ORDER BY slug`, [TST])).rows.map(r => r.slug);
  t('a cidade de teste tem TODAS as corporações do Santa Fé', corpsSF.every(s => corpsT.includes(s)), JSON.stringify({ corpsSF, corpsT }));
  const membrosT = (await pool.query(`SELECT COUNT(*)::int n FROM members m JOIN corporations c ON c.id = m.corporation_id WHERE c.cidade_id = $1`, [TST])).rows[0].n;
  t('...com cargos e sem membros copiados', membrosT === 0);
  const gov = (await pool.query(`SELECT corporation_id FROM governo_config WHERE cidade_id = $1`, [TST])).rows[0];
  t('...e com o Governo próprio (tesouro dela)', gov && gov.corporation_id);
  const ssuT = await jogo('GET', '/ssu', null, 'testes');
  t('SSU da cidade de teste é a dela (sempre aberta), não a do Santa Fé', ssuT.s === 200 && ssuT.j.ajustes && ssuT.j.ajustes.sempre_aberta === true, JSON.stringify(ssuT.j));

  console.log('\nSAVES E DADOS DO JOGADOR (o mesmo jogador nas duas cidades)');
  const pat = (bolso, banco) => ({ roblox_id: RID, nome: 'mundo_' + RID, bolso, banco, level: 1, emprego: '' });
  t('Santa Fé grava o patrimônio', (await jogo('POST', '/patrimonio', pat(111, 222))).s === 200);
  t('cidade de teste grava o patrimônio DELA', (await jogo('POST', '/patrimonio', pat(9999999, 8888888), 'testes')).s === 200);
  const fSF = await jogo('GET', '/ficha/cidade');
  const fT = await jogo('GET', '/ficha/cidade', null, 'testes');
  const pSF = (fSF.j.pessoas || []).find(p => p.roblox_id === RID), pT = (fT.j.pessoas || []).find(p => p.roblox_id === RID);
  t('no Santa Fé ele tem 111 no bolso (o dinheiro do teste não passou)', pSF && pSF.bolso === 111, JSON.stringify(pSF));
  t('na cidade de teste ele tem 9.999.999 (o do Santa Fé não passou)', pT && pT.bolso === 9999999, JSON.stringify(pT));
  const linhas = (await pool.query(`SELECT cidade_id, bolso FROM game_patrimonio WHERE roblox_id = $1 ORDER BY cidade_id`, [RID])).rows;
  t('no banco: 2 linhas, uma por cidade', linhas.length === 2 && linhas[0].cidade_id === 1 && linhas[1].cidade_id === TST);

  await jogo('POST', '/heartbeat', { job_id: 'ct-sf-' + RID, place_id: 1, players: [{ userId: RID, name: 'mundo_sf' }] });
  await jogo('POST', '/heartbeat', { job_id: 'ct-t-' + RID, place_id: 1, players: [{ userId: RID, name: 'mundo_t' }] }, 'testes');
  const gp = (await pool.query(`SELECT cidade_id, nome FROM game_players WHERE roblox_id = $1 ORDER BY cidade_id`, [RID])).rows;
  t('registro de jogadores: um por cidade, cada um com o nome visto lá', gp.length === 2 && gp[0].nome === 'mundo_sf' && gp[1].nome === 'mundo_t', JSON.stringify(gp));
  const gs = (await pool.query(`SELECT cidade_id FROM game_servers WHERE job_id = $1`, ['ct-t-' + RID])).rows[0];
  t('o servidor da cidade de teste fica marcado com a cidade dele', gs && gs.cidade_id === TST);

  console.log('\nCONFIG, TEMPORADA, CELULAR, LOGS');
  await pool.query(`INSERT INTO game_config (cidade_id, key, value) VALUES (1, 'temporada', '{"n":7}') ON CONFLICT (cidade_id, key) DO UPDATE SET value = '{"n":7}'`);
  const tSF = await jogo('GET', '/temporada'), tT = await jogo('GET', '/temporada', null, 'testes');
  t('temporada é por cidade (Santa Fé 7, teste 1): wipe de uma não toca a outra', tSF.j.temporada === 7 && tT.j.temporada === 1, JSON.stringify([tSF.j, tT.j]));
  await pool.query(`UPDATE game_config SET value = '{"n":1}' WHERE cidade_id = 1 AND key = 'temporada'`);
  const num = String(RID).slice(-6);
  await jogo('POST', '/celular/contato', { dono: num, numero: '111', apelido: 'contato do santa fe' });
  await jogo('POST', '/celular/contato', { dono: num, numero: '111', apelido: 'contato do teste' }, 'testes');
  const cSF = await jogo('GET', '/celular/contatos?numero=' + num), cT = await jogo('GET', '/celular/contatos?numero=' + num, null, 'testes');
  t('celular: o mesmo número tem contatos diferentes em cada cidade', cSF.j.contatos.length === 1 && cSF.j.contatos[0].apelido === 'contato do santa fe'
    && cT.j.contatos.length === 1 && cT.j.contatos[0].apelido === 'contato do teste', JSON.stringify([cSF.j, cT.j]));
  t('logs da cidade de teste são aceitos (200)', (await jogo('POST', '/logs', { job_id: 'x', eventos: [{ tipo: 'entrou', jogador: 'so_no_teste_' + RID, detalhe: { userId: RID } }] }, 'testes')).s === 200);
  const logSF = (await pool.query(`SELECT cidade_id FROM game_logs WHERE jogador = $1`, ['so_no_teste_' + RID])).rows;
  t('...e gravados SÓ na cidade de teste', logSF.length === 1 && logSF[0].cidade_id === TST);

  console.log('\nCORPORAÇÃO E PAINEL DO SITE');
  const ana = (await pool.query(`INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username) VALUES ($1,$1,$2,$1)
                                  ON CONFLICT (discord_id) DO UPDATE SET roblox_id = EXCLUDED.roblox_id RETURNING id`, ['ct_ana', RID])).rows[0].id;
  const pmSF = (await pool.query(`SELECT c.id, r.id AS rank_id FROM corporations c JOIN ranks r ON r.corporation_id = c.id WHERE c.cidade_id = 1 AND c.tipo = 'corp' AND c.is_active ORDER BY c.id, r.level DESC LIMIT 1`)).rows[0];
  await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [pmSF.id, ana, pmSF.rank_id]);
  const plSF = await jogo('GET', '/player/' + RID), plT = await jogo('GET', '/player/' + RID, null, 'testes');
  t('cargo no Santa Fé aparece no Santa Fé', plSF.j.corps.length >= 1);
  t('...e NÃO aparece na cidade de teste (lá ele não é de corp nenhuma)', plT.j.corps.length === 0, JSON.stringify(plT.j));
  const dono = (await pool.query(`SELECT id FROM users WHERE discord_id = '111'`)).rows[0].id;
  const donoAntes = (await pool.query(`SELECT dono_user_id FROM cidades WHERE id = $1`, [TST])).rows[0].dono_user_id;
  await pool.query(`UPDATE cidades SET dono_user_id = $2 WHERE id = $1`, [TST, dono]);
  await new Promise(r => setTimeout(r, 5200));   // cache das cidades no site (5 s)
  const sT = await sessao(dono, TST), cSF2 = await sessao(dono, 1);
  const logsT = await site(sT, 'GET', '/api/admin/logs?limit=1000');
  const logsSF = await site(cSF2, 'GET', '/api/admin/logs?limit=1000');
  const temT = JSON.stringify(logsT.j || {}).includes('so_no_teste_' + RID), temSF = JSON.stringify(logsSF.j || {}).includes('so_no_teste_' + RID);
  t('painel da cidade de teste vê o log de lá; o do Santa Fé não vê', logsT.s === 200 && temT && !temSF, JSON.stringify([logsT.s, temT, logsSF.s, temSF]));


  console.log('\nWIPE E SSU POR CIDADE (o Dono de uma não derruba a outra)');
  await jogo('POST', '/patrimonio', pat(111, 222));
  await jogo('POST', '/heartbeat', { job_id: 'ct-sf-' + RID, place_id: 1, players: [{ userId: RID, name: 'mundo_sf' }] });
  await jogo('POST', '/heartbeat', { job_id: 'ct-t-' + RID, place_id: 1, players: [{ userId: RID, name: 'mundo_t' }] }, 'testes');
  const tempSF0 = (await jogo('GET', '/temporada')).j.temporada;
  const tempT0 = (await jogo('GET', '/temporada', null, 'testes')).j.temporada;
  const w = await site(sT, 'POST', '/api/admin/registro/wipe', { confirm: 'WIPE' });
  t('wipe na cidade de teste funciona (200)', w.s === 200, JSON.stringify(w.j));
  t('...sobe SÓ a temporada dela', (await jogo('GET', '/temporada', null, 'testes')).j.temporada === tempT0 + 1 && (await jogo('GET', '/temporada')).j.temporada === tempSF0);
  t('...o registro de jogadores do Santa Fé fica intacto', (await pool.query(`SELECT 1 FROM game_players WHERE cidade_id = 1 AND roblox_id = $1`, [RID])).rows.length === 1);
  t('...e o da cidade de teste foi zerado', (await pool.query(`SELECT 1 FROM game_players WHERE cidade_id = $1 AND roblox_id = $2`, [TST, RID])).rows.length === 0);
  const cmds = (await pool.query(`SELECT job_id FROM game_commands WHERE tipo = 'wipe' AND created_at > NOW() - INTERVAL '1 minute'`)).rows.map(r => r.job_id);
  t('...derruba só o servidor da cidade de teste (o do Santa Fé não recebe wipe)', cmds.includes('ct-t-' + RID) && !cmds.includes('ct-sf-' + RID), JSON.stringify(cmds));
  const pend = await jogo('GET', '/commands/pending?job_id=ct-sf-' + RID);
  t('...e o servidor do Santa Fé não pega o comando de lá', !(pend.j.commands || []).some(c => c.tipo === 'wipe'));
  const g = await site(sT, 'PUT', '/api/admin/ssu/grade', { sempre_aberta: false, grade: { 1: { abre: 19, fecha: 23 } } });
  t('Dono muda a grade do SSU da cidade de teste', g.s === 200 && g.j.grade[0].includes('19:00'), JSON.stringify(g.j));
  const gSF = await site(cSF2, 'GET', '/api/admin/ssu');
  t('...a grade do Santa Fé não muda', gSF.s === 200 && gSF.j.grade.join('|').includes('12:00 às 00:00') && !gSF.j.grade.join('|').includes('19:00'), JSON.stringify(gSF.j && gSF.j.grade));
  const ssuJogo = await jogo('GET', '/ssu', null, 'testes');
  t('...o jogo da cidade de teste recebe a grade dela no /ssu', ssuJogo.j.ajustes.grade && ssuJogo.j.ajustes.grade['1'].abre === 19, JSON.stringify(ssuJogo.j.ajustes));
  t('...e o do Santa Fé não', !(await jogo('GET', '/ssu')).j.ajustes.grade);
  await site(sT, 'PUT', '/api/admin/ssu/grade', { sempre_aberta: true, grade: null });
  await pool.query(`UPDATE game_config SET value = jsonb_build_object('n', $2::int) WHERE cidade_id = $1 AND key = 'temporada'`, [TST, tempT0]);

  await pool.query(`UPDATE cidades SET dono_user_id = $2 WHERE id = $1`, [TST, donoAntes]);
  console.log('\nFALHA FECHADA');
  t('cidade que não existe = 400', (await jogo('GET', '/player/1', null, 'nao-existe')).s === 400);
  const cli = await pool.connect();
  let n = -1;
  try { await cli.query(`SET ROLE sf_app`); n = (await cli.query(`SELECT COUNT(*)::int n FROM game_players`)).rows[0].n; }
  finally { await cli.query(`RESET ROLE`); cli.release(); }
  t('como sf_app sem cidade no contexto não se vê nenhuma linha', n === 0, String(n));

  // limpeza
  await pool.query(`DELETE FROM members WHERE user_id = $1`, [ana]);
  await pool.query(`DELETE FROM game_patrimonio WHERE roblox_id = $1`, [RID]);
  await pool.query(`DELETE FROM game_players WHERE roblox_id = $1`, [RID]);
  await pool.query(`DELETE FROM celular_contatos WHERE dono_numero = $1`, [num]);
  // o teste de wipe sobe a temporada da cidade de teste: volta pra 1 (senão a próxima rodada falha)
  await pool.query(`UPDATE game_config SET value = '{"n":1}' WHERE cidade_id = $1 AND key = 'temporada'`, [TST]);
  console.log('\n' + ok + ' ok, ' + falhou + ' falharam');
  await pool.end(); process.exit(falhou ? 1 : 0);
})();
