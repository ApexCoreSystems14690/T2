// [14/10] ELEIÇÃO DO SANTA FÉ — armazenamento, apuração e revelação por zona.
//
// A lista de candidatos NÃO mora aqui: o jogo manda a config (Regras.Eleicao) no boot
// pelo POST /api/game/eleicao/config, e o site usa SÓ ela. Mudou candidato no jogo, o
// site acompanha sozinho.
//
// VOTO SECRETO: duas tabelas que não se cruzam.
//   eleicao_votantes  -> QUEM votou (user_id, nome, turno, cargo, conta_dias, revisar)
//   eleicao_votos     -> O QUE foi votado (turno, cargo, numero, zona)
// Sem chave ligando uma à outra. E pra nem a ORDEM nem o HORÁRIO entregarem quem é quem:
// o id do voto é aleatório (uuid) e o criado_em do voto é truncado pra hora cheia.
//
// O núcleo da apuração é a tradução 1:1 do Regras.Eleicao do jogo (mesmo limiar, mesma
// maior sobra com teto por partido, mesmo desempate) — os dois têm que dar o mesmo resultado.
const crypto = require('crypto');

const ZONAS = 12;
const DURACAO_PADRAO_MIN = 60;

// ============================================================ NÚCLEO PURO
const inteiro = v => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0; };

function normalizarConfig(c) {
  c = c || {};
  const partidos = {};
  for (const [k, p] of Object.entries(c.partidos || c.PARTIDOS || {})) {
    if (!p) continue;
    const cor = Array.isArray(p.cor) ? p.cor.slice(0, 3).map(inteiro) : [150, 150, 150];
    partidos[String(k)] = { numero: String(k), sigla: String(p.sigla || k).slice(0, 20), nome: String(p.nome || p.sigla || k).slice(0, 80), cor };
  }
  const cand = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 60).map(x => ({
    numero: x && x.numero != null && String(x.numero).replace(/\D/g, '') !== '' ? String(x.numero).replace(/\D/g, '') : null,
    nome: String((x && x.nome) || '?').slice(0, 80),
    vice: x && x.vice ? String(x.vice).slice(0, 80) : null,
    partido: String((x && x.partido) || ''),
    pendente: !!(x && x.pendente) || !(x && x.numero != null && String(x.numero).replace(/\D/g, '') !== ''),
  }));
  return {
    partidos,
    presidencia: cand(c.presidencia || c.PRESIDENCIA),
    parlamento: cand(c.parlamento || c.PARLAMENTO),
    limiar: Number(c.limiar || c.LIMIAR_1O_TURNO) > 0 ? Number(c.limiar || c.LIMIAR_1O_TURNO) : 0.51,
    cadeiras: inteiro(c.cadeiras || c.CADEIRAS_PARLAMENTO) || 5,
  };
}

const corHex = c => '#' + (Array.isArray(c) ? c : [150, 150, 150]).map(v => inteiro(v).toString(16).padStart(2, '0')).join('');

function lista(cfg, cargo) { return cargo === 'presidente' ? cfg.presidencia : cargo === 'parlamento' ? cfg.parlamento : []; }
// finalistas: no 2º turno só os dois que foram pra lá recebem voto
function votaveis(cfg, cargo, finalistas) {
  let l = lista(cfg, cargo).filter(c => c.numero && !c.pendente);
  if (cargo === 'presidente' && Array.isArray(finalistas) && finalistas.length) l = l.filter(c => finalistas.includes(c.numero));
  return l;
}
function cargosDoTurno(turno) { return Number(turno) === 2 ? ['presidente'] : ['parlamento', 'presidente']; }

// o número digitado vira o que fica gravado: o próprio número, BRANCO ou NULO
function normalizarVoto(cfg, cargo, numero, finalistas) {
  const s = String(numero == null ? '' : numero).trim().toUpperCase();
  if (s === 'BRANCO') return 'BRANCO';
  if (s === 'NULO' || s === '') return 'NULO';
  const n = s.replace(/\D/g, '');
  return votaveis(cfg, cargo, finalistas).some(c => c.numero === n) ? n : 'NULO';
}

