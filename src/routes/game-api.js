const router = require('express').Router();
const pool = require('../db/pool');
const { requireApiKey } = require('../middleware/auth');

// Todas as rotas aqui precisam da API key
router.use(requireApiKey);

// ---------------------------------------------------------------------------
// GET /api/game/temporada
// [19/09] O WIPE E UMA TEMPORADA NOVA, nao um DELETE jogador a jogador.
// O save de verdade mora no DataStore do Roblox (ProfileService, loja
// "CBRP_V1.2"), onde o site nao alcanca. Em vez de tentar apagar milhares de
// saves um a um, o wipe INCREMENTA este numero e o jogo passa a usar uma loja
// nova ("CBRP_V1.2_T2", "_T3"...). Todo mundo -- online, offline, quem nunca
// mais entrou -- nasce zerado no proximo login, de uma vez, sem varrer nada.
// Bonus: o save antigo continua existindo na loja antiga, entao um wipe errado
// e reversivel baixando o numero de volta.
// O jogo le isto no BOOT (antes de carregar o primeiro jogador) e a cada
// heartbeat. Ele guarda uma copia em DataStore e usa sempre o MAIOR dos dois,
// entao o site fora do ar nunca ressuscita a temporada passada.
// ---------------------------------------------------------------------------
router.get('/temporada', async (req, res) => {
  try {
    const r = await pool.query(`SELECT value FROM game_config WHERE key = 'temporada'`);
    const n = Math.max(1, parseInt(r.rows[0] && r.rows[0].value && r.rows[0].value.n) || 1);
    const w = await pool.query(`SELECT value FROM game_config WHERE key = 'wipe_em'`);
    res.json({ temporada: n, wipe_em: (w.rows[0] && w.rows[0].value && w.rows[0].value.em) || null });
  } catch (err) {
    console.error('temporada:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ------------------------------------------------------------------
// [25/09] SSU — o jogo pergunta SO os AJUSTES, nunca a grade.
// A grade (qua/sex/sab/dom) mora em ReplicatedStorage.Shared.Regras.SSU, no
// JOGO. E de proposito: com o site fora do ar o servidor continua abrindo e
// fechando na hora certa sozinho, que foi o pedido ("roda sozinho").
// Aqui so vem { sessao, encerrada, estendidaAte } -- o que a direcao mexeu
// NAQUELA noite. Se este endpoint cair, o jogo usa o ultimo ajuste conhecido.
// (Isto tambem ja viaja no /heartbeat dentro de `config.ssu`; esta rota existe
// pro BOOT do servidor, que precisa da resposta antes do primeiro heartbeat.)
// ------------------------------------------------------------------
router.get('/ssu', async (req, res) => {
  try {
    const r = await pool.query(`SELECT value FROM game_config WHERE key = 'ssu'`);
    // A LISTA DE STAFF VEM JUNTO. Motivo: "o jogo nunca decide quem e admin" --
    // quem decide e o site. Mas o jogo precisa saber na hora do JOIN, e uma
    // chamada HTTP por entrada seria lenta e frageis. Entao o jogo guarda esta
    // lista e refaz de tempos em tempos. Lista velha por alguns minutos custa,
    // no pior caso, um admin recem-promovido esperando -- nunca um jogador
    // comum entrando fora do horario.
    const st = await pool.query(
      `SELECT roblox_id FROM users WHERE roblox_id IS NOT NULL AND is_admin = true LIMIT 200`);
    res.json({
      ok: true,
      ajustes: (r.rows[0] && r.rows[0].value) || {},
      staff: st.rows.map(x => Number(x.roblox_id)),
      agora: Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    console.error('ssu:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/player/:robloxId
// Retorna todas as corporações que o jogador pertence, com cargo e salário
// Usado pelo servidor Roblox ao invés de plr:IsInGroup()
router.get('/player/:robloxId', async (req, res) => {
  try {
    const { robloxId } = req.params;
    const result = await pool.query(`
      SELECT
        c.id as corp_id,
        c.name as corp_name,
        c.slug as corp_slug,
        r.name as rank_name,
        r.level as rank_level,
        r.salary as rank_salary,
        r.permissions as rank_permissions
      FROM members m
      JOIN corporations c ON m.corporation_id = c.id
      JOIN users u ON m.user_id = u.id
      LEFT JOIN ranks r ON m.rank_id = r.id
      WHERE u.roblox_id = $1 AND c.is_active = true
    `, [robloxId]);

    res.json({
      roblox_id: parseInt(robloxId),
      // Formato lido pelo CorpService do Roblox (data.corps[].corp_slug / rank_name / ...)
      corps: result.rows.map(row => ({
        corp_id: row.corp_id,
        corp_slug: row.corp_slug,
        corp_name: row.corp_name,
        rank_name: row.rank_name || 'Sem cargo',
        rank_level: row.rank_level || 0,
        salary: row.rank_salary || 0,
        permissions: row.rank_permissions || {},
      })),
      // Formato antigo, mantido por compatibilidade
      corporations: result.rows.map(row => ({
        id: row.corp_id,
        name: row.corp_name,
        slug: row.corp_slug,
        rank: row.rank_name || 'Sem cargo',
        rank_level: row.rank_level || 0,
        salary: row.rank_salary || 0,
        permissions: row.rank_permissions || {},
      })),
    });
  } catch (err) {
    console.error('Erro ao buscar player:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/player/:robloxId/corp/:corpSlug
// Checa se o jogador pertence a uma corporação específica
// Substitui diretamente plr:IsInGroup(groupId)
router.get('/player/:robloxId/corp/:corpSlug', async (req, res) => {
  try {
    const { robloxId, corpSlug } = req.params;
    const result = await pool.query(`
      SELECT
        c.id as corp_id,
        c.name as corp_name,
        r.name as rank_name,
        r.level as rank_level,
        r.salary as rank_salary
      FROM members m
      JOIN corporations c ON m.corporation_id = c.id
      JOIN users u ON m.user_id = u.id
      LEFT JOIN ranks r ON m.rank_id = r.id
      WHERE u.roblox_id = $1 AND c.slug = $2 AND c.is_active = true
    `, [robloxId, corpSlug]);

    if (result.rows.length === 0) {
      return res.json({ is_member: false });
    }

    const row = result.rows[0];
    res.json({
      is_member: true,
      corp_id: row.corp_id,
      corp_name: row.corp_name,
      rank: row.rank_name || 'Sem cargo',
      rank_level: row.rank_level || 0,
      salary: row.rank_salary || 0,
    });
  } catch (err) {
    console.error('Erro ao checar membro:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/corp/:corpSlug/members
// Lista todos os membros de uma corporação (para ranking boards, etc.)
router.get('/corp/:corpSlug/members', async (req, res) => {
  try {
    const { corpSlug } = req.params;
    const result = await pool.query(`
      SELECT
        u.roblox_id,
        u.roblox_username,
        u.discord_username,
        r.name as rank_name,
        r.level as rank_level,
        m.joined_at
      FROM members m
      JOIN corporations c ON m.corporation_id = c.id
      JOIN users u ON m.user_id = u.id
      LEFT JOIN ranks r ON m.rank_id = r.id
      WHERE c.slug = $1 AND c.is_active = true
      ORDER BY r.level DESC NULLS LAST, m.joined_at ASC
    `, [corpSlug]);

    res.json({
      corporation: corpSlug,
      count: result.rows.length,
      members: result.rows,
    });
  } catch (err) {
    console.error('Erro ao listar membros:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/corp/:corpSlug/ranks
// Lista todos os cargos de uma corporação (para salário, etc.)
router.get('/corp/:corpSlug/ranks', async (req, res) => {
  try {
    const { corpSlug } = req.params;
    const result = await pool.query(`
      SELECT r.name, r.level, r.salary
      FROM ranks r
      JOIN corporations c ON r.corporation_id = c.id
      WHERE c.slug = $1 AND c.is_active = true
      ORDER BY r.level DESC
    `, [corpSlug]);

    res.json({ ranks: result.rows });
  } catch (err) {
    console.error('Erro ao listar cargos:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ============================================================
// PAINEL ADMIN — endpoints usados pelo servidor do jogo (API key)
// ============================================================

// POST /api/game/heartbeat  { job_id, place_id, players: [...], catalog?: {...} }
router.post('/heartbeat', async (req, res) => {
  try {
    const { job_id, place_id, players, catalog } = req.body || {};
    if (!job_id || typeof job_id !== 'string' || job_id.length > 64) return res.status(400).json({ error: 'job_id inválido' });
    const lista = Array.isArray(players) ? players.slice(0, 200) : [];
    if (catalog && typeof catalog === 'object') {
      await pool.query(
        `INSERT INTO game_servers (job_id, place_id, players, catalog, updated_at) VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (job_id) DO UPDATE SET place_id = EXCLUDED.place_id, players = EXCLUDED.players, catalog = EXCLUDED.catalog, updated_at = NOW()`,
        [job_id, place_id ? parseInt(place_id) : null, JSON.stringify(lista), JSON.stringify(catalog)]
      );
    } else {
      await pool.query(
        `INSERT INTO game_servers (job_id, place_id, players, updated_at) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (job_id) DO UPDATE SET place_id = EXCLUDED.place_id, players = EXCLUDED.players, updated_at = NOW()`,
        [job_id, place_id ? parseInt(place_id) : null, JSON.stringify(lista)]
      );
    }
    // limpa servidores mortos (sem heartbeat há 2 min)
    await pool.query(`DELETE FROM game_servers WHERE updated_at < NOW() - INTERVAL '2 minutes'`);

    // Registro de jogadores: refresca nome + ultima_vez de todo mundo online agora.
    // (o número de visitas é contado no /logs, no evento 'entrou' — aqui não incrementa)
    const rids = [];
    {
      const vals = [], pr = [];
      let i = 1;
      for (const p of lista) {
        const rid = Number(p && p.userId);
        if (!Number.isFinite(rid) || rid <= 0) continue;
        rids.push(rid);
        vals.push(`($${i++}, $${i++})`);
        pr.push(rid, String((p && p.name) || '').slice(0, 64));
      }
      if (vals.length) {
        await pool.query(
          `INSERT INTO game_players (roblox_id, nome) VALUES ${vals.join(',')}
           ON CONFLICT (roblox_id) DO UPDATE SET nome = EXCLUDED.nome, ultima_vez = NOW()`,
          pr);
      }
    }

    // Fila de itens: entrega pendências de quem está online agora (o jogo aplica e confirma)
    let entregas = [];
    if (rids.length) {
      const fila = await pool.query(
        `SELECT id, roblox_id, item, qtd FROM game_item_fila
         WHERE entregue_em IS NULL AND roblox_id = ANY($1) ORDER BY id ASC LIMIT 200`,
        [rids]);
      const map = {};
      for (const r of fila.rows) { (map[r.roblox_id] = map[r.roblox_id] || []).push({ id: r.id, item: r.item, qtd: r.qtd }); }
      entregas = Object.keys(map).map(uid => ({ userId: Number(uid), itens: map[uid] }));
    }

    // config persistida (clima etc.) volta no heartbeat: servidor novo já nasce com o estado certo
    const cfg = await pool.query(`SELECT key, value FROM game_config`);
    const config = {};
    for (const r of cfg.rows) config[r.key] = r.value;
    res.json({ ok: true, config, entregas });
  } catch (err) {
    console.error('heartbeat:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/commands/pending?job_id=...  -> marca como 'sent' atomicamente e devolve
router.get('/commands/pending', async (req, res) => {
  try {
    const job = String(req.query.job_id || '');
    if (!job) return res.status(400).json({ error: 'job_id obrigatório' });
    const result = await pool.query(
      `UPDATE game_commands SET status = 'sent', sent_at = NOW()
       WHERE id IN (
         SELECT id FROM game_commands
         WHERE status = 'pending' AND (job_id = $1 OR job_id IS NULL)
           AND created_at > NOW() - INTERVAL '10 minutes'
         ORDER BY id ASC LIMIT 20
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id, tipo, target_roblox_id, target_name, payload, job_id`,
      [job]
    );
    // comandos globais (job_id NULL) ficam marcados como sent pelo primeiro servidor que pegar;
    // pra broadcast real o painel cria um comando por servidor.
    res.json({ commands: result.rows });
  } catch (err) {
    console.error('commands/pending:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/commands/:id/result  { ok: bool, msg: string }
router.post('/commands/:id/result', async (req, res) => {
  try {
    const { ok, msg } = req.body || {};
    await pool.query(
      `UPDATE game_commands SET status = $1, result = $2, executed_at = NOW() WHERE id = $3 AND status = 'sent'`,
      [ok ? 'done' : 'error', String(msg || '').slice(0, 500), req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('commands/result:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/logs  { job_id, eventos: [{ tipo, jogador, alvo, detalhe, t }] }
router.post('/logs', async (req, res) => {
  try {
    const { job_id, eventos } = req.body || {};
    if (!Array.isArray(eventos) || eventos.length === 0) return res.json({ ok: true, n: 0 });
    const lote = eventos.slice(0, 500);
    const values = [];
    const params = [];
    let i = 1;
    for (const e of lote) {
      if (!e || typeof e.tipo !== 'string') continue;
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, to_timestamp($${i++}))`);
      params.push(
        e.tipo.slice(0, 32),
        e.jogador != null ? String(e.jogador).slice(0, 64) : null,
        e.alvo != null ? String(e.alvo).slice(0, 64) : null,
        JSON.stringify(e.detalhe && typeof e.detalhe === 'object' ? e.detalhe : {}),
        job_id ? String(job_id).slice(0, 64) : null,
        Number(e.t) || Math.floor(Date.now() / 1000)
      );
    }
    if (values.length) {
      await pool.query(`INSERT INTO game_logs (tipo, jogador, alvo, detalhe, job_id, ocorrido_em) VALUES ${values.join(',')}`, params);
    }
    // Cada 'entrou' conta uma visita no registro de jogadores
    for (const e of lote) {
      if (!e || e.tipo !== 'entrou' || !e.detalhe) continue;
      const rid = Number(e.detalhe.userId);
      if (!Number.isFinite(rid) || rid <= 0) continue;
      try {
        await pool.query(
          `INSERT INTO game_players (roblox_id, nome) VALUES ($1, $2)
           ON CONFLICT (roblox_id) DO UPDATE SET
             nome = COALESCE(EXCLUDED.nome, game_players.nome),
             ultima_vez = NOW(),
             visitas = game_players.visitas + 1`,
          [rid, e.jogador != null ? String(e.jogador).slice(0, 64) : null]);
      } catch (e2) { /* não derruba o log por causa do registro */ }
    }
    res.json({ ok: true, n: values.length });
  } catch (err) {
    console.error('logs:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/item-fila/entregue  { ids: [...] }  -> jogo confirma que entregou os itens
router.post('/item-fila/entregue', async (req, res) => {
  try {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
    if (!ids.length) return res.json({ ok: true, n: 0 });
    const r = await pool.query(`UPDATE game_item_fila SET entregue_em = NOW() WHERE id = ANY($1) AND entregue_em IS NULL`, [ids.slice(0, 200)]);
    res.json({ ok: true, n: r.rowCount });
  } catch (err) {
    console.error('item-fila/entregue:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ============================================================
// CELULAR — Aparelho com uid (registro + retenção pra perícia da PC)
// Tudo aditivo; o jogo chama por HTTP com a mesma x-api-key.
// ============================================================

// POST /api/game/celular/registrar  { uid, numero, roblox_id, nome }
// Cria/atualiza o aparelho ATIVO de um jogador (chamado quando o jogo dá/garante um A10).
router.post('/celular/registrar', async (req, res) => {
  try {
    const { uid, numero, roblox_id, nome } = req.body || {};
    if (!uid || typeof uid !== 'string' || uid.length > 64) return res.status(400).json({ error: 'uid inválido' });
    if (!numero || typeof numero !== 'string' || numero.length > 24) return res.status(400).json({ error: 'numero inválido' });
    await pool.query(
      `INSERT INTO aparelhos (uid, numero, dono_roblox_id, dono_nome, ativo, atualizado_em)
       VALUES ($1, $2, $3, $4, true, NOW())
       ON CONFLICT (uid) DO UPDATE SET
         numero = EXCLUDED.numero, dono_roblox_id = EXCLUDED.dono_roblox_id,
         dono_nome = EXCLUDED.dono_nome, ativo = true, atualizado_em = NOW()`,
      [uid, numero, Number(roblox_id) || null, nome ? String(nome).slice(0, 64) : null]
    );
    res.json({ ok: true });
  } catch (err) { console.error('celular/registrar:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/game/celular/dono  { uid, roblox_id, nome }
// Campos OPCIONAIS (o jogo manda desde 17/09): de_roblox_id, de_nome, motivo, pos:{x,y,z}
// motivo: dropar · pegar · dar · confisco · revista · olx · portamalas · morte · combatlog · reset · wipe
// Atualiza o dono E grava uma linha no histórico (aba "Rastreio" da perícia da PC).
router.post('/celular/dono', async (req, res) => {
  try {
    const { uid, roblox_id, nome, de_roblox_id, de_nome, motivo, pos } = req.body || {};
    if (!uid) return res.status(400).json({ error: 'uid obrigatório' });
    await pool.query(
      `UPDATE aparelhos SET dono_roblox_id = $2, dono_nome = $3, atualizado_em = NOW() WHERE uid = $1`,
      [uid, Number(roblox_id) || null, nome ? String(nome).slice(0, 64) : null]
    );
    // Só grava histórico quando o jogo disse POR QUE moveu. Chamada antiga (sem
    // motivo) continua funcionando e não polui a tabela.
    if (motivo) {
      await pool.query(
        `INSERT INTO aparelho_donos
           (aparelho_uid, de_roblox_id, de_nome, para_roblox_id, para_nome, motivo, pos_x, pos_y, pos_z)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          String(uid).slice(0, 64),
          Number(de_roblox_id) || null,
          de_nome ? String(de_nome).slice(0, 64) : null,
          Number(roblox_id) || null,
          nome ? String(nome).slice(0, 64) : null,
          String(motivo).slice(0, 24),
          pos && Number.isFinite(Number(pos.x)) ? Number(pos.x) : null,
          pos && Number.isFinite(Number(pos.y)) ? Number(pos.y) : null,
          pos && Number.isFinite(Number(pos.z)) ? Number(pos.z) : null,
        ]
      );
    }
    res.json({ ok: true });
  } catch (err) { console.error('celular/dono:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/game/celular/:uid/donos?limit=50  -> histórico de posse (perícia: aba Rastreio)
router.get('/celular/:uid/donos', async (req, res) => {
  try {
    const uid = String(req.params.uid || '').slice(0, 64);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const r = await pool.query(
      `SELECT de_nome, para_nome, motivo, pos_x, pos_y, pos_z, criado_em
       FROM aparelho_donos WHERE aparelho_uid = $1 ORDER BY id DESC LIMIT $2`,
      [uid, limit]
    );
    res.json({ uid, donos: r.rows });
  } catch (err) { console.error('celular/donos:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/game/celular/wipe  { uid_antigo, uid_novo, numero_novo, roblox_id, nome }
// "Apagar" nas Configs: o antigo vira INATIVO (apagado_em = now, base da retenção) e o novo entra ativo.
router.post('/celular/wipe', async (req, res) => {
  try {
    const { uid_antigo, uid_novo, numero_novo, roblox_id, nome } = req.body || {};
    if (uid_antigo) {
      await pool.query(`UPDATE aparelhos SET ativo = false, apagado_em = NOW(), atualizado_em = NOW() WHERE uid = $1`, [uid_antigo]);
    }
    if (uid_novo && numero_novo) {
      await pool.query(
        `INSERT INTO aparelhos (uid, numero, dono_roblox_id, dono_nome, ativo, atualizado_em)
         VALUES ($1, $2, $3, $4, true, NOW())
         ON CONFLICT (uid) DO UPDATE SET
           numero = EXCLUDED.numero, dono_roblox_id = EXCLUDED.dono_roblox_id,
           dono_nome = EXCLUDED.dono_nome, ativo = true, atualizado_em = NOW()`,
        [uid_novo, String(numero_novo).slice(0, 24), Number(roblox_id) || null, nome ? String(nome).slice(0, 64) : null]
      );
    }
    res.json({ ok: true });
  } catch (err) { console.error('celular/wipe:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/game/celular/pericia/:numero?dias=2
// Perícia da PC: acha o(s) aparelho(s) por número — ativos, ou apagados DENTRO da janela de retenção.
router.get('/celular/pericia/:numero', async (req, res) => {
  try {
    const numero = String(req.params.numero || '').slice(0, 24);
    const dias = Math.min(Math.max(Number(req.query.dias) || 2, 1), 30);
    const r = await pool.query(
      `SELECT uid, numero, dono_roblox_id, dono_nome, criado_em, apagado_em, ativo
       FROM aparelhos
       WHERE numero = $1 AND (ativo = true OR apagado_em > NOW() - (INTERVAL '1 day' * $2))
       ORDER BY atualizado_em DESC`,
      [numero, dias]
    );
    res.json({ numero, janela_dias: dias, aparelhos: r.rows });
  } catch (err) { console.error('celular/pericia:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// ---- Mensagens (RoZap por número) + Contatos ----
function parKey(a, b) { return [String(a), String(b)].sort().join('|'); }

// POST /api/game/celular/msg/enviar  { de, para, texto, pos:{x,y,z}, rua }
router.post('/celular/msg/enviar', async (req, res) => {
  try {
    const { de, para, texto, pos, rua } = req.body || {};
    if (!de || !para || !texto) return res.status(400).json({ error: 'de/para/texto obrigatórios' });
    const p = pos || {};
    const r = await pool.query(
      `INSERT INTO celular_mensagens (de_numero, para_numero, par_key, texto, pos_x, pos_y, pos_z, rua)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, criado_em`,
      [String(de).slice(0,24), String(para).slice(0,24), parKey(de, para), String(texto).slice(0,300),
       Number(p.x)||null, Number(p.y)||null, Number(p.z)||null, rua ? String(rua).slice(0,64) : null]
    );
    res.json({ ok: true, id: r.rows[0].id, criado_em: r.rows[0].criado_em });
  } catch (err) { console.error('celular/msg/enviar:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/game/celular/msg/conversa?a=..&b=..&limit=200  -> histórico da conversa (ordem antiga->nova)
router.get('/celular/msg/conversa', async (req, res) => {
  try {
    const a = String(req.query.a||'').slice(0,24), b = String(req.query.b||'').slice(0,24);
    if (!a || !b) return res.status(400).json({ error: 'a e b obrigatórios' });
    const limit = Math.min(Math.max(Number(req.query.limit)||200, 1), 300);
    const r = await pool.query(
      `SELECT id, de_numero, para_numero, texto, criado_em FROM celular_mensagens
       WHERE par_key = $1 ORDER BY id DESC LIMIT $2`,
      [parKey(a,b), limit]
    );
    res.json({ mensagens: r.rows.reverse() });
  } catch (err) { console.error('celular/msg/conversa:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/game/celular/msg/conversas?numero=..  -> lista de conversas (última msg de cada)
router.get('/celular/msg/conversas', async (req, res) => {
  try {
    const numero = String(req.query.numero||'').slice(0,24);
    if (!numero) return res.status(400).json({ error: 'numero obrigatório' });
    const r = await pool.query(
      `SELECT outro, texto, criado_em FROM (
         SELECT DISTINCT ON (CASE WHEN de_numero = $1 THEN para_numero ELSE de_numero END)
           (CASE WHEN de_numero = $1 THEN para_numero ELSE de_numero END) AS outro, texto, criado_em, id
         FROM celular_mensagens
         WHERE de_numero = $1 OR para_numero = $1
         ORDER BY (CASE WHEN de_numero = $1 THEN para_numero ELSE de_numero END), id DESC
       ) t ORDER BY id DESC LIMIT 100`,
      [numero]
    );
    res.json({ conversas: r.rows });
  } catch (err) { console.error('celular/msg/conversas:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/game/celular/contato  { dono, numero, apelido }
router.post('/celular/contato', async (req, res) => {
  try {
    const { dono, numero, apelido } = req.body || {};
    if (!dono || !numero) return res.status(400).json({ error: 'dono e numero obrigatórios' });
    await pool.query(
      `INSERT INTO celular_contatos (dono_numero, numero, apelido) VALUES ($1,$2,$3)
       ON CONFLICT (dono_numero, numero) DO UPDATE SET apelido = EXCLUDED.apelido`,
      [String(dono).slice(0,24), String(numero).slice(0,24), apelido ? String(apelido).slice(0,64) : null]
    );
    res.json({ ok: true });
  } catch (err) { console.error('celular/contato:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/game/celular/contatos?numero=..
router.get('/celular/contatos', async (req, res) => {
  try {
    const numero = String(req.query.numero||'').slice(0,24);
    if (!numero) return res.status(400).json({ error: 'numero obrigatório' });
    const r = await pool.query(`SELECT numero, apelido, criado_em FROM celular_contatos WHERE dono_numero = $1 ORDER BY apelido NULLS LAST, numero`, [numero]);
    res.json({ contatos: r.rows });
  } catch (err) { console.error('celular/contatos:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/game/celular/aparelhos  -> lista de donos de celular (MESMO OFFLINE), 1 por dono (o ativo).
// O jogo usa isso pra montar a tela de "adicionar contato" (foto + nome), SEM numero visivel.
router.get('/celular/aparelhos', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT DISTINCT ON (dono_roblox_id) numero, dono_roblox_id, dono_nome
       FROM aparelhos
       WHERE ativo = true AND dono_roblox_id IS NOT NULL
       ORDER BY dono_roblox_id, atualizado_em DESC`
    );
    res.json({ aparelhos: r.rows });
  } catch (err) { console.error('celular/aparelhos:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// ===== DEEPWEB (mural anônimo por chip) =====
// POST /api/game/celular/deepweb/postar  { chip_nome, autor_numero, autor_roblox_id, corpo, pos:{x,y,z}, rua }
// Regras (doc): 1 post a cada 2min por chip; corpo<=200; guarda 150 últimos e some em 72h.
router.post('/celular/deepweb/postar', async (req, res) => {
  try {
    const { chip_nome, autor_numero, autor_roblox_id, corpo, pos, rua } = req.body || {};
    if (!chip_nome || !corpo) return res.status(400).json({ error: 'chip_nome e corpo obrigatórios' });
    // cooldown 2 min por chip
    const ult = await pool.query(`SELECT criado_em FROM deepweb_posts WHERE chip_nome = $1 ORDER BY id DESC LIMIT 1`, [String(chip_nome).slice(0,32)]);
    if (ult.rows.length && (Date.now() - new Date(ult.rows[0].criado_em).getTime()) < 120000) {
      return res.status(429).json({ error: 'devagar' });
    }
    await pool.query(
      `INSERT INTO deepweb_posts (chip_nome, autor_numero, autor_roblox_id, corpo, pos_x, pos_y, pos_z, rua)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [String(chip_nome).slice(0,32), autor_numero ? String(autor_numero).slice(0,24) : null, autor_roblox_id || null,
       String(corpo).slice(0,200), pos && pos.x, pos && pos.y, pos && pos.z, rua ? String(rua).slice(0,64) : null]
    );
    // limpeza: some em 72h e mantém só os 150 mais novos
    await pool.query(`DELETE FROM deepweb_posts WHERE criado_em < NOW() - INTERVAL '72 hours'`);
    await pool.query(`DELETE FROM deepweb_posts WHERE id NOT IN (SELECT id FROM deepweb_posts ORDER BY id DESC LIMIT 150)`);
    res.json({ ok: true });
  } catch (err) { console.error('deepweb/postar:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/game/celular/deepweb/feed?limit=150  -> mural: chip_nome + corpo (SEM dados de autor)
router.get('/celular/deepweb/feed', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit)||150, 1), 150);
    const r = await pool.query(`SELECT id, chip_nome, corpo, criado_em FROM deepweb_posts ORDER BY id DESC LIMIT $1`, [limit]);
    res.json({ posts: r.rows });
  } catch (err) { console.error('deepweb/feed:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/game/celular/deepweb/pericia?numero=..  -> só PC: posts daquele número (com chip_nome + rastreio)
router.get('/celular/deepweb/pericia', async (req, res) => {
  try {
    const numero = String(req.query.numero||'').slice(0,24);
    if (!numero) return res.status(400).json({ error: 'numero obrigatório' });
    const r = await pool.query(`SELECT id, chip_nome, corpo, pos_x, pos_y, pos_z, rua, criado_em FROM deepweb_posts WHERE autor_numero = $1 ORDER BY id DESC LIMIT 200`, [numero]);
    res.json({ posts: r.rows });
  } catch (err) { console.error('deepweb/pericia:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

module.exports = router;
