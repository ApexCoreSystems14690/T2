const router = require('express').Router();
const discord = require('../services/discord-auth');

// Redireciona pro Discord
router.get('/discord', (req, res) => {
  res.redirect(discord.getAuthURL());
});

// Callback do Discord
router.get('/discord/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/');

    // Troca code por token
    const tokenData = await discord.exchangeCode(code);

    // Busca perfil do Discord
    const profile = await discord.getDiscordUser(tokenData.access_token);
    console.log('Discord login:', profile.id, profile.username);

    // Cria/atualiza no banco
    let user = await discord.findOrCreateUser(profile);

    // Admins definidos por variável de ambiente (ADMIN_DISCORD_IDS=123,456)
    const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (adminIds.includes(String(profile.id)) && !user.is_admin) {
      user = await discord.setAdmin(user.id, true);
    }

    // Salva na sessão
    req.session.userId = user.id;
    req.session.save(() => {
      res.redirect('/dashboard');
    });
  } catch (err) {
    console.error('Auth callback erro:', err.message);
    res.render('error', { message: 'Erro no login: ' + err.message, user: null });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
