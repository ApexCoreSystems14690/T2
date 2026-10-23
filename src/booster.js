// ============================================================================
// BOOSTER AUTOMÁTICO (22/10/2026)
//
// Pedido do Julio: quem dá boost no Discord do Santa Fé (boost válido, sem
// truque) recebe o benefício SOZINHO ao entrar no jogo, sem staff setando na mão.
//
// Como funciona:
//   1. O heartbeat do jogo diz quem está online. Pra cada um com conta Roblox
//      VINCULADA E VERIFICADA no site, o site pergunta ao Discord (bot) se aquela
//      conta do Discord está boostando o servidor e desde quando (premium_since).
//   2. Se está boostando há pelo menos `carencia_horas`, o que é devido entra:
//        - KIT: uma vez por temporada (por conta do Discord E por conta Roblox);
//        - MESADA: a cada `mesada.dias` dias, enquanto o boost continuar ativo.
//   3. A entrega usa o que o jogo já sabe fazer: dinheiro_add e carro_add (comando
//      pro servidor onde a pessoa está) + fila de itens + uma mensagem no jogo.
//
// As travas contra truque (ver o porquê de cada uma em BRECHAS, no fim):
//   - carência: boostou e tirou logo depois não leva nada;
//   - um kit por temporada por Discord e por Roblox: nem 2 contas, nem 2 Discords;
//   - vínculo verificado: ninguém resgata usando a conta Roblox de outro;
//   - um nível só: o Discord não diz quantos boosts a pessoa deu, então "dei 2"
//     não vale nada aqui;
//   - mesada só enquanto o boost estiver ativo, conferido de novo a cada entrega;
//   - comando que pode ter rodado (ficou "sent" sem resposta) NUNCA é reenviado:
//     vai pra revisão no painel, porque reenviar poderia pagar duas vezes.
// ============================================================================

const PADRAO = {
  ligado: true,
  carencia_horas: 72,
  kit: {
    dinheiro: 30000,
    itens: [
      { item: 'Mochila', qtd: 1 },
      { item: 'Galao de gasolina', qtd: 2 },
      { item: 'Kit de reparo', qtd: 2 },
    ],
    carro: 'GolMi',   // Gol Mi 1997 (ServerStorage.Assets.Carros.GolMi). 'Gol' sozinho não existe no jogo
  },
  mesada: { valor: 5000, dias: 7 },
  checar_discord_min: 10,     // de quanto em quanto tempo reconfere o boost de quem está online
};

const DISCORD_API = 'https://discord.com/api/v10';
const GUILD_PADRAO = { 1: '1544515870154293290' };   // © Santa Fé - RolePlay

// ------------------------------------------------------------ núcleo puro

// Junta o padrão com o que o Dono configurou (game_config 'booster').
function configDe(salvo) {
  const s = (salvo && typeof salvo === 'object') ? salvo : {};
  const kit = Object.assign({}, PADRAO.kit, s.kit || {});
  const mesada = Object.assign({}, PADRAO.mesada, s.mesada || {});
  return Object.assign({}, PADRAO, s, { kit, mesada });
}

// O que esta pessoa deveria receber AGORA.
//   st      = { boostando, desde (ms) }
//   hist    = { kitNestaTemporada (bool), kitDoRobloxNestaTemporada (bool), ultimaMesada (ms|null) }
//   agora   = ms
// Devolve { kit: bool, mesada: bool, motivo }
function devido(cfg, st, hist, agora) {
  if (!cfg.ligado) return { kit: false, mesada: false, motivo: 'desligado' };
  if (!st || !st.boostando || !st.desde) return { kit: false, mesada: false, motivo: 'sem boost' };
  const horas = (agora - st.desde) / 3600000;
  if (horas < cfg.carencia_horas) return { kit: false, mesada: false, motivo: 'carencia' };
  const kit = !hist.kitNestaTemporada && !hist.kitDoRobloxNestaTemporada;
  const prazo = cfg.mesada.dias * 86400000;
  // a primeira mesada vem uma semana depois do kit (o kit já é o "primeiro mês")
  const base = hist.ultimaMesada || hist.kitEm || null;
  const mesada = cfg.mesada.valor > 0 && !kit && base !== null && (agora - base) >= prazo;
  return { kit, mesada, motivo: kit ? 'kit' : (mesada ? 'mesada' : 'em dia') };
}

