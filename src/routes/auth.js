const router = require('express').Router();
const passport = require('passport');

// Redireciona pro Discord
router.get('/discord', passport.authenticate('discord'));

// Callback do Discord
router.get('/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

module.exports = router;