function totais(cfg, votos, cargo, finalistas) {
  votos = votos || {};
  let validos = 0, branco = inteiro(votos.BRANCO), nulo = inteiro(votos.NULO);
  const conhecidos = new Set(votaveis(cfg, cargo, finalistas).map(c => c.numero));
  for (const [k, v] of Object.entries(votos)) {
    if (k === 'BRANCO' || k === 'NULO') continue;
    if (conhecidos.has(k)) validos += inteiro(v); else nulo += inteiro(v);
  }
  return { validos, branco, nulo, total: validos + branco + nulo };
}

function ranking(cfg, cargo, votos, finalistas) {
  votos = votos || {};
  const t = totais(cfg, votos, cargo, finalistas);
  const r = votaveis(cfg, cargo, finalistas).map(c => {
    const p = cfg.partidos[c.partido];
    const v = inteiro(votos[c.numero]);
    return { numero: c.numero, nome: c.nome, vice: c.vice, partido: c.partido, sigla: p ? p.sigla : '', cor: corHex(p && p.cor), votos: v, pct: t.validos > 0 ? v / t.validos : 0 };
  });
  r.sort((a, b) => (b.votos - a.votos) || (Number(a.numero) - Number(b.numero)));
  return { r, t };
}

function presidencia(cfg, votos, turno, finalistas) {
  turno = Number(turno) || 1;
  const { r, t } = ranking(cfg, 'presidente', votos, turno === 2 ? finalistas : null);
  const out = { ranking: r, totais: t, turno, limiar: cfg.limiar, eleito: null, segundoTurno: null };
  if (t.validos <= 0) { out.situacao = 'sem_votos'; return out; }
  if (turno >= 2) {
    if (r[1] && r[0].votos === r[1].votos) out.situacao = 'empate';
    else { out.eleito = r[0]; out.situacao = 'eleito_2o'; }
    return out;
  }
  if (r[0].pct >= cfg.limiar) { out.eleito = r[0]; out.situacao = 'eleito_1o'; return out; }
  out.segundoTurno = [r[0], r[1]].filter(Boolean);
  out.situacao = 'segundo_turno';
  return out;
}

function parlamento(cfg, votos) {
  const { r, t } = ranking(cfg, 'parlamento', votos);
  const N = cfg.cadeiras;
  const out = { ranking: r, totais: t, cadeiras: N, porPartido: [], eleitos: [], assentos: [], vagas: N };
  // candidato anunciado sem número aparece na lista como "número pendente"
  out.pendentes = cfg.parlamento.filter(c => !c.numero || c.pendente).map(c => {
    const p = cfg.partidos[c.partido]; return { nome: c.nome, partido: c.partido, sigla: p ? p.sigla : '', cor: corHex(p && p.cor) };
  });
  if (t.validos <= 0) {
    r.forEach(c => { c.eleito = false; });
    for (let i = 0; i < N; i++) out.assentos.push({ vazio: true, cor: '#C1C7CF' });
    out.situacao = 'sem_votos';
    return out;
  }
  const porP = new Map();
  for (const c of r) {
    if (!porP.has(c.partido)) porP.set(c.partido, { partido: c.partido, sigla: c.sigla, cor: c.cor, votos: 0, cadeiras: 0 });
    porP.get(c.partido).votos += c.votos;
  }
  const ordemP = [...porP.values()];
  const teto = {};
  for (const c of r) if (c.votos > 0) teto[c.partido] = (teto[c.partido] || 0) + 1;
  const quota = t.validos / N;
  let usadas = 0;
  for (const p of ordemP) {
    p.teto = teto[p.partido] || 0;
    if (p.votos > 0) {
      const cheias = Math.floor(p.votos / quota);
      p.cadeiras = Math.min(cheias, p.teto);
      p.sobra = (p.votos / quota) - cheias;
      usadas += p.cadeiras;
    } else { p.cadeiras = 0; p.sobra = -1; }
  }
  const porSobra = [...ordemP].sort((a, b) => (b.sobra - a.sobra) || (b.votos - a.votos) || (Number(a.partido) - Number(b.partido)));
  while (usadas < N) {
    let deu = false;
    for (const p of porSobra) {
      if (p.votos > 0 && p.cadeiras < p.teto) { p.cadeiras++; usadas++; deu = true; if (usadas >= N) break; }
    }
    if (!deu) break;
  }
  out.vagas = N - usadas;
  const levou = {};
  for (const c of r) {
    const p = porP.get(c.partido);
    levou[c.partido] = levou[c.partido] || 0;
    if (p && levou[c.partido] < p.cadeiras && c.votos > 0) { c.eleito = true; levou[c.partido]++; out.eleitos.push(c); }
    else c.eleito = false;
  }
  ordemP.sort((a, b) => (b.cadeiras - a.cadeiras) || (b.votos - a.votos));
  out.porPartido = ordemP;
  for (const c of out.eleitos) out.assentos.push({ partido: c.partido, sigla: c.sigla, cor: c.cor, nome: c.nome });
  while (out.assentos.length < N) out.assentos.push({ vazio: true, cor: '#C1C7CF' });
  out.situacao = 'ok';
  out.quota = quota;
  return out;
}

