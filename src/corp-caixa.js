// ============================================================================
// CAIXA E ESTOQUE DA CORPORAÇÃO — núcleo puro (28/09/2026)
//
// Julio, 28/09:
//   "o salario base deve continuar nascendo do nada!, o caixa paga bonus"
//   "acho que 50% da multa para corp e ok" · "a liberacao de patio a corp tbm ganha"
//   "A arma e emprestimo atualmente, ela some quando ele sai do servico, deve
//    continuar assim desde que nao tenha sido roubada ou ele morto"
//   "o comandante controlar isso pelo site da corp, poder ver o stock, o lucro,
//    oque a corp tem de dinheiro, quantos equipamentos perderam ... vendo o
//    extrato em tempo real disso (tipo comprando cada uma)"
//
// DE ONDE VEM O DINHEIRO. Não foi preciso inventar fonte: multa paga, dívida
// quitada e liberação de pátio JÁ debitavam o infrator e não creditavam ninguém
// — o dinheiro sumia do jogo. Agora metade tem destino.
//
// O SALDO NUNCA É GUARDADO SOZINHO. Todo evento vira LANÇAMENTO, e o saldo é a
// soma. Sem extrato não dá pra auditar, e sem auditoria a corrupção não é
// jogável: vira sumiço invisível em vez de inquérito.
//
// ESPELHO DO JOGO: os motivos de ESTOQUE são os mesmos de
// ReplicatedStorage.Shared.Regras.Estoque (Luau). Mexeu num, mexe no outro —
// o teste `teste_caixa.js` compara as duas listas.
//
// Puro de propósito: sem pool, sem req, sem Date.now() escondido. Dá pra rodar
// no node sem subir o site nem tocar no banco.
// ============================================================================

// ---------------------------------------------------------------- dinheiro
// Quanto de cada cobrança do jogo vai pra corporação que cobrou.
// O resto continua sumindo, como sempre foi — tirar 100% transformaria o
// policial em cobrador, e a multa deixaria de ser punição pra virar renda.
const RATEIO = {
  multa: 0.50,      // Julio: "50% da multa para corp"
  patio: 0.50,      // Julio: "a liberacao de patio a corp tbm ganha"
  divida: 0.50,     // dívida é multa atrasada; mesma fatia, senão compensa não pagar na hora
};

const DINHEIRO = {
  multa:    { sinal: +1, rotulo: 'Multa aplicada' },
  patio:    { sinal: +1, rotulo: 'Liberação de pátio' },
  divida:   { sinal: +1, rotulo: 'Dívida quitada' },
  venda:    { sinal: +1, rotulo: 'Veículo apreendido transferido' },
  aporte:   { sinal: +1, rotulo: 'Aporte do comando' },
  compra:   { sinal: -1, rotulo: 'Compra de equipamento' },
  bonus:    { sinal: -1, rotulo: 'Bônus pago' },
  ajuste:   { sinal: -1, rotulo: 'Ajuste do comando' },
};

// ---------------------------------------------------------------- estoque
// MESMA TABELA do Luau (Regras.Estoque.MOTIVOS). Delta por unidade.
// `perda: true` = saiu da mão da pessoa e NÃO volta pra prateleira. É só isso
// que faz a regra do Julio funcionar — nenhum `if` especial em lugar nenhum.
const ESTOQUE = {
  retirou:  { estoque: -1, emprestado: +1, perda: false, rotulo: 'Retirou no vestiário' },
  devolveu: { estoque: +1, emprestado: -1, perda: false, rotulo: 'Devolveu no vestiário' },
  saiu:     { estoque: +1, emprestado: -1, perda: false, rotulo: 'Saiu de serviço' },
  roubada:  { estoque:  0, emprestado: -1, perda: true,  rotulo: 'Tomada numa revista' },
  morreu:   { estoque:  0, emprestado: -1, perda: true,  rotulo: 'Perdida na morte' },
  comprou:  { estoque: +1, emprestado:  0, perda: false, rotulo: 'Comprada pelo comando' },
  baixa:    { estoque: -1, emprestado:  0, perda: true,  rotulo: 'Baixa dada pelo comando' },
};

