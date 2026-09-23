// Verifica se o usuário está logado (para rotas do dashboard)
function requireAuth(req, res, next) {
  if (req.user) return next();
  res.redirect('/auth/discord');
}

// Verifica API key do Roblox (para rotas da game API)
function requireApiKey(req, res, next) {
  // Ignora espaços/quebras de linha dos dois lados: um paste com quebra a cada
  // 30 caracteres no Railway (já aconteceu) não pode derrubar o jogo inteiro.
  const clean = v => String(v || '').replace(/\s+/g, '');
  // [FIX 23/09 seguranca] SO HEADER. Antes aceitava tambem ?apikey= na URL, e
  // URL vaza em log do Railway, log de proxy e historico -- essa chave e a UNICA
  // barreira da API do jogo inteira (RoZap, deepweb, posse de celular, temporada).
  const key = clean(req.headers['x-api-key']);
  const expected = clean(process.env.ROBLOX_API_KEY);
  if (!expected) {
    console.error('[game-api] ROBLOX_API_KEY não configurada no ambiente');
    return res.status(500).json({ error: 'API key não configurada no servidor' });
  }
  if (req.query && req.query.apikey) {
    console.warn('[seguranca] chamada com ?apikey= na URL, recusada. Use o header x-api-key.');
  }
  // comparacao de tempo constante: com == o tempo de resposta entrega o prefixo
  // certo caractere a caractere.
  const crypto = require('crypto');
  const a = Buffer.from(key || '', 'utf8');
  const b = Buffer.from(expected, 'utf8');
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return res.status(401).json({ error: 'API key inválida' });
  next();
}

// ---------------------------------------------------------------------------
// CONTEXTO DA CORPORAÇÃO (23/09/2026 — reescrito)
//
// ANTES: "dono, co-gerente ou TOP 2 CARGOS". A regra dos top 2 era estrutural e
// invisível: ninguém escolhia quem mandava, a posição na lista de cargos é que
// decidia. Medido: o Jornal Nacional tem 3 cargos, então JORNALISTA mandava na
// redação inteira; uma corp nova entregava gerência aos 2 primeiros cargos
// criados; e como o `isHighRank` só era conferido nas rotas de MEMBRO, o 2º
// cargo editava o PRÓPRIO nível e passava o comandante.
//
// AGORA: quem resolve é `corp-poderes.js`, por PAPEL (staff / dono / gerente /
// chefe / membro). Uma consulta só monta o contexto e todo mundo pergunta pra
// ele. `isOwner`, `isHighRank` e `userRankLevel` continuam sendo preenchidos
// pra não quebrar o código antigo, mas cada rota agora tem a sua guarda.
// ---------------------------------------------------------------------------
const CP = require('../corp-poderes');

async function ctxDaCorp(corpId, user) {
  const pool = require('../db/pool');
  const id = parseInt(corpId);
  if (!id || !user) return null;
  const r = await pool.query(
    `SELECT c.*, (c.icon_data IS NOT NULL) AS has_icon_file,
            (c.owner_id = $2) AS eh_dono,
            EXISTS (SELECT 1 FROM corp_managers cm
                     WHERE cm.corporation_id = c.id AND cm.user_id = $2) AS eh_gerente,
            EXISTS (SELECT 1 FROM members mm
                     WHERE mm.corporation_id = c.id AND mm.user_id = $2) AS sou_membro,
            (SELECT rr.level FROM members mm LEFT JOIN ranks rr ON rr.id = mm.rank_id
              WHERE mm.corporation_id = c.id AND mm.user_id = $2) AS meu_nivel,
            (SELECT rr.permissions FROM members mm LEFT JOIN ranks rr ON rr.id = mm.rank_id
              WHERE mm.corporation_id = c.id AND mm.user_id = $2) AS minhas_permissoes,
            (SELECT MAX(level) FROM ranks WHERE corporation_id = c.id) AS nivel_max,
            (SELECT COUNT(DISTINCT level)::int FROM ranks WHERE corporation_id = c.id) AS qtd_niveis
       FROM corporations c WHERE c.id = $1`,
    [id, user.id]
  );
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  const ctx = {
    ehStaffCorp: require('../permissoes').pode(user, 'corp'),
    ehDono:      !!row.eh_dono,
    ehGerente:   !!row.eh_gerente,
    souMembro:   !!row.sou_membro,
    meuNivel:    row.meu_nivel === null || row.meu_nivel === undefined ? null : Number(row.meu_nivel),
    nivelMax:    row.nivel_max === null || row.nivel_max === undefined ? null : Number(row.nivel_max),
    qtdNiveis:   Number(row.qtd_niveis || 0),
    permissoes:  row.minhas_permissoes || {},
  };
  return { corp: row, ctx, papel: CP.papelDe(ctx), poderes: CP.poderesDe(ctx) };
}

