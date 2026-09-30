const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const CC = require('./src/corp-caixa');
let ok=0, f=0; const t=(n,c)=>{ c?(ok++,console.log('  OK   '+n)):(f++,console.log('  FALHOU '+n)); };

(async () => {
  console.log('\n[1] nucleo: motivos novos');
  t("DINHEIRO.salario existe e e saida", CC.DINHEIRO.salario && CC.DINHEIRO.salario.sinal === -1);
  t("ESTOQUE.recuperou credita a prateleira", CC.ESTOQUE.recuperou && CC.ESTOQUE.recuperou.estoque === 1 && CC.ESTOQUE.recuperou.emprestado === 0 && CC.ESTOQUE.recuperou.perda === false);

  console.log('\n[2] nucleo: debito recusa caixa descoberto');
  t("paga 300 de 1000", CC.aplicarDinheiro(1000,'salario',300).ok === true);
  t("saldo vira 700", CC.aplicarDinheiro(1000,'salario',300).saldo === 700);
  const r0 = CC.aplicarDinheiro(200,'salario',300);
  t("recusa 300 de 200", r0.ok === false && r0.erro === 'saldo');
  t("diz quanto falta", r0.falta === 100);
  t("recusa valor 0", CC.aplicarDinheiro(1000,'salario',0).ok === false);
  t("recusa valor negativo", CC.aplicarDinheiro(1000,'salario',-50).ok === false);

  console.log('\n[3] a tabela do JS bate com a do Luau (motivos de estoque)');
  const luau = ['retirou','devolveu','saiu','roubada','morreu','recuperou','comprou','baixa'];
  const js = Object.keys(CC.ESTOQUE).sort();
  t("mesmos motivos dos dois lados", JSON.stringify(js) === JSON.stringify([...luau].sort()));

  console.log('\n[4] banco: movDinheiro salario numa empresa de verdade');
  const caixa = require('./src/corp-caixa-db');
  const c = (await pool.query(`SELECT id FROM corporations WHERE slug='mercado-fechado'`)).rows[0];
  await pool.query(`UPDATE corp_caixa SET saldo=0 WHERE corporation_id=$1`, [c.id]);
  let r = await caixa.movDinheiro(c.id, 'salario', 400, { quem:'Julio' });
  t("caixa zerado recusa", r.ok === false && r.erro === 'saldo');
  await pool.query(`UPDATE corp_caixa SET saldo=1000 WHERE corporation_id=$1`, [c.id]);
  r = await caixa.movDinheiro(c.id, 'salario', 400, { quem:'Julio' });
  t("com 1000 paga 400", r.ok === true && r.saldo === 600);
  const saldoDb = (await pool.query(`SELECT saldo FROM corp_caixa WHERE corporation_id=$1`,[c.id])).rows[0].saldo;
  t("gravou no banco", Number(saldoDb) === 600);
  const lanc = (await pool.query(`SELECT tipo, valor FROM corp_lancamentos WHERE corporation_id=$1 ORDER BY id DESC LIMIT 1`,[c.id])).rows[0];
  t("lancamento tipo=salario", lanc && lanc.tipo === 'salario');
  t("lancamento com sinal negativo", lanc && Number(lanc.valor) === -400);

  console.log('\n[5] banco: movEstoque recuperou credita a prateleira');
  await caixa.movEstoque(c.id, 'comprou', 'comando', 'Pizza');
  await caixa.movEstoque(c.id, 'retirou', 'Ze', 'Pizza');
  let e = await caixa.movEstoque(c.id, 'roubada', 'Ze', 'Pizza');       // dropou
  t("drop (roubada) passa", e.ok === true);
  let e2 = await caixa.movEstoque(c.id, 'devolveu', 'Ze', 'Pizza');
  t("devolveu agora da nao_tem", e2.ok === false && e2.erro === 'nao_tem');
  let e3 = await caixa.movEstoque(c.id, 'recuperou', 'Ze', 'Pizza');
  t("recuperou passa", e3.ok === true);
  const est = (await pool.query(`SELECT qtd FROM corp_estoque WHERE corporation_id=$1 AND item='Pizza'`,[c.id])).rows[0];
  t("prateleira voltou a 1 Pizza", est && Number(est.qtd) === 1);

  console.log('\n[6] a consulta do /corp/salario acha o cargo e o adicional');
  await pool.query(`INSERT INTO users (discord_id, discord_username, roblox_id) VALUES ('555','entregador1',987654)
                    ON CONFLICT (discord_id) DO UPDATE SET roblox_id=987654`);
  const u = (await pool.query(`SELECT id FROM users WHERE discord_id='555'`)).rows[0];
  const rk = (await pool.query(`SELECT id FROM ranks WHERE corporation_id=$1 AND name='Entregador Trainee'`,[c.id])).rows[0];
  await pool.query(`UPDATE ranks SET salary=250 WHERE id=$1`, [rk.id]);
  await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3)
                    ON CONFLICT (corporation_id, user_id) DO UPDATE SET rank_id=$3`, [c.id,u.id,rk.id]);
  const m = await pool.query(
    `SELECT r.name AS cargo, COALESCE(r.salary,0) AS adicional
       FROM members mb JOIN users u ON u.id=mb.user_id LEFT JOIN ranks r ON r.id=mb.rank_id
      WHERE mb.corporation_id=$1 AND u.roblox_id=$2 LIMIT 1`, [c.id, 987654]);
  t("achou o membro pelo roblox_id", m.rows.length === 1);
  t("cargo certo", m.rows[0] && m.rows[0].cargo === 'Entregador Trainee');
  t("adicional 250", m.rows[0] && Number(m.rows[0].adicional) === 250);
  const naoMembro = await pool.query(
    `SELECT 1 FROM members mb JOIN users u ON u.id=mb.user_id WHERE mb.corporation_id=$1 AND u.roblox_id=$2`, [c.id, 111]);
  t("quem nao e membro nao aparece", naoMembro.rows.length === 0);

  console.log(`\n=== ${ok} passaram, ${f} falharam ===`);
  await pool.end(); process.exit(f?1:0);
})().catch(e => { console.error('EXPLODIU:', e.message); process.exit(1); });