// ============================================================ REVELAÇÃO POR ZONA
// votosPorZona: { zona: { cargo: { numero: n } } }
function somarZonas(votosPorZona, zonas) {
  const out = {};
  for (const z of zonas) {
    const vz = votosPorZona[z] || {};
    for (const [cargo, mapa] of Object.entries(vz)) {
      out[cargo] = out[cargo] || {};
      for (const [num, n] of Object.entries(mapa)) out[cargo][num] = (out[cargo][num] || 0) + n;
    }
  }
  return out;
}

// quem lidera depois de cada zona revelada (presidente; no 1º turno também o partido que lidera o parlamento)
function lideres(cfg, votosPorZona, ordem, turno, finalistas) {
  const acc = {}; const seq = [];
  for (const z of ordem) {
    const vz = votosPorZona[z] || {};
    for (const [cargo, mapa] of Object.entries(vz)) {
      acc[cargo] = acc[cargo] || {};
      for (const [num, n] of Object.entries(mapa)) acc[cargo][num] = (acc[cargo][num] || 0) + n;
    }
    const pr = ranking(cfg, 'presidente', acc.presidente, Number(turno) === 2 ? finalistas : null);
    const lp = pr.t.validos > 0 ? pr.r[0].numero : null;
    let lpart = null;
    if (Number(turno) !== 2) {
      const pa = ranking(cfg, 'parlamento', acc.parlamento);
      const soma = {};
      for (const c of pa.r) soma[c.partido] = (soma[c.partido] || 0) + c.votos;
      const ent = Object.entries(soma).sort((a, b) => (b[1] - a[1]) || (Number(a[0]) - Number(b[0])));
      lpart = ent.length && ent[0][1] > 0 ? ent[0][0] : null;
    }
    seq.push([lp, lpart]);
  }
  return seq;
}
function viradas(seq) {
  let pres = 0, parl = 0;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i][0] && seq[i - 1][0] && seq[i][0] !== seq[i - 1][0]) pres++;
    if (seq[i][1] && seq[i - 1][1] && seq[i][1] !== seq[i - 1][1]) parl++;
  }
  return { pres, parl, total: pres + parl };
}

