// [22/10] Regulamentos de cada cidade: páginas públicas + editor do Dono da cidade.
//
// PÚBLICO (sem login, não muda a cidade da sessão):
//   GET /cidade/:slug/regras               lista dos documentos daquela cidade
//   GET /cidade/:slug/regras/:doc          o documento desenhado (sumário, busca, link por artigo)
//   GET /cidade/:slug/regras/:doc/pdf      o PDF original
// EDITOR (logado, cidade da sessão, só o Dono DESTA cidade):
//   GET  /painel/regras                    tela de edição
//   GET  /api/regras                       lista (com arquivados)
//   GET  /api/regras/:doc                  documento com o texto
//   PUT  /api/regras/:doc                  dados (JSON: titulo, versao, status, ...)
//   PUT  /api/regras/:doc/texto            o texto (text/plain)
//   POST /api/regras/:doc/pdf              o PDF (application/pdf)
//   POST /api/regras/previa                desenha um texto sem salvar (text/plain)
//   GET  /api/regras/:doc/historico        versões anteriores
//   POST /api/regras/:doc/restaurar/:hid   volta pra uma versão
const express = require('express');
const pool = require('../db/pool');
const CID = require('../cidades');
const RG = require('../regulamentos');
const perm = require('../permissoes');

const router = express.Router();
const texto = express.text({ type: ['text/plain', 'text/markdown'], limit: '1mb' });
const pdfBody = express.raw({ type: 'application/pdf', limit: '9mb' });

async function cidadeDoSlug(slug) {
  if (!CID.slugValido(slug)) return null;
  const c = await CID.porSlug(pool, slug);
  return c && c.status !== 'fechada' ? c : null;
}

function dataBR(d) {
  if (!d) return null;
  // DATE do Postgres chega como meia-noite LOCAL: lê no fuso local, senão vira o dia anterior
  if (typeof d === 'string') { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d); return m ? `${m[3]}/${m[2]}/${m[1]}` : null; }
  const x = new Date(d);
  if (isNaN(x)) return null;
  const z = n => String(n).padStart(2, '0');
  return `${z(x.getDate())}/${z(x.getMonth() + 1)}/${x.getFullYear()}`;
}

// ------------------------------------------------------------------ público
router.get('/cidade/:slug/regras', async (req, res) => {
  try {
    const c = await cidadeDoSlug(req.params.slug);
    if (!c) return res.status(404).render('error', { message: 'Cidade não encontrada', user: req.user || null });
    const docs = await RG.listar(pool, c.id, true);
    res.render('regras', { modo: 'lista', c, docs, d: null, r: null, dataBR, user: req.user || null,
      cidade: (req.cidade && req.cidade.id === c.id) ? req.cidade : null, podeEditar: podeEditar(req, c) });
  } catch (e) { console.error('regras lista:', e.message); res.status(500).render('error', { message: 'Erro interno', user: req.user || null }); }
});

router.get('/cidade/:slug/regras/:doc', async (req, res) => {
  try {
    const c = await cidadeDoSlug(req.params.slug);
    if (!c || !RG.slugOk(req.params.doc)) return res.status(404).render('error', { message: 'Documento não encontrado', user: req.user || null });
    const d = await RG.doc(pool, c.id, req.params.doc, true);
    if (!d || d.status === 'arquivado') return res.status(404).render('error', { message: 'Documento não encontrado', user: req.user || null });
    const docs = await RG.listar(pool, c.id, true);
    const temOficial = docs.some(x => x.slug === 'oficial') && d.slug !== 'oficial';
    const r = RG.renderizar(d.conteudo, { linkOficial: temOficial ? `/cidade/${c.slug}/regras/oficial` : null });
    res.render('regras', { modo: 'doc', c, docs, d, r, dataBR, user: req.user || null,
      cidade: (req.cidade && req.cidade.id === c.id) ? req.cidade : null, podeEditar: podeEditar(req, c) });
  } catch (e) { console.error('regras doc:', e.message); res.status(500).render('error', { message: 'Erro interno', user: req.user || null }); }
});

router.get('/cidade/:slug/regras/:doc/pdf', async (req, res) => {
  try {
    const c = await cidadeDoSlug(req.params.slug);
    const p = c && RG.slugOk(req.params.doc) ? await RG.pdfDe(pool, c.id, req.params.doc) : null;
    if (!p) return res.status(404).send('PDF não encontrado');
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${p.pdf_nome || req.params.doc + '.pdf'}"`);
    res.set('Cache-Control', 'public, max-age=300');
    res.send(p.pdf);
  } catch (e) { console.error('regras pdf:', e.message); res.status(500).send('Erro'); }
});

