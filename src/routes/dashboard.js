const router = require('express').Router();
const pool = require('../db/pool');
const { requireAuth, ctxDaCorp } = require('../middleware/auth');
const perm = require('../permissoes');

router.use(requireAuth);

// Dashboard principal — lista corporações do usuário
router.get('/', async (req, res) => {
  try {
    // [19/09] Agora lista TAMBEM as corporações em que a pessoa é só membro comum.
    // Antes o dashboard só mostrava o que ela GERENCIA, então um membro raso não via
    // a própria corp em lugar nenhum -- e por isso não tinha como sair dela sozinho.
    // pode_gerenciar diz se aparece o botão "Gerenciar"; sou_membro/sou_gerente
    // dizem se aparece o "Sair".
    const corps = await pool.query(
      `SELECT c.*, (SELECT COUNT(*) FROM members WHERE corporation_id = c.id) as member_count,
              (icon_data IS NOT NULL) as has_icon_file,
              (c.owner_id = $1) AS sou_dono,
              EXISTS (SELECT 1 FROM members mm WHERE mm.corporation_id = c.id AND mm.user_id = $1) AS sou_membro,
              EXISTS (SELECT 1 FROM corp_managers cg WHERE cg.corporation_id = c.id AND cg.user_id = $1) AS sou_gerente,
              (SELECT r.name FROM members mr LEFT JOIN ranks r ON mr.rank_id = r.id
                WHERE mr.corporation_id = c.id AND mr.user_id = $1) AS meu_cargo,
              -- [23/09, pedido do Julio] o membro comum ve o proprio salario no cartao
              (SELECT r.salary FROM members mr LEFT JOIN ranks r ON mr.rank_id = r.id
                WHERE mr.corporation_id = c.id AND mr.user_id = $1) AS meu_salario,
              ($2::boolean
                OR c.owner_id = $1
                OR c.id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)
                OR c.id IN (
                  -- [23/09] ANTES: "os 2 cargos do topo". Virava gerencia sem ninguem
                  -- escolher -- no Jornal (3 cargos) o JORNALISTA mandava na redacao.
                  -- AGORA: so o cargo de MAIOR nivel, e so se a corp tiver 2+ niveis;
                  -- ou o cargo que declarar permissions.gerir_membros. Mesma regra
                  -- que o corp-poderes.js aplica no back (CP.SQL_CHEFE).
                  SELECT m.corporation_id FROM members m
                  JOIN ranks r ON m.rank_id = r.id
                  WHERE m.user_id = $1 AND ${CP.SQL_CHEFE}
                )
              ) AS pode_gerenciar
       FROM corporations c
       WHERE c.tipo <> 'faccao'    -- [20/09] faccao tem painel proprio: /faccoes
         AND ($2::boolean
          OR c.owner_id = $1
          OR c.id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)
          OR c.id IN (SELECT corporation_id FROM members WHERE user_id = $1))
       ORDER BY c.name`,
      [req.user.id, perm.pode(req.user, 'corp')]
    );
    res.render('dashboard', {
      user: req.user,
      corporations: corps.rows,
      podeCorp: perm.pode(req.user, 'corp'),
      ehStaff: !!perm.cargoDe(req.user),
    });
  } catch (err) {
    console.error('Dashboard error:', err.message, err.stack);
    res.render('error', { message: 'Erro ao carregar dashboard', user: req.user });
  }
});

// Gerenciar corporação específica
// [23/09] Antes esta rota repetia na mão a regra de quem entra (e repetia a
// versao ANTIGA, dos top 2). Agora pergunta pro mesmo ctxDaCorp que o back usa:
// uma fonte da verdade so, e a view recebe os poderes pra esconder botao.
router.get('/corp/:corpId', async (req, res) => {
  try {
    const info = await ctxDaCorp(req.params.corpId, req.user);
    if (!info || !CP.pode(info.ctx, 'ver_painel')) return res.redirect('/dashboard');

    const ranks = await pool.query(
      'SELECT * FROM ranks WHERE corporation_id = $1 ORDER BY level DESC',
      [req.params.corpId]
    );
    const members = await pool.query(`
      SELECT m.*, u.discord_username, u.roblox_id, u.roblox_username, r.name as rank_name, r.level as rank_level,
             (m.user_id = $2) AS sou_eu,
             (m.user_id = (SELECT owner_id FROM corporations WHERE id = $1)) AS eh_dono_da_corp
      FROM members m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN ranks r ON m.rank_id = r.id
      WHERE m.corporation_id = $1
      ORDER BY r.level DESC NULLS LAST, m.joined_at ASC
    `, [req.params.corpId, req.user.id]);

    res.render('corp-manage', {
      user: req.user,
      corporation: info.corp,
      ranks: ranks.rows,
      members: members.rows,
      isOwner: info.papel === 'dono' || info.papel === 'staff',
      isHighRank: info.papel === 'chefe',
      papel: info.papel,
      poderes: info.poderes,
      meuNivel: CP.semTeto(info.ctx) ? null : info.ctx.meuNivel,
    });
  } catch (err) {
    console.error('Corp manage error:', err.message, err.stack);
    res.render('error', { message: 'Erro ao carregar corporação', user: req.user });
  }
});

