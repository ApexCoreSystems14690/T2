// ============================================================================
// [16/10] PDs — registro de todo encerramento de personagem + REVERTER.
//
// [stated] Julio: "O reverter é para ser uma aba no painel chamada 'pds' onde vai ter
// registro de todo pd, garanta que o caminho e o fluxo FUNCIONAM para não cometermos
// erros bobos, e com botão para reverter 100% garantido".
//
// O QUE UM PD FAZ (e portanto o que o reverter desfaz), medido no código:
//   JOGO  (DataHandler ordem 'resetar')
//     1. guarda a cópia do perfil inteiro em WipeSnapshots-CBRP.1 (chave = "<uid>:<epoch>")
//     2. zera o perfil (dinheiro, banco, inventário, carros, casas, celular, ficha...)
//     3. carro apreendido vira lote de leilão da corp (LeilaoPendente-CBRP.1)
//     4. solta as casas no registro global (ImoveisService) e apaga os móveis delas
//   SITE  (POST /api/game/player/:id/encerrar-personagem)
//     5. grava a linha em fichas_encerradas (é ESTA tabela que a aba PDs mostra)
//     6. tira o jogador de TODA corporação (members) e da co-gerência (corp_managers)
//     7. encerra o mandado de procurado aberto
//
// O REVERTER, em ordem (nada muda no site antes de o jogo confirmar):
//   painel  -> POST /api/admin/pds/:id/reverter      : rev_estado = 'pendente'
//   jogo    -> GET  /api/game/pds/reverter/proximo   : pega 1 (atômico), rev_estado = 'executando'
//              (se o jogador está ONLINE num servidor, só aquele servidor pega)
//   jogo    -> devolve o perfil da cópia, as casas, os móveis, tira os lotes do leilão
//   jogo    -> POST /api/game/pds/:id/reverter/resultado {ok,msg,detalhe}
//   site    -> se ok: devolve corps (com o cargo de antes), gerência e mandado,
//              apaga as linhas de "saída" que o PD criou no histórico, marca 'revertido'.
//              se erro: rev_estado = 'erro' + mensagem; o botão volta a aparecer.
//
// SEGURO CONTRA REPETIÇÃO: o jogo marca o perfil com PDRevertido = chave. Se o
// resultado se perder no caminho e o pedido voltar pra fila (3 min sem resposta), o
// jogo vê a marca e só confirma, sem sobrescrever de novo. Do lado do site tudo é
// ON CONFLICT / condicional.
//
// SÓ O ÚLTIMO encerramento de cada jogador pode ser revertido: reverter um mais antigo
// devolveria o personagem de ANTES e apagaria tudo o que veio depois (inclusive um
// PD válido mais novo).
// ============================================================================

const JANELA_S = 20;          // segundos em volta do PD pra achar o que ele mexeu (fichas antigas)
const TRAVA_MIN = 3;          // 'executando' sem resposta há mais que isto volta pra fila

async function migrar(pool) {
  await pool.query(`
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS pd BOOLEAN;
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS vinculos JSONB;
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS gerencias JSONB;
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS procurados_ids JSONB;
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS rev_estado VARCHAR(16);
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS rev_pedido_por VARCHAR(128);
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS rev_pedido_em TIMESTAMP;
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS rev_motivo VARCHAR(300);
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS rev_job VARCHAR(64);
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS rev_claim_em TIMESTAMP;
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS rev_tentativas INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS rev_msg TEXT;
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS rev_detalhe JSONB;
    ALTER TABLE fichas_encerradas ADD COLUMN IF NOT EXISTS rev_feito_em TIMESTAMP;
    CREATE INDEX IF NOT EXISTS idx_fichas_enc_rev ON fichas_encerradas(rev_estado) WHERE rev_estado IS NOT NULL;
  `);
}

// ---------------------------------------------------------------- puro (testável sem banco)

// chave do backup que o jogo guardou. O jogo só manda `resumo.snapshot` quando a cópia
// foi gravada de verdade (snapOk).
function chaveDoBackup(f) {
  const r = f && f.resumo;
  const c = r && typeof r === 'object' ? r.snapshot : null;
  return (typeof c === 'string' && /^\d+:\d+$/.test(c)) ? c : null;
}

