// [20/09/2026, pedido do Julio] O TERCEIRO PAINEL: facções.
// Uma facção é uma corporação com tipo = 'faccao'. Não existe tabela nova: cargos,
// membros, ícone e a API que o jogo consulta são exatamente os mesmos. Muda só onde
// ela aparece — o /dashboard filtra as facções fora, e este painel só mostra elas.
// A tela de gerenciar continua sendo /dashboard/corp/:id, reaproveitada inteira.
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const perm = require('../permissoes');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const faccoes = await pool.query(
      `SELECT c.*, (SELECT COUNT(*) FROM members WHERE corporation_id = c.id) as member_count,
              (icon_data IS NOT NULL) as has_icon_file,
              (c.owner_id = $1) AS sou_dono,
              EXISTS (SELECT 1 FROM members mm WHERE mm.corporation_id = c.id AND mm.user_id = $1) AS sou_membro,
              EXISTS (SELECT 1 FROM corp_managers cg WHERE cg.corporation_id = c.id AND cg.user_id = $1) AS sou_gerente,
              (SELECT r.name FROM members mr LEFT JOIN ranks r ON mr.rank_id = r.id
                WHERE mr.corporation_id = c.id AND mr.user_id = $1) AS meu_cargo,
              -- [23/09, pedido do Julio] o membro comum ve o proprio salario no cartao
              (SELECT r.salary FROM members mr LEFT JOIN ranks r ON mr.rank_id = r.id
                WHERE mr.corporation_id = c.id AND mr.user_id = $1) AS meu_salario,
              ($2::boolean
                OR c.owner_id = $1
                OR c.id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)
                OR c.id IN (
                  -- [23/09] ANTES: "os 2 cargos do topo". Virava gerencia sem ninguem
                  -- escolher -- no Jornal (3 cargos) o JORNALISTA mandava na redacao.
                  -- AGORA: so o cargo de MAIOR nivel, e so se a corp tiver 2+ niveis;
                  -- ou o cargo que declarar permissions.gerir_membros. Mesma regra
                  -- que o corp-poderes.js aplica no back (CP.SQL_CHEFE).
                  SELECT m.corporation_id FROM members m
                  JOIN ranks r ON m.rank_id = r.id
                  WHERE m.user_id = $1 AND ${CP.SQL_CHEFE}
                )
              ) AS pode_gerenciar
       FROM corporations c
       WHERE c.tipo = 'faccao'
         AND ($2::boolean
          OR c.owner_id = $1
          OR c.id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)
          OR c.id IN (SELECT corporation_id FROM members WHERE user_id = $1))
       ORDER BY c.name`,
      [req.user.id, perm.pode(req.user, 'corp')]
    );
    res.render('faccoes', {
      user: req.user,
      faccoes: faccoes.rows,
      podeCorp: perm.pode(req.user, 'corp'),
      ehStaff: !!perm.cargoDe(req.user),
    });
  } catch (err) {
    console.error('Faccoes error:', err.message, err.stack);
    res.render('error', { message: 'Erro ao carregar as facções', user: req.user });
  }
});

module.exports = router;
