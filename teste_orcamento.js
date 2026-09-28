'use strict';
// [28/09] Testes do núcleo do ORÇAMENTO DO GOVERNO. `node teste_orcamento.js`
const O = require('./src/corp-orcamento');
let n = 0; const falhas = [];
const t = (nome, cond) => { n++; if (!cond) falhas.push(nome); };
const DIA = O.DIA;
const SEMANA = DIA * O.ORC.DIAS;

// ---- período: inteiro, estável dentro da janela, +1 na virada
const t0 = 1_700_000_000_000;
const p0 = O.periodoDe(t0);
t('periodo é inteiro', Number.isInteger(p0));
t('mesmo instante = mesmo periodo', O.periodoDe(t0) === p0);
t('1h depois = mesmo periodo', O.periodoDe(t0 + 3600e3) === p0);
t('6 dias depois ainda pode ser o mesmo ou o proximo', Math.abs(O.periodoDe(t0 + 6 * DIA) - p0) <= 1);
t('+1 semana = +1 periodo', O.periodoDe(t0 + SEMANA) === p0 + 1);
t('+4 semanas = +4 periodos', O.periodoDe(t0 + 4 * SEMANA) === p0 + 4);
t('periodo nunca anda pra tras no tempo', O.periodoDe(t0 + SEMANA) > O.periodoDe(t0));
t('entrada porca nao explode', O.periodoDe('lixo') === 0 && O.periodoDe(NaN) === 0);

// ---- próximo repasse cai sempre no futuro e dentro de uma semana
const prox = O.proximoEm(t0);
t('proximo repasse é no futuro', prox > t0);
t('proximo repasse em ate 7 dias', prox - t0 <= SEMANA);

// ---- base por corp: SAMU menor, foi o pedido do Julio
t('PM usa a base padrao', O.baseDe('policia-militar') === O.ORC.BASE_PADRAO);
t('SAMU recebe MENOS que a PM', O.baseDe('samu') < O.baseDe('policia-militar'));
t('jornal tambem é menor', O.baseDe('jornal') < O.ORC.BASE_PADRAO);
t('corp desconhecida cai no padrao', O.baseDe('corp-que-nao-existe') === O.ORC.BASE_PADRAO);
t('slug com espaco/maiuscula normaliza', O.baseDe('  SAMU ') === O.ORC.BASE_SAMU);
t('slug nulo nao explode', O.baseDe(null) === O.ORC.BASE_PADRAO);

// ---- valor: base + atividade
const semNada = O.valorDe('policia-militar', 0);
t('sem atividade recebe so a base', semNada.total === O.ORC.BASE_PADRAO && semNada.extra === 0);
const com10 = O.valorDe('policia-militar', 10);
t('10 ocorrencias somam 10x o por-atividade', com10.extra === 10 * O.ORC.POR_ATIVIDADE);
t('total = base + extra', com10.total === com10.base + com10.extra);
t('SAMU parada ainda recebe algo', O.valorDe('samu', 0).total === O.ORC.BASE_SAMU);
t('SAMU ativa recebe mais que SAMU parada', O.valorDe('samu', 5).total > O.valorDe('samu', 0).total);
// teto: nao da pra farmar infinito
const absurdo = O.valorDe('policia-militar', 999999);
t('atividade tem TETO', absurdo.atividade === O.ORC.TETO_ATIVIDADE);
t('teto limita o total', absurdo.total === O.ORC.BASE_PADRAO + O.ORC.TETO_ATIVIDADE * O.ORC.POR_ATIVIDADE);
t('atividade negativa vira 0', O.valorDe('policia-militar', -50).extra === 0);
t('atividade fracionada arredonda pra baixo', O.valorDe('policia-militar', 3.9).atividade === 3);
t('atividade NaN vira 0', O.valorDe('policia-militar', NaN).extra === 0);
t('valor é sempre inteiro', Number.isInteger(O.valorDe('samu', 7).total));

// ---- decidir: o coração da idempotência
t('nunca pago antes: paga', O.decidir(null, t0).pagar === true);
const per = O.periodoDe(t0);
t('ja pago neste periodo: NAO paga', O.decidir(per, t0).pagar === false);
t('pago no periodo anterior: paga', O.decidir(per - 1, t0).pagar === true);
t('pago 3 periodos atras: paga (uma vez so)', O.decidir(per - 3, t0).pagar === true);
t('o periodo devolvido é o ATUAL', O.decidir(per - 3, t0).periodo === per);
t('pago no FUTURO (relogio torto): nao paga', O.decidir(per + 1, t0).pagar === false);
t('ultimo invalido nao paga', O.decidir('lixo', t0).pagar === false);

// ---- a prova que importa: 1000 chamadas na mesma semana pagam UMA vez
let ultimo = null, pagamentos = 0;
for (let i = 0; i < 1000; i++) {
  const d = O.decidir(ultimo, t0 + i * 600); // a cada 10 min durante a semana
  if (d.pagar) { pagamentos++; ultimo = d.periodo; }
}
t('1000 chamadas na mesma semana = 1 pagamento', pagamentos === 1);

// 5 semanas de hora em hora: UM pagamento por periodo distinto, nunca dois.
// (nao sao 5 e sim 6: t0 cai no MEIO de um periodo, entao a janela toca 6 deles.
//  O que importa nao e o total, e nao repetir nenhum.)
ultimo = null;
const pagos = [];
for (let i = 0; i < 5 * 7 * 24; i++) {
  const d = O.decidir(ultimo, t0 + i * 3600e3);
  if (d.pagar) { pagos.push(d.periodo); ultimo = d.periodo; }
}
const distintos = new Set(pagos);
t('nenhum periodo pago duas vezes', distintos.size === pagos.length);
t('um pagamento por periodo tocado na janela',
  pagos.length === O.periodoDe(t0 + (5 * 7 * 24 - 1) * 3600e3) - O.periodoDe(t0) + 1);
t('os periodos pagos sao consecutivos',
  pagos.every((v, i) => i === 0 || v === pagos[i - 1] + 1));

console.log(`${n - falhas.length}/${n} | falhas: ${falhas.length ? falhas.join(', ') : 'nenhuma'}`);
process.exit(falhas.length ? 1 : 0);
