// Página do Painel Admin (HTML). Só admin.
const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).render('error', { message: 'Acesso restrito a administradores', user: req.user || null });
  }
  res.render('admin', { user: req.user });
});

module.exports = router;
