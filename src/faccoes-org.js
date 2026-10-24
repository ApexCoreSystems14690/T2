// ============================================================================
// [24/10] FACÇÕES VIVAS NO SITE — nível, ações, advertências, recursos e a
// organização das facções (Regulamento das Facções v3.1, aprovado em 22/10).
//
// Facção continua sendo uma corporação com tipo = 'faccao' (cargos e membros
// iguais), mas NÃO tem caixa, estoque, vestiário, repasse nem salário pelo site
// (Regulamento das Facções, Art. 1.5 e 2.4): o dinheiro dela vem do crime e fica
// no cofre da boca, dentro do jogo. Os dados antigos não são apagados, só não
// aparecem para tipo 'faccao'.
//
// O que mora aqui:
//   faccao_info          nível (1 Bonde, 2 Firma, 3 Comando) e desde quando
//   faccao_acoes         ações registradas (prova), aprovadas pela organização
//   faccao_advertencias  advertência só com prova, vence em 30 dias, recurso 72 h
//   faccao_pedidos       pedidos de oficialização
//   faccao_log           tudo que a organização faz, e as consequências automáticas
// O jogo lê o nível no campo `nivel` da entrada da corp (/api/game/player/:id).
// ============================================================================
const pool = require('./db/pool');

const NIVEIS = {
  1: { nome: 'Bonde',   membros: 4, libera: 'Cargo no Discord, canal próprio e vestiário com uniforme, máscara e rádio' },
  2: { nome: 'Firma',   membros: 6, semanas: 2, acoes: 3, libera: 'Assumir 1 boca, laboratório e contrabandista (até 4 armas longas por semana)' },
  3: { nome: 'Comando', membros: 8, semanasNoNivel2: 4, libera: 'Até 2 bocas, contrabandista com até 8 armas longas por semana e cor própria no mural e no rádio pirata' },
};
const TIPOS_ACAO = ['assalto', 'sequestro', 'banco', 'guerra'];
const VENCE_DIAS = 30, RECURSO_H = 72, INATIVA_DIAS = 14, VOLTA_DIAS = 7;
const SEMANA = 7 * 24 * 3600 * 1000;

