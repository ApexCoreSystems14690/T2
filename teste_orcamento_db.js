// ============================================================================
// TESTE DE INTEGRAÇÃO DO ORÇAMENTO — contra Postgres DE VERDADE.
//   PGHOST=/tmp PGPORT=5477 PGUSER=postgres PGDATABASE=t2orc node teste_orcamento_db.js
// Prova o que o teste puro não prova: a TRAVA do UNIQUE(corp, periodo) sob
// concorrência, e que o dinheiro entra pelo caminho normal do caixa (extrato).
// ============================================================================
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.PGHOST || '/tmp',
  port: parseInt(process.env.PGPORT) || 5477,
  user: process.env.PGUSER || 'postgres',
  database: process.env.PGDATABASE || 't2orc',
});
const alvo = require.resolve('./src/db/pool');
require.cache[alvo] = { id: alvo, filename: alvo, loaded: true, exports: pool, children: [], paths: [] };

const caixa = require('./src/corp-caixa-db');
const ORC = require('./src/corp-orcamento');

let ok = 0; const falhas = [];
const t = (nome, cond, extra) => { if (cond) ok++; else falhas.push(nome + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')); };

(async () => {
  // schema mínimo do que o orçamento toca
  await pool.query(`
    DROP TABLE IF EXISTS corp_orcamento_pago, corp_atividade, corp_lancamentos, corp_caixa, corporations CASCADE;
    CREATE TABLE corporations (id SERIAL PRIMARY KEY, name VARCHAR(64), slug VARCHAR(64) UNIQUE, is_active BOOLEAN DEFAULT true);
    CREATE TABLE corp_caixa (corporation_id INTEGER PRIMARY KEY REFERENCES corporations(id) ON DELETE CASCADE, saldo BIGINT NOT NULL DEFAULT 0, atualizado_em TIMESTAMP DEFAULT NOW());
    CREATE TABLE corp_lancamentos (
      id SERIAL PRIMARY KEY, corporation_id INTEGER NOT NULL REFERENCES corporations(id) ON DELETE CASCADE,
      tipo VARCHAR(24) NOT NULL, motivo VARCHAR(24), valor BIGINT NOT NULL DEFAULT 0, saldo_depois BIGINT,
      item VARCHAR(64), qtd INTEGER DEFAULT 0, perda BOOLEAN DEFAULT false,
      quem VARCHAR(64), por VARCHAR(64), detalhe JSONB, em TIMESTAMP DEFAULT NOW());
    CREATE TABLE corp_atividade (id SERIAL PRIMARY KEY, corporation_id INTEGER NOT NULL REFERENCES corporations(id) ON DELETE CASCADE, tipo VARCHAR(24) NOT NULL, quem VARCHAR(64), em TIMESTAMP DEFAULT NOW());
    CREATE TABLE corp_orcamento_pago (
      id SERIAL PRIMARY KEY, corporation_id INTEGER NOT NULL REFERENCES corporations(id) ON DELETE CASCADE,
      periodo BIGINT NOT NULL, valor BIGINT NOT NULL, base BIGINT NOT NULL, atividade INTEGER NOT NULL DEFAULT 0,
      em TIMESTAMP DEFAULT NOW(), UNIQUE (corporation_id, periodo));
  `);
  const pm = (await pool.query(`INSERT INTO corporations (name, slug) VALUES ('PM','policia-militar') RETURNING id`)).rows[0].id;
  const samu = (await pool.query(`INSERT INTO corporations (name, slug) VALUES ('SAMU','samu') RETURNING id`)).rows[0].id;

  // ---- 1) primeiro repasse cai
  const r1 = await caixa.pagarOrcamentoSePendente(pm, 'policia-militar');
  t('primeiro repasse paga', r1.pagou === true, r1);
  t('valor = base da PM (sem atividade)', r1.valor === ORC.ORC.BASE_PADRAO, r1);
  const saldo1 = (await pool.query(`SELECT saldo FROM corp_caixa WHERE corporation_id=$1`, [pm])).rows[0].saldo;
  t('o dinheiro entrou no caixa', Number(saldo1) === ORC.ORC.BASE_PADRAO, saldo1);

  // ---- 2) chamar de novo no mesmo período NÃO paga
  const r2 = await caixa.pagarOrcamentoSePendente(pm, 'policia-militar');
  t('segunda chamada no mesmo periodo NAO paga', r2.pagou === false, r2);
  const saldo2 = (await pool.query(`SELECT saldo FROM corp_caixa WHERE corporation_id=$1`, [pm])).rows[0].saldo;
  t('saldo nao mudou', Number(saldo2) === Number(saldo1));

  // ---- 3) A PROVA: 8 servidores pedindo AO MESMO TEMPO, período novo
  await pool.query(`DELETE FROM corp_orcamento_pago WHERE corporation_id=$1`, [pm]);
  await pool.query(`UPDATE corp_caixa SET saldo=0 WHERE corporation_id=$1`, [pm]);
  const corrida = await Promise.all(Array.from({ length: 8 }, () => caixa.pagarOrcamentoSePendente(pm, 'policia-militar')));
  const pagaram = corrida.filter(x => x.pagou).length;
  t('8 chamadas simultaneas: EXATAMENTE 1 paga', pagaram === 1, corrida.map(x => x.pagou));
  const linhas = (await pool.query(`SELECT COUNT(*)::int n FROM corp_orcamento_pago WHERE corporation_id=$1`, [pm])).rows[0].n;
  t('so 1 linha de repasse gravada', linhas === 1, linhas);
  const saldo3 = Number((await pool.query(`SELECT saldo FROM corp_caixa WHERE corporation_id=$1`, [pm])).rows[0].saldo);
  t('caixa recebeu UMA vez so', saldo3 === ORC.ORC.BASE_PADRAO, saldo3);

  // ---- 4) atividade aumenta o repasse
  await pool.query(`DELETE FROM corp_orcamento_pago WHERE corporation_id=$1`, [samu]);
  for (let i = 0; i < 6; i++) await caixa.registrarAtividade(samu, 'reanimacao', 'Medico' + i);
  const rs = await caixa.pagarOrcamentoSePendente(samu, 'samu');
  t('SAMU recebe base + atividade', rs.valor === ORC.ORC.BASE_SAMU + 6 * ORC.ORC.POR_ATIVIDADE, rs);
  t('a contagem de atividade bate', rs.atividade === 6, rs);
  t('SAMU recebe MENOS que a PM com a mesma atividade',
    ORC.valorDe('samu', 6).total < ORC.valorDe('policia-militar', 6).total);

  // ---- 5) entra no extrato como aporte, com a marca do orçamento
  const lan = (await pool.query(
    `SELECT tipo, valor, detalhe FROM corp_lancamentos WHERE corporation_id=$1 ORDER BY id DESC LIMIT 1`, [samu])).rows[0];
  t('lancamento é aporte', lan.tipo === 'aporte', lan.tipo);
  t('valor bate com o repasse', Number(lan.valor) === rs.valor, lan.valor);
  t('detalhe marca que foi orcamento', lan.detalhe && lan.detalhe.orcamento === true, lan.detalhe);

  // ---- 6) período seguinte paga de novo (forjando o último como anterior)
  const per = ORC.periodoDe(Date.now());
  await pool.query(`UPDATE corp_orcamento_pago SET periodo=$1 WHERE corporation_id=$2`, [per - 1, samu]);
  const r6 = await caixa.pagarOrcamentoSePendente(samu, 'samu');
  t('periodo novo paga de novo', r6.pagou === true, r6);
  t('e grava no periodo ATUAL', r6.periodo === per, r6);

  // ---- 7) atividade nunca derruba a operação
  const antes = (await pool.query(`SELECT COUNT(*)::int n FROM corp_atividade`)).rows[0].n;
  const okAt = await caixa.registrarAtividade(999999, 'lixo', 'x');  // corp que não existe
  t('atividade em corp inexistente devolve false, sem lançar', okAt === false);
  const depois = (await pool.query(`SELECT COUNT(*)::int n FROM corp_atividade`)).rows[0].n;
  t('e nao gravou nada', depois === antes);

  console.log(`${ok}/${ok + falhas.length} | falhas: ${falhas.length ? '\n  - ' + falhas.join('\n  - ') : 'nenhuma'}`);
  await pool.end();
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('ESTOUROU:', e); process.exit(1); });
