// Render do corp-manage.ejs com o bloco novo do REPASSE. Sem browser: prova que
// o EJS compila nos dois papéis e que o bloco só existe pra quem vê o caixa.
const ejs = require('ejs'); const fs = require('fs');
const tpl = fs.readFileSync('./src/views/corp-manage.ejs', 'utf8');
let ok = 0; const falhas = [];
const t = (n, c, e) => { if (c) ok++; else falhas.push(n + (e !== undefined ? ' -> ' + JSON.stringify(e) : '')); };

const base = {
  corporation: { id: 1, name: 'PM', slug: 'policia-militar', description: '', icon_url: '', has_icon_file: false, max_members: 100, color: '#00d4ff' },
  members: [{ id: 1, name: 'Julio', roblox_id: 123, roblox_username: 'julio', discord_username: 'julio', rank: 'Coronel', rank_id: 9, level: 9, salary: 19000, joined_at: new Date(), sou_eu: true, travado: false }],
  ranks: [{ id: 9, name: 'Coronel', level: 9, salary: 19000 }],
  MEU_NIVEL: 10, MEU_PAPEL: 'dono', eh_dono_da_corp: true,
};
function render(P) { return ejs.render(tpl, { ...base, poderes: P, isOwner: true, meuNivel: 10, papel: 'dono' }); }

const dono = render({ ver_caixa: true, gastar_caixa: true, gerir_estoque: true, gerir_cargos: true, gerir_gerentes: true, editar_corp: true });
t('dono: template renderiza', dono.length > 1000);
t('dono: bloco do repasse existe', dono.includes('id="cx-orcamento"'));
t('dono: JS do repasse existe', dono.includes("getElementById('cx-orcamento')"));
t('dono: texto Repasse do governo', dono.includes('Repasse do governo'));
t('dono: bloco nasce escondido', /id="cx-orcamento"[^>]*display:none/.test(dono));
t('dono: nao sobrou tag EJS', !dono.includes('<%'));

const chefe = render({ ver_caixa: false, gastar_caixa: false, gerir_estoque: false, gerir_cargos: true, gerir_gerentes: false, editar_corp: false });
t('chefe: template renderiza', chefe.length > 1000);
t('sem ver_caixa NAO tem bloco de repasse', !chefe.includes('id="cx-orcamento"'));

// [29/09] APORTE SÓ PRA STAFF: dono de corp não imprime dinheiro.
const donoSemStaff = render({ ver_caixa: true, gastar_caixa: true, gerir_estoque: true, aportar_caixa: false, gerir_cargos: true, gerir_gerentes: true, editar_corp: true });
t('dono NAO ve o aporte', !donoSemStaff.includes('id="cx-aporte"'));
t('dono ainda ve comprar', donoSemStaff.includes('id="cx-item"'));
t('dono ainda ve bonus', donoSemStaff.includes('id="cx-bonus-valor"'));
const staff = render({ ver_caixa: true, gastar_caixa: true, gerir_estoque: true, aportar_caixa: true, gerir_cargos: true, gerir_gerentes: true, editar_corp: true });
t('staff ve o aporte', staff.includes('id="cx-aporte"'));

const soVer = render({ ver_caixa: true, gastar_caixa: false, gerir_estoque: false, gerir_cargos: false, gerir_gerentes: false, editar_corp: false });
t('so_ver: ve o repasse', soVer.includes('id="cx-orcamento"'));
t('so_ver: NAO ve comprar', !soVer.includes('id="cx-item"'));
t('so_ver: NAO ve aporte', !soVer.includes('id="cx-aporte"'));

console.log(`${ok}/${ok + falhas.length} passaram`);
falhas.forEach(f => console.log('  X ' + f));
if (falhas.length) process.exitCode = 1;