// Vincular Roblox ID
router.get('/link-roblox', (req, res) => {
  // [20/09] o 'error' vinha no querystring mas NUNCA era passado pra view, entao
  // quem errava era redirecionado de volta pra uma tela muda.
  res.render('link-roblox', { user: req.user, error: req.query.error || undefined });
});

// [20/09] Resolve o ID do Roblox a partir do NOME de usuario. Motivo: a filiacao
// numa corp costuma ser criada pelo ID do Roblox (o jogo so conhece isso), e ela
// fica pendurada num usuario "placeholder". O jogador entra no site pelo Discord,
// vira OUTRA linha de usuario, e nao ve corp nenhuma ate vincular. So que a tela
// de vincular exigia o ID NUMERICO -- que quase ninguem sabe de cor. Agora basta
// o nome; o ID a gente busca aqui.
async function idPeloNome(nome) {
  try {
    const r = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [String(nome).trim()], excludeBannedUsers: false }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const u = j && j.data && j.data[0];
    return u && u.id ? { id: u.id, nome: u.name } : null;
  } catch (e) { return null; }
}

router.post('/link-roblox', async (req, res) => {
  const { roblox_id, roblox_username } = req.body;
  let rid = parseInt(roblox_id);
  let nomeRoblox = roblox_username;
  if (!rid && roblox_username && String(roblox_username).trim()) {
    const achado = await idPeloNome(roblox_username);
    if (!achado) return res.redirect('/dashboard/link-roblox?error=nome_nao_achado');
    rid = achado.id;
    nomeRoblox = achado.nome;   // guarda com a grafia certa do Roblox
  }
  if (!rid) return res.redirect('/dashboard/link-roblox?error=id_required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Existe outro usuário com esse Roblox ID?
    const outro = await client.query('SELECT * FROM users WHERE roblox_id = $1 AND id <> $2', [rid, req.user.id]);
    if (outro.rows.length > 0) {
      const ph = outro.rows[0];
      if (!String(ph.discord_id).startsWith('roblox_')) {
        // Conta real de outra pessoa já usa esse ID
        await client.query('ROLLBACK');
        return res.redirect('/dashboard/link-roblox?error=already_linked');
      }
      // É um "placeholder" criado quando alguém te adicionou por Roblox ID:
      // transfere tudo dele pra tua conta e apaga o placeholder.
      //
      // [FIX 23/09 arquitetura] AQUI MORAVA O PIOR FURO DO SITE. Vincular um
      // Roblox NAO exige provar posse: basta digitar o nome do jogador e o site
      // resolve o id na API do Roblox. Como o bloco abaixo tambem passava
      // `corporations.owner_id` do placeholder pra quem vinculou, dava pra
      // DIGITAR O NOME DE OUTRA PESSOA e virar DONO da corporacao dela.
      // Cargo e filiacao continuam migrando (dano baixo e reversivel pelo dono).
      // A POSSE nao migra mais sozinha: ela vira um pedido que um admin com o
      // poder 'corp' confirma, ou o proprio dono transfere pelo painel.
      await client.query(
        `UPDATE members SET user_id = $1 WHERE user_id = $2
         AND corporation_id NOT IN (SELECT corporation_id FROM members WHERE user_id = $1)`,
        [req.user.id, ph.id]);
      await client.query('DELETE FROM members WHERE user_id = $1', [ph.id]);
      await client.query(
        `UPDATE corp_managers SET user_id = $1 WHERE user_id = $2
         AND corporation_id NOT IN (SELECT corporation_id FROM corp_managers WHERE user_id = $1)`,
        [req.user.id, ph.id]);
      await client.query('DELETE FROM corp_managers WHERE user_id = $1', [ph.id]);
      const donas = await client.query('SELECT id, name FROM corporations WHERE owner_id = $1', [ph.id]);
      if (donas.rows.length > 0) {
        // a corporacao fica SEM dono em vez de trocar de mao sozinha; o painel
        // (poder 'corp') resolve. Nao perde nada: os dados continuam todos la.
        await client.query('UPDATE corporations SET owner_id = NULL WHERE owner_id = $1', [ph.id]);
        console.warn('[seguranca] link-roblox: ' + donas.rows.length +
          ' corporacao(oes) ficaram sem dono ao vincular o roblox_id ' + rid +
          ' (antes a posse passava automaticamente pra quem vinculasse): ' +
          donas.rows.map(c => c.name).join(', '));
      }
      await client.query('DELETE FROM users WHERE id = $1', [ph.id]);
    }

    await client.query(
      'UPDATE users SET roblox_id = $1, roblox_username = $2, updated_at = NOW() WHERE id = $3',
      [rid, nomeRoblox || null, req.user.id]
    );
    await client.query('COMMIT');
    res.redirect('/dashboard');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('link-roblox:', err.message);
    if (err.code === '23505') return res.redirect('/dashboard/link-roblox?error=already_linked');
    res.redirect('/dashboard/link-roblox?error=internal');
  } finally {
    client.release();
  }
});

module.exports = router;