const MAX_POR_PESSOA = 1;   // o vestiário já é toggle: 1 de cada peça por vez

// ---------------------------------------------------------------- helpers
function inteiro(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function positivo(v) {
  return Math.max(0, inteiro(v));
}

// Quanto dessa cobrança é da corp. Arredonda PRA BAIXO: nunca criar centavo
// do nada, e nunca a corp levar mais do que o infrator pagou.
function parteDaCorp(tipo, valorPago) {
  const fatia = RATEIO[tipo];
  if (!fatia) return 0;
  return Math.floor(positivo(valorPago) * fatia);
}

// ---------------------------------------------------------------- dinheiro
// Devolve { ok, erro } ou { ok: true, saldo, lancamento }.
// Gastar mais do que tem é recusado: caixa negativo não é "dívida da corp", é bug.
function aplicarDinheiro(saldoAtual, motivo, valor, extra = {}) {
  const m = DINHEIRO[motivo];
  if (!m) return { ok: false, erro: 'motivo' };
  const v = positivo(valor);
  if (v <= 0) return { ok: false, erro: 'valor' };
  const saldo = positivo(saldoAtual);
  const delta = m.sinal * v;
  if (saldo + delta < 0) return { ok: false, erro: 'saldo', falta: v - saldo };
  const novo = saldo + delta;
  return {
    ok: true,
    saldo: novo,
    lancamento: {
      tipo: motivo,
      rotulo: m.rotulo,
      valor: delta,              // já com sinal: positivo entra, negativo sai
      saldo_depois: novo,
      quem: String(extra.quem || ''),
      por: String(extra.por || extra.quem || ''),
      item: extra.item ? String(extra.item) : null,
      qtd: extra.qtd ? positivo(extra.qtd) : null,
      detalhe: extra.detalhe && typeof extra.detalhe === 'object' ? extra.detalhe : {},
    },
  };
}

// ---------------------------------------------------------------- estoque
// est = { itens: {item: qtd}, perdidos: {item: qtd}, emprestado: {nome: {item: qtd}} }
function novoEstoque() {
  return { itens: {}, perdidos: {}, emprestado: {} };
}

function naPrateleira(est, item) {
  return positivo(((est || {}).itens || {})[String(item || '')]);
}

function comAPessoa(est, quem, item) {
  const p = ((est || {}).emprestado || {})[String(quem || '')];
  if (!p || typeof p !== 'object') return 0;
  return positivo(p[String(item || '')]);
}

function naRua(est, item) {
  const nome = String(item || '');
  let n = 0;
  for (const p of Object.values((est || {}).emprestado || {})) {
    if (p && typeof p === 'object') n += positivo(p[nome]);
  }
  return n;
}

// Devolve { ok, erro }. Erros: motivo, item, sem_estoque, ja_tem, nao_tem.
function podeEstoque(est, motivo, quem, item) {
  const m = ESTOQUE[String(motivo || '')];
  if (!m) return { ok: false, erro: 'motivo' };
  const nome = String(item || '');
  if (!nome) return { ok: false, erro: 'item' };
  if (m.estoque < 0 && naPrateleira(est, nome) < 1) return { ok: false, erro: 'sem_estoque' };
  if (m.emprestado > 0 && comAPessoa(est, quem, nome) >= MAX_POR_PESSOA) return { ok: false, erro: 'ja_tem' };
  if (m.emprestado < 0 && comAPessoa(est, quem, nome) < 1) return { ok: false, erro: 'nao_tem' };
  return { ok: true };
}

// Muda o estado E devolve o lançamento. Recusado = NADA é aplicado: meio
// lançamento é pior que nenhum.
function aplicarEstoque(est, motivo, quem, item, extra = {}) {
  const check = podeEstoque(est, motivo, quem, item);
  if (!check.ok) return check;
  const m = ESTOQUE[motivo];
  const nome = String(item);
  const pessoa = String(quem || '');

  est.itens = est.itens || {};
  est.perdidos = est.perdidos || {};
  est.emprestado = est.emprestado || {};

  if (m.estoque !== 0) {
    est.itens[nome] = Math.max(0, positivo(est.itens[nome]) + m.estoque);
  }
  if (m.emprestado !== 0) {
    est.emprestado[pessoa] = est.emprestado[pessoa] || {};
    const novo = Math.max(0, positivo(est.emprestado[pessoa][nome]) + m.emprestado);
    if (novo > 0) est.emprestado[pessoa][nome] = novo;
    else delete est.emprestado[pessoa][nome];
    // pessoa sem nada emprestado sai da tabela: senão o estado cresce pra sempre
    if (Object.keys(est.emprestado[pessoa]).length === 0) delete est.emprestado[pessoa];
  }
  if (m.perda) {
    est.perdidos[nome] = positivo(est.perdidos[nome]) + 1;
  }

  return {
    ok: true,
    lancamento: {
      tipo: 'estoque',
      motivo,
      rotulo: m.rotulo,
      item: nome,
      qtd: 1,
      perda: m.perda,
      quem: pessoa,
      por: String(extra.por || pessoa),
      sobrou: naPrateleira(est, nome),
    },
  };
}

// Linha por item pro painel: na prateleira, na rua, perdido.
function resumo(est) {
  const nomes = new Set();
  for (const n of Object.keys((est || {}).itens || {})) nomes.add(n);
  for (const n of Object.keys((est || {}).perdidos || {})) nomes.add(n);
  for (const p of Object.values((est || {}).emprestado || {})) {
    if (p && typeof p === 'object') for (const n of Object.keys(p)) nomes.add(n);
  }
  return [...nomes].sort().map(item => ({
    item,
    prateleira: naPrateleira(est, item),
    rua: naRua(est, item),
    perdido: positivo(((est || {}).perdidos || {})[item]),
  }));
}

// O que a pessoa está devendo (pro "saiu de serviço" saber o que devolver).
function doJogador(est, quem) {
  const p = ((est || {}).emprestado || {})[String(quem || '')];
  if (!p || typeof p !== 'object') return [];
  return Object.entries(p)
    .map(([item, qtd]) => ({ item, qtd: positivo(qtd) }))
    .sort((a, b) => a.item.localeCompare(b.item));
}

// ---------------------------------------------------------------- painel
// O "lucro" que o comandante vê: quanto entrou, quanto saiu, no período.
function balanco(lancamentos) {
  let entrou = 0, saiu = 0;
  const porTipo = {};
  for (const l of lancamentos || []) {
    const v = inteiro(l && l.valor);
    if (v > 0) entrou += v; else saiu += -v;
    const t = String((l && l.tipo) || '?');
    porTipo[t] = (porTipo[t] || 0) + v;
  }
  return { entrou, saiu, lucro: entrou - saiu, porTipo };
}

// Quanto custa encher o estoque até um alvo, com a tabela de preços do jogo.
// `precos` vem do jogo (ToolData) — o site NÃO tem tabela de preço própria de
// propósito: duas listas de preço divergem no primeiro dia.
function custoDaCompra(precos, item, qtd) {
  const p = positivo((precos || {})[String(item || '')]);
  if (p <= 0) return { ok: false, erro: 'sem_preco' };
  const n = positivo(qtd);
  if (n <= 0 || n > 99) return { ok: false, erro: 'qtd' };
  return { ok: true, unitario: p, total: p * n };
}

module.exports = {
  RATEIO, DINHEIRO, ESTOQUE, MAX_POR_PESSOA,
  inteiro, positivo, parteDaCorp,
  aplicarDinheiro,
  novoEstoque, naPrateleira, comAPessoa, naRua, podeEstoque, aplicarEstoque,
  resumo, doJogador, balanco, custoDaCompra,
};