// ------------------------------------------------------------ banco

async function garantir(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS booster_status (
      cidade_id INTEGER NOT NULL DEFAULT 1,
      discord_id VARCHAR(32) NOT NULL,
      boostando BOOLEAN NOT NULL DEFAULT false,
      desde TIMESTAMPTZ,
      checado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      erro VARCHAR(200),
      PRIMARY KEY (cidade_id, discord_id)
    );
    CREATE TABLE IF NOT EXISTS booster_entregas (
      id SERIAL PRIMARY KEY,
      cidade_id INTEGER NOT NULL DEFAULT 1,
      temporada INTEGER NOT NULL,
      tipo VARCHAR(12) NOT NULL,                 -- kit | mesada
      discord_id VARCHAR(32) NOT NULL,
      user_id INTEGER,
      roblox_id BIGINT NOT NULL,
      nome VARCHAR(64),
      conteudo JSONB NOT NULL DEFAULT '{}',
      cmd_ids JSONB NOT NULL DEFAULT '[]',
      fila_ids JSONB NOT NULL DEFAULT '[]',
      status VARCHAR(12) NOT NULL DEFAULT 'enviando',   -- enviando | entregue | revisar
      tentativas INTEGER NOT NULL DEFAULT 0,
      nota VARCHAR(200),
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      entregue_em TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_booster_kit_discord ON booster_entregas(cidade_id, temporada, discord_id) WHERE tipo = 'kit';
    CREATE UNIQUE INDEX IF NOT EXISTS uq_booster_kit_roblox ON booster_entregas(cidade_id, temporada, roblox_id) WHERE tipo = 'kit';
    CREATE INDEX IF NOT EXISTS idx_booster_ent_status ON booster_entregas(status);
  `);
}

async function lerConfig(pool) {
  try {
    const r = await pool.query(`SELECT value FROM game_config WHERE key = 'booster'`);
    return configDe(r.rows[0] && r.rows[0].value);
  } catch (e) { return configDe(null); }
}
async function temporadaAtual(pool) {
  try {
    const r = await pool.query(`SELECT value FROM game_config WHERE key = 'temporada'`);
    return Math.max(1, parseInt(r.rows[0] && r.rows[0].value && r.rows[0].value.n) || 1);
  } catch (e) { return 1; }
}

// ------------------------------------------------------------ Discord

let _avisouSemToken = false;
// Pergunta ao Discord se a conta está boostando. `fetcher` é injetável (teste).
async function consultarDiscord(guildId, discordId, fetcher) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    if (!_avisouSemToken) { console.warn('[booster] DISCORD_BOT_TOKEN não configurado: boost automático parado até configurar no Railway.'); _avisouSemToken = true; }
    return { ok: false, erro: 'sem token' };
  }
  const f = fetcher || fetch;
  let r;
  try {
    r = await f(`${DISCORD_API}/guilds/${guildId}/members/${discordId}`, { headers: { Authorization: 'Bot ' + token } });
  } catch (e) {
    return { ok: false, erro: 'sem conexão com o Discord' };   // uma falha não derruba a rodada dos outros
  }
  if (r.status === 404) return { ok: true, boostando: false, desde: null };     // não está no servidor
  if (r.status === 429) return { ok: false, erro: 'limite do Discord' };
  if (!r.ok) return { ok: false, erro: 'Discord respondeu ' + r.status };
  const m = await r.json();
  const desde = m && m.premium_since ? Date.parse(m.premium_since) : null;
  return { ok: true, boostando: !!desde, desde };
}

// Status com cache: só pergunta ao Discord se a última conferência passou do prazo.
async function statusDe(pool, cidadeId, guildId, discordId, cfg, fetcher) {
  const c = await pool.query(`SELECT boostando, desde, checado_em FROM booster_status WHERE cidade_id = $1 AND discord_id = $2`, [cidadeId, discordId]);
  const fresco = c.rows[0] && (Date.now() - new Date(c.rows[0].checado_em).getTime()) < cfg.checar_discord_min * 60000;
  if (fresco) return { boostando: c.rows[0].boostando, desde: c.rows[0].desde ? new Date(c.rows[0].desde).getTime() : null };
  const d = await consultarDiscord(guildId, discordId, fetcher);
  if (!d.ok) {
    await pool.query(
      `INSERT INTO booster_status (cidade_id, discord_id, erro, checado_em) VALUES ($1,$2,$3, NOW() - INTERVAL '1 day')
       ON CONFLICT (cidade_id, discord_id) DO UPDATE SET erro = EXCLUDED.erro`, [cidadeId, discordId, d.erro]);
    return null;   // não sabe: não entrega nada
  }
  await pool.query(
    `INSERT INTO booster_status (cidade_id, discord_id, boostando, desde, checado_em, erro) VALUES ($1,$2,$3,$4, NOW(), NULL)
     ON CONFLICT (cidade_id, discord_id) DO UPDATE SET boostando = EXCLUDED.boostando, desde = EXCLUDED.desde, checado_em = NOW(), erro = NULL`,
    [cidadeId, discordId, d.boostando, d.desde ? new Date(d.desde).toISOString() : null]);
  return { boostando: d.boostando, desde: d.desde };
}

// ------------------------------------------------------------ entrega

// [23/10] o envio e a conferência moram em src/entrega.js (a Loja de Royalties usa o mesmo caminho)
const ENTREGA = require('./entrega');

// Cria a entrega (a linha única do kit é a trava contra pagar duas vezes) e manda
// tudo pro jogo numa transação.
async function entregar(pool, { cidadeId, temporada, tipo, discordId, userId, rid, nome, job, cfg }) {
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const conteudo = tipo === 'kit'
      ? { dinheiro: cfg.kit.dinheiro, itens: cfg.kit.itens, carro: cfg.kit.carro || null }
      : { dinheiro: cfg.mesada.valor };
    let ent;
    try {
      ent = (await cli.query(
        `INSERT INTO booster_entregas (cidade_id, temporada, tipo, discord_id, user_id, roblox_id, nome, conteudo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [cidadeId, temporada, tipo, discordId, userId, rid, nome, JSON.stringify(conteudo)])).rows[0];
    } catch (e) {
      await cli.query('ROLLBACK');
      if (e.code === '23505') return { ja: true };     // kit já saiu nesta temporada
      throw e;
    }
    const texto = tipo === 'kit'
      ? 'Obrigado por apoiar o Santa Fé no Discord! Seu kit de patrocinador chegou.'
      : 'Obrigado por continuar apoiando o Santa Fé! Sua mesada de patrocinador caiu na carteira.';
    const { cmds, fila } = await ENTREGA.enviar(cli, { rid, nome, job, conteudo, motivo: 'booster', texto });
    await cli.query(`UPDATE booster_entregas SET cmd_ids = $2, fila_ids = $3 WHERE id = $1`, [ent.id, JSON.stringify(cmds), JSON.stringify(fila)]);
    await cli.query('COMMIT');
    return { id: ent.id, cmds, fila };
  } catch (e) {
    try { await cli.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally { cli.release(); }
}

// Fecha ou corrige as entregas em andamento.
//   comando 'done' + itens entregues        -> entregue
//   comando 'error' (o jogo disse que falhou) -> reenvia, se a pessoa está online (até 5x)
//   comando 'pending' (nunca saiu do site)   -> reenvia no servidor atual da pessoa
//   comando 'sent' sem resposta há 10 min    -> REVISAR (pode ter pago; reenviar pagaria 2x)
async function conferir(pool, online) {
  return ENTREGA.conferir(pool, { tabela: 'booster_entregas', aberto: 'enviando' }, online);
}

// Chamado pelo heartbeat (sem esperar). Uma rodada por vez por processo.
let _rodando = false;
async function aoBatimento(pool, { cidadeId, players, jobId, fetcher }) {
  if (_rodando) return { pulou: true };
  _rodando = true;
  const feito = { checados: 0, kits: 0, mesadas: 0 };
  try {
    const cfg = await lerConfig(pool);
    if (!cfg.ligado) return feito;
    const cid = cidadeId || 1;
    let guild = GUILD_PADRAO[cid] || null;
    try {
      const g = await pool.query(`SELECT discord_guild_id FROM cidades WHERE id = $1`, [cid]);
      if (g.rows[0] && g.rows[0].discord_guild_id) guild = g.rows[0].discord_guild_id;
    } catch (_) { /* coluna ainda não existe: usa o padrão */ }
    if (!guild) return feito;
    const online = new Map();
    for (const p of (players || [])) { const n = Number(p && p.userId); if (n) online.set(n, { job_id: jobId, name: p.name || null }); }
    if (!online.size) return feito;
    const temporada = await temporadaAtual(pool);

    // só conta com vínculo VERIFICADO (o vínculo provado no jogo ou pela bio)
    const us = await pool.query(
      `SELECT id, discord_id, roblox_id FROM users
        WHERE roblox_id = ANY($1::bigint[]) AND roblox_verificado = true AND discord_id NOT LIKE 'roblox_%'`,
      [[...online.keys()]]);
    for (const u of us.rows) {
      const rid = Number(u.roblox_id), on = online.get(rid);
      const st = await statusDe(pool, cid, guild, u.discord_id, cfg, fetcher);
      feito.checados++;
      if (!st) continue;
      const h = await pool.query(
        `SELECT
           bool_or(tipo = 'kit' AND discord_id = $3) AS kit_discord,
           bool_or(tipo = 'kit' AND roblox_id = $4) AS kit_roblox,
           max(criado_em) FILTER (WHERE tipo = 'kit' AND discord_id = $3) AS kit_em,
           max(criado_em) FILTER (WHERE tipo = 'mesada' AND discord_id = $3) AS ultima_mesada
         FROM booster_entregas WHERE cidade_id = $1 AND temporada = $2`, [cid, temporada, u.discord_id, rid]);
      const x = h.rows[0] || {};
      const d = devido(cfg, st, {
        kitNestaTemporada: !!x.kit_discord, kitDoRobloxNestaTemporada: !!x.kit_roblox,
        kitEm: x.kit_em ? new Date(x.kit_em).getTime() : null,
        ultimaMesada: x.ultima_mesada ? new Date(x.ultima_mesada).getTime() : null,
      }, Date.now());
      if (d.kit) {
        const r = await entregar(pool, { cidadeId: cid, temporada, tipo: 'kit', discordId: u.discord_id, userId: u.id, rid, nome: on.name, job: on.job_id, cfg });
        if (!r.ja) feito.kits++;
      } else if (d.mesada) {
        await entregar(pool, { cidadeId: cid, temporada, tipo: 'mesada', discordId: u.discord_id, userId: u.id, rid, nome: on.name, job: on.job_id, cfg });
        feito.mesadas++;
      }
    }
    await conferir(pool, online);
    return feito;
  } catch (e) {
    console.error('[booster]', e.message);
    return feito;
  } finally { _rodando = false; }
}

async function listar(pool, cidadeId) {
  const r = await pool.query(
    `SELECT e.*, s.boostando, s.desde AS boost_desde FROM booster_entregas e
       LEFT JOIN booster_status s ON s.cidade_id = e.cidade_id AND s.discord_id = e.discord_id
      WHERE e.cidade_id = $1 ORDER BY (e.status = 'revisar') DESC, e.id DESC LIMIT 200`, [cidadeId || 1]);
  return r.rows;
}

// BRECHAS que a regra antiga (manual, por ticket) deixava e como cada uma fecha:
//   boostar, pegar tudo e tirar o boost       -> carência + kit 1x por temporada + mesada só com boost ativo
//   dizer "dei 2" sem prova                   -> um nível só (o Discord não informa a contagem)
//   duas contas Roblox no mesmo Discord        -> kit único por Discord na temporada
//   dois Discords na mesma conta Roblox        -> kit único por Roblox na temporada
//   vincular a conta Roblox de outra pessoa    -> exige vínculo verificado
//   pedir "de novo" depois de wipe/atualização -> kit único por temporada, conferido no banco
//   staff setando a mais ou a menos            -> ninguém seta: o site entrega e registra
module.exports = { PADRAO, configDe, devido, garantir, lerConfig, consultarDiscord, statusDe, entregar, conferir, aoBatimento, listar };
