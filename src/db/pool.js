const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
});

// [24/10] isolamento por cidade: dentro de um contexto de cidade, cada consulta roda como sf_app
// com sf.cidade = <id> (Row-Level Security). Ver src/isolamento.js.
require('../isolamento').instalar(pool);

module.exports = pool;
