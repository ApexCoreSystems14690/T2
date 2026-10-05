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

/* [29/09] REBALANCEADO. Julio: "Tem coisas muito caras etc, precisa considerar
 * barcas e pa ... tenta ver oque cada corp usa normalmente".
 *
 * O QUE FOI MEDIDO NO JOGO, e que muda tudo:
 *  - o KIT COMPLETO de cada corp, com o preço de estado novo (CaixaCorp.PRECO_CORP):
 *      PM 8.950 · ROTAM 8.950 · CHOQUE 10.450 · BOPE 10.450 · PC(+PF) 10.450
 *      Governo 3.850 · SAMU ~1.130 (maleta+maca+cone+barricada)
 *    => uma BARCA DE 10 custa ~90.000 (PM/ROTAM) a ~105.000 (BOPE/CHOQUE/PC).
 *  - o SALÁRIO, que nasce do nada, é ~7.000 por saque A CADA 40 MIN por policial
 *    (média medida: PC 10.147, PF 12.644, SAMU 10.418, BOPE 7.407, PM 6.689).
 *    Dez policiais jogando 3h tiram ~300.000 do nada numa noite.
 *
 * A REGRA QUE ESCOLHI: o repasse paga ~META BARCA DE 10 por semana. A corp veste
 * a tropa inteira em ~2 semanas e, depois disso, como equipamento é EMPRÉSTIMO e
 * volta, o repasse vira dinheiro de bônus — que é pra isso que o Julio queria o
 * caixa. Mexer aqui é mexer em uma linha por corp.
 */
const ORC = {
  DIAS: 7,                    // de quantos em quantos dias cai
  BASE_PADRAO: 40000,         // corp de rua que não está na lista abaixo
  POR_ATIVIDADE: 300,         // extra por ocorrência registrada no período
  TETO_ATIVIDADE: 120,        // teto: no máximo +36.000 por semana. Sem teto dá farm.
};

/* Base por corp, em slug — o mesmo contrato do jogo.
 * O número ao lado é quantos KITS COMPLETOS a corp consegue comprar por semana. */
const BASE_POR_CORP = {
  'policia-civil':   60000,   // ~5,7 kits · é PC + PF juntas (mesmo slug, mesmo caixa)
  'policia-militar': 55000,   // ~6,1 kits · a corp com mais gente na rua
  'choque':          45000,   // ~4,3 kits
  'bope':            45000,   // ~4,3 kits
  'rotam':           40000,   // ~4,5 kits
  'governo':         20000,   // ~5,2 kits · kit barato, corp administrativa
  'samu':            50000,   // [04/10 Julio] "a samu ta recebendo mt pouco caixa, e gasta mt dinheiro, aumente" (era 15000)
  'jornal':          10000,   // não tem vestiário: o caixa dela é só pra bônus
  // Sem repasse: não são corporação do Estado.
  'pavuna':          0,
  'extra-10':        0,       // LOJA
};

function baseDe(slug) {
  const s = String(slug || '').toLowerCase().trim();
  const b = BASE_POR_CORP[s];
  // 0 é um valor VÁLIDO aqui (corp sem repasse), por isso o teste é isFinite e
  // não um `|| ORC.BASE_PADRAO` -- que transformaria 0 em 40.000 em silêncio.
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