// Portão de entrada do painel da corporação. Só entra quem tem `ver_painel`.
async function requireCorpOwner(req, res, next) {
  try {
    const corpId = req.params.corpId || req.body.corporation_id;
    const info = await ctxDaCorp(corpId, req.user);
    if (!info) return res.status(404).json({ error: 'Corporação não encontrada' });
    if (!CP.pode(info.ctx, 'ver_painel')) {
      return res.status(403).json({ error: 'Você não gerencia esta corporação' });
    }
    req.corporation = info.corp;
    req.corpCtx     = info.ctx;
    req.papelCorp   = info.papel;
    req.corpPoderes = info.poderes;
    // compatibilidade com o código antigo
    req.isOwner       = info.papel === 'dono' || info.papel === 'staff';
    req.isHighRank    = info.papel === 'chefe';
    req.userRankLevel = CP.semTeto(info.ctx) ? Infinity : info.ctx.meuNivel;
    return next();
  } catch (err) {
    console.error('ctxDaCorp:', err.message);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

// Guarda por poder dentro da corp. Usar SEMPRE depois de requireCorpOwner.
function requireCorpPoder(poder) {
  return function (req, res, next) {
    if (!req.corpCtx) return res.status(403).json({ error: 'Acesso negado' });
    if (CP.pode(req.corpCtx, poder)) return next();
    return res.status(403).json({
      error: 'Seu cargo nesta corporação não permite: ' + (CP.ROTULO[poder] || poder),
      seu_papel: req.papelCorp || null,
    });
  };
}

// Verifica se é staff (qualquer cargo). O que ele PODE fazer dentro do painel é
// decidido por requirePoder, cargo a cargo.
// [19/09] Pergunta pro permissoes.js em vez de olhar is_admin cru: a conta Dono
// é fixa no código e tem que entrar mesmo que o banco esteja errado sobre ela.
function requireAdmin(req, res, next) {
  if (req.user && require('../permissoes').cargoDe(req.user)) return next();
  res.status(403).json({ error: 'Acesso negado' });
}

// [19/09] Portão por PODER. O front esconde botão; quem barra é isto aqui, em
// cada request. Sem este middleware, um admin de cargo baixo mandando POST na
// mão continuaria fazendo tudo.
const perm = require('../permissoes');
function requirePoder(poder) {
  return function (req, res, next) {
    // olha o CARGO, nao o is_admin cru -- senao a conta Dono passaria pelo
    // requireAdmin e travaria aqui, se o banco estivesse errado sobre ela
    if (!req.user || !perm.cargoDe(req.user)) return res.status(403).json({ error: 'Acesso negado' });
    if (perm.pode(req.user, poder)) return next();
    const p = perm.PODERES[poder];
    const meu = perm.CARGOS[perm.cargoDe(req.user)];
    return res.status(403).json({
      error: 'Seu cargo não permite: ' + ((p && p.rotulo) || poder),
      seu_cargo: meu ? meu.nome : null,
      precisa: p ? (perm.CARGOS[p.min] || {}).nome : null,
    });
  };
}

module.exports = { requireAuth, requireApiKey, requireCorpOwner, requireCorpPoder, ctxDaCorp, requireAdmin, requirePoder };
