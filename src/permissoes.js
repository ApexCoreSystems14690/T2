// ============================================================================
// CARGOS DE ADMIN DO PAINEL — fonte única da verdade (19/09/2026)
//
// Decisão do Julio: o admin deixa de ser um liga/desliga e vira uma escada de
// cargos, quase como uma corporação. A base veio da lista dele:
//
//   Moderador ....... banir, expulsar, dar item (individual; sem noclip,
//                     sem dar pra todos)
//   Administrador ... o do moderador + noclip
//   Supervisor ...... o do administrador + dar item a TODOS + clima e hora
//                     (+ economia, teleporte e cargo em corp)
//   Diretor Geral ... tudo que existir, MENOS o wipe
//   Dono ............ tudo, inclusive o wipe
//
// QUEM É DONO: quem tem is_admin = true e admin_cargo NULL no banco. Ou seja,
// quem foi setado DIRETO NO BANCO por SQL — o painel nunca escreve NULL, ele
// sempre grava um cargo. Isso faz o "setado direto na db tem poder absoluto"
// valer sozinho, sem lista de ID em lugar nenhum: um UPDATE users SET
// is_admin = true é o bastante, e pra tirar o poder absoluto de alguém basta
// dar um cargo a ele pelo painel.
//
// REGRA DE OURO: o front esconde botão, o BACK é quem barra. Toda rota do
// painel confere o poder no servidor, em cada request. Esconder botão é
// conforto, não segurança.
// ============================================================================

// Escada. O 'nivel' é o que decide quem manda em quem.
const CARGOS = {
  dono:          { nome: 'Dono',          nivel: 100, cor: '#F59E0B', desc: 'Setado direto no banco. Poder absoluto, inclusive o wipe. Só sai por SQL.' },
  diretor:       { nome: 'Diretor Geral', nivel: 80,  cor: '#EF4444', desc: 'Tudo que existe no painel, menos o wipe geral.' },
  supervisor:    { nome: 'Supervisor',    nivel: 60,  cor: '#8B5CF6', desc: 'Banir, expulsar, dar item a todos, clima e hora, noclip, economia, teleporte e cargo em corp.' },
  administrador: { nome: 'Administrador', nivel: 40,  cor: '#3B82F6', desc: 'Banir, expulsar, dar item individual e noclip.' },
  moderador:     { nome: 'Moderador',     nivel: 20,  cor: '#10B981', desc: 'Banir, expulsar e dar item individual. Sem noclip.' },
};

const ORDEM = ['dono', 'diretor', 'supervisor', 'administrador', 'moderador'];
// Cargos que o painel pode atribuir. 'dono' fica de fora de propósito.
const CARGOS_ATRIBUIVEIS = ['diretor', 'supervisor', 'administrador', 'moderador'];

// Cada poder diz o cargo MÍNIMO que o exerce. Quem está acima também tem.
const PODERES = {
  expulsar:      { rotulo: 'Expulsar (kick)',                min: 'moderador' },
  banir:         { rotulo: 'Banir e desbanir',               min: 'moderador' },
  mensagem:      { rotulo: 'Mensagem privada a um jogador',  min: 'moderador' },
  item:          { rotulo: 'Dar item ou carro (individual)', min: 'moderador' },
  ver_registro:  { rotulo: 'Ver registro e logs',            min: 'moderador' },

  noclip:        { rotulo: 'Noclip (voar / atravessar)',     min: 'administrador' },

  economia:      { rotulo: 'Dinheiro, banco, level e slots', min: 'supervisor' },
  teleporte:     { rotulo: 'TP, trazer, curar e matar',      min: 'supervisor' },
  corp:          { rotulo: 'Corporação, cargo e emprego',    min: 'supervisor' },
  item_todos:    { rotulo: 'Dar item ou carro a TODOS',      min: 'supervisor' },
  servidor:      { rotulo: 'Clima, hora e anúncio geral',    min: 'supervisor' },

  registro:      { rotulo: 'Apagar jogadores do registro',   min: 'diretor'    },
  logs:          { rotulo: 'Resetar logs',                   min: 'diretor'    },
  reset_jogador: { rotulo: 'Resetar o save de um jogador',   min: 'diretor'    },
  admins:        { rotulo: 'Gerir admins e seus cargos',     min: 'diretor'    },

  wipe:          { rotulo: 'WIPE GERAL (reset da temporada)', min: 'dono'      },
};

