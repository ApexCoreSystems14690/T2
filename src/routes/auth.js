const router = require('express').Router();
const passport = require('passport');

// Redireciona pro Discord
router.get('/discord', passport.authenticate('discord'));

// Callback do Discord
router.get('/discord/callback', (req, res, next) => {
  passport.authenticate('discord', (err, user, info) => {
    if (err) {
      console.error('Auth callback erro:', err.message);
      return res.render('error', { message: 'Erro no login: ' + err.message, user: null });
    }
    if (!user) {
      console.error('Auth callback: sem user', info);
      return res.redirect('/');
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('logIn erro:', loginErr.message);
        return res.render('error', { message: 'Erro na sessão: ' + loginErr.message, user: null });
      }
      res.redirect('/dashboard');
    });
  })(req, res, next);
});

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

module.exports = router;
