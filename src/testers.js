// ============================================================================
// PAINEL TESTERS — liberação TEMPORÁRIA pra quem testa o jogo (21/10/2026)
//
// Pedido do Julio: um cargo "Gestor testers" que, com UM clique, dá a um tester
// itens, carros e entrada em TODAS as corps. Tudo temporário e registrado.
//
// Como funciona:
//   - Cada liberação é uma linha em `tester_liberacoes`, com prazo (expira_em),
//     quem deu, pra quem, e EXATAMENTE o que foi dado (corps, itens, carros).
//   - Corps: entra em cada corp ativa dos tipos escolhidos, no cargo mais alto
//     ou mais baixo. Se o tester JÁ era membro, guarda o cargo de antes pra
//     devolver; se não era, sai no fim.
//   - Itens: online -> comando na hora; offline -> fila de itens (pega no login).
//   - Carros: online -> comando na hora; offline -> fica pendente e o relógio
//     entrega quando ele aparecer. Carro que ele JÁ tinha (foto do patrimônio)
//     não é dado, senão o fim da liberação tiraria o carro dele.
//   - Fim (prazo ou botão Encerrar): as corps voltam NA HORA (é banco do site);
//     item que ainda estava na fila é cancelado; o resto (itens entregues e
//     carros) é tirado pelo jogo assim que o tester estiver online.
//
// O relógio (`tick`) roda a cada 30 s. Tudo nele é idempotente e com trava de
// linha (FOR UPDATE SKIP LOCKED): rodar duas vezes não dá nem tira em dobro.
// ============================================================================

const HORAS_MIN = 1;
const HORAS_MAX = 168;          // 7 dias
const MAX_ITENS = 300;
const MAX_CARROS = 100;
const TIPOS = ['corp', 'faccao', 'empresa'];

// ------------------------------------------------------------ núcleo puro

// Valida e normaliza o pedido do painel. Devolve { erro } ou { pedido }.
function normalizarPedido(b) {
  b = b || {};
  const horas = Number(b.horas);
  if (!Number.isFinite(horas) || horas < HORAS_MIN || horas > HORAS_MAX) {
    return { erro: `Prazo tem que ser de ${HORAS_MIN} a ${HORAS_MAX} horas` };
  }
  const user_id = parseInt(b.user_id);
  if (!user_id) return { erro: 'Escolha o tester' };

  const tipos = Array.isArray(b.tipos) ? b.tipos.filter(t => TIPOS.includes(t)) : [];
  const nivel = b.nivel === 'baixo' ? 'baixo' : 'alto';

  // itens: [{item, qtd}] ou ['nome'], sem repetir nome (soma a quantidade)
  const somaItens = new Map();
  for (const it of (Array.isArray(b.itens) ? b.itens : [])) {
    const nome = typeof it === 'string' ? it : (it && it.item);
    const qtd = typeof it === 'string' ? 1 : Number(it && it.qtd) || 1;
    if (typeof nome !== 'string' || !nome.trim() || nome.length > 64) continue;
    const q = Math.max(1, Math.min(99, Math.floor(qtd)));
    somaItens.set(nome.trim(), Math.min(99, (somaItens.get(nome.trim()) || 0) + q));
  }
  const itens = [...somaItens].map(([item, qtd]) => ({ item, qtd }));
  if (itens.length > MAX_ITENS) return { erro: `Máximo de ${MAX_ITENS} itens por liberação` };

  const carros = [...new Set((Array.isArray(b.carros) ? b.carros : [])
    .filter(c => typeof c === 'string' && c.trim() && c.length <= 64).map(c => c.trim()))];
  if (carros.length > MAX_CARROS) return { erro: `Máximo de ${MAX_CARROS} carros por liberação` };

  if (!tipos.length && !itens.length && !carros.length) return { erro: 'Nada pra liberar: marque corps, itens ou carros' };

  const motivo = typeof b.motivo === 'string' ? b.motivo.trim().slice(0, 200) : '';
  return { pedido: { user_id, horas, tipos, nivel, itens, carros, motivo } };
}

// Escolhe o cargo de cada corp: mais alto ou mais baixo nível. Empate -> menor id.
function escolherCargo(ranks, nivel) {
  if (!ranks || !ranks.length) return null;
  const ord = [...ranks].sort((a, b) => (nivel === 'baixo' ? a.level - b.level : b.level - a.level) || a.id - b.id);
  return ord[0];
}

