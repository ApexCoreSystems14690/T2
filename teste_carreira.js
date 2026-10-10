const ejs = require('ejs'); const fs = require('fs');
const tpl = fs.readFileSync('./src/views/corp-manage.ejs', 'utf8');
let ok=0; const f=[]; const t=(n,c)=>{ if(c) ok++; else f.push(n); };
const ranksPC = [
 { id: 1, name: '[DG] Delegado-Geral', level: 12, salary: 19000, carreira: 'Direção' },
 { id: 2, name: '[DP-3] Delegado de Polícia 3ª Classe', level: 7, salary: 12500, carreira: 'Delegados' },
 { id: 3, name: '[DINV] Diretor de Investigação', level: 7, salary: 12000, carreira: 'Investigação' },
 { id: 4, name: "Agente <O'Brien>", level: 5, salary: 7000, carreira: 'Agentes' },
 { id: 5, name: '[ESPC] Instruendo', level: 2, salary: 2210, carreira: 'Escola' },
];
const base = {
  corporation: { id: 12, name: 'PC', slug: 'policia-civil', description: '', icon_url: '', has_icon_file: false, max_members: 100, color: '#00d4ff' },
  members: [{ id: 1, roblox_id: 1, roblox_username: 'a', discord_username: 'a', rank_id: 2, rank_level: 7, joined_at: new Date(), sou_eu: false, travado: false }],
  ranks: ranksPC, MEU_NIVEL: 7, MEU_PAPEL: 'chefe', eh_dono_da_corp: false, isOwner: false,
  poderes: { gerir_cargos: true, gerir_membros: true, ver_caixa: false },
};
const h = ejs.render(tpl, base);
t('renderiza', h.length > 1000);
t('grupo Delegados', h.includes('Carreira · Delegados'));
t('grupo Investigação', h.includes('Carreira · Investigação'));
t('optgroup no select', h.includes('<optgroup label="Delegados">'));
t('dois Nv.7 no select', (h.match(/\(Nv\.7\)/g)||[]).length >= 2);
t('nome escapado', h.includes('Agente &lt;O&#39;Brien&gt;') || h.includes('Agente &lt;O\'Brien&gt;'));
t('botao Editar', h.includes('editRank(4,'));
t('editar sem aspas cruas quebrando', !/editRank\(4, \{[^}]*'Brien/.test(h));
t('campo carreira', h.includes('id="rank-carreira"'));
t('sem tag ejs', !h.includes('<%'));
// corp sem carreira: sem cabecalho de carreira nem optgroup
const h2 = ejs.render(tpl, { ...base, ranks: [{ id: 9, name: 'Coronel', level: 9, salary: 1 , carreira: ''}], MEU_PAPEL: 'dono', MEU_NIVEL: 10 });
t('PM sem carreira: sem cabecalho', !h2.includes('Carreira ·'));
t('PM sem carreira: sem optgroup', !h2.includes('<optgroup'));
// extrai o onclick do Editar e roda o JSON
const m = h.match(/onclick='editRank\(4, ([^']*)\)'/); let js=null; try { js = eval('(' + m[1] + ')'); } catch(e){}
t('JSON do editar valido', js && js.name === "Agente <O'Brien>" && js.carreira === 'Agentes');
console.log(ok+'/'+(ok+f.length)); f.forEach(x=>console.log(' X '+x));
