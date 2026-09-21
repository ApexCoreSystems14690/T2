const router = require('express').Router();
const pool = require('../db/pool');
const { requireApiKey } = require('../middleware/auth');

// Rotas do NAVEGADOR in-game (Santa Fe Net) que o servidor Roblox consome via Site.get/Site.post.
// Todas exigem a API key (x-api-key), igual ao resto de /api/game.
router.use(requireApiKey);

// GET /api/game/net/editais
// Lista os editais ABERTOS de todas as corporacoes (o "Portal do Governo" in-game).
router.get('/editais', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT e.id, e.titulo, e.descricao, e.vaga, e.campos, e.criado_em,
             c.name AS corp_nome, c.slug AS corp_slug, c.color AS corp_cor
      FROM net_editais e
      JOIN corporations c ON e.corporation_id = c.id
      WHERE e.aberto = true AND c.is_active = true
      ORDER BY e.criado_em DESC
      LIMIT 100
    `);
    res.json({ ok: true, editais: r.rows });
  } catch (err) {
    console.error('net/editais:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/net/edital/:id  -> um edital com as perguntas
router.get('/edital/:id', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT e.id, e.titulo, e.descricao, e.vaga, e.campos, e.aberto,
             c.name AS corp_nome, c.color AS corp_cor
      FROM net_editais e JOIN corporations c ON e.corporation_id = c.id
      WHERE e.id = $1
    `, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Edital nao encontrado' });
    res.json({ ok: true, edital: r.rows[0] });
  } catch (err) {
    console.error('net/edital:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/net/minhas?roblox_id=123  -> ids de editais em que o jogador JA se candidatou
// (o jogo usa pra marcar/bloquear o botao antes mesmo de tentar enviar).
router.get('/minhas', async (req, res) => {
  try {
    const robloxId = parseInt(req.query.roblox_id);
    if (!robloxId) return res.json({ ok: true, ids: [] });
    const r = await pool.query(
      `SELECT edital_id FROM net_candidaturas WHERE roblox_id = $1`, [robloxId]);
    res.json({ ok: true, ids: r.rows.map(x => x.edital_id) });
  } catch (err) {
    console.error('net/minhas:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/game/net/candidatar   { edital_id, roblox_id, roblox_nome, respostas }
// A TRAVA DE ENVIO DUPLO e o UNIQUE(edital_id, roblox_id): um segundo envio bate no
// conflito e devolve 409 -- ninguem se candidata duas vezes, mesmo burlando o cliente.
router.post('/candidatar', async (req, res) => {
  try {
    const { edital_id, roblox_id, roblox_nome, respostas } = req.body || {};
    const eid = parseInt(edital_id), rid = parseInt(roblox_id);
    if (!eid || !rid) return res.status(400).json({ error: 'Dados invalidos' });

    // edital tem que existir e estar aberto
    const e = await pool.query('SELECT id, aberto FROM net_editais WHERE id = $1', [eid]);
    if (!e.rows[0]) return res.status(404).json({ error: 'Edital nao encontrado' });
    if (!e.rows[0].aberto) return res.status(400).json({ error: 'Edital fechado' });

    const resp = (respostas && typeof respostas === 'object') ? respostas : {};
    try {
      await pool.query(
        `INSERT INTO net_candidaturas (edital_id, roblox_id, roblox_nome, respostas)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [eid, rid, String(roblox_nome || '').slice(0, 64), JSON.stringify(resp)]);
    } catch (dup) {
      if (dup.code === '23505') { // unique_violation
        return res.status(409).json({ error: 'Voce ja se candidatou a este edital' });
      }
      throw dup;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('net/candidatar:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/game/net/gerencia?roblox_id=123  -> corps que o jogador OWNER/gerencia
// (o jogo usa pra liberar "criar edital" in-game so pra quem pode).
router.get('/gerencia', async (req, res) => {
  try {
    const robloxId = parseInt(req.query.roblox_id);
    if (!robloxId) return res.json({ ok: true, corps: [] });
    const r = await pool.query(`
      SELECT DISTINCT c.id, c.name FROM corporations c
      JOIN users u ON u.roblox_id = $1
      WHERE c.is_active = true AND (
        c.owner_id = u.id OR c.id IN (SELECT corporation_id FROM corp_managers WHERE user_id = u.id)
      )
    `, [robloxId]);
    res.json({ ok: true, corps: r.rows });
  } catch (err) {
    console.error('net/gerencia:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
