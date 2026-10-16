// [16/10] Teste do RG no espelho do site (o PC da PC le a identidade de quem esta fora daqui).
// Uso: DATABASE_URL=... ROBLOX_API_KEY=... BASE=http://localhost:3999 node teste_rg.js
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.BASE || 'http://localhost:3999';
const KEY = process.env.ROBLOX_API_KEY;
let falhas = 0, total = 0;
// JSONB reordena as chaves: compara o CONTEUDO
const canon = v => (v && typeof v === 'object') ? (Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : '{' + Object.keys(v).sort().map(k => k + ':' + canon(v[k])).join(',') + '}') : JSON.stringify(v);
function ok(c, nome, extra) { total++; if (!c) { falhas++; console.log('  FALHOU:', nome, extra !== undefined ? JSON.stringify(extra) : ''); } else console.log('  ok', nome); }
async function jogo(method, path, body) {
  const r = await fetch(BASE + '/api/game' + path, { method, headers: { 'x-api-key': KEY, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json().catch(() => null) };
}
(async () => {
  await pool.query(`DELETE FROM game_patrimonio WHERE roblox_id IN (7101,7102,7103); DELETE FROM game_players WHERE roblox_id IN (7101,7102,7103)`);
  await pool.query(`INSERT INTO game_players (roblox_id, nome) VALUES (7101,'joaoRbx'),(7102,'semRgRbx'),(7103,'mariaRbx')`);
  const RG = { Nome: 'JOÃO DA SILVA', Nasc: '17/10/2000', Num: '12.345.678-9', Exp: '15/10/2026', Foto: { t: 1, camisa: 'rbxassetid://1', cores: { cabeca: 'c8a07a' } } };
  let r = await jogo('POST', '/patrimonio', { roblox_id: 7101, nome: 'joaoRbx', bolso: 1, banco: 2, rg: RG, versao: 3 });
  ok(r.status === 200, 'patrimonio com rg');
  await jogo('POST', '/patrimonio', { roblox_id: 7102, nome: 'semRgRbx', versao: 3 });
  await jogo('POST', '/patrimonio', { roblox_id: 7103, nome: 'mariaRbx', rg: { Nome: 'MARIA SOUZA', Nasc: '01/01/1999', Num: '45.678.901-X', Exp: '10/10/2026', Foto: { t: 1, lixo: 'x'.repeat(20000) } }, versao: 3 });

  r = await jogo('GET', '/ficha/cidade');
  const p1 = r.j.pessoas.find(p => p.roblox_id === 7101);
  const p2 = r.j.pessoas.find(p => p.roblox_id === 7102);
  const p3 = r.j.pessoas.find(p => p.roblox_id === 7103);
  ok(p1 && canon(p1.rg) === canon(RG), 'ficha/cidade devolve o rg IGUAL ao Data.RG do jogo', p1 && p1.rg);
  ok(p2 && p2.rg === null, 'sem RG = null');
  ok(p3 && p3.rg && p3.rg.Nome === 'MARIA SOUZA' && p3.rg.Foto === undefined, 'foto grande demais nao entra (o resto do RG sim)', p3 && p3.rg);

  r = await jogo('GET', '/dossie/joaoRbx');
  ok(r.j.ok && canon(r.j.pessoa.rg) === canon(RG), 'dossie devolve o rg');

  const busca = async (q) => (await jogo('GET', '/cidadaos?limit=50&busca=' + encodeURIComponent(q))).j.cidadaos.map(c => c.nome).filter(n => ['joaoRbx', 'semRgRbx', 'mariaRbx'].includes(n)).sort();
  ok(JSON.stringify(await busca('joão')) === '["joaoRbx"]', 'busca pelo nome do RG (com acento)', await busca('joão'));
  ok(JSON.stringify(await busca('SILVA')) === '["joaoRbx"]', 'busca pelo sobrenome do RG');
  ok(JSON.stringify(await busca('@semrg')) === '["semRgRbx"]', 'busca pelo @ do Roblox', await busca('@semrg'));
  ok(JSON.stringify(await busca('12.345.678')) === '["joaoRbx"]', 'busca pelo numero do RG', await busca('12.345.678'));
  ok(JSON.stringify(await busca('678901-X')) === '["mariaRbx"]', 'numero com X no fim', await busca('678901-X'));
  ok((await busca('123')).length === 0, 'numero curto nao casa');
  r = await jogo('GET', '/cidadaos?limit=50&busca=joão');
  ok(r.j.cidadaos.find(c => c.nome === 'joaoRbx').rg.Nome === 'JOÃO DA SILVA', '/cidadaos manda o rg junto');

  // PD: o jogo manda rg ausente -> espelho zera (morador novo sem documento)
  await jogo('POST', '/patrimonio', { roblox_id: 7101, nome: 'joaoRbx', versao: 3 });
  r = await jogo('GET', '/ficha/cidade');
  ok(r.j.pessoas.find(p => p.roblox_id === 7101).rg === null, 'depois do PD (sem RG) o espelho zera');

  await pool.query(`UPDATE game_patrimonio SET versao = 2 WHERE roblox_id = 7102`);
  r = await jogo('GET', '/patrimonio/ids');
  ok(r.j.ids.includes(7102), 'versao 2 volta pro backfill (pra ganhar o rg)');

  console.log(`\n${total - falhas}/${total} ok`);
  await pool.end();
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO NO TESTE:', e); process.exit(2); });
