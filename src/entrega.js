// [23/10] ENTREGA NO JOGO — o caminho do benefício de booster, separado pra ser usado
// também pela Loja de Royalties. Nada novo: é o mesmo código que o booster usava.
//
//   enviar(cli, ...)  -> manda dinheiro (dinheiro_add), carro (carro_add), itens (game_item_fila)
//                        e uma mensagem, pro servidor em que a pessoa ESTÁ (job). Devolve os ids.
//   conferir(pool, cfg, online) -> olha as entregas abertas de uma tabela:
//        tudo 'done' + fila entregue = entregue;
//        comando com erro (ou pending velho) e a pessoa online = reenvia (até 5x);
//        comando 'sent' sem resposta há 10 min = revisar (NUNCA reenvia: pode já ter pago).
//
// A tabela que usa isto precisa das colunas: id, roblox_id, nome, status, cmd_ids JSONB,
// fila_ids JSONB, tentativas INT, nota TEXT, entregue_em TIMESTAMP.

async function comando(cli, tipo, rid, nome, job, payload) {
  const r = await cli.query(
    `INSERT INTO game_commands (tipo, target_roblox_id, target_name, payload, job_id, created_by) VALUES ($1,$2,$3,$4,$5,NULL) RETURNING id`,
    [tipo, rid, nome, JSON.stringify(payload), job]);
  return r.rows[0].id;
}

// conteudo = { dinheiro, carro, itens: [{item, qtd}] }. `motivo` vai no payload do dinheiro
// (a aba Economia usa pra não contar como dinheiro criado pela staff).
async function enviar(cli, { rid, nome, job, conteudo, motivo, texto }) {
  const cmds = [], fila = [];
  if (conteudo.dinheiro > 0) cmds.push(await comando(cli, 'dinheiro_add', rid, nome, job, { valor: conteudo.dinheiro, motivo }));
  if (conteudo.carro) cmds.push(await comando(cli, 'carro_add', rid, nome, job, { carro: conteudo.carro }));
  for (const it of (conteudo.itens || [])) {
    const f = await cli.query(`INSERT INTO game_item_fila (roblox_id, item, qtd, criado_por) VALUES ($1,$2,$3,NULL) RETURNING id`, [rid, it.item, it.qtd]);
    fila.push(f.rows[0].id);
  }
  if (texto) await comando(cli, 'mensagem', rid, nome, job, { texto });
  return { cmds, fila };
}

const TABELAS_OK = new Set(['booster_entregas', 'royalties_trocas']);

async function conferir(pool, { tabela, aberto, revisar, entregue }, online) {
  if (!TABELAS_OK.has(tabela)) throw new Error('tabela de entrega desconhecida: ' + tabela);
  aberto = aberto || 'enviando'; revisar = revisar || 'revisar'; entregue = entregue || 'entregue';
  const r = await pool.query(`SELECT * FROM ${tabela} WHERE status = $1 ORDER BY id LIMIT 200`, [aberto]);
  for (const e of r.rows) {
    const ids = e.cmd_ids || [];
    const cmds = ids.length ? (await pool.query(`SELECT id, tipo, status, payload, created_at, sent_at FROM game_commands WHERE id = ANY($1)`, [ids])).rows : [];
    const fila = (e.fila_ids || []).length ? (await pool.query(`SELECT id, entregue_em FROM game_item_fila WHERE id = ANY($1)`, [e.fila_ids])).rows : [];
    const filaOk = fila.every(f => f.entregue_em);
    if (cmds.length === ids.length && cmds.every(c => c.status === 'done') && filaOk) {
      await pool.query(`UPDATE ${tabela} SET status = $2, entregue_em = NOW() WHERE id = $1`, [e.id, entregue]);
      continue;
    }
    const preso = cmds.find(c => c.status === 'sent' && c.sent_at && Date.now() - new Date(c.sent_at).getTime() > 600000);
    if (preso) {
      await pool.query(`UPDATE ${tabela} SET status = $2, nota = $3 WHERE id = $1`, [e.id, revisar, `comando ${preso.id} (${preso.tipo}) sem resposta do jogo`]);
      continue;
    }
    const on = online.get(Number(e.roblox_id));
    const refazer = cmds.filter(c => c.status === 'error' || (c.status === 'pending' && on && Date.now() - new Date(c.created_at).getTime() > 60000));
    if (!refazer.length || !on) continue;
    if (e.tentativas >= 5) {
      await pool.query(`UPDATE ${tabela} SET status = $2, nota = 'falhou 5 vezes' WHERE id = $1`, [e.id, revisar]);
      continue;
    }
    const novos = ids.filter(id => !refazer.some(c => c.id === id));
    for (const c of refazer) {
      if (c.status === 'pending') await pool.query(`DELETE FROM game_commands WHERE id = $1 AND status = 'pending'`, [c.id]);
      novos.push(await comando(pool, c.tipo, e.roblox_id, e.nome, on.job_id, c.payload));
    }
    await pool.query(`UPDATE ${tabela} SET cmd_ids = $2, tentativas = tentativas + 1 WHERE id = $1`, [e.id, JSON.stringify(novos)]);
  }
}

// { roblox_id -> { job_id, name } } de quem está online nos servidores DESTA cidade
async function onlineDaCidade(db, cidadeId) {
  const s = await db.query(`SELECT job_id, players FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds' AND cidade_id = $1`, [cidadeId || 1]);
  const m = new Map();
  for (const row of s.rows) for (const p of (row.players || [])) {
    const n = Number(p.userId); if (n) m.set(n, { job_id: row.job_id, name: p.name || null });
  }
  return m;
}

module.exports = { comando, enviar, conferir, onlineDaCidade };
