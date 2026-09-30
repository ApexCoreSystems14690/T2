// [30/09] Prova da regra nova: Diretor Geral / Dono do site mexe em QUALQUER
// membro, inclusive no dono da corporação (`corporations.owner_id`, que é só
// quem criou a corp no painel). Julio: "N consigo demitir esse gb de nada".
// Puro: roda com `node teste_dono_corp.js`, sem banco e sem subir o site.
const CP = require('./src/corp-poderes');
let ok = 0, f = 0;
const t = (n, c) => { c ? (ok++, console.log('  OK   ' + n)) : (f++, console.log('  FALHOU ' + n)); };

const staffAlto  = { ehStaffCorp: true,  ehStaffAlto: true,  meuNivel: null, nivelMax: 3, qtdNiveis: 3 };
const staffBaixo = { ehStaffCorp: true,  ehStaffAlto: false, meuNivel: null, nivelMax: 3, qtdNiveis: 3 };
const chefe      = { ehStaffCorp: false, ehStaffAlto: false, meuNivel: 3, nivelMax: 3, qtdNiveis: 3 };
const donoCorp   = { ehStaffCorp: false, ehStaffAlto: false, ehDono: true, meuNivel: 3, nivelMax: 3, qtdNiveis: 3 };
const raso       = { meuNivel: 1, nivelMax: 3, qtdNiveis: 3 };

const gb    = { nivel: 2, ehDonoDaCorp: true,  ehEuMesmo: false };  // o criador da corp
const eu    = { nivel: 2, ehDonoDaCorp: false, ehEuMesmo: true  };
const outro = { nivel: 1, ehDonoDaCorp: false, ehEuMesmo: false };
const igual = { nivel: 3, ehDonoDaCorp: false, ehEuMesmo: false };

console.log('[1] o caso que o Julio trouxe');
t('Diretor+ remove o dono da corp (era o bug)', CP.podeMexerEmMembro(staffAlto, gb) === true);
t('Diretor+ mexe em si mesmo',                  CP.podeMexerEmMembro(staffAlto, eu) === true);
t('Diretor+ mexe em qualquer outro',            CP.podeMexerEmMembro(staffAlto, outro) === true);

console.log('[2] quem esta abaixo continua como estava');
t('Supervisor NAO mexe no dono da corp', CP.podeMexerEmMembro(staffBaixo, gb) === false);
t('Supervisor mexe nos outros',          CP.podeMexerEmMembro(staffBaixo, outro) === true);
t('chefe NAO mexe no dono da corp',      CP.podeMexerEmMembro(chefe, gb) === false);
t('chefe mexe em quem esta abaixo',      CP.podeMexerEmMembro(chefe, outro) === true);
t('chefe NAO mexe em igual',             CP.podeMexerEmMembro(chefe, igual) === false);
t('chefe NAO mexe em si mesmo',          CP.podeMexerEmMembro(chefe, { nivel: 3, ehDonoDaCorp: false, ehEuMesmo: true }) === false);
t('dono da corp NAO se remove sozinho',  CP.podeMexerEmMembro(donoCorp, { nivel: 3, ehDonoDaCorp: true, ehEuMesmo: true }) === false);
t('membro raso nao mexe em ninguem',     CP.podeMexerEmMembro(raso, outro) === false);

console.log(`\n=== ${ok} passaram, ${f} falharam ===`);
process.exit(f ? 1 : 0);
