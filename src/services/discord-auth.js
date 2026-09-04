const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const pool = require('../db/pool');

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err, null);
  }
});

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify', 'email'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Verifica se o usuário já existe
    const existing = await pool.query(
      'SELECT * FROM users WHERE discord_id = $1', [profile.id]
    );

    if (existing.rows.length > 0) {
      // Atualiza dados do Discord
      const updated = await pool.query(
        `UPDATE users SET
          discord_username = $1, discord_avatar = $2, email = $3, updated_at = NOW()
         WHERE discord_id = $4 RETURNING *`,
        [profile.username, profile.avatar, profile.email, profile.id]
      );
      return done(null, updated.rows[0]);
    }

    // Cria novo usuário
    const newUser = await pool.query(
      `INSERT INTO users (discord_id, discord_username, discord_avatar, email)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [profile.id, profile.username, profile.avatar, profile.email]
    );
    done(null, newUser.rows[0]);
  } catch (err) {
    done(err, null);
  }
}));
