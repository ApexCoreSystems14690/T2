const router = require('express').Router();
const pool = require('../db/pool');
const multer = require('multer');
const { requireAuth, requireCorpOwner, requireCorpPoder, requireAdmin, requirePoder } = require('../middleware/auth');
// [23/09] poderes DENTRO da corp (papel: staff/dono/gerente/chefe/membro).
const CP = require('../corp-poderes');
const perm = require('../permissoes');

// Upload config — armazena em memória (vai pro banco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// [FIX 23/09 seguranca] O fileFilter acima confia no mimetype que o CLIENTE
// manda, e o GET /:corpId/icon devolve esse mesmo mime como Content-Type. Aqui a
// gente olha os BYTES: o que for servido de volta e o que o arquivo realmente e.
const ASSINATURAS = [
  { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/gif',  bytes: [0x47, 0x49, 0x46, 0x38] },
];
function mimeReal(buf) {
  if (!buf || buf.length < 12) return null;
  for (const a of ASSINATURAS) {
    if (a.bytes.every((b, i) => buf[i] === b)) return a.mime;
  }
  // webp = "RIFF" .... "WEBP"
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

// GET /api/corps/:corpId/icon — servir imagem da corp (público)
router.get('/:corpId/icon', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT icon_data, icon_mime FROM corporations WHERE id = $1 AND icon_data IS NOT NULL',
      [req.params.corpId]
    );
    if (result.rows.length === 0) return res.status(404).send('Sem imagem');
    // [FIX 23/09 seguranca] mime da lista branca + nosniff + sem download inline
    // de coisa que nao seja imagem. Icone antigo, gravado antes da conferencia de
    // bytes, cai no octet-stream em vez de ser servido como o cliente pediu.
    const permitidos = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    const m = permitidos.includes(result.rows[0].icon_mime) ? result.rows[0].icon_mime : 'application/octet-stream';
    res.set('Content-Type', m);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Disposition', 'inline');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(result.rows[0].icon_data);
  } catch (err) {
    res.status(500).send('Erro');
  }
});

// Todas as rotas precisam de login
router.use(requireAuth);

