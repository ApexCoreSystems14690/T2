'use strict';
/* [28/09] ORÇAMENTO DO GOVERNO — o repasse que toda corporação recebe.
 *
 * Decisão do Julio: TODA corp tem caixa (SAMU inclusive) e todas recebem do
 * governo a cada X dias; o da SAMU é menor porque "eles não gastam muitas coisas".
 * Periodicidade escolhida: 7 dias. Fórmula: BASE FIXA + PARTE POR ATIVIDADE.
 *
 * Por que a SAMU precisa disso: ela não multa, não apreende e não cobra dívida —
 * que são as três únicas entradas que existem hoje. Sem repasse ela fica em zero
 * para sempre.
 *
 * NÚCLEO PURO: sem banco, sem express, sem Date.now() escondido. Quem chama passa
 * o relógio. É isso que deixa o teste rodar sem esperar uma semana.
 *
 * IDEMPOTÊNCIA: o período é um NÚMERO inteiro derivado do relógio, não um
 * "faz 7 dias que não pago". Duas chamadas no mesmo período dão o mesmo número de
 * período, e o banco tem UNIQUE(corp, periodo) — então pagar duas vezes é
 * impossível mesmo com dois servidores pedindo ao mesmo tempo.
 */

const DIA = 24 * 60 * 60 * 1000;

const ORC = {
  DIAS: 7,                    // de quantos em quantos dias cai
  BASE_PADRAO: 50000,         // piso de quem trabalha na rua
  BASE_SAMU: 20000,           // "do samu e menor o orçamento" (Julio)
  POR_ATIVIDADE: 400,         // extra por ocorrência registrada no período
  TETO_ATIVIDADE: 200,        // acima disso não conta mais: evita farm infinito
};

// Bases por corp. Quem não está aqui usa BASE_PADRAO.
// Chave = slug, o mesmo contrato que o jogo usa.
const BASE_POR_CORP = {
  'samu': ORC.BASE_SAMU,
  'jornal': ORC.BASE_SAMU,      // também não gasta equipamento
  'governo': ORC.BASE_PADRAO,
};

function baseDe(slug) {
  const s = String(slug || '').toLowerCase().trim();
  const b = BASE_POR_CORP[s];
  return Number.isFinite(b) ? b : ORC.BASE_PADRAO;
}

/* O número do período atual. Inteiro, cresce de 1 em 1 a cada DIAS dias,
 * contado desde a época do Unix. Não depende de quando a corp foi criada, então
 * todas as corps recebem no MESMO dia — fica fácil de explicar pro jogador. */
function periodoDe(agoraMs) {
  const t = Number(agoraMs);
  if (!Number.isFinite(t)) return 0;
  return Math.floor(t / (DIA * ORC.DIAS));
}

/* Quando o próximo repasse cai (ms). Serve pro painel mostrar a contagem. */
function proximoEm(agoraMs) {
  const p = periodoDe(agoraMs);
  return (p + 1) * DIA * ORC.DIAS;
}

/* Quanto essa corp recebe neste período.
 * `atividade` = quantas ocorrências ela registrou (multa, apreensão, reanimação…). */
function valorDe(slug, atividade) {
  const base = baseDe(slug);
  let n = Math.floor(Number(atividade) || 0);
  if (!Number.isFinite(n) || n < 0) n = 0;
  if (n > ORC.TETO_ATIVIDADE) n = ORC.TETO_ATIVIDADE;
  const extra = n * ORC.POR_ATIVIDADE;
  return { base, atividade: n, extra, total: base + extra };
}

/* Deve pagar agora? `ultimoPeriodo` é o último período já pago (null = nunca).
 * Devolve { pagar, periodo, motivo }. */
function decidir(ultimoPeriodo, agoraMs) {
  const periodo = periodoDe(agoraMs);
  const u = ultimoPeriodo === null || ultimoPeriodo === undefined ? null : Math.floor(Number(ultimoPeriodo));
  if (u !== null && !Number.isFinite(u)) return { pagar: false, periodo, motivo: 'ultimo invalido' };
  if (u === null) return { pagar: true, periodo, motivo: 'primeiro repasse' };
  if (u >= periodo) return { pagar: false, periodo, motivo: 'ja pago neste periodo' };
  return { pagar: true, periodo, motivo: 'periodo novo' };
}

module.exports = { ORC, DIA, BASE_POR_CORP, baseDe, periodoDe, proximoEm, valorDe, decidir };
