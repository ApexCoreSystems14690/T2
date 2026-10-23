// [23/10] Loja de Royalties — rotas.
//   publico: /royalties (tela) e /api/royalties/* (o jogador, logado e dentro da cidade)
//   admin:   montado em /api/admin/royalties (admin-api), só Diretor Geral+ (poder 'royalties');
//            config do catálogo/motivos só o Dono da cidade.
const express = require('express');
const pool = require('../db/pool');
const CID = require('../cidades');
const R = require('../royalties');
const perm = require('../permissoes');

// ------------------------------------------------------------ jogador
const publico = express.Router();

// Quem pode ver/gastar: conta Roblox VINCULADA E VERIFICADA (senão alguém que digitou o nome
// de outro jogador gastaria os Royalties dele).
function minhaConta(req) {
  const u = req.user;
  if (!u) return { erro: 'Faça login', status: 401 };
  if (!u.roblox_id) return { erro: 'Vincule sua conta Roblox pra usar os Royalties', status: 409, vincular: true };
  if (!u.roblox_verificado) return { erro: 'Verifique sua conta Roblox pra usar os Royalties', status: 409, vincular: true };
  return { rid: Number(u.roblox_id) };
}

publico.get('/royalties', CID.exigeCidade(), (req, res) => {
  if (!req.user) return res.redirect('/');
  const c = minhaConta(req);
  res.render('royalties', { user: req.user, cidade: req.cidade, precisaVincular: !!c.vincular, avisoVinculo: c.erro || null });
});

publico.get('/api/royalties/eu', CID.exigeCidade(), async (req, res) => {
  const c = minhaConta(req);
  if (c.erro) return res.status(c.status).json({ error: c.erro, vincular: !!c.vincular });
  try { res.json(await R.painelDoJogador(pool, req.cidade.id, c.rid)); }
  catch (e) { console.error('royalties/eu:', e.message); res.status(500).json({ error: 'Erro interno' }); }
});

publico.post('/api/royalties/trocar', CID.exigeCidade(), async (req, res) => {
  const c = minhaConta(req);
  if (c.erro) return res.status(c.status).json({ error: c.erro, vincular: !!c.vincular });
  try {
    const r = await R.trocar(pool, req.cidade.id, { rid: c.rid, userId: req.user.id, nome: req.user.roblox_username }, req.body && req.body.item);
    res.json({ ok: true, ...r });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    if (e.code === '23514') return res.status(400).json({ error: 'Saldo insuficiente' });   // CHECK saldo >= 0
    console.error('royalties/trocar:', e.message); res.status(500).json({ error: 'Erro interno' });
  }
});

// saldo pra home do painel (silencioso: sem vínculo = null)
async function saldoDaHome(req) {
  try {
    const u = req.user;
    if (!u || !req.cidade || !u.roblox_id || !u.roblox_verificado) return null;
    return await R.saldoDe(pool, req.cidade.id, Number(u.roblox_id));
  } catch (e) { return null; }
}

