// [24/10] Facções Vivas — rotas.
//   faccao: /api/faccao/*          (membro da facção; o back confere tudo)
//   org:    /api/admin/faccoes/*   (poder 'faccoes': Diretor+ e o cargo lateral Organização de Facções)
//   staff:  /api/admin/faccoes-recursos/* (poder 'faccoes_recurso': a staff julga recurso, Art. 9.4)
const express = require('express');
const pool = require('../db/pool');
const CID = require('../cidades');
const F = require('../faccoes-org');
const perm = require('../permissoes');

const so = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    console.error('faccoes-org:', e.message); res.status(500).json({ error: 'Erro interno' });
  }
};
function logado(req, res, next) { if (!req.user || !req.cidade) return res.status(401).json({ error: 'Faça login' }); next(); }

// ------------------------------------------------------------ facção
const faccao = express.Router();
faccao.use('/api/faccao', CID.exigeCidade(), logado);

// o painel da facção: membro dela, ou quem organiza facções / staff com poder de corp
faccao.get('/api/faccao/:corpId/painel', so(async (req, res) => {
  const f = await F.faccao(pool, req.cidade.id, req.params.corpId);
  if (!f) return res.status(404).json({ error: 'Facção não encontrada' });
  const ok = (await F.ehMembro(pool, f.id, req.user.id)) || perm.pode(req.user, 'faccoes') || perm.pode(req.user, 'corp');
  if (!ok) return res.status(403).json({ error: 'Só quem é da facção vê o painel dela' });
  res.json(await F.painel(pool, req.cidade.id, f.id, req.user));
}));
faccao.post('/api/faccao/:corpId/acoes', so(async (req, res) => {
  res.json({ ok: true, ...(await F.enviarAcao(pool, req.cidade.id, req.params.corpId, req.user, req.body || {})) });
}));
faccao.post('/api/faccao/:corpId/advertencias/:advId/recurso', so(async (req, res) => {
  res.json(await F.recorrer(pool, req.cidade.id, req.params.corpId, req.params.advId, req.user, req.body || {}));
}));
faccao.post('/api/faccao/:corpId/lideranca', so(async (req, res) => {
  res.json(await F.passarLideranca(pool, req.cidade.id, req.params.corpId, req.user, req.body || {}));
}));
faccao.post('/api/faccao/pedido', so(async (req, res) => {
  res.json({ ok: true, ...(await F.pedir(pool, req.cidade.id, req.user, req.body || {})) });
}));

// ------------------------------------------------------------ organização (montado em /api/admin)
const org = express.Router();
org.use('/faccoes', (req, res, next) => {
  if (!perm.pode(req.user, 'faccoes')) return res.status(403).json({ error: 'Seu cargo não organiza facções' });
  next();
});
org.get('/faccoes', so(async (req, res) => {
  res.json({ ...(await F.painelOrg(pool, req.cidade.id, req.user)), eh_dono: perm.ehDonoAqui(req.user) });
}));
org.post('/faccoes/pedidos/:id', so(async (req, res) => {
  res.json(await F.decidirPedido(pool, req.cidade.id, req.params.id, req.user, req.body || {}));
}));
org.post('/faccoes/acoes/:id', so(async (req, res) => {
  res.json(await F.decidirAcao(pool, req.cidade.id, req.params.id, req.user, req.body || {}));
}));
org.post('/faccoes/:corpId/nivel', so(async (req, res) => {
  res.json(await F.mudarNivel(pool, req.cidade.id, req.params.corpId, req.user, req.body || {}));
}));
org.post('/faccoes/:corpId/advertencias', so(async (req, res) => {
  res.json({ ok: true, ...(await F.advertir(pool, req.cidade.id, req.params.corpId, req.user, req.body || {})) });
}));
// desoficializar na mão (pedido da facção, Art. 10.1, ou decisão do Dono como a Pavuna). Nada é apagado.
org.post('/faccoes/:corpId/desoficializar', so(async (req, res) => {
  const f = await F.faccao(pool, req.cidade.id, req.params.corpId);
  if (!f || !f.is_active) return res.status(404).json({ error: 'Facção não encontrada' });
  const motivo = String((req.body || {}).motivo || '').trim();
  if (motivo.length < 5) return res.status(400).json({ error: 'Diga o motivo' });
  await F.desoficializar(pool, req.cidade.id, f.id, req.user.discord_username || ('user#' + req.user.id), motivo);
  res.json({ ok: true });
}));

// ------------------------------------------------------------ staff: recursos (Art. 9.4)
org.use('/faccoes-recursos', (req, res, next) => {
  if (!perm.pode(req.user, 'faccoes_recurso')) return res.status(403).json({ error: 'Recurso de facção é julgado pela staff da cidade' });
  next();
});
org.get('/faccoes-recursos', so(async (req, res) => {
  res.json({ recursos: await F.recursosPendentes(pool, req.cidade.id) });
}));
org.post('/faccoes-recursos/:id', so(async (req, res) => {
  res.json(await F.decidirRecurso(pool, req.cidade.id, req.params.id, req.user, req.body || {}));
}));

module.exports = { faccao, org };
