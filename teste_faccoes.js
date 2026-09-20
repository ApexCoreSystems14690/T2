// QA das migrações de 20/09: facção Pavuna, painel de facções e carreira da PC.
// Roda contra um Postgres de verdade, local. Nada toca o Railway.
const fs = require('fs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://qa@localhost:5455/postgres' });

// Pega os blocos SQL exatamente como estão no index.js — se o arquivo mudar, o teste muda junto.
function blocosDoIndex() {
  const src = fs.readFileSync('./src/index.js', 'utf8');
  const ini = src.indexOf('// ===== FACÇÕES (20/09/2026');
  const fim = src.indexOf("console.log('✅ Banco migrado');");
  if (ini < 0 || fim < 0) throw new Error('não achei os blocos novos no index.js');
  const trecho = src.slice(ini, fim);
  const out = [];
  const re = /await pool\.query\(`([\s\S]*?)`\);/g;
  let m;
  while ((m = re.exec(trecho)) !== null) out.push(m[1]);
  return out;
}

let falhas = 0, testes = 0;
function ok(nome, cond, extra) {
  testes++;
  if (cond) { console.log('  ok   ' + nome); }
  else { falhas++; console.log('  FALHA ' + nome + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')); }
}

async function main() {
  const base = fs.readFileSync('./src/db/migrate.js', 'utf8');
  const sqlBase = base.slice(base.indexOf('const migration = `') + 19, base.indexOf('`;\n\nasync function run'));
  await pool.query(sqlBase);
  console.log('esquema base criado');

  // --- fixture: PC com os cargos ANTIGOS e membros espalhados ---
  await pool.query(`
    INSERT INTO users (discord_id, discord_username, roblox_id) VALUES
      ('1','delegado',101), ('2','perito',102), ('3','agente',103),
      ('4','legista',104), ('5','semmapa',105), ('6','semcargo',106)
    ON CONFLICT DO NOTHING;
    INSERT INTO corporations (name, slug, color) VALUES ('Polícia Civil','policia-civil','#123456')
      ON CONFLICT DO NOTHING;
    INSERT INTO corporations (name, slug, color) VALUES ('Jornal Nacional','jornal','#F59E0B')
      ON CONFLICT DO NOTHING;
  `);
  const cid = (await pool.query(`SELECT id FROM corporations WHERE slug='policia-civil'`)).rows[0].id;
  const antigos = [
    ['[DLG-G] Delegado Geral', 18, 19000], ['[PRT-C] Perito Criminal', 12, 11000],
    ['[AGT-P] Agente de Polícia', 3, 2550], ['[LEG] Legista', 11, 10500],
    ['Cargo Inventado Que Ninguem Mapeou', 2, 1000], ['Aluno', 1, 2210],
  ];
  for (const [n, l, s] of antigos) {
    await pool.query('INSERT INTO ranks (corporation_id,name,level,salary) VALUES ($1,$2,$3,$4)', [cid, n, l, s]);
  }
  const rid = async (n) => (await pool.query('SELECT id FROM ranks WHERE corporation_id=$1 AND name=$2', [cid, n])).rows[0].id;
  const pares = [[1,'[DLG-G] Delegado Geral'],[2,'[PRT-C] Perito Criminal'],[3,'[AGT-P] Agente de Polícia'],
                 [4,'[LEG] Legista'],[5,'Cargo Inventado Que Ninguem Mapeou']];
  for (const [u, n] of pares) {
    await pool.query('INSERT INTO members (corporation_id,user_id,rank_id) VALUES ($1,$2,$3)', [cid, u, await rid(n)]);
  }
  // membro SEM cargo nenhum (rank_id NULL) — o caso que mais quebra
  await pool.query('INSERT INTO members (corporation_id,user_id,rank_id) VALUES ($1,6,NULL)', [cid]);
  const membrosAntes = (await pool.query('SELECT COUNT(*)::int c FROM members WHERE corporation_id=$1', [cid])).rows[0].c;

  // --- roda as migrações (duas vezes, pra provar que é idempotente) ---
  const blocos = blocosDoIndex();
  console.log('blocos SQL encontrados no index.js: ' + blocos.length);
  for (const volta of [1, 2]) {
    for (const b of blocos) await pool.query(b);
    console.log('migração rodada (volta ' + volta + ')');
  }

  console.log('\n== coluna tipo / painel ==');
  const col = await pool.query(`SELECT data_type, column_default FROM information_schema.columns
                                WHERE table_name='corporations' AND column_name='tipo'`);
  ok('coluna tipo existe com default corp', col.rows.length === 1 && /corp/.test(col.rows[0].column_default || ''), col.rows[0]);
  const pcTipo = (await pool.query(`SELECT tipo FROM corporations WHERE slug='policia-civil'`)).rows[0].tipo;
  ok("PC continua tipo 'corp'", pcTipo === 'corp', pcTipo);

  console.log('\n== facção Pavuna ==');
  const pav = (await pool.query(`SELECT * FROM corporations WHERE slug='pavuna'`)).rows;
  ok('Pavuna existe', pav.length === 1);
  ok("Pavuna é tipo 'faccao'", pav[0] && pav[0].tipo === 'faccao', pav[0] && pav[0].tipo);
  ok('Pavuna tem ícone', !!(pav[0] && pav[0].icon_url));
  const cargosPav = (await pool.query('SELECT name,level,salary FROM ranks WHERE corporation_id=$1 ORDER BY level DESC', [pav[0].id])).rows;
  ok('Pavuna tem 14 cargos (sem duplicar na 2a volta)', cargosPav.length === 14, cargosPav.length);
  ok('topo da Pavuna é Dono do Morro 21000', cargosPav[0].name === 'Dono do Morro' && cargosPav[0].salary === 21000, cargosPav[0]);
  ok('base da Pavuna é Novato 1200', cargosPav[13].name === 'Novato' && cargosPav[13].salary === 1200, cargosPav[13]);
  ok('níveis da Pavuna são 14..1 sem buraco',
     cargosPav.every((c, i) => c.level === 14 - i), cargosPav.map(c => c.level));

  console.log('\n== ícone do Jornal ==');
  const jor = (await pool.query(`SELECT icon_url FROM corporations WHERE slug='jornal'`)).rows[0];
  ok('Jornal ganhou ícone', !!jor.icon_url, jor.icon_url);

  console.log('\n== carreira da Polícia Civil ==');
  const novos = (await pool.query('SELECT name,level,salary FROM ranks WHERE corporation_id=$1 ORDER BY level DESC', [cid])).rows;
  ok('PC tem 21 cargos', novos.length === 21, novos.length);
  ok('nenhum cargo antigo sobrou', !novos.some(r => /^\[DLG|^\[AGT|^\[PRT|^\[LEG|^\[INV-\d º|Inventado|^Aluno$/.test(r.name)),
     novos.filter(r => /DLG|AGT|PRT|LEG|Inventado|^Aluno$/.test(r.name)).map(r => r.name));
  ok('topo é [DG] Delegado-Geral', novos[0].name === '[DG] Delegado-Geral', novos[0]);
  ok('níveis 21..1 sem buraco', novos.every((c, i) => c.level === 21 - i), novos.map(c => c.level));
  ok('nenhum nível >= 100 sobrou (temporários limpos)', !novos.some(c => c.level >= 100));

  const semCargo = (await pool.query('SELECT user_id FROM members WHERE corporation_id=$1 AND rank_id IS NULL', [cid])).rows;
  ok('NINGUÉM ficou sem cargo', semCargo.length === 0, semCargo);
  const membrosDepois = (await pool.query('SELECT COUNT(*)::int c FROM members WHERE corporation_id=$1', [cid])).rows[0].c;
  ok('nenhum membro sumiu', membrosDepois === membrosAntes, { antes: membrosAntes, depois: membrosDepois });

  const destino = async (u) => (await pool.query(
    'SELECT r.name FROM members m JOIN ranks r ON m.rank_id=r.id WHERE m.corporation_id=$1 AND m.user_id=$2', [cid, u])).rows[0].name;
  ok('Delegado Geral -> [DG] Delegado-Geral', await destino(1) === '[DG] Delegado-Geral', await destino(1));
  ok('Perito Criminal -> [PER-1] 1ª Classe', await destino(2) === '[PER-1] Perito Criminal 1ª Classe', await destino(2));
  ok('Agente de Polícia -> [APJ-3] 3ª Classe', await destino(3) === '[APJ-3] Agente de Polícia Judiciária 3ª Classe', await destino(3));
  ok('Legista -> [PER-2] 2ª Classe', await destino(4) === '[PER-2] Perito Criminal 2ª Classe', await destino(4));
  ok('cargo sem mapa -> [ESPC] Instruendo', await destino(5) === '[ESPC] Instruendo', await destino(5));
  ok('membro que estava SEM cargo -> [ESPC] Instruendo', await destino(6) === '[ESPC] Instruendo', await destino(6));

  console.log('\n' + (falhas === 0 ? 'TUDO PASSOU' : falhas + ' FALHA(S)') + ' — ' + testes + ' testes');
  await pool.end();
  process.exit(falhas === 0 ? 0 : 1);
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
