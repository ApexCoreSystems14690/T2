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
// QUEM É DONO (mudou em 19/09, decisão do Julio: "somente o discord julio14690
// vai ter poder de DONO, essa db de dono aí não tem que existir"):
// DONO é UMA conta do Discord, fixa aqui embaixo em DONO_DISCORD. Não vem mais
// do banco. Antes a regra era "is_admin com admin_cargo NULL", e isso tinha um
// problema: qualquer UPDATE no banco criava outro poder absoluto, e todo admin
// que já existia virou Dono de uma vez. Agora não existe caminho de banco que
// crie um Dono — nem SQL, nem painel. Só trocando esta lista no código.
//
// REGRA DE OURO: o front esconde botão, o BACK é quem barra. Toda rota do
// painel confere o poder no servidor, em cada request. Esconder botão é
// conforto, não segurança.
// ============================================================================

// A conta do Discord que é Dono. Fixa no código de propósito — ver o cabeçalho.
const DONO_DISCORD = ['julio14690'];

// Escada. O 'nivel' é o que decide quem manda em quem.
const CARGOS = {
  dono:          { nome: 'Dono',          nivel: 100, cor: '#F59E0B', desc: 'Poder absoluto, inclusive o wipe. Conta fixa no código; não se concede nem se tira pelo painel.' },
  diretor:       { nome: 'Diretor Geral', nivel: 80,  cor: '#EF4444', desc: 'Tudo que existe no painel, menos o wipe geral.' },
  supervisor:    { nome: 'Supervisor',    nivel: 60,  cor: '#8B5CF6', desc: 'Banir, expulsar, dar item a todos, clima e hora, noclip, economia, teleporte e cargo em corp.' },
  administrador: { nome: 'Administrador', nivel: 40,  cor: '#3B82F6', desc: 'Banir, expulsar, dar item individual e noclip.' },
  moderador:     { nome: 'Moderador',     nivel: 20,  cor: '#10B981', desc: 'Banir, expulsar e dar item individual. Sem noclip.' },
  estagiario:    { nome: 'Estagiário',    nivel: 10,  cor: '#64748B', desc: 'Ver registro e logs, mandar mensagem, expulsar e dar item individual. NÃO bane.' },
};

const ORDEM = ['dono', 'diretor', 'supervisor', 'administrador', 'moderador', 'estagiario'];
// Cargos que o painel pode atribuir. 'dono' fica de fora de propósito.
const CARGOS_ATRIBUIVEIS = ['diretor', 'supervisor', 'administrador', 'moderador', 'estagiario'];

// Cada poder diz o cargo MÍNIMO que o exerce. Quem está acima também tem.
const PODERES = {
  // o Estagiário faz tudo isto; o que separa ele do Moderador é o BANIR
  ver_registro:  { rotulo: 'Ver registro e logs',            min: 'estagiario' },
  mensagem:      { rotulo: 'Mensagem privada a um jogador',  min: 'estagiario' },
  expulsar:      { rotulo: 'Expulsar (kick)',                min: 'estagiario' },
  item:          { rotulo: 'Dar item ou carro (individual)', min: 'estagiario' },

  banir:         { rotulo: 'Banir e desbanir',               min: 'moderador'  },

  noclip:        { rotulo: 'Noclip (voar / atravessar)',     min: 'administrador' },
  prisao:        { rotulo: 'Zerar prisão de um jogador',     min: 'moderador' },

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
  soltar:        'prisao',
};

// ---------------------------------------------------------------- funções

function nivelDoCargo(cargo) {
  const c = CARGOS[cargo];
  return c ? c.nivel : 0;
}

// É a conta Dono? Compara o usuário do Discord, sem caixa e sem espaço.
function ehDono(user) {
  if (!user) return false;
  const u = String(user.discord_username || '').trim().toLowerCase();
  return u.length > 0 && DONO_DISCORD.includes(u);
}

// O cargo efetivo de um usuário do site.
//   é o julio14690            -> 'dono', mesmo que o banco diga outra coisa
//   is_admin false            -> null (não é staff)
//   is_admin true + cargo     -> esse cargo
//   is_admin true sem cargo   -> 'estagiario', o MENOR da escada.
// Essa última linha é de propósito: antes "sem cargo" significava DONO, e era
// por isso que um UPDATE no banco dava poder absoluto sem querer. Agora, se
// sobrar um registro sem cargo, ele cai no degrau mais baixo em vez do mais
// alto — errar pra menos, nunca pra mais.
function cargoDe(user) {
  if (ehDono(user)) return 'dono';
  if (!user || !user.is_admin) return null;
  const c = user.admin_cargo;
  if (!c || !CARGOS[c] || c === 'dono') return 'estagiario';
  return c;
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
  CARGOS, ORDEM, CARGOS_ATRIBUIVEIS, PODERES, PODER_DO_COMANDO, DONO_DISCORD,
  ehDono, cargoDe, pode, poderesDe, podeMexerEm, podeDarCargo, nivelDoCargo, matriz,
};