// Que tipo de encerramento foi. `pd` só existe a partir de 16/10; antes disso a pista é
// o motivo que o PDFaccao e o Tribunal mandam.
function tipoDe(f) {
  const m = String((f && f.motivo) || '').toLowerCase();
  if (m.includes('ferro velho') || m.includes('faccao') || m.includes('facção')) return 'pd_faccao';
  if (m.includes('tribunal') || m.includes('condena')) return 'pd_estado';
  if (f && f.pd === true) return 'pd';
  return 'reset';
}

// Pode reverter AGORA? `ultimoId` = id do encerramento mais novo NÃO revertido do jogador.
function avaliar(f, ultimoId) {
  if (!f) return { pode: false, motivo: 'não existe' };
  if (f.estado === 'revertido') return { pode: false, motivo: 'já revertido' };
  if (f.rev_estado === 'pendente') return { pode: false, motivo: 'aguardando um servidor do jogo pegar', aguardando: true };
  if (f.rev_estado === 'executando') return { pode: false, motivo: 'o jogo está devolvendo agora', aguardando: true };
  if (!chaveDoBackup(f)) return { pode: false, motivo: 'sem backup do personagem (a cópia não foi gravada nesse PD)' };
  if (ultimoId != null && Number(ultimoId) !== Number(f.id)) {
    return { pode: false, motivo: 'tem encerramento mais novo desse jogador — reverta o mais novo primeiro' };
  }
  return { pode: true, motivo: null };
}

// O que o painel mostra de cada linha.
function linhaPainel(f, ultimoId, presentes) {
  const a = avaliar(f, ultimoId);
  return {
    id: f.id,
    roblox_id: Number(f.roblox_id),
    nome: f.nome,
    tipo: tipoDe(f),
    motivo: f.motivo,
    por_nome: f.por_nome,
    corp: f.corp,
    quando: f.encerrado_em,
    estado: f.estado,
    resumo: f.resumo || null,
    backup: !!chaveDoBackup(f),
    corps: Array.isArray(f.vinculos) ? f.vinculos.map(v => v.slug || v.corporation_id) : null,
    presentes: presentes || null,
    rev: f.rev_estado ? {
      estado: f.rev_estado, por: f.rev_pedido_por, em: f.rev_pedido_em, motivo: f.rev_motivo,
      msg: f.rev_msg, detalhe: f.rev_detalhe, feito_em: f.rev_feito_em, tentativas: f.rev_tentativas,
    } : null,
    pode_reverter: a.pode,
    motivo_nao: a.motivo,
  };
}

// ---------------------------------------------------------------- captura (no PD)

// Chamado DENTRO da transação do encerrar-personagem, ANTES do DELETE de members.
async function capturar(cli, userId) {
  if (!userId) return { vinculos: [], gerencias: [] };
  const v = await cli.query(
    // joined_at vai como TEXTO: a coluna é TIMESTAMP sem fuso, e um Date do node passando
    // por JSON ganha o fuso do servidor (medido: 1 h a menos com o relógio em BST).
    `SELECT m.corporation_id, c.slug, m.rank_id, r.name AS rank_nome, r.level AS rank_level,
            to_char(m.joined_at, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS joined_at
       FROM members m JOIN corporations c ON c.id = m.corporation_id
       LEFT JOIN ranks r ON r.id = m.rank_id
      WHERE m.user_id = $1`, [userId]);
  const g = await cli.query(
    `SELECT cm.corporation_id, c.slug FROM corp_managers cm
       JOIN corporations c ON c.id = cm.corporation_id WHERE cm.user_id = $1`, [userId]);
  return { vinculos: v.rows, gerencias: g.rows };
}

// ---------------------------------------------------------------- painel

