// teste_ssu.js — prova que o SSU do SITE e o SSU do JOGO dizem a MESMA coisa.
//
// Existem duas implementacoes da mesma regra:
//   jogo -> ReplicatedStorage.Shared.Regras.SSU   (Luau, e a que manda)
//   site -> src/ssu.js                            (espelho, pro painel)
// Duas implementacoes da mesma regra e como nasce divergencia. Este teste
// compara as duas MINUTO A MINUTO numa semana inteira (10.081 pontos por
// cenario), mais os casos de ajuste. Divergiu em um ponto, quebra.
//
// A coluna "lua" abaixo foi gerada rodando o modulo do jogo no Studio. Se um
// dia a grade mudar, gerar de novo la e colar aqui -- nunca editar na mao.
//
// Rodar:  node teste_ssu.js

const S = require('./src/ssu');
const ini = 1789959600;          // segunda 21/09/2026 00:00 em Sao Paulo (veio do Lua)
const fim = ini + 7 * 86400;
const cenarios = [
  ['sem ajuste', null],
  ['encerrada sexta', { sessao: '2026-09-25', encerrada: true }],
  ['estendida quarta', { sessao: '2026-09-23', estendidaAte: 23 }],
  ['abuso: estender domingo ate 23', { sessao: '2026-09-27', estendidaAte: 23 }],
];
// o que o Lua devolveu, colado aqui pra comparar
const doLua = {
  'sem ajuste': '0:f 241200:A 252000:f 414000:A 432000:f 500400:A 518400:f 586800:A 597600:f',
  'encerrada sexta': '0:f 241200:A 252000:f 414000:E 432000:f 500400:A 518400:f 586800:A 597600:f',
  'estendida quarta': '0:f 241200:A 255600:f 414000:A 432000:f 500400:A 518400:f 586800:A 597600:f',
  'abuso: estender domingo ate 23': '0:f 241200:A 252000:f 414000:A 432000:f 500400:A 518400:f 586800:A 597600:f',
};
let ok = 0, dif = 0;
for (const [nome, aj] of cenarios) {
  const trans = [];
  let anterior = null;
  for (let e = ini; e <= fim; e += 60) {
    const st = S.estado(e, aj);
    const marca = st.aberto ? 'A' : (st.motivo === 'encerrada' ? 'E' : 'f');
    if (marca !== anterior) { trans.push(`${e - ini}:${marca}`); anterior = marca; }
  }
  const js = trans.join(' ');
  if (js === doLua[nome]) { ok++; console.log(`  IGUAL  ${nome}`); }
  else { dif++; console.log(`  DIVERGIU ${nome}\n    lua: ${doLua[nome]}\n    js : ${js}`); }
}
console.log(`\n== Luau x JS: ${ok}/${ok + dif} cenarios identicos, ${dif} divergentes`);
console.log('   (7 dias comparados de minuto em minuto = 10.081 pontos por cenario)');
// e traduz as transicoes pra hora legivel, pra conferir com o olho
console.log('\nleitura humana do cenario "sem ajuste":');
for (const p of doLua['sem ajuste'].split(' ')) {
  const [off, m] = p.split(':');
  const d = new Date((ini + Number(off) + S.FUSO) * 1000);
  const dia = ['dom','seg','ter','qua','qui','sex','sab'][d.getUTCDay()];
  console.log(`   ${dia} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}  -> ${m === 'A' ? 'ABRE' : 'fecha'}`);
}
process.exit(dif ? 1 : 0);
