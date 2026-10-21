// [22/10] Teste da faxina de emprestimo fantasma ("Com quem esta agora" com gente fora do jogo).
const pool = require('./src/db/pool');
const X = require('./src/corp-caixa-db');
let falhas = 0, total = 0;
function ok(c, nome, extra) { total++; if (!c) { falhas++; console.log('  FALHOU:', nome, extra !== undefined ? JSON.stringify(extra) : ''); } else console.log('  ok', nome); }

(async () => {
  const slug = 'teste-fantasma';
  await pool.query(`DELETE FROM corporations WHERE slug = $1`, [slug]);
  const own = await pool.query(`SELECT id FROM users LIMIT 1`);
  const c = await pool.query(
    `INSERT INTO corporations (name, slug, owner_id) VALUES ('Teste Fantasma', $1, $2) RETURNING id`,
    [slug, own.rows[0] ? own.rows[0].id : null]);
  const cid = c.rows[0].id;
  await pool.query(`DELETE FROM game_players WHERE roblox_id IN (9101,9102,9103)`);
  await pool.query(`DELETE FROM game_servers WHERE job_id = 'job-teste-fantasma'`);
  // 9101 fantasma (saiu ha 1 dia), 9102 online agora, 9103 saiu ha 2 min (ainda na carencia)
  await pool.query(`INSERT INTO game_players (roblox_id, nome, ultima_vez) VALUES
    (9101,'Fantasma1', NOW() - INTERVAL '1 day'), (9102,'Online2', NOW()), (9103,'Recente3', NOW() - INTERVAL '2 minutes')`);
  await pool.query(`INSERT INTO game_servers (job_id, players, updated_at) VALUES ('job-teste-fantasma', $1, NOW())`,
    [JSON.stringify([{ userId: 9102, name: 'Online2' }])]);

  // estoque: 5 FAL e 5 Algema na prateleira
  for (const it of ['FAL', 'Algema']) for (let i = 0; i < 5; i++) {
    await pool.query(`INSERT INTO corp_estoque (corporation_id, item, qtd, perdidos) VALUES ($1,$2,5,0)
      ON CONFLICT (corporation_id, item) DO NOTHING`, [cid, it]);
  }
  const ret = async (nome, uid, item) => ok((await X.movEstoque(cid, 'retirou', nome, item, { roblox_id: uid })).ok, `retirou ${nome} ${item}`);
  await ret('Fantasma1', 9101, 'FAL'); await ret('Fantasma1', 9101, 'Algema');
  await ret('Online2', 9102, 'FAL');
  await ret('Recente3', 9103, 'Algema');
  // sem roblox_id (registro antigo): casa pelo nome
  await ret('SemId4', null, 'FAL');
  // os emprestimos "envelhecem" (pego ha 1 semana)
  await pool.query(`UPDATE corp_emprestimos SET pego_em = NOW() - INTERVAL '7 days' WHERE corporation_id = $1`, [cid]);

  const p = await X.painel(cid);
  const quem = p.emprestimos.map(e => e.nome + ':' + e.item).sort();
  ok(JSON.stringify(quem) === JSON.stringify(['Online2:FAL', 'Recente3:Algema']), 'painel so mostra quem esta no jogo (ou saiu ha < 5 min)', quem);
  const fal = p.itens.find(i => i.item === 'FAL'), alg = p.itens.find(i => i.item === 'Algema');
  ok(fal.prateleira === 4 && fal.rua === 1 && fal.perdido === 0, 'FAL: fantasmas voltaram pra prateleira, nada contado como perdido', fal);
  ok(alg.prateleira === 4 && alg.rua === 1 && alg.perdido === 0, 'Algema idem', alg);

  const l = await pool.query(`SELECT motivo, quem, detalhe FROM corp_lancamentos WHERE corporation_id = $1 AND motivo = 'saiu' ORDER BY id`, [cid]);
  ok(l.rows.length === 3 && l.rows.every(r => r.detalhe && r.detalhe.auto === 'fora_do_jogo'), 'cada devolucao virou lancamento `saiu` marcado auto', l.rows);

  // repetir nao faz nada
  ok((await X.faxinaFantasmas(cid)) === 0, 'rodar de novo nao mexe em nada');

  // servidor com heartbeat atrasado (> 2 min) mas o jogador visto ha 1 min: NAO devolve
  await pool.query(`UPDATE game_servers SET updated_at = NOW() - INTERVAL '3 minutes' WHERE job_id = 'job-teste-fantasma'`);
  await pool.query(`UPDATE game_players SET ultima_vez = NOW() - INTERVAL '1 minute' WHERE roblox_id = 9102`);
  ok((await X.faxinaFantasmas(cid)) === 0, 'heartbeat atrasado nao arranca a arma de quem jogava ha 1 min');

  // o Recente3 passa da carencia -> devolve
  await pool.query(`UPDATE game_players SET ultima_vez = NOW() - INTERVAL '10 minutes' WHERE roblox_id = 9103`);
  ok((await X.faxinaFantasmas(cid)) === 1, 'passou dos 5 min fora -> devolve');

  // depois da faxina, o mesmo jogador volta e pega de novo sem `ja_tem`
  const de = await X.movEstoque(cid, 'retirou', 'Fantasma1', 'FAL', { roblox_id: 9101 });
  ok(de.ok, 'quem tinha fantasma consegue pegar de novo', de);

  await pool.query(`DELETE FROM corporations WHERE id = $1`, [cid]);
  await pool.query(`DELETE FROM game_players WHERE roblox_id IN (9101,9102,9103)`);
  await pool.query(`DELETE FROM game_servers WHERE job_id = 'job-teste-fantasma'`);
  console.log(`\n${total - falhas}/${total} ok`);
  await pool.end();
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO NO TESTE:', e); process.exit(2); });
