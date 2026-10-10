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

// ---------------------------------------------------------------------------
// POST /api/game/player/:robloxId/encerrar-personagem
// [09/10 PD] O FIM DE UM PERSONAGEM, num lugar só.
//
// [stated] Julio: "o cara não consegue voltar a jogar, tem que ser PERDA DE
// PERSONAGEM, RESET WIPE MESMO, com o pressuposto de que o personagem antigo foi
// preso, ele é um novo morador" + "emprego no site ele deve ser retirado (o jogo
// vai enviar um sinal pro site tirar ele) (SOMENTE NO WIPE DE JOGADOR INDIVIDUAL)".
//
// O reset do perfil acontece no JOGO (DataHandler, ordem 'resetar'). O que o jogo
// NÃO alcança é o estado que mora aqui: vínculo de corporação, co-gerência e a
// lista de procurados. Sem esta rota o "novo morador" nascia ainda registrado como
// policial e ainda procurado pela própria polícia.
//
// NÃO É O WIPE GERAL. O wipe geral é temporada (GET /temporada) e não passa aqui.
//
// O que NÃO mexo de propósito: `corporations.owner_id`. Apagar o dono de uma corp
// pelo jogo deixaria a corporação órfã, sem ninguém pra administrar o caixa. Se o
// condenado for dono de alguma, devolvo a lista em `dono_de` e a decisão é humana.
//
// Idempotente pela coluna `chave`: a ponte do jogo repete requisição quando a
// resposta não chega, e um PD não pode virar dois registros.
// ---------------------------------------------------------------------------
router.post('/player/:robloxId/encerrar-personagem', async (req, res) => {
  const rid = Number(req.params.robloxId);
  if (!Number.isFinite(rid) || rid <= 0) return res.status(400).json({ error: 'roblox_id inválido' });

  const b = req.body || {};
  const txt = (v, n) => (v != null ? String(v).slice(0, n) : null);
  const lista = (v) => (Array.isArray(v) ? v : []);
  const chave = txt(b.chave, 80) || (rid + ':' + Math.floor(Date.now() / 1000));

  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');

    const u = await cli.query('SELECT id FROM users WHERE roblox_id = $1', [rid]);
    const userId = u.rows[0] && u.rows[0].id;

    // 1) arquiva a ficha. Vai PRIMEIRO: se o resto falhar, o histórico já está salvo.
    const f = await cli.query(
      `INSERT INTO fichas_encerradas
         (chave, roblox_id, nome, estado, motivo, por_nome, corp, prisoes, dividas, resumo)
       VALUES ($1,$2,$3,'preso_permanente',$4,$5,$6,$7,$8,$9)
       ON CONFLICT (chave) DO NOTHING
       RETURNING id`,
      [chave, rid, txt(b.nome, 64), txt(b.motivo, 300), txt(b.por_nome, 64), txt(b.corp, 64),
       JSON.stringify(lista(b.prisoes)), JSON.stringify(lista(b.dividas)),
       b.resumo && typeof b.resumo === 'object' ? JSON.stringify(b.resumo) : null]);

    if (f.rows.length === 0) {
      // já tinha chegado antes: não repete o desvínculo nem o encerramento
      await cli.query('COMMIT');
      return res.json({ ok: true, repetido: true });
    }

    let saiuDe = [], gerencias = 0, donoDe = [], procEncerrados = 0;

    if (userId) {
      // 2) tira de TODAS as corporações
      const m = await cli.query(
        `DELETE FROM members m USING corporations c
          WHERE m.corporation_id = c.id AND m.user_id = $1
          RETURNING c.slug`, [userId]);
      saiuDe = m.rows.map(r => r.slug);

      // 3) tira a co-gerência
      const g = await cli.query('DELETE FROM corp_managers WHERE user_id = $1', [userId]);
      gerencias = g.rowCount || 0;

      // 4) só AVISA se ele era dono — não mexo
      const d = await cli.query('SELECT slug FROM corporations WHERE owner_id = $1', [userId]);
      donoDe = d.rows.map(r => r.slug);
    }

    // 5) procurado some da lista: ele não está foragido, está preso pra sempre
    const pr = await cli.query(
      `UPDATE procurados
          SET estado = 'encerrado', encerrado_em = NOW(), encerrado_por = $2,
              atualizado_em = NOW()
        WHERE roblox_id = $1 AND estado = 'ativo'`,
      [rid, txt(b.por_nome, 64) || 'PD']);
    procEncerrados = pr.rowCount || 0;

    await cli.query('COMMIT');
    res.json({
      ok: true,
      ficha_id: f.rows[0].id,
      saiu_de: saiuDe,
      gerencias_removidas: gerencias,
      dono_de: donoDe,
      procurados_encerrados: procEncerrados,
    });
  } catch (err) {
    await cli.query('ROLLBACK').catch(() => {});
    console.error('game/encerrar-personagem:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  } finally {
    cli.release();
  }
});