function erro(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function linkOk(s) { return typeof s === 'string' && /^https?:\/\/\S{4,}$/i.test(s.trim()) && s.length <= 500; }

async function garantir(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS faccao_info (
      corporation_id INTEGER PRIMARY KEY REFERENCES corporations(id) ON DELETE CASCADE,
      nivel INTEGER NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 1 AND 3),
      nivel_desde TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      oficializada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      desoficializada_em TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS faccao_acoes (
      id SERIAL PRIMARY KEY,
      corporation_id INTEGER NOT NULL REFERENCES corporations(id) ON DELETE CASCADE,
      tipo VARCHAR(16) NOT NULL,
      data DATE NOT NULL,
      prova VARCHAR(500) NOT NULL,
      descricao VARCHAR(300),
      enviada_por INTEGER, enviada_nome VARCHAR(128),
      status VARCHAR(12) NOT NULL DEFAULT 'pendente',
      decidido_por VARCHAR(128), motivo VARCHAR(300), decidido_em TIMESTAMPTZ,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS faccao_advertencias (
      id SERIAL PRIMARY KEY,
      corporation_id INTEGER NOT NULL REFERENCES corporations(id) ON DELETE CASCADE,
      artigo VARCHAR(40) NOT NULL,
      motivo VARCHAR(500) NOT NULL,
      prova VARCHAR(500) NOT NULL,
      aplicada_por INTEGER, aplicada_nome VARCHAR(128),
      aplicada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      vence_em TIMESTAMPTZ NOT NULL,
      anulada BOOLEAN NOT NULL DEFAULT false,
      recurso_texto VARCHAR(1000), recurso_em TIMESTAMPTZ, recurso_por VARCHAR(128),
      recurso_status VARCHAR(12),            -- pendente | aceito | negado
      recurso_decidido_por VARCHAR(128), recurso_motivo VARCHAR(300), recurso_decidido_em TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS faccao_pedidos (
      id SERIAL PRIMARY KEY,
      cidade_id INTEGER NOT NULL REFERENCES cidades(id),
      nome VARCHAR(80) NOT NULL, sigla VARCHAR(8) NOT NULL, cor VARCHAR(7) NOT NULL,
      lider_user_id INTEGER NOT NULL, lider_nome VARCHAR(128),
      sublider VARCHAR(80), membros TEXT,
      status VARCHAR(12) NOT NULL DEFAULT 'pendente',
      decidido_por VARCHAR(128), motivo VARCHAR(300), corporation_id INTEGER,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(), decidido_em TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS faccao_log (
      id SERIAL PRIMARY KEY,
      cidade_id INTEGER NOT NULL,
      corporation_id INTEGER,
      acao VARCHAR(40) NOT NULL,
      detalhe JSONB NOT NULL DEFAULT '{}',
      por VARCHAR(128),
      em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_faccao_log ON faccao_log(cidade_id, id DESC);
  `);
  // toda facção que já existe ganha a linha de nível (Nível 1, Art. 2.3)
  await db.query(`INSERT INTO faccao_info (corporation_id, oficializada_em)
                  SELECT id, COALESCE(created_at, NOW()) FROM corporations WHERE tipo = 'faccao' ON CONFLICT DO NOTHING`);
  // alto comando (Regulamento Oficial, Art. 1.10): ids do Discord de CEO, CO-CEO e COO em 24/10.
  // O Dono edita em game_config 'alto_comando'.
  await db.query(`INSERT INTO game_config (key, value) VALUES ('alto_comando', $1::jsonb) ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify({ discord_ids: ['810270743925489676', '1115068291384352770', '986522825219260446', '1248404426906009651', '1243890990801092659'],
                      nota: 'CEO, CO-CEO e COO do Discord principal em 24/10/2026' })]);
}

async function log(db, cidadeId, corpId, acao, detalhe, por) {
  await db.query(`INSERT INTO faccao_log (cidade_id, corporation_id, acao, detalhe, por) VALUES ($1,$2,$3,$4,$5)`,
    [cidadeId, corpId || null, acao, JSON.stringify(detalhe || {}), por || null]);
}
function quem(u) { return u ? (u.discord_username || u.roblox_username || ('user#' + u.id)) : 'sistema'; }

// ---------------------------------------------------------------- alto comando
async function altoComando(db) {
  const r = await db.query(`SELECT value FROM game_config WHERE key = 'alto_comando'`).catch(() => ({ rows: [] }));
  const v = r.rows[0] && r.rows[0].value;
  return new Set(((v && v.discord_ids) || []).map(String));
}
async function ehAltoComando(db, userId) {
  const u = (await db.query(`SELECT discord_id FROM users WHERE id = $1`, [userId])).rows[0];
  if (!u) return false;
  return (await altoComando(db)).has(String(u.discord_id));
}

// ---------------------------------------------------------------- leitura
async function faccao(db, cidadeId, corpId) {
  const r = await db.query(
    `SELECT c.id, c.name, c.slug, c.color, c.is_active, c.owner_id, c.created_at, c.cidade_id,
            COALESCE(fi.nivel, 1) AS nivel, fi.nivel_desde, fi.oficializada_em
       FROM corporations c LEFT JOIN faccao_info fi ON fi.corporation_id = c.id
      WHERE c.id = $1 AND c.cidade_id = $2 AND c.tipo = 'faccao'`, [parseInt(corpId) || 0, cidadeId]);
  return r.rows[0] || null;
}

// núcleo puro: o que falta pro próximo nível
function requisitos(f, agoraMs) {
  const agora = agoraMs || Date.now();
  const prox = f.nivel + 1;
  if (prox > 3) return { proximo: null, itens: [], cumpre: false };
  const N = NIVEIS[prox];
  const itens = [{ k: 'membros', rotulo: 'Membros', tem: f.membros, precisa: N.membros }];
  if (prox === 2) {
    const sem = Math.floor((agora - new Date(f.oficializada_em).getTime()) / SEMANA);
    itens.push({ k: 'semanas', rotulo: 'Semanas ativa', tem: sem, precisa: N.semanas });
    itens.push({ k: 'acoes', rotulo: 'Ações registradas aprovadas', tem: f.acoes_aprovadas, precisa: N.acoes });
  } else {
    const sem = Math.floor((agora - new Date(f.nivel_desde).getTime()) / SEMANA);
    itens.push({ k: 'semanas', rotulo: 'Semanas no Nível 2', tem: sem, precisa: N.semanasNoNivel2 });
  }
  return { proximo: prox, nome: N.nome, itens, cumpre: itens.every(i => i.tem >= i.precisa) };
}

const SQL_ADV_ATIVA = `NOT a.anulada AND a.vence_em > NOW() AND COALESCE(a.recurso_status, '') <> 'aceito'`;

async function resumo(db, f) {
  const m = await db.query(
    `SELECT COUNT(*)::int AS n,
            MAX((SELECT MAX(COALESCE(l.ocorrido_em, l.created_at)) FROM game_logs l
                  WHERE l.tipo = 'entrou' AND l.detalhe->>'userId' = u.roblox_id::text)) AS ultima
       FROM members mb JOIN users u ON u.id = mb.user_id WHERE mb.corporation_id = $1`, [f.id]).catch(() => ({ rows: [{ n: 0, ultima: null }] }));
  const ac = await db.query(`SELECT COUNT(*)::int n FROM faccao_acoes WHERE corporation_id = $1 AND status = 'aprovada'`, [f.id]);
  const adv = await db.query(`SELECT COUNT(*)::int n FROM faccao_advertencias a WHERE a.corporation_id = $1 AND ${SQL_ADV_ATIVA}`, [f.id]);
  const out = { ...f, membros: m.rows[0].n, ultima_atividade: m.rows[0].ultima, acoes_aprovadas: ac.rows[0].n, advertencias_ativas: adv.rows[0].n };
  out.inativa = !out.ultima_atividade || (Date.now() - new Date(out.ultima_atividade).getTime()) > INATIVA_DIAS * 86400000;
  out.req = requisitos(out);
  return out;
}

// o que a facção vê no painel dela
async function painel(db, cidadeId, corpId, user) {
  const f0 = await faccao(db, cidadeId, corpId);
  if (!f0) throw erro('Facção não encontrada', 404);
  const f = await resumo(db, f0);
  const acoes = (await db.query(`SELECT id, tipo, to_char(data, 'YYYY-MM-DD') AS data, prova, descricao, enviada_nome, status, motivo, decidido_por, criado_em
                                   FROM faccao_acoes WHERE corporation_id = $1 ORDER BY id DESC LIMIT 50`, [f.id])).rows;
  const advs = (await db.query(`SELECT a.*, (${SQL_ADV_ATIVA}) AS ativa,
                                       (a.recurso_em IS NULL AND NOW() < a.aplicada_em + INTERVAL '${RECURSO_H} hours') AS pode_recorrer
                                  FROM faccao_advertencias a WHERE a.corporation_id = $1 ORDER BY a.id DESC LIMIT 50`, [f.id])).rows;
  return {
    faccao: { id: f.id, nome: f.name, slug: f.slug, cor: f.color, nivel: f.nivel, nivel_nome: NIVEIS[f.nivel].nome,
              membros: f.membros, ultima_atividade: f.ultima_atividade, inativa: f.inativa, advertencias_ativas: f.advertencias_ativas },
    niveis: NIVEIS, requisitos: f.req, acoes, advertencias: advs, tipos_acao: TIPOS_ACAO,
    // O jogo ainda não manda posse de boca nem compras do contrabandista pro site (ficam no DataStore
    // do jogo: Bocas-CBRP.1 e Contrabando-CBRP.1). O painel não inventa número.
    boca: { reportada: false, aviso: 'O jogo ainda não informa ao site qual boca a facção tem.' },
    contrabandista: { reportada: false, teto: f.nivel >= 3 ? 8 : (f.nivel === 2 ? 4 : 0),
                      aviso: 'As compras ficam registradas no jogo; o site ainda não recebe essa conta.' },
  };
}

async function ehMembro(db, corpId, userId) {
  return !!(await db.query(`SELECT 1 FROM members WHERE corporation_id = $1 AND user_id = $2`, [corpId, userId])).rows[0];
}
// comando da facção = dono no painel ou cargo entre os 2 maiores níveis (líder e sub-líder)
async function ehComando(db, corpId, userId) {
  const r = await db.query(
    `SELECT (c.owner_id = $2) OR EXISTS (
        SELECT 1 FROM members mb JOIN ranks r ON r.id = mb.rank_id
         WHERE mb.corporation_id = c.id AND mb.user_id = $2
           AND r.level >= COALESCE((SELECT level FROM ranks WHERE corporation_id = c.id ORDER BY level DESC OFFSET 1 LIMIT 1),
                                   (SELECT MAX(level) FROM ranks WHERE corporation_id = c.id))) AS ok
       FROM corporations c WHERE c.id = $1`, [corpId, userId]);
  return !!(r.rows[0] && r.rows[0].ok);
}

// ---------------------------------------------------------------- facção age
async function enviarAcao(db, cidadeId, corpId, user, b) {
  const f = await faccao(db, cidadeId, corpId);
  if (!f || !f.is_active) throw erro('Facção não encontrada', 404);
  if (!(await ehMembro(db, f.id, user.id))) throw erro('Só membro da facção registra ação', 403);
  const tipo = String(b.tipo || '');
  if (!TIPOS_ACAO.includes(tipo)) throw erro('Tipo de ação inválido');
  if (!linkOk(b.prova)) throw erro('Mande o link do print ou do vídeo da ação (https://...)');
  const data = String(b.data || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || new Date(data + 'T00:00:00Z').getTime() > Date.now() + 86400000) throw erro('Data inválida');
  const r = await db.query(`INSERT INTO faccao_acoes (corporation_id, tipo, data, prova, descricao, enviada_por, enviada_nome)
                            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [f.id, tipo, data, b.prova.trim(), String(b.descricao || '').slice(0, 300) || null, user.id, quem(user)]);
  return { id: r.rows[0].id };
}

async function recorrer(db, cidadeId, corpId, advId, user, b) {
  const f = await faccao(db, cidadeId, corpId);
  if (!f) throw erro('Facção não encontrada', 404);
  if (!(await ehComando(db, f.id, user.id))) throw erro('Só o líder ou o sub-líder recorre', 403);
  const texto = String(b.texto || '').trim();
  if (texto.length < 10) throw erro('Explique o recurso (pelo menos 10 letras)');
  const a = (await db.query(`SELECT * FROM faccao_advertencias WHERE id = $1 AND corporation_id = $2`, [parseInt(advId) || 0, f.id])).rows[0];
  if (!a) throw erro('Advertência não encontrada', 404);
  if (a.recurso_em) throw erro('Essa advertência já tem recurso');
  if (Date.now() > new Date(a.aplicada_em).getTime() + RECURSO_H * 3600000) throw erro('O prazo de recurso (72 h) já passou');
  await db.query(`UPDATE faccao_advertencias SET recurso_texto = $2, recurso_em = NOW(), recurso_por = $3, recurso_status = 'pendente' WHERE id = $1`,
    [a.id, texto.slice(0, 1000), quem(user)]);
  await log(db, cidadeId, f.id, 'recurso_aberto', { advertencia: a.id }, quem(user));
  return { ok: true };
}

async function passarLideranca(db, cidadeId, corpId, user, b) {
  const f = await faccao(db, cidadeId, corpId);
  if (!f || !f.is_active) throw erro('Facção não encontrada', 404);
  if (f.owner_id !== user.id) throw erro('Só o líder passa a liderança', 403);
  const alvo = parseInt(b.user_id) || 0;
  if (!(await ehMembro(db, f.id, alvo))) throw erro('O novo líder tem que ser membro da facção');
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const r1 = (await cli.query(`SELECT rank_id FROM members WHERE corporation_id = $1 AND user_id = $2`, [f.id, user.id])).rows[0];
    const r2 = (await cli.query(`SELECT rank_id FROM members WHERE corporation_id = $1 AND user_id = $2`, [f.id, alvo])).rows[0];
    await cli.query(`UPDATE corporations SET owner_id = $2, updated_at = NOW() WHERE id = $1`, [f.id, alvo]);
    if (r1 && r2) {   // troca os cargos: o novo líder pega o cargo do antigo
      await cli.query(`UPDATE members SET rank_id = $3 WHERE corporation_id = $1 AND user_id = $2`, [f.id, alvo, r1.rank_id]);
      await cli.query(`UPDATE members SET rank_id = $3 WHERE corporation_id = $1 AND user_id = $2`, [f.id, user.id, r2.rank_id]);
    }
    await cli.query('COMMIT');
  } catch (e) { await cli.query('ROLLBACK').catch(() => {}); throw e; } finally { cli.release(); }
  await log(db, cidadeId, f.id, 'lideranca', { de: user.id, para: alvo }, quem(user));
  return { ok: true };
}

// ---------------------------------------------------------------- organização
async function lista(db, cidadeId) {
  const fs = (await db.query(
    `SELECT c.id, c.name, c.slug, c.color, c.is_active, c.owner_id, c.created_at, c.cidade_id,
            COALESCE(fi.nivel, 1) AS nivel, COALESCE(fi.nivel_desde, c.created_at) AS nivel_desde,
            COALESCE(fi.oficializada_em, c.created_at) AS oficializada_em, fi.desoficializada_em
       FROM corporations c LEFT JOIN faccao_info fi ON fi.corporation_id = c.id
      WHERE c.tipo = 'faccao' AND c.cidade_id = $1 ORDER BY c.is_active DESC, c.name`, [cidadeId])).rows;
  const out = [];
  for (const f of fs) {
    const r = await resumo(db, f);
    r.nivel_nome = NIVEIS[r.nivel].nome;
    r.sugestao = !r.is_active ? null
      : r.inativa ? 'descer (2 semanas sem membro ativo, Art. 2.5)'
      : r.req.cumpre ? 'subir para o Nível ' + r.req.proximo + ' (' + r.req.nome + ')'
      : null;
    out.push(r);
  }
  return out;
}

async function membrosDe(db, corpId) {
  return (await db.query(
    `SELECT u.id AS user_id, u.discord_id, COALESCE(u.roblox_username, u.discord_username) AS nome, r.name AS cargo, r.level
       FROM members mb JOIN users u ON u.id = mb.user_id LEFT JOIN ranks r ON r.id = mb.rank_id
      WHERE mb.corporation_id = $1 ORDER BY r.level DESC NULLS LAST, nome`, [corpId])).rows;
}

async function mudarNivel(db, cidadeId, corpId, user, b) {
  const f = await faccao(db, cidadeId, corpId);
  if (!f || !f.is_active) throw erro('Facção não encontrada', 404);
  const n = parseInt(b.nivel);
  if (![1, 2, 3].includes(n)) throw erro('Nível é 1, 2 ou 3');
  const motivo = String(b.motivo || '').trim();
  if (motivo.length < 5) throw erro('Diga o motivo');
  if (n === Number(f.nivel)) throw erro('A facção já está nesse nível');
  await db.query(`INSERT INTO faccao_info (corporation_id, nivel, nivel_desde) VALUES ($1,$2,NOW())
                  ON CONFLICT (corporation_id) DO UPDATE SET nivel = $2, nivel_desde = NOW()`, [f.id, n]);
  await log(db, cidadeId, f.id, n > f.nivel ? 'subiu_nivel' : 'desceu_nivel', { de: f.nivel, para: n, motivo }, quem(user));
  return { ok: true };
}

async function desoficializar(db, cidadeId, corpId, porNome, motivo) {
  await db.query(`UPDATE corporations SET is_active = false, updated_at = NOW() WHERE id = $1 AND cidade_id = $2 AND tipo = 'faccao'`, [corpId, cidadeId]);
  await db.query(`INSERT INTO faccao_info (corporation_id, desoficializada_em) VALUES ($1, NOW())
                  ON CONFLICT (corporation_id) DO UPDATE SET desoficializada_em = NOW()`, [corpId]);
  await log(db, cidadeId, corpId, 'desoficializada', { motivo }, porNome);
}

async function decidirAcao(db, cidadeId, acaoId, user, b) {
  const a = (await db.query(`SELECT a.*, c.cidade_id FROM faccao_acoes a JOIN corporations c ON c.id = a.corporation_id WHERE a.id = $1`, [parseInt(acaoId) || 0])).rows[0];
  if (!a || a.cidade_id !== cidadeId) throw erro('Ação não encontrada', 404);
  if (a.status !== 'pendente') throw erro('Essa ação já foi decidida');
  const aprovar = b.aprovar === true;
  const motivo = String(b.motivo || '').trim();
  if (!aprovar && motivo.length < 5) throw erro('Recusar exige motivo');
  if (await ehMembro(db, a.corporation_id, user.id)) throw erro('Quem é da facção não decide a ação dela', 403);
  await db.query(`UPDATE faccao_acoes SET status = $2, motivo = $3, decidido_por = $4, decidido_em = NOW() WHERE id = $1`,
    [a.id, aprovar ? 'aprovada' : 'recusada', motivo || null, quem(user)]);
  await log(db, cidadeId, a.corporation_id, aprovar ? 'acao_aprovada' : 'acao_recusada', { acao: a.id, motivo }, quem(user));
  return { ok: true };
}

async function advertir(db, cidadeId, corpId, user, b) {
  const f = await faccao(db, cidadeId, corpId);
  if (!f || !f.is_active) throw erro('Facção não encontrada', 404);
  // Art. 9.2: quem tem relação com a facção punida não decide
  if (await ehMembro(db, f.id, user.id)) throw erro('Você é membro dessa facção: não pode advertir ela (Art. 9.2)', 403);
  if (!linkOk(b.prova)) throw erro('Advertência só com prova: mande o link do print ou do vídeo');
  const artigo = String(b.artigo || '').trim();
  if (!/\d/.test(artigo)) throw erro('Diga o artigo do regulamento');
  const motivo = String(b.motivo || '').trim();
  if (motivo.length < 5) throw erro('Diga o motivo');
  const r = await db.query(`INSERT INTO faccao_advertencias (corporation_id, artigo, motivo, prova, aplicada_por, aplicada_nome, vence_em)
                            VALUES ($1,$2,$3,$4,$5,$6, NOW() + INTERVAL '${VENCE_DIAS} days') RETURNING id`,
    [f.id, artigo.slice(0, 40), motivo.slice(0, 500), b.prova.trim(), user.id, quem(user)]);
  await log(db, cidadeId, f.id, 'advertencia', { id: r.rows[0].id, artigo, motivo }, quem(user));
  const consequencia = await consequencias(db, cidadeId, f.id, quem(user));
  return { id: r.rows[0].id, consequencia };
}

// Tabela do Art. 9.4: 2 ativas = desce um nível; 3 = desoficialização. Avisa no log.
async function consequencias(db, cidadeId, corpId, porNome) {
  const n = (await db.query(`SELECT COUNT(*)::int n FROM faccao_advertencias a WHERE a.corporation_id = $1 AND ${SQL_ADV_ATIVA}`, [corpId])).rows[0].n;
  if (n >= 3) {
    await desoficializar(db, cidadeId, corpId, porNome + ' (automático: 3 advertências)', '3 advertências ativas (Art. 9.4)');
    return 'desoficializada';
  }
  if (n === 2) {
    const f = await faccao(db, cidadeId, corpId);
    if (f && f.nivel > 1) {
      await db.query(`UPDATE faccao_info SET nivel = nivel - 1, nivel_desde = NOW() WHERE corporation_id = $1`, [corpId]);
      await log(db, cidadeId, corpId, 'desceu_nivel', { de: f.nivel, para: f.nivel - 1, motivo: '2 advertências ativas (Art. 9.4)' }, porNome + ' (automático)');
      return 'desceu_nivel';
    }
    await log(db, cidadeId, corpId, 'aviso', { motivo: '2 advertências ativas no Nível 1: não há nível para descer' }, 'automático');
  }
  return null;
}

async function decidirRecurso(db, cidadeId, advId, user, b) {
  const a = (await db.query(`SELECT a.*, c.cidade_id FROM faccao_advertencias a JOIN corporations c ON c.id = a.corporation_id WHERE a.id = $1`, [parseInt(advId) || 0])).rows[0];
  if (!a || a.cidade_id !== cidadeId) throw erro('Advertência não encontrada', 404);
  if (a.recurso_status !== 'pendente') throw erro('Não há recurso pendente nessa advertência');
  const aceitar = b.aceitar === true;
  const motivo = String(b.motivo || '').trim();
  if (motivo.length < 5) throw erro('Diga o motivo da decisão');
  await db.query(`UPDATE faccao_advertencias SET recurso_status = $2, recurso_decidido_por = $3, recurso_motivo = $4, recurso_decidido_em = NOW() WHERE id = $1`,
    [a.id, aceitar ? 'aceito' : 'negado', quem(user), motivo.slice(0, 300)]);
  await log(db, cidadeId, a.corporation_id, aceitar ? 'recurso_aceito' : 'recurso_negado', { advertencia: a.id, motivo }, quem(user));
  return { ok: true };
}

async function recursosPendentes(db, cidadeId) {
  return (await db.query(
    `SELECT a.id, a.artigo, a.motivo, a.prova, a.aplicada_nome, a.aplicada_em, a.recurso_texto, a.recurso_em, a.recurso_por,
            c.name AS faccao, c.id AS corporation_id
       FROM faccao_advertencias a JOIN corporations c ON c.id = a.corporation_id
      WHERE c.cidade_id = $1 AND a.recurso_status = 'pendente' ORDER BY a.recurso_em`, [cidadeId])).rows;
}

// pedido de oficialização (o líder pede pelo site)
async function pedir(db, cidadeId, user, b) {
  const nome = String(b.nome || '').trim(), sigla = String(b.sigla || '').trim().toUpperCase(), cor = String(b.cor || '').trim();
  if (nome.length < 3 || nome.length > 80) throw erro('Nome inválido');
  if (!/^[A-Z0-9]{2,8}$/.test(sigla)) throw erro('Sigla com 2 a 8 letras ou números');
  if (!/^#[0-9a-fA-F]{6}$/.test(cor)) throw erro('Cor inválida');
  if (await ehAltoComando(db, user.id)) throw erro('Alto comando não entra em facção (Regulamento Oficial, Art. 1.10)', 403);
  // Art. 10.3: depois de desoficializada, só volta em 7 dias
  const volta = (await db.query(
    `SELECT fi.desoficializada_em FROM corporations c JOIN faccao_info fi ON fi.corporation_id = c.id
      WHERE c.cidade_id = $1 AND c.tipo = 'faccao' AND fi.desoficializada_em > NOW() - INTERVAL '${VOLTA_DIAS} days'
        AND (LOWER(c.name) = LOWER($2) OR c.owner_id = $3) LIMIT 1`, [cidadeId, nome, user.id])).rows[0];
  if (volta) throw erro('Facção desoficializada só pode pedir de novo 7 dias depois (Art. 10.3)');
  const r = await db.query(`INSERT INTO faccao_pedidos (cidade_id, nome, sigla, cor, lider_user_id, lider_nome, sublider, membros)
                            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [cidadeId, nome, sigla, cor.toUpperCase(), user.id, quem(user), String(b.sublider || '').slice(0, 80) || null, String(b.membros || '').slice(0, 2000) || null]);
  return { id: r.rows[0].id };
}

async function decidirPedido(db, cidadeId, pedidoId, user, b) {
  const p = (await db.query(`SELECT * FROM faccao_pedidos WHERE id = $1 AND cidade_id = $2`, [parseInt(pedidoId) || 0, cidadeId])).rows[0];
  if (!p) throw erro('Pedido não encontrado', 404);
  if (p.status !== 'pendente') throw erro('Esse pedido já foi decidido');
  if (b.aprovar !== true) {
    const motivo = String(b.motivo || '').trim();
    if (motivo.length < 5) throw erro('Recusar exige motivo');
    await db.query(`UPDATE faccao_pedidos SET status = 'recusado', motivo = $2, decidido_por = $3, decidido_em = NOW() WHERE id = $1`, [p.id, motivo, quem(user)]);
    await log(db, cidadeId, null, 'pedido_recusado', { pedido: p.id, nome: p.nome, motivo }, quem(user));
    return { ok: true };
  }
  if (await ehAltoComando(db, p.lider_user_id)) throw erro('O líder pedido é do alto comando (Art. 1.10)', 403);
  const base = p.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'faccao';
  let slug = base, i = 2;
  while ((await db.query(`SELECT 1 FROM corporations WHERE slug = $1`, [slug])).rows[0]) slug = base + '-' + (i++);
  const cli = await pool.connect();
  let corpId;
  try {
    await cli.query('BEGIN');
    corpId = (await cli.query(
      `INSERT INTO corporations (name, slug, description, owner_id, color, max_members, tipo, cidade_id)
       VALUES ($1,$2,$3,$4,$5,50,'faccao',$6) RETURNING id`,
      [p.nome, slug, p.sigla, p.lider_user_id, p.cor, cidadeId])).rows[0].id;
    const ids = [];
    for (const [nome, lv] of [['Líder', 3], ['Sub-líder', 2], ['Membro', 1]]) {
      ids.push((await cli.query(`INSERT INTO ranks (corporation_id, name, level, salary) VALUES ($1,$2,$3,0) RETURNING id`, [corpId, nome, lv])).rows[0].id);
    }
    await cli.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3)`, [corpId, p.lider_user_id, ids[0]]);
    await cli.query(`INSERT INTO faccao_info (corporation_id, nivel) VALUES ($1, 1)`, [corpId]);
    await cli.query(`UPDATE faccao_pedidos SET status = 'aprovado', corporation_id = $2, decidido_por = $3, decidido_em = NOW() WHERE id = $1`, [p.id, corpId, quem(user)]);
    await cli.query('COMMIT');
  } catch (e) { await cli.query('ROLLBACK').catch(() => {}); throw e; } finally { cli.release(); }
  await log(db, cidadeId, corpId, 'oficializada', { pedido: p.id, nome: p.nome, nivel: 1 }, quem(user));
  return { ok: true, corporation_id: corpId, slug };
}

async function painelOrg(db, cidadeId, user) {
  const fs = await lista(db, cidadeId);
  const ac = await altoComando(db);
  for (const f of fs) {
    f.membros_lista = await membrosDe(db, f.id);
    f.alto_comando_dentro = f.membros_lista.filter(m => ac.has(String(m.discord_id))).map(m => m.nome);
    f.sou_membro = f.membros_lista.some(m => m.user_id === user.id);
    delete f.req.itens_raw;
  }
  const pedidos = (await db.query(`SELECT * FROM faccao_pedidos WHERE cidade_id = $1 ORDER BY (status = 'pendente') DESC, id DESC LIMIT 40`, [cidadeId])).rows;
  const acoes = (await db.query(
    `SELECT a.id, a.tipo, to_char(a.data, 'YYYY-MM-DD') AS data, a.prova, a.descricao, a.enviada_nome, a.criado_em, c.name AS faccao, c.id AS corporation_id
       FROM faccao_acoes a JOIN corporations c ON c.id = a.corporation_id
      WHERE c.cidade_id = $1 AND a.status = 'pendente' ORDER BY a.id`, [cidadeId])).rows;
  const logs = (await db.query(`SELECT l.*, c.name AS faccao FROM faccao_log l LEFT JOIN corporations c ON c.id = l.corporation_id
                                 WHERE l.cidade_id = $1 ORDER BY l.id DESC LIMIT 60`, [cidadeId])).rows;
  return { faccoes: fs, pedidos, acoes_pendentes: acoes, log: logs, niveis: NIVEIS };
}

module.exports = {
  NIVEIS, TIPOS_ACAO, VENCE_DIAS, RECURSO_H, garantir, requisitos, faccao, painel, enviarAcao, recorrer, passarLideranca,
  lista, painelOrg, mudarNivel, decidirAcao, advertir, consequencias, decidirRecurso, recursosPendentes, pedir, decidirPedido,
  desoficializar, ehAltoComando, altoComando, ehMembro, log,
};
