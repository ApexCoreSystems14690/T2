// [14/10] APURAÇÃO — aba pública (qualquer um logado vê) + botões da staff (só o Dono).
// O voto entra pelo /api/game/eleicao/voto (game-api.js); aqui só se LÊ e se controla o turno.
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const perm = require('../permissoes');
const E = require('../eleicao');

router.use(requireAuth);

const ehStaff = u => perm.ehDonoAqui(u);   // [21/10] Dono desta cidade
function soStaff(req, res, next) {
  if (ehStaff(req.user)) return next();
  return res.status(403).json({ error: 'Só o Dono controla a eleição.' });
}
async function audit(req, acao, detalhe) {
  try {
    await pool.query('INSERT INTO admin_audit (admin_id, admin_nome, acao, detalhe) VALUES ($1, $2, $3, $4)',
      [req.user.id, req.user.discord_username || ('user#' + req.user.id), acao, JSON.stringify(detalhe || {})]);
  } catch (e) { console.error('audit eleicao:', e.message); }
}

router.get('/', (req, res) => res.render('apuracao', { user: req.user, ehStaff: ehStaff(req.user) }));
router.get('/transmissao', (req, res) => res.render('apuracao-tv', { user: req.user }));

// [24/10 isolamento] a transmissão é pública (sem cidade na sessão): a apuração é a da cidade
// da sessão, ou a de ?cidade=<slug>, ou a do Santa Fé. Nunca a mistura de todas.
router.get('/dados', async (req, res) => {
  try {
    const CID = require('../cidades');
    let c = req.cidade;
    if (!c && req.query.cidade) c = await CID.porSlug(pool, String(req.query.cidade).toLowerCase().slice(0, 40));
    const id = c ? c.id : CID.SANTA_FE;
    res.json(await require('../isolamento').run(id, () => E.apuracao(pool, req.query.turno)));
  }
  catch (err) { console.error('apuracao/dados:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

// ---------------------------------------------------------------- STAFF
router.get('/staff', soStaff, async (req, res) => {
  try {
    const est = await E.lerEstado(pool);
    const cfg = await E.lerConfig(pool);
    const porCargo = await pool.query(
      `SELECT turno, cargo, COUNT(*)::int AS n FROM eleicao_votantes GROUP BY turno, cargo ORDER BY turno, cargo`);
    // [pedido] contas pra revisão manual: SÓ o fato de terem votado, nunca em quem.
    const alertas = await pool.query(
      `SELECT user_id, nome, turno, cargo, conta_dias, revisar, votado_em FROM eleicao_votantes
        WHERE revisar = true OR conta_dias < 30 ORDER BY votado_em DESC LIMIT 300`);
    res.json({ ok: true, estado: est, temConfig: !!cfg, configRecebida: cfg && cfg.recebido_em,
      candidatos: cfg ? { presidencia: cfg.presidencia.length, parlamento: cfg.parlamento.length,
        pendentes: cfg.parlamento.filter(c => c.pendente).map(c => c.nome) } : null,
      votantes: porCargo.rows, alertas: alertas.rows });
  } catch (err) { console.error('apuracao/staff:', err.message); res.status(500).json({ error: 'Erro interno' }); }
});

router.post('/staff/acao', soStaff, async (req, res) => {
  const acao = String((req.body && req.body.acao) || '');
  try {
    const est = await E.lerEstado(pool);
    const cfg = await E.lerConfig(pool);
    const dur = Math.min(Math.max(parseInt(req.body.duracao) || est.duracao_min || E.DURACAO_PADRAO_MIN, 1), 600);

    if (acao === 'duracao') {
      await pool.query('UPDATE eleicao_estado SET duracao_min = $1, atualizado_em = NOW() WHERE id = 1', [dur]);
      await audit(req, 'eleicao:duracao', { duracao: dur });
      return res.json({ ok: true, msg: 'Apuração vai durar ' + dur + ' min (vale no próximo fechamento).' });
    }
    if (acao === 'abrir1') {
      if (!cfg) return res.status(400).json({ error: 'O jogo ainda não mandou a lista de candidatos. Suba um servidor.' });
      if (!(est.turno === 1 && est.fase === 'preparo')) return res.status(400).json({ error: 'O 1º turno já foi aberto. Pra recomeçar, use Zerar tudo.' });
      await pool.query(`UPDATE eleicao_estado SET turno = 1, aberto = true, fase = 'votacao', atualizado_em = NOW() WHERE id = 1`);
      await audit(req, 'eleicao:abrir1', {});
      return res.json({ ok: true, msg: '1º turno aberto. As urnas já aceitam voto.' });
    }
    if (acao === 'fechar1' || acao === 'fechar2') {
      const t = acao === 'fechar1' ? 1 : 2;
      if (!(est.turno === t && est.aberto)) return res.status(400).json({ error: 'O ' + t + 'º turno não está aberto.' });
      const vpz = await E.votosPorZona(pool, t);
      const { ordem, viradas } = E.escolherOrdem(cfg, vpz, t, est.finalistas);
      const cron = E.cronograma(dur);
      await pool.query(
        `UPDATE eleicao_estado SET aberto = false, fase = 'apuracao', fechado_em = NOW(), duracao_min = $1,
                ordem = $2, cronograma = $3, viradas = $4, atualizado_em = NOW() WHERE id = 1`,
        [dur, JSON.stringify(ordem), JSON.stringify(cron), viradas]);
      await audit(req, 'eleicao:fechar' + t, { duracao: dur, viradas });
      return res.json({ ok: true, msg: t + 'º turno fechado. A apuração começa agora e leva ' + dur + ' min.' });
    }
    if (acao === 'abrir2') {
      if (!(est.turno === 1 && est.fase === 'apuracao')) return res.status(400).json({ error: 'Feche o 1º turno antes.' });
      const { pres } = await E.resultadoCheio(pool, 1);
      if (pres.situacao !== 'segundo_turno') return res.status(400).json({ error: pres.situacao === 'eleito_1o' ? 'A presidência já foi decidida no 1º turno — não tem 2º turno.' : 'Sem votos suficientes pra um 2º turno.' });
      const fin = pres.segundoTurno.map(c => c.numero);
      await pool.query(
        `UPDATE eleicao_estado SET turno = 2, aberto = true, fase = 'votacao', finalistas = $1, fechado_em = NULL,
                ordem = NULL, cronograma = NULL, viradas = NULL, atualizado_em = NOW() WHERE id = 1`, [JSON.stringify(fin)]);
      await audit(req, 'eleicao:abrir2', { finalistas: fin });
      return res.json({ ok: true, msg: '2º turno aberto entre ' + pres.segundoTurno.map(c => c.nome).join(' e ') + '.' });
    }
    if (acao === 'zerar') {
      if (String(req.body.confirmar || '') !== 'ZERAR') return res.status(400).json({ error: 'Digite ZERAR pra confirmar.' });
      const cli = await pool.connect();
      try {
        await cli.query('BEGIN');
        const v1 = await cli.query('DELETE FROM eleicao_votos');
        const v2 = await cli.query('DELETE FROM eleicao_votantes');
        await cli.query(`UPDATE eleicao_estado SET turno = 1, aberto = false, fase = 'preparo', fechado_em = NULL, ordem = NULL,
                          cronograma = NULL, viradas = NULL, finalistas = NULL, rodada = rodada + 1, atualizado_em = NOW() WHERE id = 1`);
        await cli.query('COMMIT');
        await audit(req, 'eleicao:zerar', { votos: v1.rowCount, votantes: v2.rowCount });
        return res.json({ ok: true, msg: 'Eleição zerada: ' + v1.rowCount + ' votos apagados.' });
      } catch (e) { await cli.query('ROLLBACK').catch(() => {}); throw e; }
      finally { cli.release(); }
    }
    return res.status(400).json({ error: 'Ação desconhecida.' });
  } catch (err) {
    console.error('apuracao/acao:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
