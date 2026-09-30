// [30/09 Julio] Cadastra as EMPRESAS OFICIAIS do Santa Fé.
// Empresa = corporação com tipo = 'empresa'. NÃO recebe repasse do governo.
// Rodar: node seed_empresas.js      (é idempotente, pode rodar quantas vezes quiser)
const pool = require('./src/db/pool');

// O piso de R$ 500 é fixo e vem do jogo. O `adicional` daqui é o que o dono/diretor
// paga por cima, e ESSE sai do caixa da empresa. Começa tudo em 0 de propósito:
// quem decide quanto pagar é o dono, no painel.
const EMPRESAS = [
  {
    slug: 'mercado-fechado',
    name: 'Mercado Fechado',
    cnpj: '34.627.847/0001-12',   // montado sobre o groupId 34627847, DV pelo algoritmo da Receita
    color: '#22C55E',
    description: 'Delivery de produtos. O cliente pede pelo app, o entregador retira no estoque e leva.',
    // level: quanto MAIOR, mais alto o cargo. adicional: R$ por pagamento, além dos 500 fixos.
    cargos: [
      { name: 'CEO ',                            level: 10, adicional: 0, gestor: true },
      { name: 'Diretor Geral',                   level: 9,  adicional: 0, gestor: true },
      { name: 'Gerente de Operações',            level: 8,  adicional: 0, gestor: true },
      { name: 'Gerente de Recursos Humanos',     level: 7,  adicional: 0, gestor: true },
      { name: 'Supervisor de Logística',         level: 6,  adicional: 0, gestor: false },
      { name: 'Condutor de Carga Pesada',        level: 5,  adicional: 0, gestor: false },
      { name: 'Segurança de Carga',              level: 4,  adicional: 0, gestor: false },
      { name: 'Motorista de Logística',          level: 3,  adicional: 0, gestor: false },
      { name: 'Atendente de Suporte ao Cliente', level: 2,  adicional: 0, gestor: false },
      { name: 'Entregador Trainee',              level: 1,  adicional: 0, gestor: false },
    ],
  },
];

async function run() {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const e of EMPRESAS) {
      const up = await c.query(
        `INSERT INTO corporations (name, slug, description, color, tipo, cnpj)
              VALUES ($1, $2, $3, $4, 'empresa', $5)
         ON CONFLICT (slug) DO UPDATE
            SET tipo = 'empresa', cnpj = EXCLUDED.cnpj,
                name = EXCLUDED.name, color = EXCLUDED.color,
                description = EXCLUDED.description, updated_at = NOW()
         RETURNING id`, [e.name, e.slug, e.description, e.color, e.cnpj]);
      const id = up.rows[0].id;

      for (const g of e.cargos) {
        await c.query(
          `INSERT INTO ranks (corporation_id, name, level, salary, permissions)
                VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (corporation_id, name) DO UPDATE
              SET level = EXCLUDED.level, permissions = EXCLUDED.permissions`,
          [id, g.name, g.level, g.adicional, JSON.stringify({ gestor: !!g.gestor })]);
      }
      // caixa começa existindo em zero — empresa não ganha do governo, tem que faturar
      await c.query(
        `INSERT INTO corp_caixa (corporation_id, saldo) VALUES ($1, 0)
         ON CONFLICT (corporation_id) DO NOTHING`, [id]);

      console.log(`  ${e.name}  id=${id}  CNPJ ${e.cnpj}  ${e.cargos.length} cargos`);
    }
    await c.query('COMMIT');
    console.log('empresas oficiais cadastradas.');
  } catch (err) {
    await c.query('ROLLBACK');
    console.error('FALHOU, nada foi gravado:', err.message);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
}
run();
