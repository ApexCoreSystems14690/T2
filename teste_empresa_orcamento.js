// [30/09] Prova: EMPRESA NUNCA RECEBE REPASSE DO GOVERNO.
// Julio: "e ja começam com 40 mil, o caixa deveria ser so oque a empresa ganha".
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const caixa = require('./src/corp-caixa-db');
const ORC = require('./src/corp-orcamento');
let ok=0,f=0; const t=(n,c)=>{c?(ok++,console.log('  OK   '+n)):(f++,console.log('  FALHOU '+n))};

(async () => {
  const emp = (await pool.query(`SELECT id, slug FROM corporations WHERE slug='mercado-fechado'`)).rows[0];
  await pool.query(`INSERT INTO corporations (name, slug, tipo, color) VALUES ('Policia Militar','pm','corp','#3B82F6')
                    ON CONFLICT (slug) DO UPDATE SET tipo='corp'`);
  const pm = (await pool.query(`SELECT id, slug FROM corporations WHERE slug='pm'`)).rows[0];
  await pool.query(`DELETE FROM corp_orcamento_pago`);
  await pool.query(`UPDATE corp_caixa SET saldo=0`);

  console.log('\n[1] o bug: sem a trava, mercado-fechado cairia na base padrao');
  t('ORC.valorDe("mercado-fechado") > 0 (a base padrao existe mesmo)', ORC.valorDe('mercado-fechado', 0).total > 0);
  console.log('      valor que ela receberia: R$ ' + ORC.valorDe('mercado-fechado', 0).total.toLocaleString('pt-BR'));

  console.log('\n[2] com a trava: a EMPRESA nao recebe');
  const r1 = await caixa.pagarOrcamentoSePendente(emp.id, emp.slug);
  t('nao pagou', r1.pagou === false);
  t('motivo certo', String(r1.motivo).indexOf('empresa') === 0);
  const s1 = (await pool.query(`SELECT COALESCE(saldo,0) s FROM corp_caixa WHERE corporation_id=$1`,[emp.id])).rows[0];
  t('caixa continua em 0', Number(s1 ? s1.s : 0) === 0);
  const l1 = (await pool.query(`SELECT COUNT(*)::int n FROM corp_orcamento_pago WHERE corporation_id=$1`,[emp.id])).rows[0].n;
  t('nao gravou linha de repasse', l1 === 0);
  t('resumoOrcamento devolve null (painel nao promete dinheiro)', (await caixa.resumoOrcamento(emp.id, emp.slug)) === null);

  console.log('\n[3] a CORP continua recebendo normalmente (nao quebrei nada)');
  const r2 = await caixa.pagarOrcamentoSePendente(pm.id, pm.slug);
  t('a PM pagou', r2.pagou === true);
  const s2 = (await pool.query(`SELECT saldo FROM corp_caixa WHERE corporation_id=$1`,[pm.id])).rows[0];
  t('caixa da PM subiu', Number(s2.saldo) > 0);
  console.log('      PM recebeu R$ ' + Number(s2.saldo).toLocaleString('pt-BR'));
  t('resumo da PM existe', (await caixa.resumoOrcamento(pm.id, pm.slug)) !== null);

  console.log('\n[4] a venda entregue credita o caixa da empresa');
  const v = await caixa.movDinheiro(emp.id, 'venda', 105, { quem: 'cliente', por: 'entregador' });
  t('venda creditou', v.ok === true && v.saldo === 105);

  console.log(`\n=== ${ok} passaram, ${f} falharam ===`);
  await pool.end(); process.exit(f?1:0);
})().catch(e => { console.error('EXPLODIU:', e.message); process.exit(1); });
