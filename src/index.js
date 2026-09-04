require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const pool = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Sessão com PostgreSQL
app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());
require('./services/discord-auth');

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Rotas
app.use('/auth', require('./routes/auth'));
app.use('/api/game', require('./routes/game-api'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/api/corps', require('./routes/corps-api'));

// Home
app.get('/', (req, res) => {
  res.render('home', { user: req.user || null });
});

// 404
app.use((req, res) => {
  res.status(404).render('error', { message: 'Página não encontrada', user: req.user || null });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: 'Erro interno', user: req.user || null });
});

app.listen(PORT, () => {
  console.log(`🏙️ Santa Fé Corps rodando na porta ${PORT}`);
});