// Comando do jogo -> poder que ele exige. Comando fora deste mapa é recusado:
// esquecer de mapear nunca pode virar "liberado pra todo mundo".
const PODER_DO_COMANDO = {
  kick:          'expulsar',
  ban:           'banir',
  unban:         'banir',
  mensagem:      'mensagem',
  item_add:      'item',
  item_remove:   'item',
  carro_add:     'item',
  carro_remove:  'item',
  noclip:        'noclip',
  dinheiro_set:  'economia',
  dinheiro_add:  'economia',
  banco_set:     'economia',
  level_set:     'economia',
  slots_set:     'economia',
  tp_local:      'teleporte',
  tp_jogador:    'teleporte',
  tp_coord:      'teleporte',
  trazer:        'teleporte',
  curar:         'teleporte',
  matar:         'teleporte',
  emprego:       'corp',
  corp_refresh:  'corp',
  hora:          'servidor',
  clima:         'servidor',
  anuncio:       'servidor',
  resetar_dados: 'reset_jogador',
};

// ---------------------------------------------------------------- funções

function nivelDoCargo(cargo) {
  const c = CARGOS[cargo];
  return c ? c.nivel : 0;
}

// O cargo efetivo de um usuário do site.
// is_admin false -> null (não é admin).
// is_admin true + admin_cargo vazio -> 'dono' (foi setado direto no banco).
// is_admin true + admin_cargo conhecido -> esse cargo.
function cargoDe(user) {
  if (!user || !user.is_admin) return null;
  const c = user.admin_cargo;
  if (!c) return 'dono';
  return CARGOS[c] ? c : 'dono';
}

function pode(user, poder) {
  const cargo = cargoDe(user);
  if (!cargo) return false;
  const p = PODERES[poder];
  if (!p) return false;
  return nivelDoCargo(cargo) >= nivelDoCargo(p.min);
}

// Todos os poderes de um usuário, como objeto { poder: true } — é o que vai
// pro front esconder botão.
function poderesDe(user) {
  const out = {};
  const cargo = cargoDe(user);
  if (!cargo) return out;
  const meu = nivelDoCargo(cargo);
  for (const [k, p] of Object.entries(PODERES)) {
    if (meu >= nivelDoCargo(p.min)) out[k] = true;
  }
  return out;
}

// Mexer em outro admin: só em quem está ABAIXO de você, e só pra dar cargo
// abaixo do seu. Assim um Diretor não promove ninguém a Diretor nem rebaixa
// outro Diretor, e ninguém alcança um Dono.
function podeMexerEm(user, alvo) {
  if (!pode(user, 'admins')) return false;
  if (user.id === alvo.id) return false;
  const meu = nivelDoCargo(cargoDe(user));
  const dele = nivelDoCargo(cargoDe(alvo));  // 0 se o alvo não é admin
  return meu > dele;
}

function podeDarCargo(user, cargo) {
  if (!pode(user, 'admins')) return false;
  if (!CARGOS_ATRIBUIVEIS.includes(cargo)) return false;   // 'dono' nunca
  return nivelDoCargo(cargoDe(user)) > nivelDoCargo(cargo);
}

// Matriz cargo x poder, pra mostrar no painel e pra conferir no teste.
function matriz() {
  const linhas = [];
  for (const cargo of ORDEM) {
    const n = nivelDoCargo(cargo);
    const tem = Object.keys(PODERES).filter(k => n >= nivelDoCargo(PODERES[k].min));
    linhas.push({ cargo, nome: CARGOS[cargo].nome, nivel: n, poderes: tem });
  }
  return linhas;
}

module.exports = {
  CARGOS, ORDEM, CARGOS_ATRIBUIVEIS, PODERES, PODER_DO_COMANDO,
  cargoDe, pode, poderesDe, podeMexerEm, podeDarCargo, nivelDoCargo, matriz,
};
