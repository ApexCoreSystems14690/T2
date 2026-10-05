// ===========================================================================
// AUDITORIA DO SUMIÇO — 05/10/2026
// Responde: "ele apagou alguma conta do site?" e "quais?".
//
// SÓ LÊ. Não tem um único INSERT/UPDATE/DELETE aqui dentro. Pode rodar à vontade.
//
// Como rodar (PowerShell, dentro de D:\T2):
//   $env:DATABASE_URL="<a URL do Postgres do Railway>"
//   node auditoria_sumico.js
//
// (no cmd.exe:  set DATABASE_URL=...   e depois  node auditoria_sumico.js)
//
// A URL está no Railway: serviço Postgres → aba Variables → DATABASE_URL
// (use a PÚBLICA, a que tem um host .proxy.rlwy.net ou parecido).
// ===========================================================================
const { Pool } = require('pg');

const URL = process.env.DATABASE_URL;
if (!URL) {
  console.error('\nFalta a DATABASE_URL. Veja o cabeçalho deste arquivo.\n');
  process.exit(1);
}
const local = /localhost|127\.0\.0\.1/.test(URL);
const pool = new Pool({ connectionString: URL, ssl: local ? false : { rejectUnauthorized: false }, max: 3 });

const linha = (t) => console.log('\n' + '='.repeat(72) + '\n' + t + '\n' + '='.repeat(72));
const data = (d) => d ? new Date(d).toLocaleString('pt-BR') : '—';

