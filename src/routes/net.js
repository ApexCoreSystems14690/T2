const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// Painel do GESTOR de corp: criar editais (estilo Google Forms) e ver os resultados.
// So quem e dono (corporations.owner_id) ou co-gerente (corp_managers) enxerga a sua corp.

// corps que o usuario logado gerencia
async function corpsQueGerencia(userId) {
  const r = await pool.query(`
    SELECT c.id, c.name FROM corporations c
    WHERE c.is_active = true AND (
      c.owner_id = $1 OR c.id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)
    ) ORDER BY c.name
  `, [userId]);
  return r.rows;
}
async function gerenciaCorp(userId, corpId) {
  const r = await pool.query(`
    SELECT 1 FROM corporations WHERE id = $2 AND (
      owner_id = $1 OR id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)
    )`, [userId, corpId]);
  return r.rows.length > 0;
}

// GET /net  -> painel: minhas corps, editais e um formulario de criar
router.get('/', requireAuth, async (req, res) => {
  try {
    const corps = await corpsQueGerencia(req.user.id);
    let editais = [];
    if (corps.length > 0) {
      const ids = corps.map(c => c.id);
      const r = await pool.query(`
        SELECT e.id, e.titulo, e.vaga, e.aberto, e.campos, e.criado_em, c.name AS corp_nome,
               (SELECT COUNT(*) FROM net_candidaturas WHERE edital_id = e.id) AS respostas
        FROM net_editais e JOIN corporations c ON e.corporation_id = c.id
        WHERE e.corporation_id = ANY($1) ORDER BY e.criado_em DESC
      `, [ids]);
      editais = r.rows;
    }
    res.render('net-editais', { user: req.user, corps, editais, resultados: null, edital: null });
  } catch (err) {
    console.error('GET /net:', err.message);
    res.status(500).render('error', { message: 'Erro ao carregar editais' });
  }
});

// POST /net/editais  -> cria um edital. Body: corporation_id, titulo, descricao, vaga, campos (JSON)
router.post('/editais', requireAuth, async (req, res) => {
  try {
    const { corporation_id, titulo, descricao, vaga } = req.body;
    const corpId = parseInt(corporation_id);
    if (!corpId || !(await gerenciaCorp(req.user.id, corpId))) {
      return res.status(403).json({ error: 'Voce nao gerencia essa corporacao' });
    }
    if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'Titulo obrigatorio' });
    let campos = [];
    try { campos = JSON.parse(req.body.campos || '[]'); } catch (e) { campos = []; }
    if (!Array.isArray(campos)) campos = [];
    // higieniza os campos (max 15 perguntas)
    campos = campos.slice(0, 15).map(c => ({
      label: String(c.label || '').slice(0, 120),
      tipo: (['texto', 'paragrafo', 'opcoes'].includes(c.tipo) ? c.tipo : 'texto'),
      opcoes: Array.isArray(c.opcoes) ? c.opcoes.slice(0, 8).map(o => String(o).slice(0, 60)) : [],
      obrigatorio: !!c.obrigatorio,
    })).filter(c => c.label);

    await pool.query(`
      INSERT INTO net_editais (corporation_id, titulo, descricao, vaga, campos, criado_por)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6)
    `, [corpId, titulo.trim().slice(0, 120), String(descricao || '').slice(0, 2000),
        String(vaga || '').slice(0, 80), JSON.stringify(campos), req.user.id]);
    res.redirect('/net');
  } catch (err) {
    console.error('POST /net/editais:', err.message);
    res.status(500).json({ error: 'Erro ao criar edital' });
  }
});

// POST /net/editais/:id/fechar  -> abre/fecha o edital (alterna)
router.post('/editais/:id/fechar', requireAuth, async (req, res) => {
  try {
    const eid = parseInt(req.params.id);
    const e = await pool.query('SELECT corporation_id, aberto FROM net_editais WHERE id = $1', [eid]);
    if (!e.rows[0] || !(await gerenciaCorp(req.user.id, e.rows[0].corporation_id))) {
      return res.status(403).json({ error: 'Sem acesso' });
    }
    await pool.query('UPDATE net_editais SET aberto = NOT aberto WHERE id = $1', [eid]);
    res.redirect('/net');
  } catch (err) {
    console.error('fechar edital:', err.message);
    res.status(500).json({ error: 'Erro' });
  }
});

// POST /net/editais/:id/excluir  -> apaga o edital (e as candidaturas, por ON DELETE CASCADE)
router.post('/editais/:id/excluir', requireAuth, async (req, res) => {
  try {
    const eid = parseInt(req.params.id);
    const e = await pool.query('SELECT corporation_id FROM net_editais WHERE id = $1', [eid]);
    if (!e.rows[0] || !(await gerenciaCorp(req.user.id, e.rows[0].corporation_id))) {
      return res.status(403).json({ error: 'Sem acesso' });
    }
    await pool.query('DELETE FROM net_editais WHERE id = $1', [eid]);
    res.redirect('/net');
  } catch (err) {
    console.error('excluir edital:', err.message);
    res.status(500).json({ error: 'Erro' });
  }
});

// GET /net/editais/:id/resultados  -> ve as candidaturas (respostas), como o Google Forms
router.get('/editais/:id/resultados', requireAuth, async (req, res) => {
  try {
    const eid = parseInt(req.params.id);
    const e = await pool.query(`
      SELECT e.*, c.name AS corp_nome FROM net_editais e
      JOIN corporations c ON e.corporation_id = c.id WHERE e.id = $1`, [eid]);
    if (!e.rows[0] || !(await gerenciaCorp(req.user.id, e.rows[0].corporation_id))) {
      return res.status(403).render('error', { message: 'Sem acesso a este edital' });
    }
    const cands = await pool.query(`
      SELECT roblox_id, roblox_nome, respostas, criado_em
      FROM net_candidaturas WHERE edital_id = $1 ORDER BY criado_em DESC`, [eid]);
    const corps = await corpsQueGerencia(req.user.id);
    res.render('net-editais', {
      user: req.user, corps, editais: [], edital: e.rows[0], resultados: cands.rows,
    });
  } catch (err) {
    console.error('resultados:', err.message);
    res.status(500).render('error', { message: 'Erro ao carregar resultados' });
  }
});

module.exports = router;