// GET /api/corps — listar corporações do usuário (que ele é dono)
router.get('/', async (req, res) => {
  try {
    const result = perm.pode(req.user, 'corp')
      ? await pool.query(
          `SELECT c.*, (SELECT COUNT(*) FROM members WHERE corporation_id = c.id) as member_count
           FROM corporations c ORDER BY c.name`)
      : await pool.query(
          `SELECT c.*, (SELECT COUNT(*) FROM members WHERE corporation_id = c.id) as member_count
           FROM corporations c WHERE c.owner_id = $1 ORDER BY c.name`,
          [req.user.id]);
    res.json({ corporations: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/corps/users/list — todos os usuários registrados na plataforma (pro seletor de membros)
// Precisa estar logado; só quem gerencia alguma corporação (ou admin) enxerga.
router.get('/users/list', async (req, res) => {
  try {
    // [23/09] Esta rota entrega a base INTEIRA de usuários (discord_id,
    // roblox_id, is_admin). Antes qualquer membro dos 2 cargos do topo de
    // qualquer corp a lia -- dava pra mapear quem é admin do site. Agora é
    // poder de DONO / co-gerente / staff ('ver_usuarios'), e mais ninguém.
    if (!perm.pode(req.user, 'corp')) {
      const gerencia = await pool.query(
        `SELECT 1 FROM corporations WHERE owner_id = $1
         UNION SELECT 1 FROM corp_managers WHERE user_id = $1
         LIMIT 1`,
        [req.user.id]
      );
      if (gerencia.rows.length === 0) return res.status(403).json({ error: 'Acesso negado' });
    }
    const result = await pool.query(
      `SELECT id, discord_username, discord_avatar, discord_id, roblox_id, roblox_username, is_admin,
              (discord_id LIKE 'roblox_%') AS is_placeholder
       FROM users
       ORDER BY (discord_id LIKE 'roblox_%') ASC, LOWER(COALESCE(discord_username, roblox_username, '')) ASC`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('users/list:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/corps/:corpId — detalhes de uma corporação
router.get('/:corpId', requireCorpOwner, requireCorpPoder('ver_membros'), async (req, res) => {
  try {
    const ranks = await pool.query(
      'SELECT * FROM ranks WHERE corporation_id = $1 ORDER BY level DESC',
      [req.params.corpId]
    );
    const members = await pool.query(`
      SELECT m.*, u.discord_username, u.roblox_id, u.roblox_username, r.name as rank_name, r.level as rank_level
      FROM members m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN ranks r ON m.rank_id = r.id
      WHERE m.corporation_id = $1
      ORDER BY r.level DESC NULLS LAST
    `, [req.params.corpId]);

    res.json({
      corporation: req.corporation,
      ranks: ranks.rows,
      members: members.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/corps/:corpId — editar configurações da corporação
router.put('/:corpId', requireCorpOwner, requireCorpPoder('editar_corp'), async (req, res) => {
  try {
    const { name, description, icon_url, color, max_members } = req.body;
    // Se mandou uma URL, limpa a imagem do banco
    const extraCols = icon_url ? ', icon_data = NULL, icon_mime = NULL' : '';
    const result = await pool.query(
      `UPDATE corporations SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        icon_url = $3,
        color = COALESCE($4, color),
        max_members = COALESCE($5, max_members),
        updated_at = NOW()
        ${extraCols}
       WHERE id = $6 AND ($8::boolean OR owner_id = $7 OR id IN (SELECT corporation_id FROM corp_managers WHERE user_id = $7)) RETURNING *`,
      [name || null, description || null, icon_url || null, color || null,
       max_members ? parseInt(max_members) : null, req.params.corpId, req.user.id, perm.pode(req.user, 'corp')]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Corporação não encontrada' });
    res.json({ corporation: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/corps/:corpId/icon — upload de imagem da corp
router.post('/:corpId/icon', requireCorpOwner, requireCorpPoder('editar_corp'), upload.single('icon'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie uma imagem (PNG, JPG, GIF ou WebP, máx 2MB)' });
    // [FIX 23/09 seguranca] o mime gravado e o dos BYTES, nunca o que o cliente
    // declarou -- e o GET /icon devolve esse mesmo valor como Content-Type.
    const mimeOk = mimeReal(req.file.buffer);
    if (!mimeOk) return res.status(400).json({ error: 'Arquivo não é uma imagem PNG, JPG, GIF ou WebP de verdade' });
    const result = await pool.query(
      'UPDATE corporations SET icon_data = $1, icon_mime = $2, icon_url = NULL, updated_at = NOW() WHERE id = $3 RETURNING id',
      [req.file.buffer, mimeOk, req.params.corpId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Corporação não encontrada' });
    res.json({ ok: true, icon_url: '/api/corps/' + req.params.corpId + '/icon' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar imagem' });
  }
});

// DELETE /api/corps/:corpId/icon — remover imagem da corp
router.delete('/:corpId/icon', requireCorpOwner, requireCorpPoder('editar_corp'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE corporations SET icon_data = NULL, icon_mime = NULL, icon_url = NULL, updated_at = NOW() WHERE id = $1',
      [req.params.corpId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover imagem' });
  }
});

// POST /api/corps/:corpId/ranks — criar cargo
router.post('/:corpId/ranks', requireCorpOwner, requireCorpPoder('gerir_cargos'), async (req, res) => {
  try {
    const { name, level, salary } = req.body;
    if (!name || level === undefined) {
      return res.status(400).json({ error: 'Nome e nível são obrigatórios' });
    }
    const result = await pool.query(
      'INSERT INTO ranks (corporation_id, name, level, salary) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.corpId, name, parseInt(level), parseInt(salary) || 0]
    );
    res.json({ rank: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Cargo com esse nome ou nível já existe' });
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/corps/:corpId/ranks/:rankId — editar cargo
router.put('/:corpId/ranks/:rankId', requireCorpOwner, requireCorpPoder('gerir_cargos'), async (req, res) => {
  try {
    const { name, level, salary } = req.body;
    const result = await pool.query(
      `UPDATE ranks SET name = COALESCE($1, name), level = COALESCE($2, level),
       salary = COALESCE($3, salary) WHERE id = $4 AND corporation_id = $5 RETURNING *`,
      [name, level !== undefined ? parseInt(level) : null, salary !== undefined ? parseInt(salary) : null,
       req.params.rankId, req.params.corpId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cargo não encontrado' });
    res.json({ rank: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/corps/:corpId/ranks/:rankId — remover cargo
router.delete('/:corpId/ranks/:rankId', requireCorpOwner, requireCorpPoder('gerir_cargos'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM ranks WHERE id = $1 AND corporation_id = $2',
      [req.params.rankId, req.params.corpId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// Busca o username no Roblox a partir do ID (melhor esforço)
async function fetchRobloxUsername(robloxId) {
  try {
    const r = await fetch('https://users.roblox.com/v1/users/' + robloxId);
    if (!r.ok) return null;
    const j = await r.json();
    return j.name || null;
  } catch (e) { return null; }
}

// POST /api/corps/:corpId/members — adicionar membro
// Aceita { user_id } (usuário registrado, escolhido no seletor) OU { roblox_id, roblox_username } (fallback)
router.post('/:corpId/members', requireCorpOwner, requireCorpPoder('gerir_membros'), async (req, res) => {
  try {
    const { user_id, roblox_id, roblox_username, rank_id } = req.body;

    let user;
    if (user_id) {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [parseInt(user_id)]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
      user = result.rows[0];
    } else if (roblox_id) {
      const rid = parseInt(roblox_id);
      if (!rid) return res.status(400).json({ error: 'Roblox ID inválido' });
      let result = await pool.query('SELECT * FROM users WHERE roblox_id = $1', [rid]);
      if (result.rows.length === 0) {
        const nome = roblox_username || await fetchRobloxUsername(rid);
        // Usuário placeholder (sem Discord ainda). Quando a pessoa vincular o Roblox, é mesclado.
        result = await pool.query(
          'INSERT INTO users (discord_id, roblox_id, roblox_username) VALUES ($1, $2, $3) RETURNING *',
          [`roblox_${rid}`, rid, nome]
        );
      }
      user = result.rows[0];
    } else {
      return res.status(400).json({ error: 'Selecione um usuário' });
    }

    // [23/09] Teto de hierarquia. Vale pra QUALQUER papel com teto (hoje o
    // chefe); dono, co-gerente e staff passam. Antes só olhava `isHighRank`.
    if (rank_id) {
      const newRank = await pool.query('SELECT level FROM ranks WHERE id = $1 AND corporation_id = $2', [rank_id, req.params.corpId]);
      const nivelNovo = newRank.rows.length > 0 ? newRank.rows[0].level : null;
      if (!CP.podeDarCargo(req.corpCtx, nivelNovo)) {
        return res.status(403).json({ error: 'Você não pode atribuir um cargo igual ou superior ao seu' });
      }
    }

    // Limite de membros
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM members WHERE corporation_id = $1', [req.params.corpId]);
    if (req.corporation && req.corporation.max_members && count.rows[0].n >= req.corporation.max_members) {
      return res.status(400).json({ error: 'A corporação atingiu o máximo de membros' });
    }

    const member = await pool.query(
      'INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1, $2, $3) RETURNING *',
      [req.params.corpId, user.id, rank_id || null]
    );

    res.json({ member: member.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Jogador já é membro desta corporação' });
    }
    console.error('add member:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/corps/:corpId/members/:memberId — alterar cargo de um membro
router.put('/:corpId/members/:memberId', requireCorpOwner, requireCorpPoder('gerir_membros'), async (req, res) => {
  try {
    const { rank_id } = req.body;
    // [23/09] A guarda vale pra todo papel com teto, e agora também protege o
    // DONO da corp e o próprio sujeito — antes um chefe podia rebaixar o dono
    // se o dono também fosse membro com cargo baixo.
    const alvo = await pool.query(
      `SELECT r.level AS nivel, m.user_id, (m.user_id = c.owner_id) AS eh_dono_da_corp
         FROM members m
         JOIN corporations c ON c.id = m.corporation_id
         LEFT JOIN ranks r ON m.rank_id = r.id
        WHERE m.id = $1 AND m.corporation_id = $2`,
      [req.params.memberId, req.params.corpId]
    );
    if (alvo.rows.length === 0) return res.status(404).json({ error: 'Membro não encontrado' });
    const a = alvo.rows[0];
    if (!CP.podeMexerEmMembro(req.corpCtx, {
      nivel: a.nivel, ehDonoDaCorp: !!a.eh_dono_da_corp, ehEuMesmo: a.user_id === req.user.id,
    })) {
      return res.status(403).json({ error: 'Você não pode alterar o cargo desta pessoa' });
    }
    if (rank_id) {
      const newRank = await pool.query('SELECT level FROM ranks WHERE id = $1 AND corporation_id = $2', [rank_id, req.params.corpId]);
      const nivelNovo = newRank.rows.length > 0 ? newRank.rows[0].level : null;
      if (!CP.podeDarCargo(req.corpCtx, nivelNovo)) {
        return res.status(403).json({ error: 'Você não pode atribuir um cargo igual ou superior ao seu' });
      }
    }
    const result = await pool.query(
      'UPDATE members SET rank_id = $1 WHERE id = $2 AND corporation_id = $3 RETURNING *',
      [rank_id, req.params.memberId, req.params.corpId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Membro não encontrado' });
    res.json({ member: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/corps/:corpId/members/:memberId — remover membro
router.delete('/:corpId/members/:memberId', requireCorpOwner, requireCorpPoder('gerir_membros'), async (req, res) => {
  try {
    // [23/09] mesma guarda do PUT: teto de nível + o dono da corp é intocável
    // por aqui + ninguém se remove pelo painel (pra isso existe o botão Sair).
    const alvo = await pool.query(
      `SELECT r.level AS nivel, m.user_id, (m.user_id = c.owner_id) AS eh_dono_da_corp
         FROM members m
         JOIN corporations c ON c.id = m.corporation_id
         LEFT JOIN ranks r ON m.rank_id = r.id
        WHERE m.id = $1 AND m.corporation_id = $2`,
      [req.params.memberId, req.params.corpId]
    );
    if (alvo.rows.length === 0) return res.json({ ok: true });
    const a = alvo.rows[0];
    if (!CP.podeMexerEmMembro(req.corpCtx, {
      nivel: a.nivel, ehDonoDaCorp: !!a.eh_dono_da_corp, ehEuMesmo: a.user_id === req.user.id,
    })) {
      return res.status(403).json({ error: 'Você não pode remover esta pessoa' });
    }
    await pool.query(
      'DELETE FROM members WHERE id = $1 AND corporation_id = $2',
      [req.params.memberId, req.params.corpId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/corps/:corpId/sair — o PRÓPRIO jogador sai da corporação.
// Julio, 19/09: "o usuário deve poder sair da corporação opcionalmente se quiser".
//
// Repare que esta é a ÚNICA rota de corporação que NÃO usa requireCorpOwner: todas
// as outras exigem ser dono, co-gerente ou top 2 cargos. Um membro comum não tinha
// caminho nenhum pra mexer na própria situação — só podia ser removido por alguém
// de cima. Aqui ele age só sobre si mesmo: o id vem da SESSÃO, nunca do corpo do
// pedido, então ninguém consegue usar isto pra expulsar outra pessoa.
//
// O DONO não sai: a corporação ficaria órfã. Ele transfere ou exclui.
// Sair leva junto o co-gerenciamento, senão a pessoa continuaria mandando numa
// corp de que não é mais membro.
// ---------------------------------------------------------------------------
router.post('/:corpId/sair', async (req, res) => {
  const cli = await pool.connect();
  try {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    const corpId = parseInt(req.params.corpId);
    if (!corpId) return res.status(400).json({ error: 'Corporação inválida' });

    const c = await cli.query('SELECT id, name, owner_id FROM corporations WHERE id = $1', [corpId]);
    if (c.rows.length === 0) return res.status(404).json({ error: 'Corporação não encontrada' });
    const corp = c.rows[0];

    if (corp.owner_id === req.user.id) {
      return res.status(400).json({ error: 'Você é o dono desta corporação. Passe a posse para outra pessoa ou exclua a corporação.' });
    }

    await cli.query('BEGIN');
    const m = await cli.query('DELETE FROM members WHERE corporation_id = $1 AND user_id = $2', [corpId, req.user.id]);
    const g = await cli.query('DELETE FROM corp_managers WHERE corporation_id = $1 AND user_id = $2', [corpId, req.user.id]);
    if (m.rowCount === 0 && g.rowCount === 0) {
      await cli.query('ROLLBACK');
      return res.status(400).json({ error: 'Você não faz parte desta corporação' });
    }
    await cli.query('COMMIT');

    // se estiver jogando agora, manda o jogo recarregar a corp dele na hora --
    // senão ele continuaria abrindo as portas da corp até o próximo login
    let avisouJogo = false;
    try {
      if (req.user.roblox_id) {
        const servers = await pool.query(
          `SELECT job_id, players FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds'`);
        for (const sv of servers.rows) {
          for (const pl of (sv.players || [])) {
            if (Number(pl.userId) === Number(req.user.roblox_id)) {
              await pool.query(
                'INSERT INTO game_commands (tipo, target_roblox_id, target_name, payload, job_id, created_by) VALUES ($1,$2,$3,$4,$5,$6)',
                ['corp_refresh', req.user.roblox_id, pl.name || null, '{}', sv.job_id, req.user.id]);
              avisouJogo = true;
            }
          }
        }
      }
    } catch (e) { console.error('sair/corp_refresh:', e.message); }

    res.json({ ok: true, corporacao: corp.name, era_gerente: g.rowCount > 0, avisou_jogo: avisouJogo });
  } catch (err) {
    try { await cli.query('ROLLBACK'); } catch (e) {}
    console.error('corps/sair:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  } finally { cli.release(); }
});

// DELETE /api/corps/:corpId — excluir corporação (somente dono)
router.delete('/:corpId', requireCorpOwner, requireCorpPoder('excluir_corp'), async (req, res) => {
  try {
    if (!req.isOwner) {
      return res.status(403).json({ error: 'Apenas o dono pode excluir a corporação' });
    }
    await pool.query('DELETE FROM corporations WHERE id = $1', [req.params.corpId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/corps/:corpId/managers — listar co-gerentes
router.get('/:corpId/managers', requireCorpOwner, requireCorpPoder('gerir_gerentes'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cm.id, cm.added_at, u.id as user_id, u.discord_username, u.roblox_username, u.roblox_id
       FROM corp_managers cm JOIN users u ON cm.user_id = u.id
       WHERE cm.corporation_id = $1 ORDER BY cm.added_at`,
      [req.params.corpId]
    );
    res.json({ managers: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/corps/:corpId/managers — adicionar co-gerente (só dono)
router.post('/:corpId/managers', requireCorpOwner, requireCorpPoder('gerir_gerentes'), async (req, res) => {
  try {
    if (!req.isOwner) return res.status(403).json({ error: 'Apenas o dono pode gerenciar co-gerentes' });
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id é obrigatório' });
    const result = await pool.query(
      'INSERT INTO corp_managers (corporation_id, user_id) VALUES ($1, $2) RETURNING *',
      [req.params.corpId, user_id]
    );
    res.json({ manager: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Usuário já é co-gerente' });
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/corps/:corpId/managers/:managerId — remover co-gerente (só dono)
router.delete('/:corpId/managers/:managerId', requireCorpOwner, requireCorpPoder('gerir_gerentes'), async (req, res) => {
  try {
    if (!req.isOwner) return res.status(403).json({ error: 'Apenas o dono pode gerenciar co-gerentes' });
    await pool.query(
      'DELETE FROM corp_managers WHERE id = $1 AND corporation_id = $2',
      [req.params.managerId, req.params.corpId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/corps — criar corporação (SOMENTE admin)
// [FIX 23/09 arquitetura] Criar corporacao exigia so `requireAdmin`, que e
// "qualquer staff" -- um ESTAGIARIO criava corporacao a vontade. Mexer em
// corporacao e poder de Supervisor pra cima, igual a todo o resto que mexe em
// corp (PODERES.corp). O front esconde botao; quem barra e isto aqui.
router.post('/', requirePoder('corp'), async (req, res) => {
  try {
    const { name, slug, description, color, icon_url, max_members, tipo } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: 'Nome e slug são obrigatórios' });
    }
    // [20/09] tipo decide em qual painel ela aparece: 'corp' (padrão) ou 'faccao'.
    // Lista fechada de propósito — o cliente manda a chave, o servidor resolve.
    const tipoLimpo = tipo === 'faccao' ? 'faccao' : 'corp';
    // Slug deve ser lowercase e sem espaços
    const cleanSlug = slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const result = await pool.query(
      `INSERT INTO corporations (name, slug, description, owner_id, color, icon_url, max_members, tipo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, cleanSlug, description || null, req.user.id, color || '#3B82F6', icon_url || null, max_members || 100, tipoLimpo]
    );
    res.json({ corporation: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Slug já existe' });
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