(async () => {
  try {
    // -------------------------------------------------------------------
    linha('1. BURACOS NA NUMERAÇÃO DAS CONTAS  (cada buraco = 1 conta apagada)');
    // users.id é SERIAL: o número nunca se repete e nunca é reaproveitado.
    // Logo, um id que não existe mais é uma linha que foi DELETADA.
    const seq = await pool.query(`SELECT last_value FROM users_id_seq`);
    const tot = await pool.query(`SELECT COUNT(*)::int AS vivas, MIN(id)::int AS menor, MAX(id)::int AS maior FROM users`);
    const criadas = Number(seq.rows[0].last_value);
    const { vivas, menor, maior } = tot.rows[0];
    console.log(`  contas já criadas desde sempre : ${criadas}`);
    console.log(`  contas vivas agora             : ${vivas}`);
    console.log(`  faixa de ids                   : ${menor} .. ${maior}`);
    console.log(`  >>> APAGADAS (em algum momento): ${criadas - vivas}`);

    const buracos = await pool.query(`
      SELECT s AS id_sumido FROM generate_series(1, (SELECT MAX(id) FROM users)) s
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s)
      ORDER BY s`);
    if (buracos.rows.length === 0) {
      console.log('\n  Nenhum buraco. Nenhuma conta foi apagada. :)');
    } else {
      console.log(`\n  ${buracos.rows.length} id(s) sumido(s). Datando cada um pelos vizinhos:\n`);
      for (const b of buracos.rows) {
        const id = b.id_sumido;
        const viz = await pool.query(`
          SELECT
            (SELECT created_at FROM users WHERE id < $1 ORDER BY id DESC LIMIT 1) AS antes,
            (SELECT created_at FROM users WHERE id > $1 ORDER BY id ASC  LIMIT 1) AS depois`, [id]);
        const v = viz.rows[0];
        console.log(`   id ${String(id).padStart(5)}  — criado entre ${data(v.antes)} e ${data(v.depois)}`);
      }
      console.log('\n  (a data acima é de QUANDO A CONTA FOI CRIADA, não de quando sumiu)');
    }

    // -------------------------------------------------------------------
    linha('2. CORPORAÇÕES QUE FICARAM SEM DONO  (o sintoma mais barulhento)');
    const semDono = await pool.query(`
      SELECT id, name, slug, is_active, updated_at,
             (SELECT COUNT(*) FROM members m WHERE m.corporation_id = c.id)::int AS membros
      FROM corporations c WHERE owner_id IS NULL ORDER BY updated_at DESC NULLS LAST`);
    if (semDono.rows.length === 0) console.log('  Nenhuma. Bom sinal.');
    else {
      console.log(`  ${semDono.rows.length} corporação(ões) com owner_id = NULL:\n`);
      for (const c of semDono.rows)
        console.log(`   #${c.id}  ${c.name}  (${c.membros} membros, ativa=${c.is_active}, mexida em ${data(c.updated_at)})`);
      console.log('\n  Pode ser do ataque OU de alguém que saiu normalmente. Confira uma a uma no painel.');
    }

    // -------------------------------------------------------------------
    linha('3. FILIAÇÃO ROUBADA  (prova forte: membro mais velho que a conta)');
    // members.joined_at nao muda quando o user_id e trocado. Entao uma filiacao
    // com data ANTERIOR a criacao da conta que a segura so pode ter sido movida.
    const roubadas = await pool.query(`
      SELECT m.id, m.joined_at, c.name AS corp, u.id AS user_id,
             u.discord_username, u.discord_id, u.roblox_username, u.created_at
      FROM members m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN corporations c ON c.id = m.corporation_id
      WHERE m.joined_at < u.created_at - INTERVAL '1 minute'
      ORDER BY u.id, m.joined_at`);
    if (roubadas.rows.length === 0) console.log('  Nenhuma. Nenhuma filiação foi transferida pra outra conta.');
    else {
      console.log(`  ${roubadas.rows.length} filiação(ões) em conta criada DEPOIS da filiação existir:\n`);
      for (const r of roubadas.rows)
        console.log(`   "${r.corp}" entrou em ${data(r.joined_at)} mas está na conta #${r.user_id} ` +
                    `(${r.discord_username || r.discord_id}) criada em ${data(r.created_at)}`);
      console.log('\n  >>> Essas contas são as que ABSORVERAM filiação de outro. Olhe com carinho.');
    }

    // -------------------------------------------------------------------
    linha('4. QUEM ESTÁ EM MAIS CORPORAÇÕES  (o atacante infla aqui)');
    const conc = await pool.query(`
      SELECT u.id, u.discord_id, u.discord_username, u.roblox_id, u.roblox_username,
             u.created_at, u.updated_at, COUNT(m.id)::int AS corps
      FROM users u JOIN members m ON m.user_id = u.id
      GROUP BY u.id ORDER BY corps DESC, u.updated_at DESC LIMIT 10`);
    for (const u of conc.rows)
      console.log(`   ${String(u.corps).padStart(3)} corps — #${u.id} ${u.discord_username || u.discord_id} ` +
                  `[roblox ${u.roblox_username || u.roblox_id || '—'}]  criada ${data(u.created_at)}  mexida ${data(u.updated_at)}`);

    // -------------------------------------------------------------------
    linha('5. CONTAS MEXIDAS NAS ÚLTIMAS 48H  (vincular Roblox carimba updated_at)');
    const recentes = await pool.query(`
      SELECT id, discord_id, discord_username, roblox_id, roblox_username, created_at, updated_at
      FROM users WHERE updated_at > NOW() - INTERVAL '48 hours' ORDER BY updated_at DESC LIMIT 40`);
    if (recentes.rows.length === 0) console.log('  Nenhuma.');
    else for (const u of recentes.rows)
      console.log(`   ${data(u.updated_at)}  #${u.id} ${u.discord_username || u.discord_id} ` +
                  `→ roblox ${u.roblox_username || u.roblox_id || '—'}  (conta de ${data(u.created_at)})`);

    // -------------------------------------------------------------------
    linha('6. PLACEHOLDERS QUE AINDA EXISTEM  (eram os alvos do buraco)');
    const ph = await pool.query(`
      SELECT COUNT(*)::int AS n FROM users WHERE discord_id LIKE 'roblox\\_%'`);
    console.log(`  ${ph.rows[0].n} conta(s) placeholder viva(s).`);
    console.log('  Antes do conserto, QUALQUER pessoa logada apagava uma dessas digitando o nome do Roblox.');

    // -------------------------------------------------------------------
    linha('7. ÚLTIMAS AÇÕES DE ADMIN REGISTRADAS');
    try {
      const au = await pool.query(`SELECT admin_nome, acao, detalhe, criado_em FROM admin_audit ORDER BY id DESC LIMIT 15`);
      if (au.rows.length === 0) console.log('  Vazio.');
      else for (const a of au.rows)
        console.log(`   ${data(a.criado_em)}  ${a.admin_nome}  ${a.acao}  ${JSON.stringify(a.detalhe).slice(0, 90)}`);
    } catch (e) {
      try {
        const au2 = await pool.query(`SELECT admin_nome, acao, detalhe, created_at FROM admin_audit ORDER BY id DESC LIMIT 15`);
        for (const a of au2.rows)
          console.log(`   ${data(a.created_at)}  ${a.admin_nome}  ${a.acao}  ${JSON.stringify(a.detalhe).slice(0, 90)}`);
      } catch (e2) { console.log('  (não consegui ler admin_audit: ' + e2.message + ')'); }
    }

    linha('FIM — nada neste script escreveu no banco.');
  } catch (err) {
    console.error('\nDEU ERRO: ' + err.message);
    if (/self.signed|certificate/i.test(err.message)) console.error('(parece SSL — confira se a DATABASE_URL é a pública do Railway)');
  } finally {
    await pool.end().catch(() => {});
  }
})();
