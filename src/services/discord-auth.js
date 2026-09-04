const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const pool = require('../db/pool');

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || null);
  } catch (err) {
    console.error('deserializeUser erro:', err.message);
    done(err, null);
  }
});

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Discord login:', profile.id, profile.username);

    const existing = await pool.query(
      'SELECT * FROM users WHERE discord_id = $1', [profile.id]
    );

    if (existing.rows.length > 0) {
      const updated = await pool.query(
        `UPDATE users SET
          discord_username = $1, discord_avatar = $2, updated_at = NOW()
         WHERE discord_id = $3 RETURNING *`,
        [profile.username, profile.avatar, profile.id]
      );
      return done(null, updated.rows[0]);
    }

    const newUser = await pool.query(
      `INSERT INTO users (discord_id, discord_username, discord_avatar)
       VALUES ($1, $2, $3) RETURNING *`,
      [profile.id, profile.username, profile.avatar]
    );
    done(null, newUser.rows[0]);
  } catch (err) {
    console.error('Discord auth erro:', err.message);
    console.error('Stack:', err.stack);
    done(err, null);
  }
}));
