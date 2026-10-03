// ============================================================================
// TESTE DO CAIXA E DO ESTOQUE DA CORPORAÇÃO — núcleo puro, sem banco, sem site.
//   node teste_caixa.js
// ============================================================================
const C = require('./src/corp-caixa');

let ok = 0; const falhas = [];
function t(nome, cond, extra) {
  if (cond) ok++; else falhas.push(nome + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''));
}

// ---------------------------------------------------------------- 1. espelho do Luau
// A lista de motivos TEM que bater com ReplicatedStorage.Shared.Regras.Estoque.
// Se alguém mexer num lado só, este teste quebra — é o ponto.
const ESPERADO_LUAU = ['abasteceu', 'baixa', 'comprou', 'devolveu', 'morreu', 'recuperou', 'retirou', 'roubada', 'saiu'];
t('motivos batem com o Luau', JSON.stringify(Object.keys(C.ESTOQUE).sort()) === JSON.stringify(ESPERADO_LUAU), Object.keys(C.ESTOQUE).sort());
t('roubada nao credita a prateleira', C.ESTOQUE.roubada.estoque === 0 && C.ESTOQUE.roubada.perda === true);
t('morreu nao credita a prateleira', C.ESTOQUE.morreu.estoque === 0 && C.ESTOQUE.morreu.perda === true);
// [29/09] CONTRABANDO nao tem motivo proprio de proposito: o desvio do policial
// entra como `roubada`, igual a quem foi assaltado. O comandante tem que
// descobrir. Este teste existe pra ninguem "consertar" isso achando que faltou.
t('contrabando NAO tem motivo proprio', C.ESTOQUE.desviada === undefined);
t('abasteceu tira da prateleira sem emprestar (consumo da maleta)', C.ESTOQUE.abasteceu.estoque === -1 && C.ESTOQUE.abasteceu.emprestado === 0 && C.ESTOQUE.abasteceu.perda === false);
t('saiu de servico credita', C.ESTOQUE.saiu.estoque === 1 && C.ESTOQUE.saiu.perda === false);

// ---------------------------------------------------------------- 2. rateio
t('multa 50%', C.parteDaCorp('multa', 400) === 200, C.parteDaCorp('multa', 400));
t('patio 50%', C.parteDaCorp('patio', 9900) === 4950, C.parteDaCorp('patio', 9900));
t('arredonda pra baixo', C.parteDaCorp('multa', 351) === 175, C.parteDaCorp('multa', 351));
t('tipo desconhecido da 0', C.parteDaCorp('pixuleco', 1000) === 0);
t('valor negativo da 0', C.parteDaCorp('multa', -500) === 0);
t('NaN da 0', C.parteDaCorp('multa', NaN) === 0 && C.parteDaCorp('multa', Infinity) === 0);

// ---------------------------------------------------------------- 3. dinheiro
let r = C.aplicarDinheiro(0, 'multa', 200, { quem: 'Julio', por: 'Ana' });
t('multa entra', r.ok && r.saldo === 200 && r.lancamento.valor === 200, r.saldo);
t('lancamento guarda o saldo depois', r.lancamento.saldo_depois === 200);
t('lancamento guarda quem e por', r.lancamento.quem === 'Julio' && r.lancamento.por === 'Ana');

r = C.aplicarDinheiro(200, 'compra', 150, { item: 'FAL', qtd: 1, por: 'Delegado' });
t('compra sai', r.ok && r.saldo === 50 && r.lancamento.valor === -150, r.saldo);
t('compra guarda o item', r.lancamento.item === 'FAL' && r.lancamento.qtd === 1);

r = C.aplicarDinheiro(50, 'compra', 9000);
t('gastar mais do que tem recusa', r.ok === false && r.erro === 'saldo', r);
t('recusa diz quanto falta', r.falta === 8950, r.falta);

t('motivo invalido', C.aplicarDinheiro(100, 'roubar', 10).erro === 'motivo');
t('valor zero', C.aplicarDinheiro(100, 'multa', 0).erro === 'valor');
t('saldo nunca negativo', C.aplicarDinheiro(0, 'bonus', 1).ok === false);

// bonus sai do caixa (o salario BASE nao -- ele nasce do nada, decisao do Julio)
r = C.aplicarDinheiro(5000, 'bonus', 1200, { quem: 'Ana', por: 'Delegado' });
t('bonus sai do caixa', r.ok && r.saldo === 3800, r.saldo);

// ---------------------------------------------------------------- 4. estoque
const est = C.novoEstoque();
t('sem estoque recusa', C.podeEstoque(est, 'retirou', 'Julio', 'FAL').erro === 'sem_estoque');

for (let i = 0; i < 3; i++) C.aplicarEstoque(est, 'comprou', '', 'FAL', { por: 'Delegado' });
t('prateleira 3', C.naPrateleira(est, 'FAL') === 3, C.naPrateleira(est, 'FAL'));

const ret = C.aplicarEstoque(est, 'retirou', 'Julio', 'FAL');
t('retirou ok', ret.ok === true);
t('prateleira 2', C.naPrateleira(est, 'FAL') === 2);
t('Julio tem 1', C.comAPessoa(est, 'Julio', 'FAL') === 1);
t('lancamento de estoque completo', ret.lancamento.item === 'FAL' && ret.lancamento.sobrou === 2 && ret.lancamento.perda === false);

t('limite 1 por pessoa', C.podeEstoque(est, 'retirou', 'Julio', 'FAL').erro === 'ja_tem');