// ---------------------------------------------------------------------------
// GET /api/game/player/:robloxId/fichas-encerradas
// A Polícia Civil consultando o arquivo: quem já levou PD, e por quê.
// ---------------------------------------------------------------------------
router.get('/player/:robloxId/fichas-encerradas', async (req, res) => {
  const rid = Number(req.params.robloxId);
  if (!Number.isFinite(rid) || rid <= 0) return res.status(400).json({ error: 'roblox_id inválido' });
  try {
    const r = await pool.query(
      `SELECT id, nome, estado, motivo, por_nome, corp, prisoes, resumo, encerrado_em
         FROM fichas_encerradas WHERE roblox_id = $1 ORDER BY id DESC LIMIT 20`, [rid]);
    res.json({ ok: true, fichas: r.rows });
  } catch (err) {
    console.error('game/fichas-encerradas:', err.message);
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

    // [25/09; corrigido 26/09] SNAPSHOT pra aba ANÁLISE: 1 linha a cada ~1min com o
    // total online AGORA (soma dos players de todos os servidores vivos).
    //
    // BUG QUE ISSO CORRIGE: antes o `NOT EXISTS` ficava no WHERE de um SELECT
    // AGREGADO (SUM/COUNT sem GROUP BY). Quando já havia snapshot recente, o WHERE
    // filtrava as LINHAS de game_servers, mas o agregado sobre conjunto vazio ainda
    // devolve UMA linha (SUM=NULL->0, COUNT=0) -> gravava um ZERO a cada heartbeat.
    // Resultado: milhares de amostras-lixo e a média afogada em zeros.
    // AGORA o agregado vira uma subquery (1 linha só) e o NOT EXISTS gateia ESSA
    // linha: throttle falhou = nenhuma linha = nada gravado; passou = grava o real.
    // Nunca derruba o heartbeat: qualquer erro aqui é engolido.
    try {
      await pool.query(
        `INSERT INTO player_snapshots (jogadores, servidores)
         SELECT j, s FROM (
           SELECT COALESCE(SUM(jsonb_array_length(players)), 0)::int AS j, COUNT(*)::int AS s
             FROM game_servers
         ) x
          WHERE NOT EXISTS (SELECT 1 FROM player_snapshots WHERE criado_em > NOW() - INTERVAL '1 minute')`);
      // retenção: guarda 120 dias de histórico
      await pool.query(`DELETE FROM player_snapshots WHERE criado_em < NOW() - INTERVAL '120 days'`);
    } catch (e) { /* análise nunca pode derrubar o heartbeat do jogo */ }

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
        // [26/09 PROCURADOS] "EM AGUARDO DE DADOS" -> ATIVO.
        // A polícia pode marcar alguém por NOME antes de o cara ter entrado alguma
        // vez; aí o mandado fica sem roblox_id, esperando. Não vence nunca (o Julio:
        // "o aguardando data ta praticamente infinito"). É aqui, no primeiro
        // 'entrou' dele, que o nome vira id e o mandado passa a valer.
        try {
          await pool.query(
            `UPDATE procurados
                SET roblox_id = $1, estado = 'ativo', atualizado_em = NOW()
              WHERE estado = 'aguardo' AND roblox_id IS NULL AND LOWER(nome) = LOWER($2)`,
            [rid, e.jogador != null ? String(e.jogador).slice(0, 64) : '']);
        } catch (e3) { /* idem: nunca derruba o log */ }
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

// ===========================================================================
// PROCURADOS + CADASTRO DE CIDADÃOS  [26/09]
//
// O cadastro de cidadãos NÃO ganhou tabela: `game_players` já é todo mundo que
// entrou (roblox_id, nome, primeira_vez, ultima_vez, visitas), alimentado pelo
// log 'entrou' logo acima. A FOTO sai do roblox_id no lado do jogo
// (Players:GetUserThumbnailAsync funciona online ou offline) — não guardamos
// imagem nenhuma aqui.
//
// A tabela nova é só `procurados`: o mandado que a polícia escreve à mão, com a
// descrição (roupa, cor, cabelo, carro). Estados: ativo | aguardo | encerrado.
// ===========================================================================

// GET /api/game/cidadaos?busca=&limit=&offset=
// A lista da tela "pessoas" do PC da delegacia. Devolve se tem mandado aberto.
router.get('/cidadaos', async (req, res) => {
  try {
    const busca = String(req.query.busca || '').trim().slice(0, 64);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const where = busca ? `WHERE LOWER(gp.nome) LIKE LOWER($3)` : '';
    const params = busca ? [limit, offset, '%' + busca + '%'] : [limit, offset];
    const r = await pool.query(
      `SELECT gp.roblox_id, gp.nome, gp.primeira_vez, gp.ultima_vez, gp.visitas,
              pr.id AS procurado_id, pr.estado AS procurado_estado,
              pr.motivo AS procurado_motivo, pr.descricao AS procurado_descricao
         FROM game_players gp
         LEFT JOIN procurados pr
                ON pr.roblox_id = gp.roblox_id AND pr.estado <> 'encerrado'
         ${where}
        ORDER BY gp.ultima_vez DESC
        LIMIT $1 OFFSET $2`, params);
    res.json({ cidadaos: r.rows });
  } catch (err) { console.error('cidadaos:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/game/cidadaos/:robloxId  -> a ficha de UM cidadão
router.get('/cidadaos/:robloxId', async (req, res) => {
  try {
    const rid = Number(req.params.robloxId);
    if (!Number.isFinite(rid) || rid <= 0) return res.status(400).json({ error: 'roblox_id inválido' });
    const base = await pool.query(
      `SELECT roblox_id, nome, primeira_vez, ultima_vez, visitas FROM game_players WHERE roblox_id = $1`, [rid]);
    const mand = await pool.query(
      `SELECT * FROM procurados WHERE roblox_id = $1 ORDER BY id DESC LIMIT 20`, [rid]);
    res.json({ cidadao: base.rows[0] || null, mandados: mand.rows });
  } catch (err) { console.error('cidadao:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// GET /api/game/procurados?estado=ativo|aguardo|todos
router.get('/procurados', async (req, res) => {
  try {
    const estado = String(req.query.estado || 'abertos');
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
    let sql = `SELECT * FROM procurados WHERE estado <> 'encerrado' ORDER BY id DESC LIMIT $1`;
    let params = [limit];
    if (estado === 'ativo' || estado === 'aguardo' || estado === 'encerrado') {
      sql = `SELECT * FROM procurados WHERE estado = $2 ORDER BY id DESC LIMIT $1`;
      params = [limit, estado];
    } else if (estado === 'todos') {
      sql = `SELECT * FROM procurados ORDER BY id DESC LIMIT $1`;
    }
    const r = await pool.query(sql, params);
    res.json({ procurados: r.rows });
  } catch (err) { console.error('procurados:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/game/procurados
//   { nome, roblox_id?, descricao, motivo, por_roblox_id, por_nome, corp }
// Se o roblox_id não vier, tenta resolver pelo NOME em game_players. Não achou
// (o cara nunca entrou na cidade) -> nasce em 'aguardo', SEM PRAZO, e o primeiro
// 'entrou' dele promove pra 'ativo'.
router.post('/procurados', async (req, res) => {
  try {
    const b = req.body || {};
    const nome = String(b.nome || '').trim().slice(0, 64);
    if (!nome) return res.status(400).json({ error: 'nome obrigatório' });
    let rid = Number(b.roblox_id);
    if (!Number.isFinite(rid) || rid <= 0) {
      const achou = await pool.query(
        `SELECT roblox_id FROM game_players WHERE LOWER(nome) = LOWER($1) LIMIT 1`, [nome]);
      rid = achou.rows[0] ? Number(achou.rows[0].roblox_id) : null;
    }
    const estado = rid ? 'ativo' : 'aguardo';
    if (rid) {
      const jaTem = await pool.query(
        `SELECT id FROM procurados WHERE roblox_id = $1 AND estado <> 'encerrado' LIMIT 1`, [rid]);
      if (jaTem.rows[0]) return res.status(409).json({ error: 'já procurado', id: jaTem.rows[0].id });
    }
    const r = await pool.query(
      `INSERT INTO procurados (roblox_id, nome, descricao, motivo, por_roblox_id, por_nome, corp, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [rid, nome,
       b.descricao ? String(b.descricao).slice(0, 600) : null,
       b.motivo ? String(b.motivo).slice(0, 160) : null,
       Number(b.por_roblox_id) || null,
       b.por_nome ? String(b.por_nome).slice(0, 64) : null,
       b.corp ? String(b.corp).slice(0, 64) : null,
       estado]);
    res.json({ ok: true, procurado: r.rows[0], estado });
  } catch (err) { console.error('procurados/criar:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// POST /api/game/procurados/:id/encerrar   { por_nome }
router.post('/procurados/:id/encerrar', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'id inválido' });
    const por = req.body && req.body.por_nome ? String(req.body.por_nome).slice(0, 64) : null;
    const r = await pool.query(
      `UPDATE procurados SET estado = 'encerrado', encerrado_em = NOW(), encerrado_por = $2,
              atualizado_em = NOW()
        WHERE id = $1 AND estado <> 'encerrado' RETURNING *`, [id, por]);
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado ou já encerrado' });
    res.json({ ok: true, procurado: r.rows[0] });
  } catch (err) { console.error('procurados/encerrar:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// ===========================================================================
// ALERTAS DE COMPRA SUSPEITA (30/09) -- a denuncia automatica que chega no PC
// da Policia Civil quando alguem compra material de fabricar arma pelo cll.
//
// QUEM DECIDE O QUE E SUSPEITO E O JOGO, nao o site: o SuspeitaNucleo le as
// receitas de arma de verdade (Receitas.lua) e pontua. Aqui so guardamos, e a
// razao de guardar e uma so -- a PC precisa ver o alerta DEPOIS que o suspeito
// fechou o jogo. Dado ao vivo do servidor nao serve pra investigacao.
//
// ANTI-PAREDE: dois alertas do mesmo cidadao dentro de AGRUPAR_MIN minutos nao
// viram duas linhas. O segundo SOMA no primeiro e incrementa "vezes". Sem isso
// quem monta 3 CAR15 seguidos enche a aba inteira com o proprio nome e o
// policial perde o resto.
// ===========================================================================
const AGRUPAR_MIN = 10;

// POST /api/game/alertas/compra
// { roblox_id, nome, numero, motivo, nivel, pontos, acumulado, itens, resumo, pedido_id }
router.post('/alertas/compra', async (req, res) => {
  try {
    const b = req.body || {};
    const rid = Number(b.roblox_id);
    if (!Number.isFinite(rid) || rid <= 0) return res.status(400).json({ error: 'roblox_id invalido' });
    const nome = String(b.nome || '').slice(0, 64);
    if (!nome) return res.status(400).json({ error: 'nome obrigatorio' });

    const motivo = ['pedido', 'acumulado'].includes(String(b.motivo)) ? String(b.motivo) : 'pedido';
    const nivel = ['media', 'alta'].includes(String(b.nivel)) ? String(b.nivel) : 'media';
    const numero = b.numero ? String(b.numero).slice(0, 24) : null;
    const pontos = Math.max(0, Math.floor(Number(b.pontos) || 0));
    const acumulado = Math.max(0, Math.floor(Number(b.acumulado) || 0));
    const resumo = String(b.resumo || '').slice(0, 200);
    const pedidoId = b.pedido_id ? String(b.pedido_id).slice(0, 40) : null;
    // itens vem do jogo como [{nome, qtd, pontos}] -- guardamos cru, em jsonb
    const itens = Array.isArray(b.itens) ? b.itens.slice(0, 20) : [];

    // agrupa com o alerta aberto recente do mesmo cidadao, se houver
    const recente = await pool.query(
      `SELECT id FROM alertas_compra
        WHERE roblox_id = $1 AND estado = 'aberto'
          AND atualizado_em > NOW() - ($2 || ' minutes')::interval
        ORDER BY id DESC LIMIT 1`, [rid, String(AGRUPAR_MIN)]);

    if (recente.rows[0]) {
      const r = await pool.query(
        `UPDATE alertas_compra
            SET vezes = vezes + 1,
                pontos = pontos + $2,
                acumulado = GREATEST(acumulado, $3),
                nivel = CASE WHEN $4 = 'alta' THEN 'alta' ELSE nivel END,
                numero = COALESCE($5, numero),
                resumo = $6,
                itens = $7::jsonb,
                atualizado_em = NOW()
          WHERE id = $1 RETURNING *`,
        [recente.rows[0].id, pontos, acumulado, nivel, numero, resumo, JSON.stringify(itens)]);
      return res.json({ ok: true, alerta: r.rows[0], agrupado: true });
    }

    const r = await pool.query(
      `INSERT INTO alertas_compra
         (roblox_id, nome, numero, motivo, nivel, pontos, acumulado, itens, resumo, pedido_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10) RETURNING *`,
      [rid, nome, numero, motivo, nivel, pontos, acumulado, JSON.stringify(itens), resumo, pedidoId]);
    res.json({ ok: true, alerta: r.rows[0], agrupado: false });
  } catch (err) {
    console.error('alertas/compra:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/alertas/compra?estado=aberto|arquivado|todos&limit=
// O que o terminal da PC le. Traz junto se o alvo JA tem mandado aberto, pra
// nao mandar o policial procurar na outra aba.
router.get('/alertas/compra', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);
    const estado = String(req.query.estado || 'aberto');
    let filtro = `WHERE a.estado = 'aberto'`;
    const params = [limit];
    if (estado === 'todos') filtro = '';
    else if (estado === 'arquivado') filtro = `WHERE a.estado = 'arquivado'`;
    const r = await pool.query(
      `SELECT a.*, pr.id AS procurado_id, pr.estado AS procurado_estado
         FROM alertas_compra a
         LEFT JOIN procurados pr
                ON pr.roblox_id = a.roblox_id AND pr.estado <> 'encerrado'
         ${filtro}
        ORDER BY a.id DESC LIMIT $1`, params);
    res.json({ alertas: r.rows });
  } catch (err) {
    console.error('alertas/compra/ler:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/alertas/compra/:id/arquivar   { por_nome }
// "ja investiguei" -- some da lista sem apagar o historico.
router.post('/alertas/compra/:id/arquivar', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'id invalido' });
    const por = req.body && req.body.por_nome ? String(req.body.por_nome).slice(0, 64) : null;
    const r = await pool.query(
      `UPDATE alertas_compra SET estado = 'arquivado', arquivado_em = NOW(),
              arquivado_por = $2, atualizado_em = NOW()
        WHERE id = $1 AND estado = 'aberto' RETURNING *`, [id, por]);
    if (!r.rows[0]) return res.status(404).json({ error: 'nao encontrado ou ja arquivado' });
    res.json({ ok: true, alerta: r.rows[0] });
  } catch (err) {
    console.error('alertas/compra/arquivar:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ===========================================================================
// REEMBOLSO PENDENTE DO MERCADO FECHADO (30/09)
// O cliente paga o pedido na hora. Se ele sai antes da entrega, o jogo nao
// consegue devolver -- perfil de quem deslogou nao esta carregado. Grava aqui e
// acerta no proximo login. Mesmo desenho da OLX (acertarPendencias).
// O "pago" e marcado na MESMA query que le, entao dois servidores lendo junto
// nao pagam duas vezes.
// ===========================================================================

// POST /api/game/mf/reembolso   { roblox_id, nome, valor, pedido_id, motivo }
router.post('/mf/reembolso', async (req, res) => {
  try {
    const b = req.body || {};
    const rid = Number(b.roblox_id);
    const valor = Math.floor(Number(b.valor) || 0);
    if (!Number.isFinite(rid) || rid <= 0) return res.status(400).json({ error: 'roblox_id invalido' });
    if (valor <= 0) return res.status(400).json({ error: 'valor invalido' });
    const r = await pool.query(
      `INSERT INTO mf_reembolsos (roblox_id, nome, valor, pedido_id, motivo)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, valor`,
      [rid, b.nome ? String(b.nome).slice(0, 64) : null, valor,
       b.pedido_id ? String(b.pedido_id).slice(0, 40) : null,
       b.motivo ? String(b.motivo).slice(0, 40) : null]);
    res.json({ ok: true, reembolso: r.rows[0] });
  } catch (err) {
    console.error('mf/reembolso:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/mf/reembolso/acertar   { roblox_id }
// Le e marca como pago numa tacada so. Devolve o total pro jogo creditar.
router.post('/mf/reembolso/acertar', async (req, res) => {
  try {
    const rid = Number((req.body || {}).roblox_id);
    if (!Number.isFinite(rid) || rid <= 0) return res.status(400).json({ error: 'roblox_id invalido' });
    const r = await pool.query(
      `UPDATE mf_reembolsos SET pago_em = NOW()
        WHERE roblox_id = $1 AND pago_em IS NULL
        RETURNING valor, pedido_id`, [rid]);
    const total = r.rows.reduce((s, l) => s + Number(l.valor || 0), 0);
    res.json({ ok: true, total, pedidos: r.rows.length });
  } catch (err) {
    console.error('mf/reembolso/acertar:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/patrimonio  { roblox_id, nome, bolso, banco, level, xp, emprego, carros, casas }
// O jogo manda a foto financeira do jogador no PlayerLeaving. Upsert: sempre a mais recente.
// Funciona com o jogador OFFLINE porque e a ultima foto salva, nao um dado ao vivo.
// [05/10] O jogo empurra os BANS pro site: os feitos in-game (comando/admin dentro do
// servidor) e a varredura do DataStore no boot (os que ja existiam antes do espelho).
// Sem isto a lista do painel so teria os bans dados PELO painel -- ou seja, nasceria vazia.
// Aceita um lote: { bans: [ { roblox_id, nome, motivo, ate, origem } ] }.
// NAO sobrescreve um ban que o painel acabou de dar (origem 'painel' ganha do backfill),
// e NAO ressuscita um ban ja desfeito, a nao ser que venha de novo como ban fresco do jogo.
router.post('/bans', async (req, res) => {
  try {
    const b = req.body || {};
    const lote = Array.isArray(b.bans) ? b.bans : (b.roblox_id ? [b] : []);
    if (lote.length === 0) return res.json({ ok: true, gravados: 0 });
    if (lote.length > 200) return res.status(400).json({ error: 'lote grande demais' });
    let n = 0;
    for (const it of lote) {
      const rid = Number(it.roblox_id);
      if (!Number.isFinite(rid) || rid <= 0) continue;
      const ate = Number.isFinite(Number(it.ate)) ? Math.max(0, Math.floor(Number(it.ate))) : 0;
      const origem = (it.origem === 'jogo' || it.origem === 'backfill') ? it.origem : 'jogo';
      await pool.query(
        `INSERT INTO game_bans (roblox_id, nome, motivo, ate, banido_por, banido_em, origem, desfeito_em, desfeito_por)
         VALUES ($1,$2,$3,$4,$5, NOW(), $6, NULL, NULL)
         ON CONFLICT (roblox_id) DO UPDATE SET
           nome = COALESCE(EXCLUDED.nome, game_bans.nome),
           motivo = COALESCE(EXCLUDED.motivo, game_bans.motivo),
           ate = EXCLUDED.ate,
           origem = EXCLUDED.origem,
           desfeito_em = NULL, desfeito_por = NULL
         WHERE game_bans.desfeito_em IS NOT NULL OR $6 <> 'backfill'`,
        [rid, it.nome != null ? String(it.nome).slice(0, 64) : null,
         it.motivo != null ? String(it.motivo).slice(0, 500) : null,
         ate, it.banido_por != null ? String(it.banido_por).slice(0, 64) : null, origem]);
      n++;
    }
    res.json({ ok: true, gravados: n });
  } catch (err) {
    console.error('game/bans:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// [05/10] quais ids o site AINDA NAO tem -- o jogo usa pra nao reenviar o mundo todo
// a cada boot (mesmo padrao do backfill do patrimonio).
router.get('/bans/faltando', async (req, res) => {
  try {
    const r = await pool.query(`SELECT roblox_id FROM game_bans`);
    res.json({ ok: true, ids: r.rows.map(x => Number(x.roblox_id)) });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

router.post('/patrimonio', async (req, res) => {
  try {
    const b = req.body || {};
    const rid = Number(b.roblox_id);
    if (!Number.isFinite(rid) || rid <= 0) return res.status(400).json({ error: 'roblox_id invalido' });
    const num = (v) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? n : 0; };
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
    const arr = (v) => Array.isArray(v) ? v : [];
    await pool.query(
      `INSERT INTO game_patrimonio (roblox_id, nome, bolso, banco, level, xp, emprego, carros, casas,
                                    prisoes, dividas, divida_estado, divida_recusas, preso, atualizado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, NOW())
       ON CONFLICT (roblox_id) DO UPDATE SET
         nome = COALESCE(EXCLUDED.nome, game_patrimonio.nome),
         bolso = EXCLUDED.bolso, banco = EXCLUDED.banco,
         level = EXCLUDED.level, xp = EXCLUDED.xp, emprego = EXCLUDED.emprego,
         carros = EXCLUDED.carros, casas = EXCLUDED.casas,
         prisoes = EXCLUDED.prisoes, dividas = EXCLUDED.dividas,
         divida_estado = EXCLUDED.divida_estado, divida_recusas = EXCLUDED.divida_recusas,
         preso = EXCLUDED.preso,
         atualizado_em = NOW()`,
      [rid, b.nome != null ? String(b.nome).slice(0, 64) : null,
       num(b.bolso), num(b.banco), num(b.level) || 1, num(b.xp),
       b.emprego != null ? String(b.emprego).slice(0, 64) : null,
       JSON.stringify(obj(b.carros)), JSON.stringify(arr(b.casas)),
       // [09/10 PD] a ficha. Vem como ARRAY do jogo (Prisoes/Dividas sao listas).
       JSON.stringify(arr(b.prisoes)), JSON.stringify(arr(b.dividas)),
       b.divida_estado != null ? String(b.divida_estado).slice(0, 16) : 'Pagando',
       num(b.divida_recusas), num(b.preso)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('patrimonio:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ===========================================================================
// CAIXA E ESTOQUE DA CORPORAÇÃO — o lado do JOGO (28/09)
//
// REGRA DE OURO: o jogo manda o VALOR PAGO pelo infrator e o TIPO da cobrança.
// Quem decide a fatia da corp é o servidor (corp-caixa.RATEIO), nunca o cliente
// — mesmo princípio do talão de multa, onde o cliente manda a chave da infração
// e jamais o valor.
//
// DE ONDE VEM O DINHEIRO: multa, dívida e liberação de pátio já debitavam o
// infrator e não creditavam ninguém — sumia do jogo. Agora metade tem destino.
// ===========================================================================
const caixa = require('../corp-caixa-db');
const CC = require('../corp-caixa');

async function corpPorSlug(slug) {
  const s = String(slug || '').toLowerCase().trim();
  if (!s) return null;
  const r = await pool.query(
    `SELECT id, name, slug FROM corporations WHERE LOWER(slug) = $1 AND is_active LIMIT 1`, [s]);
  // [28/09] O BURACO MAIS SILENCIOSO DO CAIXA: o jogo manda o crédito
  // fire-and-forget. Se o slug não existir aqui, a rota devolve 404, o jogo não
  // olha a resposta e o dinheiro da corp simplesmente SOME -- e o repasse do
  // governo nunca cai pra ela, porque ele só roda pra corp que existe.
  // Um warn nomeando o slug transforma isso num log em vez de um mistério.
  if (!r.rows[0]) console.warn('[corp] slug inexistente ou inativo:', s);
  return r.rows[0] || null;
}

// GET /api/game/corps — os slugs que existem DE VERDADE.
// O jogo confere isto uma vez no boot e grita no console o que estiver faltando,
// em vez de descobrir semanas depois que a SAMU nunca recebeu nada.
router.get('/corps', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT slug, name FROM corporations WHERE is_active ORDER BY slug`);
    res.json({ ok: true, corps: r.rows.map(x => ({ slug: x.slug, nome: x.name })) });
  } catch (err) {
    console.error('corps (lista):', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/corp/caixa  { corp, tipo, valor_pago, quem, por }
// tipo: multa | patio | divida | venda
router.post('/corp/caixa', async (req, res) => {
  try {
    const { corp, tipo, valor_pago, quem, por } = req.body || {};
    if (!CC.RATEIO[String(tipo)] && String(tipo) !== 'venda') {
      return res.status(400).json({ error: 'tipo inválido' });
    }
    const c = await corpPorSlug(corp);
    if (!c) return res.status(404).json({ error: 'corporação não encontrada' });

    // 'venda' (veículo apreendido transferido) vai 100%: o carro já era da
    // apreensão, não é cobrança de ninguém. O resto vai pela fatia do RATEIO.
    const pago = Math.max(0, Math.floor(Number(valor_pago) || 0));
    const parte = String(tipo) === 'venda' ? pago : CC.parteDaCorp(String(tipo), pago);
    if (parte <= 0) return res.json({ ok: true, creditado: 0, motivo: 'fatia zerada' });

    const r = await caixa.movDinheiro(c.id, String(tipo), parte, {
      quem: String(quem || '').slice(0, 64),
      por: String(por || '').slice(0, 64),
      detalhe: { pago },
    });
    if (!r.ok) return res.status(400).json({ error: r.erro });
    // [29/09] SÓ A MULTA CONTA COMO ATIVIDADE AQUI -- ver ATIVIDADES_VALIDAS abaixo.
    // Antes qualquer entrada de dinheiro virava atividade, e isso estava errado em
    // dois níveis: (1) a corp era paga DUAS VEZES pela mesma multa -- 50% na hora e
    // mais o extra no repasse; (2) `divida` cai semanas depois, com o policial
    // offline, e `venda` é clique do comando no painel -- nenhum dos dois é trabalho
    // feito naquela semana. Atividade é OCORRÊNCIA DE TRABALHO, não entrada de caixa.
    if (String(tipo) === 'multa') {
      caixa.registrarAtividade(c.id, 'multa', String(quem || ''));
    }
    res.json({ ok: true, corp: c.slug, creditado: parte, de: pago, saldo: r.saldo });
  } catch (err) {
    console.error('corp/caixa:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ============================================================================
// [30/09/2026, pedido do Julio] TIRAR DINHEIRO DO CAIXA.
//
// O POST /corp/caixa acima só SOMA -- todos os motivos dele são entrada, e o
// jogo manda "o que o infrator pagou", não "o quanto creditar". Pra pagar o
// adicional de salário faltava o contrário, e faltava BLOQUEANTE: o jogo tem
// que saber se o dinheiro saiu ANTES de botar na mão do jogador. Fire-and-forget
// aqui seria dinheiro nascendo do nada toda semana.
// ============================================================================

// POST /api/game/corp/caixa/debitar  { corp, tipo, valor, quem, por }
// tipo: qualquer motivo de saída do núcleo (compra | bonus | ajuste | salario).
// Resposta: { ok: true, saldo } · { ok: false, erro: 'sem_saldo', falta, saldo }
router.post('/corp/caixa/debitar', async (req, res) => {
  try {
    const { corp, tipo, valor, quem, por } = req.body || {};
    const t = String(tipo || '');
    const regra = CC.DINHEIRO[t];
    // Só motivo de SAÍDA. Deixar passar um motivo de entrada aqui viraria a
    // porta dos fundos pra creditar caixa sem cobrança nenhuma no jogo.
    if (!regra || regra.sinal !== -1) return res.status(400).json({ error: 'tipo inválido' });

    const v = Math.max(0, Math.floor(Number(valor) || 0));
    if (v <= 0) return res.status(400).json({ error: 'valor inválido' });

    const c = await corpPorSlug(corp);
    if (!c) return res.status(404).json({ error: 'corporação não encontrada' });

    const r = await caixa.movDinheiro(c.id, t, v, {
      quem: String(quem || '').slice(0, 64),
      por: String(por || quem || '').slice(0, 64),
    });
    // `saldo` é o erro que o núcleo devolve quando o caixa não cobre. Traduzo pra
    // 'sem_saldo' porque é isso que o jogo testa, e mando o que falta junto: o
    // painel consegue dizer "faltaram R$ X" em vez de só "não deu".
    if (!r.ok) {
      return res.json({ ok: false, erro: r.erro === 'saldo' ? 'sem_saldo' : r.erro, falta: r.falta || null });
    }
    res.json({ ok: true, corp: c.slug, debitado: v, saldo: r.saldo });
  } catch (err) {
    console.error('corp/caixa/debitar:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/corp/salario  { corp, roblox_id, quem }
// O JOGO NÃO MANDA O VALOR. Quem sabe quanto é o adicional é o site -- é lá que
// o dono configura, no `ranks.salary` do cargo. Se o jogo mandasse o número,
// bastaria forjar o pedido pra sacar o caixa inteiro.
// Resposta: { ok, adicional, pago, saldo, cargo } · { ok:false, erro }
//   erro 'nao_e_membro'  -> não tem cargo nessa corp: paga só o piso
//   erro 'sem_adicional' -> cargo com adicional 0: paga só o piso (não é falha)
//   erro 'sem_saldo'     -> o caixa não cobre: paga só o piso
router.post('/corp/salario', async (req, res) => {
  try {
    const { corp, roblox_id, quem } = req.body || {};
    const rid = parseInt(roblox_id);
    if (!rid) return res.status(400).json({ error: 'roblox_id inválido' });

    const c = await corpPorSlug(corp);
    if (!c) return res.status(404).json({ error: 'corporação não encontrada' });

    const m = await pool.query(
      `SELECT r.name AS cargo, COALESCE(r.salary, 0) AS adicional
         FROM members mb
         JOIN users u ON u.id = mb.user_id
         LEFT JOIN ranks r ON r.id = mb.rank_id
        WHERE mb.corporation_id = $1 AND u.roblox_id = $2
        LIMIT 1`, [c.id, rid]);
    if (m.rows.length === 0) return res.json({ ok: false, erro: 'nao_e_membro' });

    const adicional = Math.max(0, Math.floor(Number(m.rows[0].adicional) || 0));
    if (adicional <= 0) return res.json({ ok: false, erro: 'sem_adicional', adicional: 0, cargo: m.rows[0].cargo });

    const r = await caixa.movDinheiro(c.id, 'salario', adicional, {
      quem: String(quem || '').slice(0, 64),
      por: String(quem || '').slice(0, 64),
      detalhe: { cargo: m.rows[0].cargo, roblox_id: rid },
    });
    if (!r.ok) {
      return res.json({ ok: false, erro: r.erro === 'saldo' ? 'sem_saldo' : r.erro,
                        adicional, falta: r.falta || null, cargo: m.rows[0].cargo });
    }
    res.json({ ok: true, corp: c.slug, cargo: m.rows[0].cargo, adicional, pago: adicional, saldo: r.saldo });
  } catch (err) {
    console.error('corp/salario:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ============================================================================
// [30/09/2026, pedido do Julio] CONTA EMPRESARIAL NO JOGO, PELO CNPJ.
//
//   "a empresa vai receber um cnpj ... e com esse cnpj ele pode acessar a conta
//    da empresa e ate depositar dinheiro pessoal la, que vai aparecer no painel
//    do T2 como caixa da empresa, afinal empresa nao ganha dinheiro do governo."
//
// O CNPJ é a SENHA da conta: quem tem o número entra. É de propósito -- é assim
// que o dono "entrega a conta" pros sócios dentro do RP, sem precisar de painel.
// Por isso a comparação é feita só com dígitos (o jogador pode digitar com ou
// sem pontuação) e só existe pra corporação com tipo = 'empresa'.
// ============================================================================
function soDigitos(v) { return String(v || '').replace(/\D+/g, ''); }

async function empresaPorCnpj(cnpj) {
  const d = soDigitos(cnpj);
  if (d.length !== 14) return null;
  const r = await pool.query(
    `SELECT c.id, c.name, c.slug, c.cnpj,
            COALESCE((SELECT saldo FROM corp_caixa k WHERE k.corporation_id = c.id), 0) AS saldo
       FROM corporations c
      WHERE c.tipo = 'empresa' AND c.cnpj IS NOT NULL
        AND regexp_replace(c.cnpj, '[^0-9]', '', 'g') = $1
      LIMIT 1`, [d]);
  return r.rows[0] || null;
}

// POST /api/game/empresa/acessar  { cnpj }
router.post('/empresa/acessar', async (req, res) => {
  try {
    const e = await empresaPorCnpj((req.body || {}).cnpj);
    if (!e) return res.json({ ok: false, erro: 'cnpj_invalido' });
    res.json({ ok: true, slug: e.slug, nome: e.name, cnpj: e.cnpj, saldo: Number(e.saldo) });
  } catch (err) {
    console.error('empresa/acessar:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/empresa/deposito  { cnpj, valor, quem, roblox_id }
// O jogo só tira o dinheiro do bolso DEPOIS de ver ok: true -- por isso aqui o
// caixa sobe primeiro e o extrato pessoal depois. Reaproveita o `movDinheiro`
// (motivo 'aporte'), que já trava a linha do caixa numa transação: dois sócios
// depositando ao mesmo tempo não podem perder um dos depósitos.
router.post('/empresa/deposito', async (req, res) => {
  try {
    const { cnpj, valor, quem, roblox_id } = req.body || {};
    const v = Math.max(0, Math.floor(Number(valor) || 0));
    if (v <= 0) return res.json({ ok: false, erro: 'valor_invalido' });

    const e = await empresaPorCnpj(cnpj);
    if (!e) return res.json({ ok: false, erro: 'cnpj_invalido' });

    const r = await caixa.movDinheiro(e.id, 'aporte', v, {
      quem: String(quem || '').slice(0, 64),
      por: String(quem || '').slice(0, 64),
      detalhe: { origem: 'deposito_cnpj', roblox_id: parseInt(roblox_id) || null },
    });
    if (!r.ok) return res.json({ ok: false, erro: r.erro });

    // O extrato de QUEM pôs do próprio bolso fica separado de propósito: em
    // corp_lancamentos interessa o caixa, aqui interessa a dívida da empresa com
    // o sócio. Se este INSERT falhar o dinheiro NÃO some (já está no caixa), mas
    // o registro pessoal sim -- então grita no log em vez de falhar calado.
    try {
      await pool.query(
        `INSERT INTO empresa_depositos (corporation_id, quem, roblox_id, valor)
              VALUES ($1, $2, $3, $4)`,
        [e.id, String(quem || '').slice(0, 64), parseInt(roblox_id) || null, v]);
    } catch (e2) {
      console.error('[empresa/deposito] caixa creditado mas extrato pessoal falhou:', e2.message,
                    { corp: e.slug, quem, valor: v });
    }

    res.json({ ok: true, slug: e.slug, nome: e.name, depositado: v, saldo: r.saldo });
  } catch (err) {
    console.error('empresa/deposito:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/corp/estoque  { corp, motivo, quem, roblox_id, item }
// motivo: retirou | devolveu | saiu | roubada | morreu | recuperou | abasteceu (03/10 SAMU: consumo da maleta)
// O vestiário pergunta ANTES de entregar; se vier `sem_estoque`, não entrega.
router.post('/corp/estoque', async (req, res) => {
  try {
    const { corp, motivo, quem, roblox_id, item } = req.body || {};
    const m = String(motivo || '');
    // `comprou` e `baixa` são do COMANDO, pelo painel — o jogo não cria peça.
    // [30/09] `recuperou` entra aqui: e o armario de devolucao, disparado pelo jogo.
    if (!['retirou', 'devolveu', 'saiu', 'roubada', 'morreu', 'recuperou', 'abasteceu'].includes(m)) {
      return res.status(400).json({ error: 'motivo inválido' });
    }
    const c = await corpPorSlug(corp);
    if (!c) return res.status(404).json({ error: 'corporação não encontrada' });

    const r = await caixa.movEstoque(c.id, m, String(quem || '').slice(0, 64), String(item || '').slice(0, 64),
      { roblox_id: parseInt(roblox_id) || null, por: String(quem || '').slice(0, 64) });
    if (!r.ok) return res.json({ ok: false, erro: r.erro });
    res.json({ ok: true, lancamento: r.lancamento });
  } catch (err) {
    console.error('corp/estoque:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// [05/10] POST /api/game/corp/estoque/lote  { corp, motivo, quem, roblox_id, itens: { item: qtd } }
// Julio: "foto da minha maleta, tudo zerado, compare com o caixa". A maleta da SAMU
// enchia/devolvia UMA unidade por POST: 11 itens x 4 = 44 requisicoes seguidas (~18 s)
// pra encher, e 44 pra devolver quando ela some. Com varios medicos, isso comia o
// teto de HTTP do servidor (400/min) e o que passava do teto simplesmente nao
// voltava pra prateleira -- sobretudo no fechamento do servidor.
// Aqui e 1 requisicao por maleta. Cada unidade continua passando pelo MESMO
// movEstoque (lock, nucleo, lancamento) -- nada de regra nova, so menos viagens.
// motivo: abasteceu (para no 1o sem_estoque de cada item) | recuperou.
// Devolve { ok, itens: { item: quantas_passaram }, erros: { item: erro } }.
const LOTE_MOTIVOS = ['abasteceu', 'recuperou'];
const LOTE_MAX = 120;   // trava de sanidade: maleta cheia sao 44
// [09/10] reposicao automatica por corp: abaixo de `min` na prateleira, compra `itens[x]`.
const REPOR = {
  samu: { min: 10, itens: { 'Fio de sutura': 20, 'Gesso': 20, 'Colar cervical': 20, 'Adrenalina': 20 } },
};
router.post('/corp/estoque/lote', async (req, res) => {
  try {
    const { corp, motivo, quem, roblox_id, itens } = req.body || {};
    const m = String(motivo || '');
    if (!LOTE_MOTIVOS.includes(m)) return res.status(400).json({ error: 'motivo inválido' });
    if (!itens || typeof itens !== 'object') return res.status(400).json({ error: 'itens' });
    const c = await corpPorSlug(corp);
    if (!c) return res.status(404).json({ error: 'corporação não encontrada' });
    const nome = String(quem || '').slice(0, 64);
    const extra = { roblox_id: parseInt(roblox_id) || null, por: nome };
    const feitos = {}, erros = {};
    let total = 0;
    for (const [itemBruto, qBruta] of Object.entries(itens)) {
      const item = String(itemBruto).slice(0, 64);
      const q = Math.max(0, Math.min(20, parseInt(qBruta) || 0));
      feitos[item] = 0;
      for (let i = 0; i < q && total < LOTE_MAX; i++) {
        const r = await caixa.movEstoque(c.id, m, nome, item, extra);
        if (!r.ok) { erros[item] = r.erro; break; }
        feitos[item] += 1; total += 1;
      }
    }
    // [09/10] REPOSICAO AUTOMATICA. Julio: "eles tem muito pouco, gasta rapido, toda
    // hora para acao para comprar mais". Na maleta nova so 4 itens gastam estoque
    // (o basico e infinito e bisturi/desfib sao equipamento). Quando um deles cai
    // abaixo do minimo, o site compra sozinho com o caixa da corp -- mesma funcao
    // `comprar` do painel (dinheiro e estoque na mesma transacao), registrada como
    // "Reposição automática" no extrato. Caixa sem saldo = nao compra, segue a vida.
    const repostos = {};
    const regra = REPOR[c.slug];
    if (regra && m === 'abasteceu') {
      try {
        const tabela = await caixa.precos(c.slug);
        for (const item of Object.keys(regra.itens)) {
          const q = await pool.query(
            `SELECT qtd FROM corp_estoque WHERE corporation_id = $1 AND item = $2`, [c.id, item]);
          const tem = q.rows[0] ? Number(q.rows[0].qtd) : 0;
          if (tem >= regra.min) continue;
          const r = await caixa.comprar(c.id, item, regra.itens[item], tabela, { por: 'Reposição automática' });
          if (r && r.ok) repostos[item] = regra.itens[item];
        }
      } catch (e) { console.error('reposicao automatica:', e.message); }
    }
    // a prateleira como ficou, pro jogo atualizar o que a maleta mostra
    const prateleira = {};
    try {
      const est = await pool.query(`SELECT item, qtd FROM corp_estoque WHERE corporation_id = $1`, [c.id]);
      for (const r of est.rows) prateleira[r.item] = Number(r.qtd);
    } catch (e) {}
    res.json({ ok: true, itens: feitos, erros, repostos, prateleira });
  } catch (err) {
    console.error('corp/estoque/lote:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/corp/:slug/estoque — o que o vestiário tem pra entregar agora.
// O jogo lê isto no boot e guarda; a entrega em si confirma no POST acima.
// [05/10] GET /api/game/corp/:slug/movimentos?horas=6&limite=300 -- AUDITORIA do estoque.
// Julio: "so tinha um cara em servico, com 1 maleta" e mesmo assim 10 colares sumiram da
// prateleira em minutos. O painel NAO mostra movimento de equipamento (de proposito, ver
// painel()), entao nao havia como saber QUEM puxou. Isto e so leitura, protegido pela
// x-api-key do jogo como o resto do router: devolve cada abasteceu/recuperou/retirou... com
// quem, item, quantidade e hora. Agregado por pessoa+motivo+item no fim, pra ler rapido.
router.get('/corp/:slug/movimentos', async (req, res) => {
  try {
    const c = await corpPorSlug(req.params.slug);
    if (!c) return res.status(404).json({ error: 'corporação não encontrada' });
    const horas = Math.max(1, Math.min(72, parseInt(req.query.horas) || 6));
    const limite = Math.max(1, Math.min(1000, parseInt(req.query.limite) || 300));
    const r = await pool.query(
      `SELECT criado_em, motivo, item, qtd, quem, por, valor, tipo
         FROM corp_lancamentos
        WHERE corporation_id = $1 AND criado_em > NOW() - make_interval(hours => $2::int)
        ORDER BY id DESC LIMIT $3`, [c.id, horas, limite]);
    const resumo = {};
    for (const l of r.rows) {
      if (l.tipo !== 'estoque') continue;
      const k = `${l.quem || '?'}|${l.motivo}|${l.item}`;
      resumo[k] = (resumo[k] || 0) + (Number(l.qtd) || 1);
    }
    res.json({ ok: true, corp: c.slug, horas, linhas: r.rows, resumo });
  } catch (err) {
    console.error('corp/movimentos:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/corp/:slug/estoque', async (req, res) => {
  try {
    const c = await corpPorSlug(req.params.slug);
    if (!c) return res.status(404).json({ error: 'corporação não encontrada' });
    const d = await caixa.painel(c.id, 1);
    res.json({ ok: true, corp: c.slug, saldo: d.saldo, itens: d.itens });
  } catch (err) {
    console.error('corp/estoque/ler:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/corp/atividade  { corp, tipo, quem }
// Ocorrência que NÃO move dinheiro -- a SAMU depende disto. Ela não multa, não
// apreende e não cobra dívida, então sem uma via própria ficaria com atividade
// zero e só receberia a base do governo pra sempre.
// tipo livre (reanimacao, atendimento...), guardado como rótulo.
// [29/09] O QUE É UMA "ATIVIDADE" -- a definição mora aqui e em lugar nenhum mais.
// Julio: "nao e definido nem setado em momento algum oque seria uma operacao da
// policia, uma prisao? multa? e do jornal?". Estava mesmo indefinido: valia
// qualquer string que o jogo mandasse, e na prática era "entrou dinheiro".
// Atividade = UM ATO DE TRABALHO, no momento em que acontece:
//   polícia -> prisao | multa | apreensao
//   SAMU     -> reanimacao | estabilizacao
// Jornal e Governo ainda NÃO TÊM fonte de atividade (não existe "publicar matéria"
// nem ato de governo medido no jogo) -- por isso vivem só da base do repasse.
// Tipo fora da lista é recusado: senão um typo no jogo vira métrica fantasma.
const ATIVIDADES_VALIDAS = ['prisao', 'multa', 'apreensao', 'reanimacao', 'estabilizacao'];

router.post('/corp/atividade', async (req, res) => {
  try {
    const { corp, tipo, quem } = req.body || {};
    const t = String(tipo || '').slice(0, 24);
    if (!t) return res.status(400).json({ error: 'tipo vazio' });
    if (!ATIVIDADES_VALIDAS.includes(t)) {
      console.warn('[corp/atividade] tipo desconhecido, ignorado:', t);
      return res.status(400).json({ error: 'tipo de atividade desconhecido', validos: ATIVIDADES_VALIDAS });
    }
    const c = await corpPorSlug(corp);
    if (!c) return res.status(404).json({ error: 'corporação não encontrada' });
    await caixa.registrarAtividade(c.id, t, String(quem || ''));
    res.json({ ok: true });
  } catch (err) {
    console.error('corp/atividade:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/precos  { itens: { "FAL": 8750, ... } }
// O JOGO é dono da tabela de preço (ToolData). O site não tem lista própria de
// propósito: duas listas de preço divergem no primeiro dia. O jogo publica no
// boot e o painel do comandante passa a saber quanto custa cada peça.
router.post('/precos', async (req, res) => {
  try {
    const itens = (req.body && req.body.itens) || {};
    if (typeof itens !== 'object' || Array.isArray(itens)) {
      return res.status(400).json({ error: 'itens tem que ser um objeto' });
    }
    const limpo = {};
    let n = 0;
    for (const [k, v] of Object.entries(itens)) {
      const preco = Math.floor(Number(v) || 0);
      if (k && preco > 0 && n < 500) { limpo[String(k).slice(0, 64)] = preco; n++; }
    }
    await pool.query(
      `INSERT INTO game_config (key, value, updated_at) VALUES ('precos_itens', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify({ itens: limpo })]);

    // [29/09] CATÁLOGO POR CORP: { slug: [itens] } -- o que o vestiário daquela
    // corporação entregava de graça antes. [stated] Julio: o painel tinha "TUDO do
    // jogo praticamente, inclusive armas de crime"; "só deve ter como ele comprar
    // exatamente o que o armário já dava". Preço é global, catálogo é por corp.
    // Vem do próprio Vestuarios do jogo, então nunca sai de sincronia.
    const cat = (req.body && req.body.catalogo) || null;
    let nCat = 0;
    if (cat && typeof cat === 'object' && !Array.isArray(cat)) {
      const limpoCat = {};
      for (const [slug, lista] of Object.entries(cat)) {
        if (!Array.isArray(lista)) continue;
        const itens = lista
          .filter(x => typeof x === 'string' && x)
          .slice(0, 200)
          .map(x => String(x).slice(0, 64));
        limpoCat[String(slug).toLowerCase().slice(0, 64)] = itens;
        nCat++;
      }
      if (nCat) {
        await pool.query(
          `INSERT INTO game_config (key, value, updated_at) VALUES ('catalogo_corps', $1::jsonb, NOW())
           ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
          [JSON.stringify({ corps: limpoCat })]);
      }
    }
    res.json({ ok: true, itens: n, corps: nCat });
  } catch (err) {
    console.error('precos:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/game/dossie/:nome
// [09/10 PD] A ficha de UMA pessoa, pra Policia Civil abrir no PC da Ficha
// mesmo com o jogador OFFLINE.
//
// [stated] Julio: "no pc da policial civil adicione que deve dar para abrir as
// fichas vendo direitinho dados da pessoa, imoveis, patrimonio, se trabalhar em
// alguma corp ou empresa, salario medio, ( para comparar etc )".
//
// O que da pra entregar aqui e o que o ESPELHO tem (game_patrimonio) mais o
// vinculo de corp e o estado de procurado. LIMITE HONESTO: a ficha criminal
// (Prisoes) mora so no perfil do jogo e nao e espelhada -- com o jogador
// offline, o jogo nao manda `prisoes` e o selo nao da pra calcular. O jogo
// sabe disso e escreve na tela.
// ---------------------------------------------------------------------------
router.get('/dossie/:nome', async (req, res) => {
  const nome = String(req.params.nome || '').slice(0, 64);
  if (!nome) return res.status(400).json({ error: 'nome invalido' });
  try {
    const pa = await pool.query(
      `SELECT roblox_id, nome, bolso, banco, level, xp, emprego, carros, casas,
              prisoes, dividas, divida_estado, divida_recusas, preso, atualizado_em
         FROM game_patrimonio WHERE LOWER(nome) = LOWER($1) LIMIT 1`, [nome]);
    if (pa.rows.length === 0) return res.json({ ok: false, erro: 'nao_achei' });
    const p = pa.rows[0];
    const rid = Number(p.roblox_id);

    // corp/empresa e cargo
    let corp = null, cargo = null;
    const u = await pool.query('SELECT id FROM users WHERE roblox_id = $1', [rid]);
    if (u.rows[0]) {
      const m = await pool.query(
        `SELECT c.slug, c.nome AS corp_nome, m.cargo
           FROM members m JOIN corporations c ON c.id = m.corporation_id
          WHERE m.user_id = $1 LIMIT 1`, [u.rows[0].id]);
      if (m.rows[0]) { corp = m.rows[0].corp_nome || m.rows[0].slug; cargo = m.rows[0].cargo; }
    }

    // procurado ativo?
    const pr = await pool.query(
      `SELECT motivo FROM procurados WHERE roblox_id = $1 AND estado = 'ativo' LIMIT 1`, [rid]);

    // ja levou PD alguma vez?
    const fe = await pool.query(
      `SELECT COUNT(*)::int AS n FROM fichas_encerradas WHERE roblox_id = $1`, [rid]);

    res.json({
      ok: true,
      pessoa: {
        roblox_id: rid, nome: p.nome,
        bolso: Number(p.bolso) || 0, banco: Number(p.banco) || 0,
        level: Number(p.level) || 1, xp: Number(p.xp) || 0,
        emprego: p.emprego || '',
        carros: p.carros || {}, casas: p.casas || [],
        corp, cargo,
        procurado: pr.rows[0] ? (pr.rows[0].motivo || 'sim') : null,
        pds_anteriores: fe.rows[0] ? fe.rows[0].n : 0,
        // [09/10] a ficha criminal AGORA vem (o jogo passou a espelhar)
        prisoes: p.prisoes || [],
        dividas: p.dividas || [],
        divida_estado: p.divida_estado || 'Pagando',
        divida_recusas: Number(p.divida_recusas) || 0,
        preso: Number(p.preso) || 0,
        atualizado_em: p.atualizado_em,
      },
    });
  } catch (err) {
    console.error('game/dossie:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/game/ficha/cidade
// [09/10 PD] TODO MUNDO que o espelho conhece, pras abas do PC da Policia Civil.
//
// [stated] Julio: "precisa ver offline tbm, todo mundo, em tudo da pc".
// Antes, Procurados / Na cadeia / Historico / Multas so liam
// `Players:GetPlayers()` -- ou seja, so quem estava no servidor naquele segundo.
//
// Devolve cru e o JOGO monta cada aba (quem tem divida vira Procurado, quem tem
// Preso>0 vira Na cadeia, etc). Assim a regra de negocio continua num lugar so.
// Teto de 300: a ficha e pra consultar, nao pra rolar a cidade inteira.
// ---------------------------------------------------------------------------
router.get('/ficha/cidade', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT roblox_id, nome, bolso, banco, level, emprego,
              prisoes, dividas, divida_estado, divida_recusas, preso, atualizado_em
         FROM game_patrimonio
        ORDER BY atualizado_em DESC NULLS LAST
        LIMIT 300`);
    res.json({
      ok: true,
      pessoas: r.rows.map(p => ({
        roblox_id: Number(p.roblox_id), nome: p.nome,
        bolso: Number(p.bolso) || 0, banco: Number(p.banco) || 0,
        level: Number(p.level) || 1, emprego: p.emprego || '',
        prisoes: p.prisoes || [], dividas: p.dividas || [],
        divida_estado: p.divida_estado || 'Pagando',
        divida_recusas: Number(p.divida_recusas) || 0,
        preso: Number(p.preso) || 0,
      })),
    });
  } catch (err) {
    console.error('game/ficha/cidade:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/patrimonio/ids -> roblox_ids do registro que AINDA NAO tem patrimonio.
// O jogo usa isso pra fazer backfill (ViewProfileAsync read-only) sem esperar o cara sair.
router.get('/patrimonio/ids', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT gp.roblox_id FROM game_players gp
         LEFT JOIN game_patrimonio pa ON pa.roblox_id = gp.roblox_id
        WHERE pa.roblox_id IS NULL
        ORDER BY gp.ultima_vez DESC
        LIMIT 60`);
    res.json({ ok: true, ids: r.rows.map(x => Number(x.roblox_id)) });
  } catch (err) {
    console.error('patrimonio/ids:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ===========================================================================
// OLX (03/10) — o lado do SITE que faltava.
// O jogo chama estas rotas desde 20/09 (SiteCelular.olx*) e elas NUNCA existiram:
// tudo dava 404 e a OLX do cll / o "anunciar" do Meu Patrimonio nao faziam nada.
// REGRAS: 5 anuncios ativos por vendedor (409), vence em 7 dias, quem RESERVA a
// compra e o UPDATE ... WHERE status='ativo' (dois compradores, so um passa).
// Item volta pro dono SO por /olx/devolver, que marca devolvido_em na mesma query
// em que le — nao devolve duas vezes.
// ===========================================================================
const OLX_LIMITE = 5;
const olxId = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : null; };

// GET /api/game/olx/feed?limit=60
router.get('/olx/feed', async (req, res) => {
  try {
    const lim = Math.min(150, Math.max(1, parseInt(req.query.limit) || 60));
    const r = await pool.query(
      `SELECT id, vendedor_id, vendedor_nome, vendedor_numero, item, qtd, preco,
              GREATEST(0, EXTRACT(EPOCH FROM (expira_em - NOW())))::int AS expira_seg
         FROM olx_anuncios
        WHERE status = 'ativo' AND expira_em > NOW()
        ORDER BY id DESC LIMIT $1`, [lim]);
    res.json({ ok: true, anuncios: r.rows });
  } catch (err) {
    console.error('olx/feed:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/olx/meus?roblox_id=
router.get('/olx/meus', async (req, res) => {
  try {
    const rid = olxId(req.query.roblox_id);
    if (!rid) return res.status(400).json({ error: 'roblox_id invalido' });
    const r = await pool.query(
      `SELECT id, vendedor_id, vendedor_nome, item, qtd, preco,
              GREATEST(0, EXTRACT(EPOCH FROM (expira_em - NOW())))::int AS expira_seg
         FROM olx_anuncios
        WHERE vendedor_id = $1 AND status = 'ativo' AND expira_em > NOW()
        ORDER BY id DESC`, [rid]);
    res.json({ ok: true, anuncios: r.rows });
  } catch (err) {
    console.error('olx/meus:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/olx/anunciar { vendedor_id, vendedor_nome, vendedor_numero, item, qtd, preco }
router.post('/olx/anunciar', async (req, res) => {
  const b = req.body || {};
  const rid = olxId(b.vendedor_id);
  const item = String(b.item || '').trim().slice(0, 80);
  const qtd = Math.min(99, Math.max(1, Math.floor(Number(b.qtd) || 1)));
  const preco = Math.floor(Number(b.preco) || 0);
  if (!rid) return res.status(400).json({ error: 'vendedor invalido' });
  if (item.length < 1) return res.status(400).json({ error: 'item invalido' });
  if (preco < 1 || preco > 100000000) return res.status(400).json({ error: 'preco invalido' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // trava por vendedor: dois anuncios simultaneos nao furam o limite
    await client.query('SELECT pg_advisory_xact_lock($1)', [rid]);
    const c = await client.query(
      `SELECT COUNT(*)::int AS n FROM olx_anuncios
        WHERE vendedor_id = $1 AND status = 'ativo' AND expira_em > NOW()`, [rid]);
    if (c.rows[0].n >= OLX_LIMITE) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, erro: 'limite' });
    }
    const r = await client.query(
      `INSERT INTO olx_anuncios (vendedor_id, vendedor_nome, vendedor_numero, item, qtd, preco)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [rid, b.vendedor_nome ? String(b.vendedor_nome).slice(0, 64) : null,
       b.vendedor_numero ? String(b.vendedor_numero).slice(0, 24) : null, item, qtd, preco]);
    await client.query('COMMIT');
    res.json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('olx/anunciar:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  } finally {
    client.release();
  }
});

// POST /api/game/olx/comprar { anuncio_id, comprador_id, comprador_nome }
router.post('/olx/comprar', async (req, res) => {
  const b = req.body || {};
  const id = olxId(b.anuncio_id);
  const cid = olxId(b.comprador_id);
  if (!id || !cid) return res.status(400).json({ error: 'dados invalidos' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE olx_anuncios SET status = 'vendido', fechado_em = NOW()
        WHERE id = $1 AND status = 'ativo' AND expira_em > NOW() AND vendedor_id <> $2
        RETURNING id, vendedor_id, vendedor_nome, item, qtd, preco`, [id, cid]);
    if (!r.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, erro: 'indisponivel' });
    }
    const a = r.rows[0];
    await client.query(
      `INSERT INTO olx_vendas (anuncio_id, vendedor_id, comprador_id, comprador_nome, item, qtd, valor)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [a.id, a.vendedor_id, cid, b.comprador_nome ? String(b.comprador_nome).slice(0, 64) : null,
       a.item, a.qtd, a.preco]);
    await client.query('COMMIT');
    res.json({ ok: true, id: a.id, item: a.item, qtd: a.qtd, preco: Number(a.preco),
               vendedor_id: Number(a.vendedor_id), vendedor_nome: a.vendedor_nome });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('olx/comprar:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  } finally {
    client.release();
  }
});

// POST /api/game/olx/cancelar { anuncio_id, vendedor_id }
// Dois usos: (1) o VENDEDOR tira o anuncio ativo; (2) o jogo DESFAZ uma compra que
// nao fechou (comprador sem saldo, vendedor offline...) mandando o id do COMPRADOR:
// a venda ainda nao paga some e o anuncio volta pro dono como cancelado (o item
// dele volta pelo /olx/devolver).
router.post('/olx/cancelar', async (req, res) => {
  const b = req.body || {};
  const id = olxId(b.anuncio_id);
  const quem = olxId(b.vendedor_id);
  if (!id || !quem) return res.status(400).json({ error: 'dados invalidos' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let r = await client.query(
      `UPDATE olx_anuncios SET status = 'cancelado', fechado_em = NOW()
        WHERE id = $1 AND vendedor_id = $2 AND status = 'ativo' RETURNING id`, [id, quem]);
    if (!r.rows.length) {
      const v = await client.query(
        `DELETE FROM olx_vendas WHERE anuncio_id = $1 AND comprador_id = $2 AND pago_em IS NULL RETURNING id`,
        [id, quem]);
      if (v.rows.length) {
        r = await client.query(
          `UPDATE olx_anuncios SET status = 'cancelado', fechado_em = NOW()
            WHERE id = $1 AND status = 'vendido' RETURNING id`, [id]);
      }
    }
    if (!r.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ ok: false, erro: 'indisponivel' });
    }
    await client.query('COMMIT');
    res.json({ ok: true, id });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('olx/cancelar:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  } finally {
    client.release();
  }
});

// POST /api/game/olx/devolver { roblox_id } -> itens cancelados/vencidos que ainda nao voltaram
router.post('/olx/devolver', async (req, res) => {
  try {
    const rid = olxId((req.body || {}).roblox_id);
    if (!rid) return res.status(400).json({ error: 'roblox_id invalido' });
    const r = await pool.query(
      `UPDATE olx_anuncios
          SET devolvido_em = NOW(),
              status = CASE WHEN status = 'ativo' THEN 'vencido' ELSE status END,
              fechado_em = COALESCE(fechado_em, NOW())
        WHERE vendedor_id = $1 AND devolvido_em IS NULL
          AND (status = 'cancelado' OR (status = 'ativo' AND expira_em <= NOW()))
        RETURNING id, item, qtd`, [rid]);
    res.json({ ok: true, itens: r.rows });
  } catch (err) {
    console.error('olx/devolver:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/olx/creditos { roblox_id } -> dinheiro de venda ainda nao pago ao vendedor
router.post('/olx/creditos', async (req, res) => {
  try {
    const rid = olxId((req.body || {}).roblox_id);
    if (!rid) return res.status(400).json({ error: 'roblox_id invalido' });
    const r = await pool.query(
      `UPDATE olx_vendas SET pago_em = NOW()
        WHERE vendedor_id = $1 AND pago_em IS NULL RETURNING valor`, [rid]);
    const total = r.rows.reduce((s, l) => s + Number(l.valor || 0), 0);
    res.json({ ok: true, total, vendas: r.rows.length });
  } catch (err) {
    console.error('olx/creditos:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