async function listar(pool, { limite = 200, busca = '' } = {}) {
  const lim = Math.min(Math.max(Number(limite) || 200, 1), 500);
  const q = String(busca || '').trim().slice(0, 64);
  const r = await pool.query(
    `SELECT f.*,
            (SELECT MAX(f2.id) FROM fichas_encerradas f2
              WHERE f2.roblox_id = f.roblox_id AND f2.estado <> 'revertido') AS ultimo_id
       FROM fichas_encerradas f
      WHERE ($2 = '' OR LOWER(f.nome) LIKE '%' || LOWER($2) || '%' OR f.roblox_id::text = $2)
      ORDER BY f.id DESC LIMIT $1`, [lim, q]);
  // testemunhas: o PDFaccao manda um log 'pd_faccao' com quem estava na roda
  const nomes = [...new Set(r.rows.map(f => f.nome).filter(Boolean))];
  let logs = [];
  if (nomes.length) {
    const l = await pool.query(
      `SELECT alvo, detalhe, COALESCE(ocorrido_em, created_at) AS t FROM game_logs
        WHERE tipo = 'pd_faccao' AND alvo = ANY($1::text[])
          AND detalhe->>'desfecho' = 'concluido'
        ORDER BY id DESC LIMIT 2000`, [nomes]);
    logs = l.rows;
  }
  return r.rows.map(f => {
    // só PD de pneu tem roda; pega o log MAIS PERTO no tempo (o reset sai ~6 s depois do fogo)
    let presentes = null;
    if (tipoDe(f) === 'pd_faccao') {
      const t = new Date(f.encerrado_em).getTime();
      let melhor = null, dMelhor = 10 * 60 * 1000;
      for (const x of logs) {
        if (x.alvo !== f.nome) continue;
        const d = Math.abs(new Date(x.t).getTime() - t);
        if (d < dMelhor) { melhor = x; dMelhor = d; }
      }
      if (melhor && melhor.detalhe && Array.isArray(melhor.detalhe.presentes)) presentes = melhor.detalhe.presentes;
    }
    return linhaPainel(f, f.ultimo_id, presentes);
  });
}

// O admin clicou "Reverter". Só enfileira: quem muda alguma coisa é o jogo, e o site
// só mexe no dele depois que o jogo confirma.
async function pedir(pool, id, quem, motivo) {
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const r = await cli.query(`SELECT * FROM fichas_encerradas WHERE id = $1 FOR UPDATE`, [id]);
    const f = r.rows[0];
    if (!f) { await cli.query('ROLLBACK'); return { ok: false, status: 404, erro: 'PD não encontrado' }; }
    const u = await cli.query(
      `SELECT MAX(id) AS id FROM fichas_encerradas WHERE roblox_id = $1 AND estado <> 'revertido'`, [f.roblox_id]);
    const a = avaliar(f, u.rows[0].id);
    if (!a.pode) { await cli.query('ROLLBACK'); return { ok: false, status: 409, erro: 'Não dá pra reverter: ' + a.motivo }; }
    await cli.query(
      `UPDATE fichas_encerradas
          SET rev_estado = 'pendente', rev_pedido_por = $2, rev_pedido_em = NOW(), rev_motivo = $3,
              rev_job = NULL, rev_claim_em = NULL, rev_msg = NULL, rev_detalhe = NULL
        WHERE id = $1`, [id, String(quem || '?').slice(0, 128), motivo ? String(motivo).slice(0, 300) : null]);
    await cli.query('COMMIT');
    return { ok: true };
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { cli.release(); }
}

// Desistir de um pedido que ainda nenhum servidor pegou (ex.: servidor fechado).
async function cancelar(pool, id) {
  const r = await pool.query(
    `UPDATE fichas_encerradas SET rev_estado = NULL, rev_msg = 'pedido cancelado no painel'
      WHERE id = $1 AND rev_estado IN ('pendente', 'erro') RETURNING id`, [id]);
  return r.rowCount > 0;
}

// ---------------------------------------------------------------- jogo

// Um servidor do jogo pede trabalho. Devolve 1 pedido ou null. Atômico: dois servidores
// nunca pegam o mesmo (FOR UPDATE SKIP LOCKED).
async function reivindicar(pool, jobId) {
  const job = String(jobId || '').slice(0, 64);
  if (!job) return null;
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const r = await cli.query(
      `SELECT id, roblox_id, nome, resumo FROM fichas_encerradas
        WHERE rev_estado = 'pendente'
           OR (rev_estado = 'executando' AND rev_claim_em < NOW() - ($1 || ' minutes')::interval)
        ORDER BY rev_pedido_em ASC NULLS LAST, id ASC
        LIMIT 10 FOR UPDATE SKIP LOCKED`, [String(TRAVA_MIN)]);
    if (r.rows.length === 0) { await cli.query('COMMIT'); return null; }
    // onde cada um está online agora (mesma janela de 90 s que o painel usa)
    const sv = await cli.query(
      `SELECT job_id, players FROM game_servers WHERE updated_at > NOW() - INTERVAL '90 seconds'`);
    const ondeEsta = rid => {
      for (const s of sv.rows) {
        if ((s.players || []).some(p => Number(p.userId) === Number(rid))) return s.job_id;
      }
      return null;
    };
    let pego = null;
    for (const f of r.rows) {
      const onde = ondeEsta(f.roblox_id);
      if (onde && onde !== job) continue;   // está online em OUTRO servidor: é aquele que faz
      pego = f;
      break;
    }
    if (!pego) { await cli.query('COMMIT'); return null; }
    await cli.query(
      `UPDATE fichas_encerradas
          SET rev_estado = 'executando', rev_job = $2, rev_claim_em = NOW(),
              rev_tentativas = rev_tentativas + 1
        WHERE id = $1`, [pego.id, job]);
    await cli.query('COMMIT');
    return { id: pego.id, roblox_id: Number(pego.roblox_id), nome: pego.nome, chave: chaveDoBackup(pego) };
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { cli.release(); }
}