// ------------------------------------------------------------ staff (dentro de /api/admin, já com requireAdmin)
const admin = express.Router();
const so = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    if (e.code === '23514') return res.status(400).json({ error: 'Saldo insuficiente' });
    console.error('admin/royalties:', e.message); res.status(500).json({ error: 'Erro interno' });
  }
};
// trava dupla: o poder 'royalties' (min diretor) E o ehDiretorOuMais, no back
admin.use((req, res, next) => {
  if (!perm.ehDiretorOuMais(req.user) || !perm.pode(req.user, 'royalties')) return res.status(403).json({ error: 'Só Diretor Geral pra cima mexe em Royalties' });
  next();
});
async function audit(req, acao, detalhe) {
  try {
    await pool.query('INSERT INTO admin_audit (admin_id, admin_nome, acao, detalhe, cidade_id) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, req.user.discord_username || ('user#' + req.user.id), acao, JSON.stringify(detalhe || {}), req.cidade.id]);
  } catch (e) { console.error('royalties audit:', e.message); }
}
function soDono(req, res, next) {
  if (!perm.ehDonoAqui(req.user)) return res.status(403).json({ error: 'Só o Dono muda o catálogo e os motivos' });
  next();
}

// config + listas pra montar a aba
admin.get('/config', so(async (req, res) => {
  res.json({
    eh_dono: perm.ehDonoAqui(req.user),
    motivos: await R.motivos(pool, req.cidade.id, true),
    catalogo: await R.catalogo(pool, req.cidade.id, true),
    trocas: await R.trocasRecentes(pool, req.cidade.id),
  });
}));

// buscar jogador: nome do Roblox, roblox_id ou Discord (só desta cidade + contas do site)
admin.get('/busca', so(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const num = /^\d+$/.test(q) ? q : null;
  const like = '%' + q.toLowerCase().replace(/[%_]/g, '') + '%';
  const r = await pool.query(
    `SELECT DISTINCT ON (rid) rid AS roblox_id, nome, discord, verificado FROM (
       SELECT u.roblox_id AS rid, u.roblox_username AS nome, u.discord_username AS discord, u.roblox_verificado AS verificado
         FROM users u WHERE u.roblox_id IS NOT NULL AND u.discord_id NOT LIKE 'roblox_%'
          AND (LOWER(COALESCE(u.roblox_username,'')) LIKE $1 OR LOWER(COALESCE(u.discord_username,'')) LIKE $1 OR u.roblox_id::text = $2)
       UNION ALL
       SELECT gp.roblox_id, gp.nome, NULL, NULL FROM game_players gp
        WHERE gp.cidade_id = $3 AND (LOWER(COALESCE(gp.nome,'')) LIKE $1 OR gp.roblox_id::text = $2)
     ) x ORDER BY rid, discord NULLS LAST LIMIT 20`, [like, num || '-', req.cidade.id]);
  const saldos = r.rows.length ? (await pool.query(`SELECT roblox_id, saldo FROM royalties_saldo WHERE cidade_id = $1 AND roblox_id = ANY($2::bigint[])`,
    [req.cidade.id, r.rows.map(x => x.roblox_id)])).rows : [];
  const sm = new Map(saldos.map(s => [String(s.roblox_id), s.saldo]));
  res.json(r.rows.map(x => ({ ...x, saldo: sm.get(String(x.roblox_id)) || 0 })));
}));

admin.get('/trocas', so(async (req, res) => {
  const st = req.query.status ? String(req.query.status).split(',') : null;
  res.json(await R.trocasRecentes(pool, req.cidade.id, st));
}));

admin.post('/creditar', so(async (req, res) => {
  const b = req.body || {};
  const r = await R.creditar(pool, req.cidade.id, b, req.user, perm.ehDonoAqui(req.user));
  await audit(req, 'royalties:creditar', { roblox_id: Number(b.roblox_id), motivo: b.motivo, lancamento: r.id, saldo: r.saldo });
  res.json({ ok: true, ...r });
}));

admin.post('/estornar', so(async (req, res) => {
  const b = req.body || {};
  const r = await R.estornar(pool, req.cidade.id, b, req.user);
  await audit(req, 'royalties:estornar', { lancamento_id: parseInt(b.lancamento_id), estorno: r.id, saldo: r.saldo });
  res.json({ ok: true, ...r });
}));

admin.put('/motivos/:chave', soDono, so(async (req, res) => {
  await R.salvarMotivo(pool, req.cidade.id, req.params.chave, req.body || {});
  await audit(req, 'royalties:motivo', { chave: req.params.chave, mudou: Object.keys(req.body || {}) });
  res.json({ ok: true });
}));

admin.put('/catalogo/:chave', soDono, so(async (req, res) => {
  await R.salvarItem(pool, req.cidade.id, req.params.chave, req.body || {});
  await audit(req, 'royalties:catalogo', { chave: req.params.chave, mudou: req.body || {} });
  res.json({ ok: true });
}));

// por último: /:roblox_id (senão engoliria /config, /busca...)
admin.get('/:roblox_id', so(async (req, res) => {
  const rid = Number(req.params.roblox_id);
  if (!Number.isFinite(rid) || rid <= 0) return res.status(400).json({ error: 'Roblox ID inválido' });
  res.json(await R.extratoStaff(pool, req.cidade.id, rid));
}));

module.exports = { publico, admin, saldoDaHome };
