// [30/09/2026, pedido do Julio] O QUARTO PAINEL: EMPRESAS OFICIAIS.
// Empresa é uma corporação com tipo = 'empresa'. De novo: NÃO existe tabela nova.
// Cargos, membros, caixa, estoque, empréstimos e a tela de gerenciar
// (/dashboard/corp/:id) são exatamente os mesmos das corps -- o que muda é a REGRA:
//
//   EMPRESA NÃO GANHA DINHEIRO DO GOVERNO.
//
// O repasse (corp_orcamento_pago) nunca roda pra ela: o caixa enche por venda, por
// aporte de sócio e por depósito pessoal feito no jogo com o CNPJ. É por isso que
// este painel mostra o SALDO na cara -- numa corp o saldo é detalhe, numa empresa
// é o que diz se ela está viva.
//
// O salário também é diferente: R$ 500 de piso vêm do jogo e NÃO saem do caixa;
// o `ranks.salary` aqui é o ADICIONAL que o dono paga por cima, e esse sai do caixa.
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const perm = require('../permissoes');
const CP = require('../corp-poderes');

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const empresas = await pool.query(
      `SELECT c.*, (SELECT COUNT(*) FROM members WHERE corporation_id = c.id) as member_count,
              (icon_data IS NOT NULL) as has_icon_file,
              (c.owner_id = $1) AS sou_dono,
              EXISTS (SELECT 1 FROM members mm WHERE mm.corporation_id = c.id AND mm.user_id = $1) AS sou_membro,
              EXISTS (SELECT 1 FROM corp_managers cg WHERE cg.corporation_id = c.id AND cg.user_id = $1) AS sou_gerente,
              (SELECT r.name FROM members mr LEFT JOIN ranks r ON mr.rank_id = r.id
                WHERE mr.corporation_id = c.id AND mr.user_id = $1) AS meu_cargo,
              -- aqui salary = ADICIONAL por cargo, não o salário inteiro
              (SELECT r.salary FROM members mr LEFT JOIN ranks r ON mr.rank_id = r.id
                WHERE mr.corporation_id = c.id AND mr.user_id = $1) AS meu_adicional,
              COALESCE((SELECT saldo FROM corp_caixa k WHERE k.corporation_id = c.id), 0) AS saldo,
              ($2::boolean
                OR c.owner_id = $1
                OR c.id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)
                OR c.id IN (
                  SELECT m.corporation_id FROM members m
                  JOIN ranks r ON m.rank_id = r.id
                  WHERE m.user_id = $1 AND ${CP.SQL_CHEFE}
                )
              ) AS pode_gerenciar
       FROM corporations c
       WHERE c.tipo = 'empresa'
         AND ($2::boolean
          OR c.owner_id = $1
          OR c.id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)
          OR c.id IN (SELECT corporation_id FROM members WHERE user_id = $1))
       ORDER BY c.name`,
      [req.user.id, perm.pode(req.user, 'corp')]
    );
    res.render('empresas', {
      user: req.user,
      empresas: empresas.rows,
      podeCorp: perm.pode(req.user, 'corp'),
      ehStaff: !!perm.cargoDe(req.user),
    });
  } catch (err) {
    console.error('Empresas error:', err.message, err.stack);
    res.render('error', { message: 'Erro ao carregar as empresas', user: req.user });
  }
});

module.exports = router;
