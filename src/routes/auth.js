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

    // [FIX 23/09 seguranca] FIXACAO DE SESSAO. Antes o sid continuava o mesmo
    // depois de autenticar: quem conseguisse plantar um cookie de sessao na
    // maquina/navegador da vitima (link, extensao, maquina compartilhada) passava
    // a usar a sessao JA LOGADA dela -- inclusive se a vitima fosse admin.
    // Trocar o sid no login quebra isso: o cookie plantado morre no ato.
    const idNovo = user.id;
    // [21/10 Cidades] a cidade escolhida antes do login sobrevive à troca do sid
    const cidadeId = req.session.cidadeId || null;
    const depois = req.session.depoisDoLogin || null;
    req.session.regenerate((errR) => {
      if (errR) {
        console.error('regenerate:', errR.message);
        return res.render('error', { message: 'Erro no login', user: null });
      }
      req.session.userId = idNovo;
      if (cidadeId) req.session.cidadeId = cidadeId;
      const ok = require('../cidades').voltarSeguro(depois);
      req.session.save(() => res.redirect(cidadeId ? (ok || '/painel') : '/'));
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