function embaralhar(a, rnd) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Escolhe a ORDEM das zonas: testa muitas, pontua pela quantidade de viradas e fica com uma
// das que têm virada (2 a 4 pontos é o ponto doce: tem drama sem virar pingue-pongue).
// O resultado final não muda: a soma das 12 zonas é sempre a contagem inteira.
function escolherOrdem(cfg, votosPorZona, turno, finalistas, rnd = Math.random, tentativas = 800) {
  const base = Array.from({ length: ZONAS }, (_, i) => i + 1);
  // nota: virada na PRESIDÊNCIA é o que importa (1 ou 2 é o ponto doce; mais que 3 vira
  // pingue-pongue e parece armado). Virada no partido que lidera o parlamento soma pouco.
  const notaDe = v => {
    let n = v.pres === 0 ? 0 : v.pres <= 2 ? 100 + v.pres * 10 : Math.max(60, 100 - (v.pres - 2) * 15);
    return n + Math.min(v.parl, 3) * 3;
  };
  let melhor = base, melhorNota = -1, melhorV = { pres: 0, parl: 0, total: 0 };
  for (let k = 0; k < tentativas; k++) {
    const o = embaralhar(base, rnd);
    const v = viradas(lideres(cfg, votosPorZona, o, turno, finalistas));
    const nota = notaDe(v);
    if (nota > melhorNota) { melhor = o; melhorNota = nota; melhorV = v; }
    if (melhorNota >= 129 && k > 100) break;
  }
  return { ordem: melhor, viradas: melhorV.pres, viradasParlamento: melhorV.parl };
}

// Horários irregulares: algumas zonas em rajada, outras depois de pausa longa.
// Devolve os segundos (desde o fechamento) em que cada zona da ORDEM entra.
function cronograma(duracaoMin, rnd = Math.random) {
  const total = Math.max(1, Number(duracaoMin) || DURACAO_PADRAO_MIN) * 60;
  const pesos = [];
  for (let i = 0; i < ZONAS; i++) {
    const r = rnd();
    pesos.push(r < 0.35 ? 0.15 + rnd() * 0.25 : r < 0.8 ? 0.6 + rnd() * 0.8 : 1.8 + rnd() * 2.2);
  }
  const soma = pesos.reduce((a, b) => a + b, 0);
  let acc = 0;
  const t = pesos.map(p => { acc += p; return Math.round((acc / soma) * total); });
  t[t.length - 1] = total;   // a última zona fecha exatamente no fim
  return t;
}

