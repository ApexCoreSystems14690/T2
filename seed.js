require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const corps = [
  {
    name: 'Polícia Militar', slug: 'policia-militar', color: '#1E40AF',
    description: 'Corporação da Polícia Militar do Estado. Responsável pelo policiamento ostensivo e manutenção da ordem pública.',
    ranks: [
      { name: 'Comandante', level: 16, salary: 21000 },
      { name: 'Sub-Comandante', level: 15, salary: 18000 },
      { name: 'Tenente-Coronel', level: 14, salary: 13000 },
      { name: 'Major', level: 13, salary: 11000 },
      { name: 'Capitão', level: 12, salary: 8500 },
      { name: 'Primeiro-Tenente', level: 11, salary: 6000 },
      { name: 'Segundo-Tenente', level: 10, salary: 5000 },
      { name: 'Aspirante-A-Oficial', level: 9, salary: 5000 },
      { name: 'Sub-Tenente', level: 8, salary: 4000 },
      { name: '1º Sargento', level: 7, salary: 3500 },
      { name: '2º Sargento', level: 6, salary: 3000 },
      { name: '3º Sargento', level: 5, salary: 2500 },
      { name: 'Cabo', level: 4, salary: 2000 },
      { name: 'Soldado', level: 3, salary: 1200 },
      { name: 'Recruta', level: 2, salary: 1200 },
      { name: 'Holder', level: 1, salary: 2125 },
    ]
  },
  {
    name: 'CHOQUE', slug: 'choque', color: '#1F2937',
    description: 'Batalhão de Choque. Unidade especializada em operações de controle de distúrbios e ações táticas.',
    ranks: [
      { name: 'Comandante', level: 16, salary: 21000 },
      { name: 'Sub-Comandante', level: 15, salary: 18000 },
      { name: 'Tenente-Coronel', level: 14, salary: 13000 },
      { name: 'Major', level: 13, salary: 11000 },
      { name: 'Capitão', level: 12, salary: 8500 },
      { name: 'Primeiro-Tenente', level: 11, salary: 6000 },
      { name: 'Segundo-Tenente', level: 10, salary: 5000 },
      { name: 'Aspirante-A-Oficial', level: 9, salary: 5000 },
      { name: 'Sub-Tenente', level: 8, salary: 4000 },
      { name: '1º Sargento', level: 7, salary: 3500 },
      { name: '2º Sargento', level: 6, salary: 3000 },
      { name: '3º Sargento', level: 5, salary: 2500 },
      { name: 'Cabo', level: 4, salary: 2000 },
      { name: 'Soldado', level: 3, salary: 1200 },
      { name: 'Recruta', level: 2, salary: 1200 },
      { name: 'Holder', level: 1, salary: 2125 },
    ]
  },
  {
    name: 'BOPE', slug: 'bope', color: '#DC2626',
    description: 'Batalhão de Operações Policiais Especiais. Unidade de elite para operações de alto risco.',
    ranks: [
      { name: 'Comandante', level: 14, salary: 21000 },
      { name: 'Sub-Comandante', level: 13, salary: 18000 },
      { name: 'Tenente-Coronel', level: 12, salary: 13000 },
      { name: 'Major', level: 11, salary: 11000 },
      { name: 'Capitão', level: 10, salary: 8500 },
      { name: 'Primeiro-Tenente', level: 9, salary: 6000 },
      { name: 'Segundo-Tenente', level: 8, salary: 5000 },
      { name: 'Aspirante-A-Oficial', level: 7, salary: 5000 },
      { name: 'Sub-Tenente', level: 6, salary: 4000 },
      { name: '1º Sargento', level: 5, salary: 3500 },
      { name: '2º Sargento', level: 4, salary: 3000 },
      { name: '3º Sargento', level: 3, salary: 2500 },
      { name: 'Cabo', level: 2, salary: 2000 },
      { name: 'Soldado', level: 1, salary: 1200 },
    ]
  },
  {
    name: 'Polícia Civil', slug: 'policia-civil', color: '#7C3AED',
    description: 'Polícia Civil do Estado. Responsável pela investigação criminal e polícia judiciária.',
    ranks: [
      { name: '[DLG-G] Delegado Geral', level: 18, salary: 19000 },
      { name: '[DLG-ADJ] Delegado Adjunto', level: 17, salary: 17000 },
      { name: '[DLG-1º] Delegado de Primeira Classe', level: 16, salary: 15000 },
      { name: '[DLG-2º] Delegado de Segunda Classe', level: 15, salary: 14500 },
      { name: '[DLG-3º] Delegado de Terceira Classe', level: 14, salary: 13500 },
      { name: '[ESC] Escrivão', level: 13, salary: 11500 },
      { name: '[PRT-C] Perito Criminal', level: 12, salary: 11000 },
      { name: '[LEG] Legista', level: 11, salary: 10500 },
      { name: '[INV-1º] Investigador de Primeira Classe', level: 10, salary: 10000 },
      { name: '[INV-2º] Investigador de Segunda Classe', level: 9, salary: 9500 },
      { name: '[INV-3º] Investigador de Terceira Classe', level: 8, salary: 9000 },
      { name: '[INV] Investigador', level: 7, salary: 8650 },
      { name: '[AGT-1º] Agente de Primeira Classe', level: 6, salary: 7650 },
      { name: '[AGT-2º] Agente de Segunda Classe', level: 5, salary: 5950 },
      { name: '[AGT-3º] Agente de Terceira Classe', level: 4, salary: 4250 },
      { name: '[AGT-P] Agente de Polícia', level: 3, salary: 2550 },
      { name: 'Aluno', level: 2, salary: 2210 },
      { name: 'Holder', level: 1, salary: 2125 },
    ]
  },
  {
    name: 'SAMU', slug: 'samu', color: '#EF4444',
    description: 'Serviço de Atendimento Móvel de Urgência. Responsável pelo atendimento médico de emergência.',
    ranks: [
      { name: 'Diretor Externo', level: 11, salary: 21000 },
      { name: 'Diretor Externo Interino', level: 10, salary: 18000 },
      { name: 'Vice-Diretor', level: 9, salary: 15000 },
      { name: 'Chefe de Medicina', level: 8, salary: 12500 },
      { name: 'Supervisor Geral', level: 7, salary: 11000 },
      { name: 'Supervisor em Estágio', level: 6, salary: 9600 },
      { name: 'Condutor Socorrista', level: 5, salary: 8000 },
      { name: 'Médico Hospitalar', level: 4, salary: 6500 },
      { name: 'Médico Socorrista', level: 3, salary: 5500 },
      { name: 'Enfermeiro', level: 2, salary: 4500 },
      { name: 'Estagiário de Medicina', level: 1, salary: 3000 },
    ]
  },
  {
    name: 'ROTAM', slug: 'rotam', color: '#059669',
    description: 'Rondas Ostensivas Táticas Metropolitanas. Unidade de patrulhamento tático.',
    ranks: [
      { name: 'Comandante', level: 15, salary: 21000 },
      { name: 'Sub-Comandante', level: 14, salary: 18000 },
      { name: 'Coronel', level: 13, salary: 16000 },
      { name: 'Tenente-Coronel', level: 12, salary: 13000 },
      { name: 'Major', level: 11, salary: 11000 },
      { name: 'Capitão', level: 10, salary: 8500 },
      { name: 'Primeiro-Tenente', level: 9, salary: 6000 },
      { name: 'Segundo-Tenente', level: 8, salary: 5000 },
      { name: 'Aspirante-A-Oficial', level: 7, salary: 5000 },
      { name: 'Sub-Tenente', level: 6, salary: 4000 },
      { name: '1º Sargento', level: 5, salary: 3500 },
      { name: '2º Sargento', level: 4, salary: 3000 },
      { name: '3º Sargento', level: 3, salary: 2500 },
      { name: 'Cabo', level: 2, salary: 2000 },
      { name: 'Soldado', level: 1, salary: 1200 },
    ]
  },
  {
    name: 'Governo', slug: 'governo', color: '#D97706',
    description: 'Governo do Estado. Administração pública e gestão governamental.',
    ranks: [
      { name: 'Governador', level: 3, salary: 32000 },
      { name: 'Prefeito', level: 2, salary: 26000 },
      { name: 'Deputado', level: 1, salary: 18000 },
    ]
  },
  {
    name: 'Polícia Federal', slug: 'policia-federal', color: '#1D4ED8',
    description: 'Polícia Federal. Responsável por crimes federais, tráfico internacional e segurança de fronteiras.',
    ranks: [
      { name: 'Diretor Geral', level: 13, salary: 26000 },
      { name: 'Diretor', level: 12, salary: 23500 },
      { name: 'Diretor Adjunto', level: 11, salary: 20000 },
      { name: 'Perito Criminal', level: 10, salary: 17000 },
      { name: 'Investigador', level: 9, salary: 14000 },
      { name: 'Sub-Investigador', level: 8, salary: 13000 },
      { name: 'Escrivão', level: 7, salary: 12000 },
      { name: 'Agente Especial', level: 6, salary: 10000 },
      { name: 'Agente Operacional', level: 5, salary: 8000 },
      { name: 'Agente 1º Classe', level: 4, salary: 7500 },
      { name: 'Agente 2º Classe', level: 3, salary: 7000 },
      { name: 'Agente 3º Classe', level: 2, salary: 4250 },
      { name: 'Aluno', level: 1, salary: 2125 },
    ]
  },
  {
    name: 'Jornal Nacional', slug: 'jornal', color: '#F59E0B',
    description: 'Jornal Nacional. Cobertura jornalística e reportagens da cidade.',
    ranks: [
      { name: 'Diretores', level: 3, salary: 9350 },
      { name: 'Jornalista', level: 2, salary: 1700 },
      { name: 'Holder', level: 1, salary: 2125 },
    ]
  },
  {
    name: 'Pavuna', slug: 'pavuna', color: '#991B1B',
    description: 'Facção Pavuna. Organização do submundo da cidade.',
    ranks: [
      { name: 'Proprietário', level: 3, salary: 21000 },
      { name: 'Administrador', level: 2, salary: 15000 },
      { name: 'Membro', level: 1, salary: 10000 },
    ]
  },
  {
    name: 'Franca', slug: 'franca', color: '#78350F',
    description: 'Facção Franca. Organização rival no submundo.',
    ranks: []
  },
  {
    name: 'Bombeiro Militar', slug: 'bombeiro-militar', color: '#F97316',
    description: 'Corpo de Bombeiros Militar. Combate a incêndios, resgates e atendimento de emergência.',
    ranks: []
  },
  { name: 'Extra 1', slug: 'extra-1', description: 'Corporação reserva 1.', color: '#6B7280', ranks: [] },
  { name: 'Extra 2', slug: 'extra-2', description: 'Corporação reserva 2.', color: '#6B7280', ranks: [] },
  { name: 'Extra 3', slug: 'extra-3', description: 'Corporação reserva 3.', color: '#6B7280', ranks: [] },
  { name: 'Extra 4', slug: 'extra-4', description: 'Corporação reserva 4.', color: '#6B7280', ranks: [] },
  { name: 'Extra 5', slug: 'extra-5', description: 'Corporação reserva 5.', color: '#6B7280', ranks: [] },
  { name: 'Extra 6', slug: 'extra-6', description: 'Corporação reserva 6.', color: '#6B7280', ranks: [] },
  { name: 'Extra 7', slug: 'extra-7', description: 'Corporação reserva 7.', color: '#6B7280', ranks: [] },
  { name: 'Extra 8', slug: 'extra-8', description: 'Corporação reserva 8.', color: '#6B7280', ranks: [] },
  { name: 'Extra 9', slug: 'extra-9', description: 'Corporação reserva 9.', color: '#6B7280', ranks: [] },
  { name: 'Extra 10', slug: 'extra-10', description: 'Corporação reserva 10.', color: '#6B7280', ranks: [] },
  { name: 'Extra 11', slug: 'extra-11', description: 'Corporação reserva 11.', color: '#6B7280', ranks: [] },
  { name: 'Extra 12', slug: 'extra-12', description: 'Corporação reserva 12.', color: '#6B7280', ranks: [] },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Pega o owner
    let res = await client.query('SELECT id FROM users WHERE is_admin = true LIMIT 1');
    if (res.rows.length === 0) {
      res = await client.query('SELECT id FROM users ORDER BY id LIMIT 1');
    }
    const ownerId = res.rows[0].id;
    console.log(`Owner ID: ${ownerId}`);

    for (const corp of corps) {
      // Upsert da corporação
      const corpRes = await client.query(
        `INSERT INTO corporations (name, slug, description, owner_id, color, max_members)
         VALUES ($1, $2, $3, $4, $5, 100)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
         RETURNING id`,
        [corp.name, corp.slug, corp.description, ownerId, corp.color]
      );
      const corpId = corpRes.rows[0].id;

      if (corp.ranks.length > 0) {
        // Limpa cargos existentes e recria
        await client.query('DELETE FROM ranks WHERE corporation_id = $1', [corpId]);
        for (const rank of corp.ranks) {
          await client.query(
            'INSERT INTO ranks (corporation_id, name, level, salary) VALUES ($1, $2, $3, $4)',
            [corpId, rank.name, rank.level, rank.salary]
          );
        }
      }

      console.log(`✅ ${corp.name} (${corp.slug}) — ${corp.ranks.length} cargos`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 Seed completo! Todas as corporações criadas.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
