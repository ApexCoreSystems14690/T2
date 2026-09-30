// Teste de verdade contra um Postgres 16 local, com os arquivos novos.
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const perm = require('./src/permissoes');

let ok = 0, falhou = 0;
function t(nome, cond) { if (cond) { ok++; console.log('  OK   ' + nome); } else { falhou++; console.log('  FALHOU ' + nome); } }

(async () => {
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_cargo VARCHAR(24)");
  // --- base falsa
  await pool.query(`INSERT INTO users (discord_id, discord_username, is_admin, admin_cargo)
    VALUES ('111111111111111111','julio14690',true,NULL),
           ('222222222222222222','impostor',false,NULL),
           ('333333333333333333','zedir',true,'diretor'),
           ('444444444444444444','zesuper',true,'supervisor')
    ON CONFLICT (discord_id) DO NOTHING`);

  const u = n => pool.query('SELECT * FROM users WHERE discord_username=$1',[n]).then(r=>r.rows[0]);
  const julio = await u('julio14690'), imp = await u('impostor'),
        dir = await u('zedir'), sup = await u('zesuper');

  console.log('\n[1] ehDono SEM DONO_DISCORD_ID configurada (o caso do Railway hoje)');
  t('julio14690 e Dono pelo nome', perm.ehDono(julio) === true);
  t('impostor nao e Dono',         perm.ehDono(imp) === false);
  t('cargoDe(julio) = dono',       perm.cargoDe(julio) === 'dono');
  t('julio e Diretor+',            perm.ehDiretorOuMais(julio) === true);
  t('zedir e Diretor+',            perm.ehDiretorOuMais(dir) === true);
  t('zesuper NAO e Diretor+',      perm.ehDiretorOuMais(sup) === false);
  t('impostor nao e Diretor+',     perm.ehDiretorOuMais(imp) === false);

  console.log('\n[2] resolverDono trava no id da conta mais antiga');
  const achados = await perm.resolverDono(pool);
  t('resolveu 1 dono', achados.length === 1);
  t('resolveu o id certo', achados[0] && achados[0].discord_id === '111111111111111111');
  t('id entrou no cache', perm.DONO_IDS_RESOLVIDOS.has('111111111111111111'));
  // agora simula o Julio trocando de nome: o id continua valendo
  t('Dono por id mesmo com outro nome',
     perm.ehDono({ discord_id:'111111111111111111', discord_username:'julio_novo' }) === true);
  // e um homonimo NOVO (id diferente) -- pelo nome ainda passa, e por isso o log
  // manda travar por id; com DONO_DISCORD_ID setada ele ja nao passa (bloco 3).

  console.log('\n[3] o bug do Julio: DONO_DISCORD_ID com o NOME em vez do id');
  delete require.cache[require.resolve('./src/permissoes')];
  process.env.DONO_DISCORD_ID = 'julio14690';        // era isto que trancava
  const p2 = require('./src/permissoes');
  t('NAO tranca mais: julio continua Dono', p2.ehDono(julio) === true);
  t('impostor segue de fora',               p2.ehDono(imp) === false);

  console.log('\n[4] DONO_DISCORD_ID com o id numerico certo');
  delete require.cache[require.resolve('./src/permissoes')];
  process.env.DONO_DISCORD_ID = '111111111111111111';
  const p3 = require('./src/permissoes');
  t('Dono por id', p3.ehDono(julio) === true);
  t('homonimo com OUTRO id NAO e Dono',
     p3.ehDono({ discord_id:'999', discord_username:'julio14690' }) === false);

  console.log('\n[5] a consulta da pagina /organizacoes roda e traz os 3 tipos');
  await pool.query(`INSERT INTO corporations (name,slug,tipo,color) VALUES
     ('Policia Militar','pm','corp','#3B82F6'), ('Pavuna','pavuna','faccao','#EF4444')
     ON CONFLICT (slug) DO NOTHING`);
  const r = await pool.query(
    `SELECT c.id,c.name,c.slug,c.tipo,c.color,c.cnpj,c.is_active,
            (c.icon_data IS NOT NULL) AS has_icon_file, c.icon_url,
            u.discord_username AS dono_nome,
            (SELECT COUNT(*) FROM members m WHERE m.corporation_id=c.id) AS membros,
            (SELECT COUNT(*) FROM ranks  k WHERE k.corporation_id=c.id) AS cargos,
            COALESCE((SELECT saldo FROM corp_caixa cx WHERE cx.corporation_id=c.id),0) AS saldo
       FROM corporations c LEFT JOIN users u ON u.id=c.owner_id
      ORDER BY CASE c.tipo WHEN 'empresa' THEN 0 WHEN 'corp' THEN 1 ELSE 2 END, c.name`);
  const tipos = r.rows.map(x=>x.tipo);
  t('consulta rodou', r.rows.length >= 3);
  t('empresa vem primeiro', tipos[0] === 'empresa');
  const mf = r.rows.find(x=>x.slug==='mercado-fechado');
  t('Mercado Fechado semeado', !!mf);
  t('com CNPJ 34.627.847/0001-12', mf && mf.cnpj === '34.627.847/0001-12');
  t('com 10 cargos', mf && Number(mf.cargos) === 10);
  t('caixa em 0', mf && Number(mf.saldo) === 0);

  console.log('\n[6] a view renderiza com esses dados');
  const ejs=require('ejs'), fs=require('fs');
  const ROT={corp:'Corporação',faccao:'Facção',empresa:'Empresa'};
  const orgs=r.rows.map(o=>({...o,rotulo:ROT[o.tipo]||o.tipo}));
  let html='';
  try { html = ejs.render(fs.readFileSync('src/views/organizacoes.ejs','utf8'),
    {user:julio,orgs,resumo:{total:orgs.length,corp:1,faccao:1,empresa:1},cargo:'dono',ehStaff:true,ehDiretor:true},
    {filename:'src/views/organizacoes.ejs'}); } catch(e){ console.log('  render explodiu:', e.message); }
  t('renderizou', html.length > 1000);
  t('uma linha por organizacao', (html.match(/data-tipo=/g)||[]).length === orgs.length);
  t('mostra o CNPJ', html.includes('34.627.847/0001-12'));
  t('botao Gerenciar aponta pra /dashboard/corp/', html.includes('/dashboard/corp/'));

  console.log('\n[7] idempotencia: rodar a migracao de novo nao duplica nada');
  const antes = (await pool.query(`SELECT COUNT(*) c FROM ranks r JOIN corporations co ON co.id=r.corporation_id WHERE co.slug='mercado-fechado'`)).rows[0].c;
  await pool.query(`UPDATE ranks SET salary=777 WHERE name='CEO ' AND corporation_id=(SELECT id FROM corporations WHERE slug='mercado-fechado')`);
  const { execSync } = require('child_process');
  execSync(`PG_NOSSL=1 DATABASE_URL="${process.env.DATABASE_URL}" node src/db/migrate.js`, {cwd: process.cwd(), stdio:'pipe'});
  const depois = (await pool.query(`SELECT COUNT(*) c FROM ranks r JOIN corporations co ON co.id=r.corporation_id WHERE co.slug='mercado-fechado'`)).rows[0].c;
  const sal = (await pool.query(`SELECT salary FROM ranks WHERE name='CEO ' AND corporation_id=(SELECT id FROM corporations WHERE slug='mercado-fechado')`)).rows[0].salary;
  t('nao duplicou cargo', antes === depois);
  t('NAO zerou o adicional que o dono configurou (777)', Number(sal) === 777);

  console.log(`\n=== ${ok} passaram, ${falhou} falharam ===`);
  await pool.end();
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error('EXPLODIU:', e); process.exit(1); });