// ------------------------------------------------------------------ editor
function podeEditar(req, c) {
  return !!(req.user && req.cidade && c && req.cidade.id === c.id && perm.ehDonoAqui(req.user));
}
function portao(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Faça login.' });
  if (!req.cidade) return res.status(409).json({ error: 'Escolha a cidade primeiro.', escolher_cidade: true });
  if (!perm.ehDonoAqui(req.user)) return res.status(403).json({ error: 'Só o Dono da cidade edita o regulamento.' });
  next();
}
async function audit(req, acao, detalhe) {
  try {
    await pool.query('INSERT INTO admin_audit (admin_id, admin_nome, acao, detalhe, cidade_id) VALUES ($1,$2,$3,$4,$5)',
      [req.user.id, req.user.discord_username || ('user#' + req.user.id), acao, JSON.stringify(detalhe || {}), req.cidade.id]);
  } catch (e) { console.error('regras audit:', e.message); }
}

router.get('/painel/regras', CID.exigeCidade(), (req, res) => {
  if (!req.user) return res.redirect('/');
  if (!perm.ehDonoAqui(req.user)) return res.status(403).render('error', { message: 'Só o Dono da cidade edita o regulamento.', user: req.user });
  res.render('regras-editar', { user: req.user, cidade: req.cidade });
});

router.get('/api/regras', portao, async (req, res) => {
  try { res.json({ cidade: { id: req.cidade.id, slug: req.cidade.slug, nome: req.cidade.nome }, docs: await RG.listar(pool, req.cidade.id, false) }); }
  catch (e) { console.error('api regras:', e.message); res.status(500).json({ error: 'Erro interno' }); }
});

router.post('/api/regras/previa', portao, texto, (req, res) => {
  const md = typeof req.body === 'string' ? req.body : '';
  const r = RG.renderizar(md, { linkOficial: `/cidade/${req.cidade.slug}/regras/oficial` });
  res.json({ html: r.html, capitulos: r.capitulos, artigos: r.artigos });
});

router.get('/api/regras/:doc', portao, async (req, res) => {
  try {
    if (!RG.slugOk(req.params.doc)) return res.status(400).json({ error: 'Endereço inválido' });
    const d = await RG.doc(pool, req.cidade.id, req.params.doc, true);
    if (!d) return res.status(404).json({ error: 'Não existe nesta cidade' });
    res.json(d);
  } catch (e) { console.error('api regras doc:', e.message); res.status(500).json({ error: 'Erro interno' }); }
});

router.put('/api/regras/:doc', portao, async (req, res) => {
  try {
    const body = Object.assign({}, req.body || {}); delete body.conteudo;   // o texto vai pela rota /texto
    const id = await RG.salvar(pool, req.cidade.id, req.params.doc, body, req.user.id);
    await audit(req, 'regras:dados', { doc: req.params.doc, campos: Object.keys(body) });
    res.json({ ok: true, id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/api/regras/:doc/texto', portao, texto, async (req, res) => {
  try {
    if (typeof req.body !== 'string') return res.status(400).json({ error: 'Mande o texto como text/plain' });
    const existe = await RG.doc(pool, req.cidade.id, req.params.doc, false);
    if (!existe) return res.status(404).json({ error: 'Crie o documento antes' });
    await RG.salvar(pool, req.cidade.id, req.params.doc, { conteudo: req.body }, req.user.id);
    const r = RG.renderizar(req.body);
    await audit(req, 'regras:texto', { doc: req.params.doc, tamanho: req.body.length, artigos: r.artigos });
    res.json({ ok: true, artigos: r.artigos, capitulos: r.capitulos.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/api/regras/:doc/pdf', portao, pdfBody, async (req, res) => {
  try {
    await RG.salvarPdf(pool, req.cidade.id, req.params.doc, req.body, req.get('x-nome-arquivo'), req.user.id);
    await audit(req, 'regras:pdf', { doc: req.params.doc, bytes: req.body.length });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/api/regras/:doc/historico', portao, async (req, res) => {
  try { res.json(await RG.historico(pool, req.cidade.id, req.params.doc)); }
  catch (e) { res.status(500).json({ error: 'Erro interno' }); }
});

router.post('/api/regras/:doc/restaurar/:hid', portao, async (req, res) => {
  try {
    await RG.restaurar(pool, req.cidade.id, req.params.doc, parseInt(req.params.hid), req.user.id);
    await audit(req, 'regras:restaurar', { doc: req.params.doc, hist: parseInt(req.params.hid) });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