C.aplicarEstoque(est, 'devolveu', 'Julio', 'FAL');
t('devolveu volta pra 3', C.naPrateleira(est, 'FAL') === 3);
t('pessoa vazia sai da tabela', est.emprestado['Julio'] === undefined);

// A REGRA DO JULIO: roubada e morte NAO voltam
C.aplicarEstoque(est, 'retirou', 'Bia', 'FAL');
const rb = C.aplicarEstoque(est, 'roubada', 'Bia', 'FAL');
t('roubada nao credita', C.naPrateleira(est, 'FAL') === 2, C.naPrateleira(est, 'FAL'));
t('roubada tira da pessoa', C.comAPessoa(est, 'Bia', 'FAL') === 0);
t('roubada conta como perda', rb.lancamento.perda === true && est.perdidos['FAL'] === 1);

C.aplicarEstoque(est, 'retirou', 'Caio', 'FAL');
C.aplicarEstoque(est, 'morreu', 'Caio', 'FAL');
t('morte nao credita', C.naPrateleira(est, 'FAL') === 1, C.naPrateleira(est, 'FAL'));
t('2 perdas contadas', est.perdidos['FAL'] === 2);

// saiu de servico DEVOLVE
C.aplicarEstoque(est, 'retirou', 'Dani', 'FAL');
C.aplicarEstoque(est, 'saiu', 'Dani', 'FAL');
t('saiu de servico devolve', C.naPrateleira(est, 'FAL') === 1 && C.comAPessoa(est, 'Dani', 'FAL') === 0);

// recusa nao aplica nada
const antes = C.naPrateleira(est, 'FAL');
t('devolver o que nao tem recusa', C.podeEstoque(est, 'devolveu', 'Zeca', 'FAL').erro === 'nao_tem');
t('recusa nao mexeu no estoque', C.naPrateleira(est, 'FAL') === antes);
t('motivo invalido no estoque', C.podeEstoque(est, 'voar', 'x', 'FAL').erro === 'motivo');
t('item vazio', C.podeEstoque(est, 'retirou', 'x', '').erro === 'item');

// naRua soma todo mundo
const e2 = C.novoEstoque();
for (let i = 0; i < 5; i++) C.aplicarEstoque(e2, 'comprou', '', 'PT 92');
C.aplicarEstoque(e2, 'retirou', 'A', 'PT 92');
C.aplicarEstoque(e2, 'retirou', 'B', 'PT 92');
t('naRua 2', C.naRua(e2, 'PT 92') === 2, C.naRua(e2, 'PT 92'));
t('prateleira 3', C.naPrateleira(e2, 'PT 92') === 3);

// estoque nunca negativo
const e3 = C.novoEstoque();
C.aplicarEstoque(e3, 'comprou', '', 'Colete');
C.aplicarEstoque(e3, 'baixa', '', 'Colete');
t('baixa sem estoque recusa', C.podeEstoque(e3, 'baixa', '', 'Colete').ok === false);
t('nunca negativo', C.naPrateleira(e3, 'Colete') === 0);

// ---------------------------------------------------------------- 5. painel
const linhas = C.resumo(est);
const fal = linhas.find(l => l.item === 'FAL');
t('resumo do FAL', fal && fal.prateleira === 1 && fal.rua === 0 && fal.perdido === 2, fal);

const e4 = C.novoEstoque();
for (const it of ['FAL', 'Colete', 'Algema']) { C.aplicarEstoque(e4, 'comprou', '', it); C.aplicarEstoque(e4, 'retirou', 'Julio', it); }
const dev = C.doJogador(e4, 'Julio');
t('doJogador em ordem', dev.length === 3 && dev[0].item === 'Algema' && dev[2].item === 'FAL', dev.map(d => d.item));

const b = C.balanco([
  { tipo: 'multa', valor: 200 }, { tipo: 'multa', valor: 300 },
  { tipo: 'patio', valor: 4950 }, { tipo: 'compra', valor: -8750 },
]);
t('balanco entrou', b.entrou === 5450, b.entrou);
t('balanco saiu', b.saiu === 8750, b.saiu);
t('balanco lucro negativo', b.lucro === -3300, b.lucro);
t('balanco por tipo', b.porTipo.multa === 500 && b.porTipo.compra === -8750, b.porTipo);

// custo da compra usa o preco do JOGO, nao uma tabela do site
const PRECOS = { 'FAL': 8750, 'Colete': 20000, 'CAR15': 60658 };
t('custo de 3 FAL', C.custoDaCompra(PRECOS, 'FAL', 3).total === 26250, C.custoDaCompra(PRECOS, 'FAL', 3));
t('item sem preco', C.custoDaCompra(PRECOS, 'Bazuca', 1).erro === 'sem_preco');
t('qtd invalida', C.custoDaCompra(PRECOS, 'FAL', 0).erro === 'qtd' && C.custoDaCompra(PRECOS, 'FAL', 500).erro === 'qtd');

// ---------------------------------------------------------------- 6. entrada porca
t('nil nao explode', C.naPrateleira(null, 'x') === 0 && C.comAPessoa(undefined, 'a', 'b') === 0 && C.naRua(null, 'x') === 0);
t('resumo de estoque vazio', Array.isArray(C.resumo(null)) && C.resumo(null).length === 0);
t('balanco de lista vazia', C.balanco([]).lucro === 0 && C.balanco(null).lucro === 0);

// ---------------------------------------------------------------- fim
const total = ok + falhas.length;
if (falhas.length) {
  console.log(`\n${ok}/${total} — FALHAS:`);
  for (const f of falhas) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log(`\n${ok}/${total} — todos passaram ✅`);
