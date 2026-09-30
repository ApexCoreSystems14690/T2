// ============================================================================
// [30/09/2026, pedido do Julio] TODAS AS ORGANIZAÇÕES — a vista de staff.
//
//   "Adm deveria conseguir ver facilmente todas as empresas, corporações, e
//    editar livremente como existem (so para adm Diretor ou owner)."
//
// Até aqui corp, facção e empresa moravam em três páginas separadas, e cada uma
// só mostrava "tudo" pra Supervisor+ misturado com o que a pessoa participa.
// Esta página é o contrário: UMA lista com os três tipos, sem filtro de
// participação, com dono, membros, caixa e CNPJ na mesma linha, e o botão
// Gerenciar apontando pra mesma tela de sempre (/dashboard/corp/:id).
//
// PORTÃO: Diretor Geral (80) pra cima, que é o que ele pediu. NÃO é Supervisor:
// o Supervisor continua com o que já tinha nas três páginas antigas, nada foi
// tirado dele. E o BACK é quem barra — esconder link é conforto, não segurança.
// ============================================================================
const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const perm = require('../permissoes');

router.use(requireAuth);

// Portão próprio: não existe poder "ver tudo" no permissoes.js, e inventar um
// mexeria na matriz de todo mundo. Aqui a regra é simples e local.
router.use((req, res, next) => {
  if (!perm.ehDiretorOuMais(req.user)) {
    return res.status(403).render('error', {
      message: 'Esta página é do Diretor Geral pra cima.', user: req.user,
    });
  }
  next();
});

const ROTULO = { corp: 'Corporação', faccao: 'Facção', empresa: 'Empresa' };

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.id, c.name, c.slug, c.tipo, c.color, c.cnpj, c.is_active,
              (c.icon_data IS NOT NULL) AS has_icon_file, c.icon_url,
              u.discord_username AS dono_nome,
              (SELECT COUNT(*) FROM members m WHERE m.corporation_id = c.id) AS membros,
              (SELECT COUNT(*) FROM ranks  k WHERE k.corporation_id = c.id) AS cargos,
              COALESCE((SELECT saldo FROM corp_caixa cx WHERE cx.corporation_id = c.id), 0) AS saldo
         FROM corporations c
         LEFT JOIN users u ON u.id = c.owner_id
        ORDER BY CASE c.tipo WHEN 'empresa' THEN 0 WHEN 'corp' THEN 1 ELSE 2 END, c.name`);

    const orgs = r.rows.map(o => ({ ...o, rotulo: ROTULO[o.tipo] || o.tipo }));
    res.render('organizacoes', {
      user: req.user,
      orgs,
      resumo: {
        total:    orgs.length,
        corp:     orgs.filter(o => o.tipo === 'corp').length,
        faccao:   orgs.filter(o => o.tipo === 'faccao').length,
        empresa:  orgs.filter(o => o.tipo === 'empresa').length,
      },
      cargo: perm.cargoDe(req.user),
      ehStaff: true,
      ehDiretor: true,
    });
  } catch (err) {
    console.error('Organizacoes error:', err.message, err.stack);
    res.render('error', { message: 'Erro ao carregar as organizações', user: req.user });
  }
});

module.exports = router;
