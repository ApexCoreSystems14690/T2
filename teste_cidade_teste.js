// [24/10] cidade de teste: senha, rotas livres e trava de escrita (cidade não isolada)
const B = 'http://localhost:4600/api/game';
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let ok = 0, falhou = 0;
function t(nome, cond, extra) { if (cond) { ok++; console.log('  ok  ' + nome); } else { falhou++; console.log('  FALHOU  ' + nome, extra || ''); } }
async function req(m, p, body, cidade) {
  const h = { 'x-api-key': 'k123', 'content-type': 'application/json' };
  if (cidade) h['x-cidade'] = cidade;
  const r = await fetch(B + p, { method: m, headers: h, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { s: r.status, j };
}
(async () => {
  const l = await req('GET', '/cidades');
  const tst = (l.j.cidades || []).find(c => c.slug === 'testes');
  const sf = (l.j.cidades || []).find(c => c.slug === 'santa-fe');
  t('lista do lobby tem a cidade de teste, restrita', tst && tst.restrita === true && tst.teste === true, JSON.stringify(tst));
  t('Santa Fé não é restrita', sf && sf.restrita === false);
  t('a lista não entrega a senha nem o hash', !JSON.stringify(l.j).includes('scrypt'));
  const rid = 900000000 + Math.floor(Math.random() * 1e6);
  t('senha errada = 403', (await req('POST', '/cidades/testes/senha', { roblox_id: rid, senha: '000000' })).s === 403);
  t('senha certa = 200', (await req('POST', '/cidades/testes/senha', { roblox_id: rid, senha: '146901' })).s === 200);
  for (let i = 0; i < 6; i++) await req('POST', '/cidades/testes/senha', { roblox_id: rid + 1, senha: 'x' + i });
  const trava = await req('POST', '/cidades/testes/senha', { roblox_id: rid + 1, senha: '146901' });
  t('6 erros travam a 7ª tentativa (429), mesmo certa', trava.s === 429, trava.s);
  t('Santa Fé sem senha confere sempre', (await req('POST', '/cidades/santa-fe/senha', { roblox_id: rid, senha: '' })).j.ok === true);

  const antes = await pool.query('SELECT COUNT(*)::int n FROM game_players WHERE roblox_id = $1', [rid]);
  const hb = await req('POST', '/heartbeat', { job_id: 'job-teste-' + rid, place_id: 1, players: [{ userId: rid, name: 'Tester' }] }, 'testes');
  t('heartbeat da cidade de teste responde isolada=false sem config', hb.s === 200 && hb.j.isolada === false && Object.keys(hb.j.config).length === 0, JSON.stringify(hb.j));
  const gs = await pool.query(`SELECT c.slug FROM game_servers g JOIN cidades c ON c.id = g.cidade_id WHERE job_id = $1`, ['job-teste-' + rid]);
  t('servidor da cidade de teste marcado com a cidade dele', gs.rows[0] && gs.rows[0].slug === 'testes');
  const depois = await pool.query('SELECT COUNT(*)::int n FROM game_players WHERE roblox_id = $1', [rid]);
  t('heartbeat de teste não escreve no registro de jogadores do Santa Fé', depois.rows[0].n === antes.rows[0].n);
  t('escrita (logs) da cidade de teste = 423', (await req('POST', '/logs', { job_id: 'x', eventos: [{ tipo: 'entrou', jogador: 'a' }] }, 'testes')).s === 423);
  t('leitura de celular da cidade de teste = 423', (await req('GET', '/celular/contatos?uid=1', null, 'testes')).s === 423);
  t('comandos pendentes do Santa Fé não vão pra cidade de teste (423)', (await req('GET', '/commands/pending?job_id=x', null, 'testes')).s === 423);
  t('cargo do jogador (/player) passa', (await req('GET', '/player/' + rid, null, 'testes')).s === 200);
  const tp = await req('GET', '/temporada', null, 'testes');
  t('temporada da cidade de teste = 1 (não herda o wipe)', tp.j && tp.j.temporada === 1);
  const ssu = await req('GET', '/ssu', null, 'testes');
  t('SSU da cidade de teste sem ajuste do Santa Fé', ssu.s === 200 && Object.keys(ssu.j.ajustes).length === 0);
  t('Santa Fé continua escrevendo (logs 200)', (await req('POST', '/logs', { job_id: 'x', eventos: [] })).s === 200);
  t('cidade que não existe = 400', (await req('GET', '/player/1', null, 'nao-existe')).s === 400);
  console.log('\n' + ok + ' ok, ' + falhou + ' falharam');
  await pool.end(); process.exit(falhou ? 1 : 0);
})();
