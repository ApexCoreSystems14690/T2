// [14/10] SEGURANCA DO SITE — anti-alt por IP, vinculo VERIFICADO e o acesso do jogo.
//
// POR QUE O IP MORA AQUI: o servidor do Roblox NAO ve o IP de ninguem (a Roblox nao
// entrega isso pra jogo nenhum). Quem ve e o SITE, quando a pessoa loga pelo Discord.
// Entao o anti-alt por IP funciona assim:
//   1. todo login/visita do site grava um HASH do IP (nunca o IP cru — LGPD);
//   2. a conta do site liga numa conta Roblox VERIFICADA (codigo no jogo ou na bio);
//   3. quando alguem entra no jogo, o jogo pergunta /api/game/acesso/:id e o site cruza:
//      quais outras contas Roblox ja usaram a mesma rede? alguma esta banida?
//
// CGNAT: no Brasil, operadora de celular poe MUITA gente desconhecida no mesmo IP.
// IP visto em mais de MAX_CONTAS_POR_IP contas diferentes e tratado como compartilhado
// e NAO conta como prova de alt. Sem essa trava, banir 1 pessoa bloquearia um bairro.
const crypto = require('crypto');

const MAX_CONTAS_POR_IP = 4;     // acima disso o IP e de operadora/lan house: ignora
const JANELA_DIAS = 60;          // IP velho nao prova nada
const CODIGO_VALIDADE_MIN = 30;

function segredo() {
  return process.env.IP_HASH_SECRET || process.env.SESSION_SECRET || 'dev-ip-hash-apenas-local';
}

// IPv6 troca o final sozinho (endereco temporario): agrupa por /64. IPv4 mapeado vira IPv4.
function normalizarIp(ip) {
  let s = String(ip || '').trim();
  if (!s) return null;
  if (s.startsWith('::ffff:')) s = s.slice(7);
  if (s.includes(':')) {
    const partes = s.split('%')[0].split(':');
    // expande o '::' o suficiente pra pegar os 4 primeiros grupos
    const idx = partes.indexOf('');
    let cheio = partes;
    if (idx !== -1) {
      const falta = 8 - partes.filter(p => p !== '').length;
      cheio = [...partes.slice(0, idx).filter(Boolean), ...Array(falta).fill('0'), ...partes.slice(idx + 1).filter(Boolean)];
    }
    return cheio.slice(0, 4).map(g => (g || '0').toLowerCase()).join(':') + '::/64';
  }
  return s;
}

function hashIp(ip) {
  const n = normalizarIp(ip);
  if (!n) return null;
  return crypto.createHmac('sha256', segredo()).update(n).digest('hex');
}

