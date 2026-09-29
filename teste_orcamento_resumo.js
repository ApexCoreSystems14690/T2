// ============================================================================
// TESTE do RESUMO DO ORÇAMENTO (o bloco novo do painel) — Postgres DE VERDADE.
//   PGHOST=/tmp PGPORT=5477 PGUSER=postgres PGDATABASE=t2orc node teste_orcamento_resumo.js
// O que importa provar: o resumo NÃO paga nada, a janela de atividade é a mesma
// que o pagamento vai usar, e corp sem repasse nenhum não quebra o painel.
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
const t = (n, c, e) => { if (c) ok++; else falhas.push(n + (e !== undefined ? ' -> ' + JSON.stringify(e) : '')); };

(async () => {
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
  const pm   = (await pool.query(`INSERT INTO corporations (name, slug) VALUES ('PM','policia-militar') RETURNING id`)).rows[0].id;
  const samu = (await pool.query(`INSERT INTO corporations (name, slug) VALUES ('SAMU','samu') RETURNING id`)).rows[0].id;

  // ---- 1) corp virgem: resumo responde sem quebrar e sem pagar
  const r0 = await caixa.resumoOrcamento(pm, 'policia-militar');
  t('resumo responde em corp virgem', !!r0, r0);
  t('ultimo = null quando nunca recebeu', r0.ultimo === null, r0.ultimo);
  t('dias = 7', r0.dias === 7, r0.dias);
  t('previsto = base quando nao houve atividade', r0.previsto.total === ORC.ORC.BASE_PADRAO, r0.previsto);
  const pago0 = (await pool.query(`SELECT COUNT(*)::int n FROM corp_orcamento_pago`)).rows[0].n;
  const saldo0 = (await pool.query(`SELECT COUNT(*)::int n FROM corp_caixa WHERE saldo <> 0`)).rows[0].n;
  t('RESUMO NAO PAGA: nenhuma linha de repasse', pago0 === 0, pago0);
  t('RESUMO NAO PAGA: nenhum caixa creditado', saldo0 === 0, saldo0);

  // ---- 2) SAMU usa a base menor
  const rs = await caixa.resumoOrcamento(samu, 'samu');
  t('SAMU tem base menor', rs.previsto.base === ORC.ORC.BASE_SAMU, rs.previsto);
  t('SAMU < PM', rs.previsto.total < r0.previsto.total);

  // ---- 3) atividade no período entra na previsão
  for (let i = 0; i < 3; i++) await caixa.registrarAtividade(pm, 'multa', 'fulano');
  const r1 = await caixa.resumoOrcamento(pm, 'policia-militar');
  t('conta as 3 ocorrencias', r1.atividade_periodo === 3, r1.atividade_periodo);
  t('previsto = base + 3*POR_ATIVIDADE',
    r1.previsto.total === ORC.ORC.BASE_PADRAO + 3 * ORC.ORC.POR_ATIVIDADE, r1.previsto);

  // ---- 4) atividade de OUTRO período não conta (fora da janela)
  await pool.query(
    `INSERT INTO corp_atividade (corporation_id, tipo, quem, em) VALUES ($1,'multa','antigo', NOW() - INTERVAL '30 days')`, [pm]);
  const r2 = await caixa.resumoOrcamento(pm, 'policia-militar');
  t('ocorrencia de 30 dias atras NAO conta', r2.atividade_periodo === 3, r2.atividade_periodo);

  // ---- 5) A JANELA BATE COM A DO PAGAMENTO: o que o resumo previu é o que cai
  const prev = (await caixa.resumoOrcamento(pm, 'policia-militar')).previsto.total;
  const pgto = await caixa.pagarOrcamentoSePendente(pm, 'policia-militar');
  t('pagou', pgto.pagou === true, pgto);
  t('PREVISTO == PAGO', pgto.valor === prev, { prev, pago: pgto.valor });

  // ---- 6) depois de pago, o resumo mostra o último
  const r3 = await caixa.resumoOrcamento(pm, 'policia-militar');
  t('ultimo agora existe', r3.ultimo !== null);
  t('ultimo.valor bate', r3.ultimo && r3.ultimo.valor === pgto.valor, r3.ultimo);
  t('ultimo.periodo = periodo atual', r3.ultimo && r3.ultimo.periodo === r3.periodo, r3.ultimo);
  t('ultimo.em preenchido', !!(r3.ultimo && r3.ultimo.em));

  // ---- 7) proximo_em sempre no futuro e dentro de 7 dias
  const falta = r3.proximo_em - Date.now();
  t('proximo repasse esta no futuro', falta > 0, falta);
  t('proximo repasse cabe em 7 dias', falta <= 7 * 24 * 3600 * 1000, falta);
  t('proximo_em = fim do periodo atual',
    r3.proximo_em === (r3.periodo + 1) * ORC.DIA * ORC.ORC.DIAS, { p: r3.proximo_em });

  // ---- 8) slug desconhecido cai na base padrão em vez de explodir
  const r4 = await caixa.resumoOrcamento(pm, null);
  t('slug nulo nao explode', r4.previsto.base === ORC.ORC.BASE_PADRAO, r4.previsto);

  console.log(`\n${ok}/${ok + falhas.length} passaram`);
  if (falhas.length) { falhas.forEach(f => console.log('  X ' + f)); process.exitCode = 1; }
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