// O jogo terminou. Se deu certo, o site devolve o que é dele.
async function concluir(pool, id, jobId, { ok, msg, detalhe } = {}) {
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const r = await cli.query(`SELECT * FROM fichas_encerradas WHERE id = $1 FOR UPDATE`, [id]);
    const f = r.rows[0];
    if (!f) { await cli.query('ROLLBACK'); return { ok: false, status: 404, erro: 'não existe' }; }
    if (f.estado === 'revertido') { await cli.query('COMMIT'); return { ok: true, repetido: true }; }
    if (f.rev_estado !== 'executando') {
      await cli.query('ROLLBACK');
      return { ok: false, status: 409, erro: 'este pedido não está em execução (' + (f.rev_estado || 'nenhum') + ')' };
    }
    const det = detalhe && typeof detalhe === 'object' ? detalhe : {};
    if (!ok) {
      await cli.query(
        `UPDATE fichas_encerradas SET rev_estado = 'erro', rev_msg = $2, rev_detalhe = $3 WHERE id = $1`,
        [id, String(msg || 'falhou no jogo').slice(0, 1000), JSON.stringify(det)]);
      await cli.query('COMMIT');
      return { ok: true, estado: 'erro' };
    }

    const site = await devolverNoSite(cli, f);
    const tudo = Object.assign({}, det, { site });
    await cli.query(
      `UPDATE fichas_encerradas
          SET estado = 'revertido', rev_estado = 'feito', rev_feito_em = NOW(),
              rev_msg = $2, rev_detalhe = $3
        WHERE id = $1`, [id, String(msg || 'ok').slice(0, 1000), JSON.stringify(tudo)]);
    await cli.query(
      `INSERT INTO game_logs (tipo, jogador, alvo, detalhe, job_id, ocorrido_em)
       VALUES ('pd_revertido', $1, $2, $3, $4, NOW())`,
      [String(f.rev_pedido_por || 'painel').slice(0, 64), String(f.nome || f.roblox_id).slice(0, 64),
       JSON.stringify({ ficha: f.id, roblox_id: Number(f.roblox_id), motivo_pd: f.motivo, motivo: f.rev_motivo, site, jogo: det }),
       jobId ? String(jobId).slice(0, 64) : null]);
    await cli.query('COMMIT');
    return { ok: true, estado: 'feito', site };
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { cli.release(); }
}