async function migrar(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_ips (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip_hash CHAR(64) NOT NULL,
      primeira TIMESTAMP DEFAULT NOW(),
      ultima TIMESTAMP DEFAULT NOW(),
      vezes INTEGER DEFAULT 1,
      PRIMARY KEY (user_id, ip_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_user_ips_hash ON user_ips(ip_hash, ultima DESC);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS roblox_verificado BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS vinculo_codigo VARCHAR(12);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS vinculo_codigo_em TIMESTAMP;
    -- [22/10] Roblox que a pessoa diz ser dela mas que já aparece em OUTRA conta sem prova
    -- (placeholder da corp ou alguém que digitou o nome). Fica aqui até ela provar.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS vinculo_pendente_rid BIGINT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS vinculo_pendente_nome VARCHAR(64);
    INSERT INTO game_config (key, value) VALUES ('seguranca', '{"exige_vinculo": false, "bloquear_alt_de_banido": true}')
      ON CONFLICT DO NOTHING;
  `);
}

async function registrarIp(pool, userId, ip) {
  const h = hashIp(ip);
  if (!h || !userId) return null;
  await pool.query(
    `INSERT INTO user_ips (user_id, ip_hash) VALUES ($1, $2)
     ON CONFLICT (user_id, ip_hash) DO UPDATE SET ultima = NOW(), vezes = user_ips.vezes + 1`,
    [userId, h]);
  return h;
}

// middleware: grava o hash 1x por sessao por IP (nao vira 1 query por request)
function middlewareIp(pool) {
  return function (req, res, next) {
    try {
      if (req.user && req.session) {
        const h = hashIp(req.ip);
        if (h && req.session.ipH !== h) {
          req.session.ipH = h;
          registrarIp(pool, req.user.id, req.ip).catch(e => console.error('user_ips:', e.message));
        }
      }
    } catch (e) { /* nunca derruba a pagina por isso */ }
    next();
  };
}

async function config(pool) {
  try {
    const r = await pool.query(`SELECT value FROM game_config WHERE cidade_id = sf_cidade_padrao() AND key = 'seguranca'`);
    const v = (r.rows[0] && r.rows[0].value) || {};
    return {
      exige_vinculo: v.exige_vinculo === true, bloquear_alt_de_banido: v.bloquear_alt_de_banido !== false,
      // [24/10] [stated] Julio: "fortaleça absurdamente o anti alt". Conta Roblox NOVA (menos de
      // N dias) só entra com vínculo VERIFICADO; e o Discord desse vínculo também não pode ser
      // recém-criado. 0 desliga.
      conta_nova_dias: Number.isFinite(Number(v.conta_nova_dias)) ? Math.max(0, Math.floor(Number(v.conta_nova_dias))) : 30,
      discord_min_dias: Number.isFinite(Number(v.discord_min_dias)) ? Math.max(0, Math.floor(Number(v.discord_min_dias))) : 14,
    };
  } catch (e) { return { exige_vinculo: false, bloquear_alt_de_banido: true, conta_nova_dias: 30, discord_min_dias: 14 }; }
}

// Idade (dias) de uma conta do Discord pelo próprio ID (snowflake: ms desde 2015 nos bits altos).
function idadeDiscordDias(discordId, agoraMs) {
  try {
    const s = String(discordId || '');
    if (!/^\d{15,22}$/.test(s)) return null;
    const ms = Number((BigInt(s) >> 22n) + 1420070400000n);
    return Math.floor(((agoraMs || Date.now()) - ms) / 86400000);
  } catch (e) { return null; }
}

// Decisão do anti-alt de conta nova (puro, testável). idadeRoblox = Player.AccountAge (dias).
function decidirContaNova(cfg, idadeRoblox, alt, idadeDiscord) {
  const dias = Number(cfg && cfg.conta_nova_dias) || 0;
  const idade = Number(idadeRoblox);
  if (!dias || !Number.isFinite(idade) || idade < 0 || idade >= dias) return null;
  if (!alt || !alt.verificado) {
    return `Conta Roblox nova (menos de ${dias} dias). Pra jogar no Santa Fé, vincule e verifique ` +
      'sua conta no site (Dashboard → Vincular Roblox → código na BIO do Roblox).';
  }
  const minD = Number(cfg.discord_min_dias) || 0;
  if (minD && idadeDiscord !== null && idadeDiscord !== undefined && idadeDiscord < minD) {
    return `Conta Roblox nova vinculada a um Discord criado há menos de ${minD} dias. ` +
      'Se não for uma conta reserva, abra um ticket no Discord do Santa Fé.';
  }
  return null;
}

// Contas Roblox ligadas por rede a esta. So conta vinculo VERIFICADO dos dois lados.
async function altsDe(pool, robloxId) {
  const rid = Number(robloxId);
  const eu = await pool.query(
    `SELECT id, roblox_verificado, discord_username FROM users WHERE roblox_id = $1`, [rid]);
  const verificado = eu.rows.some(u => u.roblox_verificado);
  const vinculado = eu.rows.length > 0;
  if (!verificado) return { vinculado, verificado, contas: [], ipsCompartilhados: 0, banidaLigada: false };
  const ids = eu.rows.filter(u => u.roblox_verificado).map(u => u.id);
  const r = await pool.query(
    `WITH meus AS (
        SELECT DISTINCT ip_hash FROM user_ips
         WHERE user_id = ANY($1) AND ultima > NOW() - ($2 || ' days')::interval
     ), uso AS (
        SELECT ui.ip_hash, COUNT(DISTINCT ui.user_id) AS n
          FROM user_ips ui JOIN meus m ON m.ip_hash = ui.ip_hash
         WHERE ui.ultima > NOW() - ($2 || ' days')::interval
         GROUP BY ui.ip_hash
     )
     SELECT u.roblox_id, u.roblox_username, u.discord_username, uso.n,
            b.roblox_id IS NOT NULL AS banido
       FROM uso
       JOIN user_ips ui ON ui.ip_hash = uso.ip_hash
       JOIN users u ON u.id = ui.user_id
       LEFT JOIN game_bans b ON b.roblox_id = u.roblox_id AND b.desfeito_em IS NULL
            AND (b.ate IS NULL OR b.ate = 0 OR b.ate > EXTRACT(EPOCH FROM NOW()))
      WHERE NOT (u.id = ANY($1)) AND u.roblox_id IS NOT NULL AND u.roblox_verificado = true
        AND u.roblox_id <> $3
        AND uso.n <= $4`,
    [ids, String(JANELA_DIAS), rid, MAX_CONTAS_POR_IP]);
  const comp = await pool.query(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT ui.ip_hash FROM user_ips ui
        WHERE ui.ip_hash IN (SELECT ip_hash FROM user_ips WHERE user_id = ANY($1))
        GROUP BY ui.ip_hash HAVING COUNT(DISTINCT ui.user_id) > $2) x`,
    [ids, MAX_CONTAS_POR_IP]);
  const vistos = new Map();
  for (const x of r.rows) {
    const k = String(x.roblox_id);
    if (!vistos.has(k)) vistos.set(k, { roblox_id: Number(x.roblox_id), nome: x.roblox_username, discord: x.discord_username, banido: !!x.banido });
    else if (x.banido) vistos.get(k).banido = true;
  }
  const contas = [...vistos.values()];
  return { vinculado, verificado, contas, ipsCompartilhados: comp.rows[0] ? comp.rows[0].n : 0,
    banidaLigada: contas.some(c => c.banido) };
}


// Grava o vinculo PROVADO (codigo no jogo ou na bio do Roblox). Uma transacao so.
async function confirmarVinculo(pool, userId, rid, nome) {
  const user = { id: userId };
  // Quem tinha esse roblox_id SEM prova (roblox_id e UNIQUE, entao no maximo 1 linha):
  //  * PLACEHOLDER (discord_id 'roblox_...', criado quando a corp registrou pelo id):
  //    agora a posse esta PROVADA, entao as filiacoes dele passam pra conta verdadeira --
  //    e exatamente o merge que foi desligado em 05/10 por falta de prova. Nada e apagado:
  //    a linha do placeholder so solta o roblox_id.
  //  * conta real que DIGITOU o nome de outro: perde o vinculo (nunca provou nada).
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const ant = await cli.query(
      `SELECT id, discord_id FROM users WHERE roblox_id = $1 AND id <> $2 AND roblox_verificado = false FOR UPDATE`,
      [rid, user.id]);
    for (const ph of ant.rows) {
      if (String(ph.discord_id || '').startsWith('roblox_')) {
        await cli.query(`UPDATE members SET user_id = $1 WHERE user_id = $2
                           AND corporation_id NOT IN (SELECT corporation_id FROM members WHERE user_id = $1)`, [user.id, ph.id]);
        await cli.query(`UPDATE corp_managers SET user_id = $1 WHERE user_id = $2
                           AND corporation_id NOT IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)`, [user.id, ph.id]);
        await cli.query(`UPDATE corporations SET owner_id = $1 WHERE owner_id = $2`, [user.id, ph.id]);
        console.log('[seguranca] placeholder ' + ph.id + ' fundido no user ' + user.id + ' (posse provada no jogo)');
      }
      await cli.query(`UPDATE users SET roblox_id = NULL, updated_at = NOW() WHERE id = $1`, [ph.id]);
    }
    await cli.query(
      `UPDATE users SET roblox_id = $1, roblox_username = COALESCE($2, roblox_username), roblox_verificado = true,
              vinculo_codigo = NULL, vinculo_codigo_em = NULL,
              vinculo_pendente_rid = NULL, vinculo_pendente_nome = NULL, updated_at = NOW() WHERE id = $3`,
      [rid, nome, user.id]);
    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { cli.release(); }
}

// [25/10] CODIGO EM PALAVRAS. Julio: "mesmo estando linkado ngm consegue entrar". Medido no site:
// de 20 jogadores ativos, so 4 verificados -- 8 linkados SEM verificar. O codigo antigo (8 letras e
// numeros soltos, tipo K7XQ2M9P) e o tipo de texto que o filtro do Roblox troca por #### na bio:
// a pessoa cola, salva, e a bio guarda "########" -> "Nao achei o codigo". Agora sao 3 palavras
// comuns em portugues, SO LETRAS (SOL VERDE PRAIA), que o filtro deixa passar. Guardado sem espaco
// (SOLVERDEPRAIA): a bio e comparada so pelas letras, entao espaco/hifen/minuscula nao atrapalham,
// e o /vincular do jogo (que tira tudo que nao e letra/numero) continua batendo.
const PALAVRAS = ['SOL', 'MAR', 'LUA', 'RIO', 'CEU', 'PRAIA', 'VERDE', 'AZUL', 'BOLA', 'CASA', 'PEIXE', 'GATO',
  'CAFE', 'PAO', 'FLOR', 'PEDRA', 'NUVEM', 'VENTO', 'CHUVA', 'AREIA', 'PONTE', 'TREM', 'BARCO', 'LIVRO',
  'MESA', 'PORTA', 'JANELA', 'FOLHA', 'ARVORE', 'CAMPO', 'MORRO', 'ONDA', 'ESTRELA', 'MANGA', 'LIMAO',
  'UVA', 'MILHO', 'FAROL', 'CANOA', 'TIGRE'];
function novoCodigo() {
  const b = crypto.randomBytes(3);
  return PALAVRAS[b[0] % PALAVRAS.length] + PALAVRAS[b[1] % PALAVRAS.length] + PALAVRAS[b[2] % PALAVRAS.length];
}
// mostra o codigo com espaco entre as palavras (so pra tela)
function codigoLegivel(cod) {
  let s = String(cod || ''), out = [];
  while (s.length) {
    const p = PALAVRAS.filter(w => s.startsWith(w)).sort((a, b) => b.length - a.length)[0];
    if (!p) { out.push(s); break; }
    out.push(p); s = s.slice(p.length);
  }
  return out.join(' ');
}
// a bio tem o codigo? compara SO as letras (ignora espaco, hifen, ponto, minuscula, emoji)
function bioTemCodigo(bio, cod) {
  const so = x => String(x || '').toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '');
  const c = so(cod);
  return c.length >= 4 && so(bio).includes(c);
}

module.exports = { idadeDiscordDias, decidirContaNova, MAX_CONTAS_POR_IP, JANELA_DIAS, CODIGO_VALIDADE_MIN,
  normalizarIp, hashIp, migrar, registrarIp, middlewareIp, config, altsDe, novoCodigo, codigoLegivel, bioTemCodigo, confirmarVinculo };