// O que fazer com uma corp ao ENCERRAR, olhando como ela está agora.
//   antes.membro false -> sai (se ainda estiver lá)
//   antes.membro true  -> volta pro cargo de antes, MAS só se ninguém mexeu
//                         depois (o cargo atual ainda é o que a liberação pôs)
function desfazerCorp(reg, atual) {
  if (!atual) return { acao: 'nada' };                    // já saiu
  if (!reg.antes || !reg.antes.membro) return { acao: 'remover' };
  if (atual.rank_id === reg.rank_id && reg.antes.rank_id !== reg.rank_id) {
    return { acao: 'restaurar', rank_id: reg.antes.rank_id };
  }
  return { acao: 'nada' };
}

// ------------------------------------------------------------ banco

async function garantir(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tester_liberacoes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      roblox_id BIGINT,
      nome VARCHAR(128),
      dado_por INTEGER REFERENCES users(id) ON DELETE SET NULL,
      dado_por_nome VARCHAR(128),
      motivo VARCHAR(200),
      criado_em TIMESTAMP DEFAULT NOW(),
      expira_em TIMESTAMP NOT NULL,
      -- ativa -> revertendo (corps já voltaram; falta o jogo tirar itens/carros) -> encerrada
      status VARCHAR(16) NOT NULL DEFAULT 'ativa',
      encerrada_em TIMESTAMP,
      encerrada_por VARCHAR(128),
      fim_motivo VARCHAR(64),
      corps JSONB NOT NULL DEFAULT '[]',
      itens JSONB NOT NULL DEFAULT '[]',
      carros JSONB NOT NULL DEFAULT '[]',
      historico JSONB NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_tester_lib_status ON tester_liberacoes(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tester_lib_uma_ativa ON tester_liberacoes(user_id) WHERE status = 'ativa';
  `);
}

// { roblox_id -> { job_id, name } } de quem está online agora
async function onlineAgora(db) {
  const s = await db.query(`SELECT job_id, players FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds'`);
  const m = new Map();
  for (const row of s.rows) for (const p of (row.players || [])) {
    const n = Number(p.userId); if (n) m.set(n, { job_id: row.job_id, name: p.name || null });
  }
  return m;
}

async function comando(db, tipo, rid, on, payload, criador) {
  const r = await db.query(
    'INSERT INTO game_commands (tipo, target_roblox_id, target_name, payload, job_id, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [tipo, rid, on.name, JSON.stringify(payload || {}), on.job_id, criador || null]);
  return r.rows[0].id;
}

function linhaHist(texto, quem) {
  return JSON.stringify([{ em: new Date().toISOString(), quem: quem || 'sistema', texto }]);
}

// CONCEDER — tudo numa transação. Devolve { ok, id, resumo } ou { erro }.
async function conceder(pool, gestor, pedido) {
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const u = await cli.query('SELECT id, discord_username, roblox_id, roblox_username FROM users WHERE id = $1', [pedido.user_id]);
    if (!u.rows[0]) { await cli.query('ROLLBACK'); return { erro: 'Usuário não encontrado' }; }
    const alvo = u.rows[0];
    const rid = alvo.roblox_id ? Number(alvo.roblox_id) : null;
    if ((pedido.itens.length || pedido.carros.length) && !rid) {
      await cli.query('ROLLBACK');
      return { erro: 'Esse usuário não vinculou o Roblox no site — sem isso não dá pra mandar item nem carro' };
    }
    const ja = await cli.query(`SELECT id FROM tester_liberacoes WHERE user_id = $1 AND status = 'ativa' FOR UPDATE`, [alvo.id]);
    if (ja.rows[0]) { await cli.query('ROLLBACK'); return { erro: 'Esse tester já tem uma liberação ativa (#' + ja.rows[0].id + '). Estenda ou encerre ela antes.' }; }

    const nomeAlvo = alvo.roblox_username || alvo.discord_username || ('user#' + alvo.id);
    const gestorNome = gestor.discord_username || ('user#' + gestor.id);
    const on = rid ? (await onlineAgora(cli)).get(rid) : null;

    // --- corps ---
    const corps = [];
    if (pedido.tipos.length) {
      const cs = await cli.query(
        `SELECT id, name, tipo FROM corporations WHERE is_active = true AND tipo = ANY($1::text[]) ORDER BY tipo, name`, [pedido.tipos]);
      const rk = await cli.query(`SELECT id, corporation_id, name, level FROM ranks WHERE corporation_id = ANY($1::int[])`, [cs.rows.map(c => c.id)]);
      const mb = await cli.query(`SELECT corporation_id, rank_id FROM members WHERE user_id = $1 AND corporation_id = ANY($2::int[]) FOR UPDATE`,
        [alvo.id, cs.rows.map(c => c.id)]);
      const membro = new Map(mb.rows.map(r => [r.corporation_id, r]));
      for (const c of cs.rows) {
        const cargo = escolherCargo(rk.rows.filter(r => r.corporation_id === c.id), pedido.nivel);
        const antes = membro.get(c.id);
        await cli.query(
          `INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1, $2, $3)
           ON CONFLICT (corporation_id, user_id) DO UPDATE SET rank_id = EXCLUDED.rank_id`,
          [c.id, alvo.id, cargo ? cargo.id : null]);
        corps.push({
          corp_id: c.id, corp: c.name, tipo: c.tipo,
          rank_id: cargo ? cargo.id : null, cargo: cargo ? cargo.name : null,
          antes: antes ? { membro: true, rank_id: antes.rank_id } : { membro: false, rank_id: null },
        });
      }
    }

    // --- itens ---
    const itens = [];
    for (const it of pedido.itens) {
      if (on) {
        const cmd = await comando(cli, 'item_add', rid, on, it, gestor.id);
        itens.push({ ...it, via: 'online', cmd_id: cmd, fila_id: null });
      } else {
        const f = await cli.query('INSERT INTO game_item_fila (roblox_id, item, qtd, criado_por) VALUES ($1,$2,$3,$4) RETURNING id',
          [rid, it.item, it.qtd, gestor.id]);
        itens.push({ ...it, via: 'fila', cmd_id: null, fila_id: f.rows[0].id });
      }
    }

    // --- carros (pula o que ele já tem no patrimônio) ---
    const carros = [];
    let jaTinha = new Set();
    if (pedido.carros.length && rid) {
      try {
        const pt = await cli.query('SELECT carros FROM game_patrimonio WHERE roblox_id = $1', [rid]);
        const lista = pt.rows[0] && pt.rows[0].carros;
        // a foto vem como lista ou como mapa { nomeDoCarro: dados } -- aceita os dois
        if (Array.isArray(lista)) jaTinha = new Set(lista.map(x => String(typeof x === 'string' ? x : (x && (x.nome || x.carro || x.modelo)) || '')));
        else if (lista && typeof lista === 'object') jaTinha = new Set(Object.keys(lista));
      } catch (e) { /* base sem game_patrimonio: dá tudo */ }
    }
    for (const carro of pedido.carros) {
      if (jaTinha.has(carro)) { carros.push({ carro, entregue: false, pulado: 'já tinha' }); continue; }
      if (on) {
        await comando(cli, 'carro_add', rid, on, { carro }, gestor.id);
        carros.push({ carro, entregue: true });
      } else {
        carros.push({ carro, entregue: false });
      }
    }

    if (on && corps.length) await comando(cli, 'corp_refresh', rid, on, {}, gestor.id);

    const r = await cli.query(
      `INSERT INTO tester_liberacoes (user_id, roblox_id, nome, dado_por, dado_por_nome, motivo, expira_em, corps, itens, carros, historico)
       VALUES ($1,$2,$3,$4,$5,$6, NOW() + ($7 || ' hours')::interval, $8,$9,$10,$11) RETURNING id, expira_em`,
      [alvo.id, rid, nomeAlvo, gestor.id, gestorNome, pedido.motivo || null, String(pedido.horas),
       JSON.stringify(corps), JSON.stringify(itens), JSON.stringify(carros),
       linhaHist(`Liberado por ${pedido.horas} h: ${corps.length} corps, ${itens.length} itens, ${carros.filter(c => !c.pulado).length} carros`, gestorNome)]);
    await cli.query('COMMIT');
    return {
      ok: true, id: r.rows[0].id, expira_em: r.rows[0].expira_em, online: !!on,
      resumo: { corps: corps.length, itens: itens.length, carros: carros.filter(c => !c.pulado).length,
                carros_pulados: carros.filter(c => c.pulado).length, carros_pendentes: carros.filter(c => !c.entregue && !c.pulado).length },
    };
  } catch (e) {
    try { await cli.query('ROLLBACK'); } catch (_) {}
    if (e.code === '23505') return { erro: 'Esse tester já tem uma liberação ativa. Estenda ou encerre ela antes.' };
    throw e;
  } finally { cli.release(); }
}

// ESTENDER — soma horas ao prazo (nunca passa de 7 dias a partir de agora).
async function estender(pool, id, horas, quem) {
  const h = Number(horas);
  if (!Number.isFinite(h) || h < HORAS_MIN || h > HORAS_MAX) return { erro: `Estender de ${HORAS_MIN} a ${HORAS_MAX} horas` };
  const r = await pool.query(
    `UPDATE tester_liberacoes
        SET expira_em = LEAST(expira_em + ($2 || ' hours')::interval, NOW() + INTERVAL '${HORAS_MAX} hours'),
            historico = historico || $3::jsonb
      WHERE id = $1 AND status = 'ativa' RETURNING id, expira_em`,
    [id, String(h), linhaHist(`Estendido em ${h} h`, quem)]);
  if (!r.rows[0]) return { erro: 'Liberação não está ativa' };
  return { ok: true, expira_em: r.rows[0].expira_em };
}

// ENCERRAR — corps voltam na hora; itens/carros entram na lista do relógio.
// `cli` já dentro de transação, com a linha travada.
async function _encerrarLinha(cli, lib, quem, fimMotivo) {
  // corps
  for (const reg of (lib.corps || [])) {
    const at = await cli.query('SELECT rank_id FROM members WHERE corporation_id = $1 AND user_id = $2 FOR UPDATE', [reg.corp_id, lib.user_id]);
    const d = desfazerCorp(reg, at.rows[0]);
    reg.desfeito = d.acao;
    if (d.acao === 'remover') {
      await cli.query('DELETE FROM members WHERE corporation_id = $1 AND user_id = $2', [reg.corp_id, lib.user_id]);
      await cli.query('DELETE FROM corp_managers WHERE corporation_id = $1 AND user_id = $2', [reg.corp_id, lib.user_id]).catch(() => {});
    } else if (d.acao === 'restaurar') {
      await cli.query('UPDATE members SET rank_id = $3 WHERE corporation_id = $1 AND user_id = $2', [reg.corp_id, lib.user_id, d.rank_id]);
    }
  }
  // itens: o que ainda estava na fila é cancelado; o resto o jogo tira
  for (const it of (lib.itens || [])) {
    it.tirar = true;
    if (it.fila_id) {
      const del = await cli.query('DELETE FROM game_item_fila WHERE id = $1 AND entregue_em IS NULL', [it.fila_id]);
      if (del.rowCount > 0) { it.tirar = false; it.cancelado = true; }
    }
  }
  for (const c of (lib.carros || [])) c.tirar = !!c.entregue;
  const falta = (lib.itens || []).some(i => i.tirar) || (lib.carros || []).some(c => c.tirar);
  await cli.query(
    `UPDATE tester_liberacoes
        SET status = $2, encerrada_em = NOW(), encerrada_por = $3, fim_motivo = $4,
            corps = $5, itens = $6, carros = $7, historico = historico || $8::jsonb
      WHERE id = $1`,
    [lib.id, falta ? 'revertendo' : 'encerrada', quem, fimMotivo,
     JSON.stringify(lib.corps || []), JSON.stringify(lib.itens || []), JSON.stringify(lib.carros || []),
     linhaHist(fimMotivo === 'expirou' ? 'Prazo acabou — corps devolvidas' : 'Encerrado — corps devolvidas', quem)]);
  return falta;
}

async function encerrar(pool, id, quem) {
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const r = await cli.query(`SELECT * FROM tester_liberacoes WHERE id = $1 AND status = 'ativa' FOR UPDATE`, [id]);
    if (!r.rows[0]) { await cli.query('ROLLBACK'); return { erro: 'Liberação não está ativa' }; }
    const falta = await _encerrarLinha(cli, r.rows[0], quem, 'encerrada');
    await cli.query('COMMIT');
    // já tenta tirar agora, se o tester estiver online
    await tick(pool).catch(e => console.error('[testers] tick pós-encerrar:', e.message));
    return { ok: true, falta_no_jogo: falta };
  } catch (e) {
    try { await cli.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally { cli.release(); }
}

// O RELÓGIO. 1) vence quem passou do prazo; 2) entrega carro pendente a quem
// ficou online; 3) tira item/carro de quem está revertendo e ficou online.
async function tick(pool) {
  const feito = { venceu: 0, carros_entregues: 0, revertidas: 0 };

  // 1) prazos
  const vencidas = await pool.query(`SELECT id FROM tester_liberacoes WHERE status = 'ativa' AND expira_em <= NOW()`);
  for (const v of vencidas.rows) {
    const cli = await pool.connect();
    try {
      await cli.query('BEGIN');
      const r = await cli.query(`SELECT * FROM tester_liberacoes WHERE id = $1 AND status = 'ativa' FOR UPDATE SKIP LOCKED`, [v.id]);
      if (r.rows[0]) { await _encerrarLinha(cli, r.rows[0], 'sistema', 'expirou'); feito.venceu++; }
      await cli.query('COMMIT');
    } catch (e) { try { await cli.query('ROLLBACK'); } catch (_) {} console.error('[testers] vencer #' + v.id + ':', e.message); }
    finally { cli.release(); }
  }

  const pend = await pool.query(`SELECT id, roblox_id FROM tester_liberacoes WHERE status IN ('ativa','revertendo') AND roblox_id IS NOT NULL`);
  if (!pend.rows.length) return feito;
  const online = await onlineAgora(pool);

  for (const p of pend.rows) {
    const on = online.get(Number(p.roblox_id));
    if (!on) continue;
    const cli = await pool.connect();
    try {
      await cli.query('BEGIN');
      const r = await cli.query(`SELECT * FROM tester_liberacoes WHERE id = $1 FOR UPDATE SKIP LOCKED`, [p.id]);
      const lib = r.rows[0];
      if (!lib) { await cli.query('ROLLBACK'); continue; }
      const rid = Number(lib.roblox_id);
      if (lib.status === 'ativa') {
        let n = 0;
        for (const c of lib.carros) {
          if (!c.entregue && !c.pulado) { await comando(cli, 'carro_add', rid, on, { carro: c.carro }, lib.dado_por); c.entregue = true; n++; }
        }
        if (n) {
          await cli.query(`UPDATE tester_liberacoes SET carros = $2, historico = historico || $3::jsonb WHERE id = $1`,
            [lib.id, JSON.stringify(lib.carros), linhaHist(`${n} carro(s) entregue(s) quando ficou online`)]);
          feito.carros_entregues += n;
        }
      } else if (lib.status === 'revertendo') {
        for (const it of lib.itens) if (it.tirar) { await comando(cli, 'item_remove', rid, on, { item: it.item, qtd: it.qtd }, null); it.tirar = false; it.tirado = true; }
        for (const c of lib.carros) if (c.tirar) { await comando(cli, 'carro_remove', rid, on, { carro: c.carro }, null); c.tirar = false; c.tirado = true; }
        if ((lib.corps || []).length) await comando(cli, 'corp_refresh', rid, on, {}, null);
        await cli.query(
          `UPDATE tester_liberacoes SET status = 'encerrada', itens = $2, carros = $3, historico = historico || $4::jsonb WHERE id = $1`,
          [lib.id, JSON.stringify(lib.itens), JSON.stringify(lib.carros), linhaHist('Itens e carros tirados no jogo')]);
        feito.revertidas++;
      }
      await cli.query('COMMIT');
    } catch (e) { try { await cli.query('ROLLBACK'); } catch (_) {} console.error('[testers] tick #' + p.id + ':', e.message); }
    finally { cli.release(); }
  }
  return feito;
}

let _timer = null;
function iniciar(pool, ms) {
  if (_timer) return;
  _timer = setInterval(() => { tick(pool).catch(e => console.error('[testers] tick:', e.message)); }, ms || 30000);
  if (_timer.unref) _timer.unref();
}

async function listar(pool) {
  const r = await pool.query(
    `SELECT * FROM tester_liberacoes
      ORDER BY (status = 'ativa') DESC, (status = 'revertendo') DESC, id DESC LIMIT 100`);
  return r.rows;
}

module.exports = {
  HORAS_MIN, HORAS_MAX, TIPOS,
  normalizarPedido, escolherCargo, desfazerCorp,
  garantir, conceder, estender, encerrar, tick, iniciar, listar, onlineAgora,
};
