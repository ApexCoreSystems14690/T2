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
const { requireAuth, ctxDaCorp } = require('../middleware/auth');
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
      // [30/09] atalho pra vista de staff; so Diretor Geral (80) pra cima
      ehDiretor: perm.ehDiretorOuMais(req.user),
    });
  } catch (err) {
    console.error('Empresas error:', err.message, err.stack);
    res.render('error', { message: 'Erro ao carregar as empresas', user: req.user });
  }
});

// ---------------------------------------------------------------------------
// [30/09/2026, pedido do Julio] PAINEL PRÓPRIO DA EMPRESA.
// "Voce esta usando no T2 o mesmo painel de gerenciamento que corps! deveria ser
//  um novo, com itens que o mercado livre compra para preencher o stoque, sem o
//  nome corporação nem policiais, em inventario" + "Tbm deveria ter la o cnpj".
//
// A tela `/dashboard/corp/:id` é feita pra polícia: fala em corporação, mostra
// vestiário, "equipamento perdido por dia", repasse do governo e co-gerentes.
// Nada disso é empresa. Aqui é a MESMA API (as rotas /api/corps/:id/* são
// genéricas, chaveadas por id), só que a tela fala a língua do negócio:
// mercadoria, funcionários, adicional de salário, e o CNPJ na cara.
//
// PORTÃO: o mesmo `ctxDaCorp` de sempre. Não inventei permissão nova -- quem
// gerencia a empresa é quem gerenciaria a corp: dono, co-gerente, chefe ou staff.
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.redirect('/empresas');

    const info = await ctxDaCorp(id, req.user);   // (corpId, user) — nessa ordem
    if (!info || !CP.pode(info.ctx, 'ver_painel')) return res.redirect('/empresas');
    // se alguém chegar aqui com o id de uma corp de verdade, manda pro painel dela
    if (String(info.corp.tipo) !== 'empresa') return res.redirect('/dashboard/corp/' + id);

    const cargos = await pool.query(
      'SELECT * FROM ranks WHERE corporation_id = $1 ORDER BY level DESC', [id]);
    const funcionarios = await pool.query(`
      SELECT m.*, u.discord_username, u.roblox_id, u.roblox_username,
             r.name AS rank_name, r.level AS rank_level, COALESCE(r.salary, 0) AS adicional,
             (m.user_id = $2) AS sou_eu,
             (m.user_id = (SELECT owner_id FROM corporations WHERE id = $1)) AS eh_dono_da_corp
        FROM members m
        JOIN users u ON m.user_id = u.id
        LEFT JOIN ranks r ON m.rank_id = r.id
       WHERE m.corporation_id = $1
       ORDER BY r.level DESC NULLS LAST, m.joined_at ASC`, [id, req.user.id]);
    // os depósitos pessoais feitos no jogo pelo CNPJ -- é o que o sócio cobra depois
    let depositos = [];
    try {
      const d = await pool.query(
        `SELECT quem, roblox_id, valor, em FROM empresa_depositos
          WHERE corporation_id = $1 ORDER BY id DESC LIMIT 30`, [id]);
      depositos = d.rows;
    } catch (e) { console.error('empresa_depositos:', e.message); }

    res.render('empresa-manage', {
      user: req.user,
      empresa: info.corp,
      cargos: cargos.rows,
      funcionarios: funcionarios.rows,
      depositos,
      papel: info.papel,
      poderes: info.poderes,
      meuNivel: CP.semTeto(info.ctx) ? null : info.ctx.meuNivel,
      ehStaffAlto: !!info.ctx.ehStaffAlto,
      ehStaff: !!perm.cargoDe(req.user),
      ehDiretor: perm.ehDiretorOuMais(req.user),
    });
  } catch (err) {
    console.error('Empresa manage:', err.message, err.stack);
    res.render('error', { message: 'Erro ao abrir a empresa', user: req.user });
  }
});

module.exports = router;