// Devolve corps (com o cargo de antes), co-gerência e mandado de procurado.
async function devolverNoSite(cli, f) {
  const out = { corps: [], corps_falhou: [], gerencias: 0, procurados: 0, procurados_pulados: 0, sem_conta: false };
  const u = await cli.query('SELECT id FROM users WHERE roblox_id = $1', [f.roblox_id]);
  const userId = u.rows[0] && u.rows[0].id;
  const de = `($2::timestamp - ($3 || ' seconds')::interval)`;
  const ate = `($2::timestamp + ($3 || ' seconds')::interval)`;

  if (!userId) {
    out.sem_conta = true;
  } else {
    // 1) vínculos. Ficha de 16/10 pra frente traz a lista exata; antes disso, o gatilho
    //    trg_members_saida guardou cada saída em corp_vinculos_hist (com o NOME do cargo).
    let vinc = Array.isArray(f.vinculos) ? f.vinculos : null;
    if (!vinc) {
      const h = await cli.query(
        `SELECT h.corporation_id, c.slug, NULL::int AS rank_id, h.cargo AS rank_nome, NULL::int AS rank_level,
                to_char(h.entrou_em, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS joined_at
           FROM corp_vinculos_hist h JOIN corporations c ON c.id = h.corporation_id
          WHERE h.user_id = $1 AND h.saiu_em BETWEEN ${de} AND ${ate}`,
        [userId, f.encerrado_em, String(JANELA_S)]);
      vinc = h.rows;
    }
    for (const v of vinc) {
      const c = await cli.query('SELECT id, slug FROM corporations WHERE id = $1', [v.corporation_id]);
      if (!c.rows[0]) { out.corps_falhou.push({ corp: v.slug || v.corporation_id, motivo: 'corporação não existe mais' }); continue; }
      // o cargo de antes: pelo id; se o cargo foi apagado, pelo nome; depois pelo nível
      let rank = null;
      if (v.rank_id) {
        const x = await cli.query('SELECT id FROM ranks WHERE id = $1 AND corporation_id = $2', [v.rank_id, v.corporation_id]);
        rank = x.rows[0] ? x.rows[0].id : null;
      }
      if (!rank && v.rank_nome) {
        const x = await cli.query('SELECT id FROM ranks WHERE corporation_id = $1 AND name = $2 LIMIT 1', [v.corporation_id, v.rank_nome]);
        rank = x.rows[0] ? x.rows[0].id : null;
      }
      if (!rank && v.rank_level != null) {
        const x = await cli.query('SELECT id FROM ranks WHERE corporation_id = $1 AND level = $2 ORDER BY id LIMIT 1', [v.corporation_id, v.rank_level]);
        rank = x.rows[0] ? x.rows[0].id : null;
      }
      await cli.query(
        `INSERT INTO members (corporation_id, user_id, rank_id, joined_at)
         VALUES ($1, $2, $3, COALESCE($4::timestamp, NOW()))
         ON CONFLICT (corporation_id, user_id) DO UPDATE
           SET rank_id = COALESCE(EXCLUDED.rank_id, members.rank_id),
               joined_at = LEAST(members.joined_at, EXCLUDED.joined_at)`,
        [v.corporation_id, userId, rank, v.joined_at || null]);
      out.corps.push({ corp: c.rows[0].slug, cargo: v.rank_nome || null, cargo_achado: !!rank });
    }
    // a "saída" que o PD escreveu no histórico não aconteceu: apaga
    await cli.query(
      `DELETE FROM corp_vinculos_hist WHERE user_id = $1 AND saiu_em BETWEEN ${de} AND ${ate}`,
      [userId, f.encerrado_em, String(JANELA_S)]);

    // 2) co-gerência
    for (const g of (Array.isArray(f.gerencias) ? f.gerencias : [])) {
      const x = await cli.query(
        `INSERT INTO corp_managers (corporation_id, user_id)
         SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM corporations WHERE id = $1)
         ON CONFLICT (corporation_id, user_id) DO NOTHING`, [g.corporation_id, userId]);
      out.gerencias += x.rowCount;
    }
  }

  // 3) mandado de procurado. Ficha nova traz os ids; antiga: o que foi encerrado no instante do PD.
  let ids = Array.isArray(f.procurados_ids) ? f.procurados_ids.map(Number).filter(Boolean) : null;
  if (!ids) {
    const p = await cli.query(
      `SELECT id FROM procurados WHERE roblox_id = $1 AND estado = 'encerrado'
          AND encerrado_em BETWEEN ${de} AND ${ate}`, [f.roblox_id, f.encerrado_em, String(JANELA_S)]);
    ids = p.rows.map(x => x.id);
  }
  for (const pid of ids) {
    // um alvo só pode ter UM mandado aberto: se abriram outro depois, o antigo fica fechado
    const x = await cli.query(
      `UPDATE procurados SET estado = 'ativo', encerrado_em = NULL, encerrado_por = NULL, atualizado_em = NOW()
        WHERE id = $1 AND estado = 'encerrado'
          AND NOT EXISTS (SELECT 1 FROM procurados o WHERE o.roblox_id = $2 AND o.estado <> 'encerrado')`,
      [pid, f.roblox_id]);
    if (x.rowCount) out.procurados++; else out.procurados_pulados++;
  }
  return out;
}

module.exports = {
  JANELA_S, TRAVA_MIN,
  migrar, chaveDoBackup, tipoDe, avaliar, linhaPainel,
  capturar, listar, pedir, cancelar, reivindicar, concluir, devolverNoSite,
};