// ============================================================ BANCO
async function migrar(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eleicao_config (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      config JSONB NOT NULL,
      recebido_em TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS eleicao_estado (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      turno INTEGER NOT NULL DEFAULT 1,
      aberto BOOLEAN NOT NULL DEFAULT false,
      fase VARCHAR(16) NOT NULL DEFAULT 'preparo',
      duracao_min INTEGER NOT NULL DEFAULT ${DURACAO_PADRAO_MIN},
      fechado_em TIMESTAMP,
      ordem JSONB,
      cronograma JSONB,
      viradas INTEGER,
      finalistas JSONB,
      atualizado_em TIMESTAMP DEFAULT NOW()
    );
    INSERT INTO eleicao_estado (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    -- rodada: sobe 1 a cada "zerar" da staff. O jogo usa pra esquecer quem já votou.
    ALTER TABLE eleicao_estado ADD COLUMN IF NOT EXISTS rodada INTEGER NOT NULL DEFAULT 0;
    -- QUEM votou. Não tem o voto.
    CREATE TABLE IF NOT EXISTS eleicao_votantes (
      user_id BIGINT NOT NULL,
      nome VARCHAR(64),
      turno INTEGER NOT NULL,
      cargo VARCHAR(16) NOT NULL,
      conta_dias INTEGER,
      revisar BOOLEAN NOT NULL DEFAULT false,
      votado_em TIMESTAMP DEFAULT NOW(),
      UNIQUE (user_id, turno, cargo)
    );
    -- O QUE foi votado. Não tem quem. id aleatório e hora truncada: nem a ordem de
    -- gravação nem o relógio servem pra casar com a tabela de cima.
    CREATE TABLE IF NOT EXISTS eleicao_votos (
      id UUID PRIMARY KEY,
      turno INTEGER NOT NULL,
      cargo VARCHAR(16) NOT NULL,
      numero VARCHAR(8) NOT NULL,
      zona SMALLINT NOT NULL CHECK (zona BETWEEN 1 AND ${ZONAS}),
      criado_em TIMESTAMP NOT NULL DEFAULT date_trunc('hour', NOW())
    );
    CREATE INDEX IF NOT EXISTS idx_eleicao_votos_turno ON eleicao_votos(turno, zona);
  `);
}

async function lerConfig(pool) {
  const r = await pool.query('SELECT config, recebido_em FROM eleicao_config WHERE id = 1');
  if (!r.rows.length) return null;
  return { ...normalizarConfig(r.rows[0].config), recebido_em: r.rows[0].recebido_em };
}
async function lerEstado(pool) {
  const r = await pool.query('SELECT * FROM eleicao_estado WHERE id = 1');
  return r.rows[0];
}
async function votosPorZona(pool, turno) {
  const r = await pool.query(
    'SELECT zona, cargo, numero, COUNT(*)::int AS n FROM eleicao_votos WHERE turno = $1 GROUP BY zona, cargo, numero', [turno]);
  const out = {};
  for (const x of r.rows) {
    out[x.zona] = out[x.zona] || {};
    out[x.zona][x.cargo] = out[x.zona][x.cargo] || {};
    out[x.zona][x.cargo][x.numero] = x.n;
  }
  return out;
}

// Apuração pública: só o que já foi liberado.
async function apuracao(pool, turnoPedido, agora = Date.now()) {
  const cfg = await lerConfig(pool);
  const est = await lerEstado(pool);
  const turno = Number(turnoPedido) || est.turno;
  const base = { turno, turnoAtual: est.turno, aberto: est.aberto, fase: est.fase, temConfig: !!cfg, zonas: ZONAS };
  if (!cfg) return { ...base, situacao: 'sem_config', pctApurado: 0 };
  const finalistas = Array.isArray(est.finalistas) ? est.finalistas : null;
  const votantes = (await pool.query('SELECT COUNT(DISTINCT user_id)::int AS n FROM eleicao_votantes WHERE turno = $1', [turno])).rows[0].n;
  // turno atual ainda em votação (ou nem abriu): não revela nada
  let liberadas = [];
  let proxima = null;
  if (turno < est.turno) liberadas = Array.from({ length: ZONAS }, (_, i) => i + 1);   // turno passado: tudo
  else if (est.fase === 'apuracao' && est.fechado_em && Array.isArray(est.ordem)) {
    const passou = (agora - new Date(est.fechado_em).getTime()) / 1000;
    const cron = est.cronograma || [];
    est.ordem.forEach((z, i) => { if (cron[i] <= passou) liberadas.push(z); });
    const i = liberadas.length;
    if (i < est.ordem.length) proxima = Math.max(0, Math.round(cron[i] - passou));
  }
  const vpz = await votosPorZona(pool, turno);
  const soma = somarZonas(vpz, liberadas);
  const pres = presidencia(cfg, soma.presidente, turno, finalistas);
  const parl = turno === 1 ? parlamento(cfg, soma.parlamento) : null;
  return {
    ...base, votantes,
    pctApurado: liberadas.length / ZONAS,
    zonasApuradas: liberadas.length,
    proximaEm: proxima,
    duracaoMin: est.duracao_min,
    finalistas,
    presidencia: pres,
    parlamento: parl,
    partidos: Object.values(cfg.partidos).map(p => ({ numero: p.numero, sigla: p.sigla, nome: p.nome, cor: corHex(p.cor) })),
  };
}

// Resultado CHEIO (todas as zonas) — só pra decidir o 2º turno e pra staff conferir.
async function resultadoCheio(pool, turno) {
  const cfg = await lerConfig(pool);
  const est = await lerEstado(pool);
  const vpz = await votosPorZona(pool, turno);
  const soma = somarZonas(vpz, Array.from({ length: ZONAS }, (_, i) => i + 1));
  return { cfg, est, vpz, pres: presidencia(cfg, soma.presidente, turno, Number(turno) === 2 ? est.finalistas : null) };
}

function novoId() { return crypto.randomUUID(); }

module.exports = {
  ZONAS, DURACAO_PADRAO_MIN,
  normalizarConfig, corHex, votaveis, cargosDoTurno, normalizarVoto, totais, ranking, presidencia, parlamento,
  somarZonas, lideres, viradas, escolherOrdem, cronograma,
  migrar, lerConfig, lerEstado, votosPorZona, apuracao, resultadoCheio, novoId,
};
