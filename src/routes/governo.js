// [23/10] Governo — tela /governo e API /api/governo (dentro da cidade).
//   ver:      membros do Governo, qualquer staff da cidade e o Dono
//   retirar obra / configurar (multiplicador, valores das obras): só o Dono da cidade
const express = require('express');
const pool = require('../db/pool');
const CID = require('../cidades');
const GOV = require('../governo');
const perm = require('../permissoes');

const router = express.Router();

async function podeVer(req) {
  if (!req.user || !req.cidade) return false;
  if (perm.ehDonoAqui(req.user) || perm.cargoDe(req.user)) return true;
  const cfg = await GOV.config(pool, req.cidade.id);
  if (!cfg || !cfg.corporation_id) return false;
  const m = await pool.query(`SELECT 1 FROM members WHERE corporation_id = $1 AND user_id = $2`, [cfg.corporation_id, req.user.id]);
  return !!m.rows[0];
}
const so = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('governo:', e.message); res.status(500).json({ error: 'Erro interno' });
  }
};
async function audit(req, acao, detalhe) {
  try {
    await pool.query('INSERT INTO admin_audit (admin_id, admin_nome, acao, detalhe, cidade_id) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, req.user.discord_username || ('user#' + req.user.id), acao, JSON.stringify(detalhe || {}), req.cidade.id]);
  } catch (e) { console.error('governo audit:', e.message); }
}

router.get('/governo', CID.exigeCidade(), so(async (req, res) => {
  if (!req.user) return res.redirect('/');
  if (!(await podeVer(req))) return res.status(403).render('error', { message: 'Só o Governo e a staff veem o caixa do Governo.', user: req.user });
  res.render('governo', { user: req.user, cidade: req.cidade, ehDono: perm.ehDonoAqui(req.user) });
}));

router.get('/api/governo', CID.exigeCidade(), so(async (req, res) => {
  if (!(await podeVer(req))) return res.status(403).json({ error: 'Sem acesso ao Governo' });
  const p = await GOV.painel(pool, req.cidade.id);
  if (!p) return res.status(404).json({ error: 'Esta cidade não tem Governo' });
  res.json({ ...p, eh_dono: perm.ehDonoAqui(req.user) });
}));

function soDono(req, res, next) {
  if (!req.user || !req.cidade) return res.status(401).json({ error: 'Faça login' });
  if (!perm.ehDonoAqui(req.user)) return res.status(403).json({ error: 'Só o Dono mexe no caixa do Governo' });
  next();
}

router.post('/api/governo/obra', CID.exigeCidade(), soDono, so(async (req, res) => {
  const r = await GOV.retirarObra(pool, req.cidade.id, req.body || {}, req.user);
  await audit(req, 'governo:obra', { obra: r.obra, valor: r.valor, lancamento: r.id, descricao: (req.body || {}).descricao });
  res.json({ ok: true, ...r });
}));

router.put('/api/governo/config', CID.exigeCidade(), soDono, so(async (req, res) => {
  await GOV.salvarConfig(pool, req.cidade.id, req.body || {});
  await audit(req, 'governo:config', req.body || {});
  res.json({ ok: true });
}));

router.put('/api/governo/obras/:chave', CID.exigeCidade(), soDono, so(async (req, res) => {
  await GOV.salvarObra(pool, req.cidade.id, req.params.chave, req.body || {});
  await audit(req, 'governo:obra_valor', { chave: req.params.chave, ...(req.body || {}) });
  res.json({ ok: true });
}));

module.exports = router;
module.exports.podeVer = podeVer;
