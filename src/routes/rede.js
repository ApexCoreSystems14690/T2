// [24/10] REDE — a tela da plataforma (acima das cidades).
// [stated] Julio: tela pra escolher e trocar o Dono de cada cidade, "desde que
// somente eu possa fazer isso". Por isso o portão aqui é o ehDono PURO (a conta
// fixa da plataforma, permissoes.DONO_DISCORD / DONO_DISCORD_ID) -- não o
// cargoDe/ehDonoAqui, que também diz 'dono' pro dono de uma cidade. O dono de
// uma cidade NUNCA entra aqui, nem na cidade dele.
//
//   GET  /rede                              a tela
//   GET  /api/rede/cidades                  cidades + dono atual + staff + online
//   GET  /api/rede/usuarios?q=              busca de conta (nome do Discord/Roblox ou id)
//   PUT  /api/rede/cidades/:id/dono         { user_id | null, motivo }
//   GET  /api/rede/cidades/:id/historico    quem foi dono, quem trocou, quando
//   PUT  /api/rede/cidades/:id/place        { place_id | null }  [25/10] place própria da cidade (evento)
const express = require('express');
const pool = require('../db/pool');
const CID = require('../cidades');
const ISO = require('../isolamento');
const perm = require('../permissoes');

const router = express.Router();

// Porta única. Sem login: página volta pro login, API 401. Logado e não é a
// conta da plataforma: 403 (a página nem diz o que tem aqui).
function soPlataforma(req, res, next) {
  const u = req.usuarioPlataforma || null;
  const api = req.originalUrl.startsWith('/api/');
  if (!u) {
    if (api) return res.status(401).json({ error: 'Faça login.' });
    req.session.depoisDoLogin = '/rede';
    return req.session.save(() => res.redirect('/auth/discord'));
  }
  if (!perm.ehDono(u)) {
    if (api) return res.status(403).json({ error: 'Sem permissão.' });
    return res.status(403).render('error', { message: 'Sem permissão.', user: u });
  }
  next();
}

const pessoa = r => r && r.id ? { id: r.id, nome: r.discord_username, roblox: r.roblox_username || null, discord_id: r.discord_id } : null;

router.get('/rede', soPlataforma, (req, res) => {
  res.render('rede', { cidade: null, user: req.usuarioPlataforma });
});

router.get('/api/rede/cidades', soPlataforma, async (req, res) => {
  try {
    const out = await ISO.global(async () => {
      const cs = (await pool.query(
        `SELECT c.id, c.slug, c.nome, c.sigla, c.tipo, c.status, c.cor, c.vagas, c.place_id,
                u.id AS u_id, u.discord_username AS u_nome, u.roblox_username AS u_roblox, u.discord_id AS u_did,
                (SELECT COUNT(*)::int FROM cidade_staff s WHERE s.cidade_id = c.id) AS staff,
                (SELECT MAX(h.em) FROM cidade_donos_hist h WHERE h.cidade_id = c.id) AS trocado_em
           FROM cidades c LEFT JOIN users u ON u.id = c.dono_user_id
          ORDER BY c.ordem, c.id`)).rows;
      const mov = await CID.movimento(pool);
      return cs.map(c => ({
        id: c.id, slug: c.slug, nome: c.nome, sigla: c.sigla, tipo: c.tipo, status: c.status, cor: c.cor, vagas: c.vagas,
        oficial: c.tipo === 'oficial',
        dono: c.tipo === 'oficial' ? { plataforma: true, nome: req.usuarioPlataforma.discord_username }
                                   : pessoa({ id: c.u_id, discord_username: c.u_nome, roblox_username: c.u_roblox, discord_id: c.u_did }),
        staff: c.staff, online: (mov[c.id] || {}).online || 0, trocado_em: c.trocado_em,
        place_id: c.place_id ? String(c.place_id) : null,
      }));
    });
    res.json({ cidades: out });
  } catch (e) {
    console.error('[rede] cidades:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/api/rede/usuarios', soPlataforma, async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 64);
  if (q.length < 2) return res.json({ usuarios: [] });
  try {
    const r = await ISO.global(() => pool.query(
      `SELECT id, discord_id, discord_username, roblox_username
         FROM users
        WHERE discord_id NOT LIKE 'roblox\\_%'
          AND (discord_username ILIKE $1 OR roblox_username ILIKE $1 OR discord_id = $2 OR roblox_id::text = $2)
        ORDER BY (lower(discord_username) = lower($2)) DESC, discord_username
        LIMIT 15`, ['%' + q.replace(/[\\%_]/g, '\\$&') + '%', q]));
    res.json({ usuarios: r.rows.map(pessoa) });
  } catch (e) {
    console.error('[rede] usuarios:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.put('/api/rede/cidades/:id/dono', soPlataforma, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Cidade inválida.' });
  const b = req.body || {};
  let para = null;
  if (b.user_id !== null && b.user_id !== undefined && b.user_id !== '') {
    para = Number(b.user_id);
    if (!Number.isInteger(para) || para <= 0) return res.status(400).json({ error: 'Usuário inválido.' });
  }
  const motivo = String(b.motivo || '').trim().slice(0, 200) || null;
  try {
    const r = await CID.trocarDono(pool, id, para, req.usuarioPlataforma.id, motivo);
    if (r.erro) return res.status(r.status || 400).json({ error: r.erro });
    console.log(`[rede] dono da cidade ${id}: ${r.de || '-'} -> ${r.para || '-'} (por ${req.usuarioPlataforma.discord_username})`);
    res.json({ ok: true });
  } catch (e) {
    console.error('[rede] trocar dono:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// [25/10 EVENTO] a place do Roblox em que a cidade roda (NULL = a place do jogo). Depois de
// publicar a place do evento DENTRO da experiência Santa Fé, a conta da plataforma cola o id aqui
// e o lobby passa a reservar/teleportar pra ela.
router.put('/api/rede/cidades/:id/place', soPlataforma, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Cidade inválida.' });
  try {
    const r = await ISO.global(() => CID.definirPlace(pool, id, (req.body || {}).place_id));
    if (r.erro) return res.status(r.status || 400).json({ error: r.erro });
    console.log(`[rede] place da cidade ${id}: ${r.place_id || 'place do jogo'} (por ${req.usuarioPlataforma.discord_username})`);
    res.json({ ok: true, place_id: r.place_id });
  } catch (e) {
    console.error('[rede] place:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/api/rede/cidades/:id/historico', soPlataforma, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Cidade inválida.' });
  try {
    res.json({ historico: await CID.historicoDono(pool, id, 30) });
  } catch (e) {
    console.error('[rede] historico:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
module.exports.soPlataforma = soPlataforma;
