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
  ['estendida quarta ate 01h', { sessao: '2026-09-23', estendidaAte: 25 }],
  ['abuso: estender domingo ate 25', { sessao: '2026-09-27', estendidaAte: 25 }],
  // [27/09] botao "Iniciar SSU agora" (ajuste iniciadaAs)
  ['inicio antecipado quarta 10:30',      { sessao: '2026-09-23', iniciadaAs: ini + 2 * 86400 + 10.5 * 3600 }],
  ['antecipado + encerrado depois',       { sessao: '2026-09-23', iniciadaAs: ini + 2 * 86400 + 10.5 * 3600, encerrada: true }],
  // [11/10] com a grade nova o dia sem SSU e a QUINTA (antes era a segunda)
  ['antecipado num dia sem SSU (quinta)', { sessao: '2026-09-24', iniciadaAs: ini + 3 * 86400 + 10 * 3600 }],
  // [24/10] grade PRÓPRIA da cidade (painel do Dono) e cidade sempre aberta
  ['grade da cidade: seg e sex 19-23 (sex estendida ate 01h), sab 20-24',
    { grade: { 1: { abre: 19, fecha: 23 }, 5: { abre: 19, fecha: 23 }, 6: { abre: 20, fecha: 24 } }, sessao: '2026-09-25', estendidaAte: 25 }],
  ['grade invalida cai na padrao', { grade: { 1: { abre: 22, fecha: 20 } } }],
  ['sempre aberta', { sempre_aberta: true, sessao: '2026-09-25', encerrada: true }],
];
// o que o Lua devolveu, colado aqui pra comparar
// [11/10] REGERADO no Studio depois da grade nova (todo dia menos quinta, 12:00-00:00).
// Nunca escrever a mao: rodar o Regras.SSU no Edit e colar a saida.
const doLua = {
  'sem ajuste': '0:f 43200:A 86400:f 129600:A 172800:f 216000:A 259200:f 388800:A 432000:f 475200:A 518400:f 561600:A 604800:f',
  'encerrada sexta': '0:f 43200:A 86400:f 129600:A 172800:f 216000:A 259200:f 388800:E 432000:f 475200:A 518400:f 561600:A 604800:f',
  'estendida quarta ate 01h': '0:f 43200:A 86400:f 129600:A 172800:f 216000:A 262800:f 388800:A 432000:f 475200:A 518400:f 561600:A 604800:f',
  'abuso: estender domingo ate 25': '0:f 43200:A 86400:f 129600:A 172800:f 216000:A 259200:f 388800:A 432000:f 475200:A 518400:f 561600:A',
  'inicio antecipado quarta 10:30': '0:f 43200:A 86400:f 129600:A 172800:f 210600:A 259200:f 388800:A 432000:f 475200:A 518400:f 561600:A 604800:f',
  'antecipado + encerrado depois': '0:f 43200:A 86400:f 129600:A 172800:f 210600:E 259200:f 388800:A 432000:f 475200:A 518400:f 561600:A 604800:f',
  'antecipado num dia sem SSU (quinta)': '0:f 43200:A 86400:f 129600:A 172800:f 216000:A 259200:f 388800:A 432000:f 475200:A 518400:f 561600:A 604800:f',
  // [24/10] gerados no Studio (Regras.SSU com gradeDoSite / sempre_aberta)
  'grade da cidade: seg e sex 19-23 (sex estendida ate 01h), sab 20-24': '0:f 68400:A 82800:f 414000:A 435600:f 504000:A 518400:f',
  'grade invalida cai na padrao': '0:f 43200:A 86400:f 129600:A 172800:f 216000:A 259200:f 388800:A 432000:f 475200:A 518400:f 561600:A 604800:f',
  'sempre aberta': '0:A',
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
