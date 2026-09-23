// ============================================================================
// PODERES DENTRO DE UMA CORPORAÇÃO — núcleo puro (23/09/2026)
//
// Motivo (Julio, 23/09): "Soldado consegue tirar o cargo de qualquer um etc,
// membros de corps tem poder demais sobre tudo, a maioria deveria so ver o nome
// la 'sua corp' e o botao de sair, talvez o salario".
//
// O QUE ESTAVA ERRADO. A regra antiga era estrutural, não declarada: quem
// estivesse nos DOIS cargos de nível mais alto da corp virava gerente de tudo,
// automaticamente. Consequências medidas:
//   - Jornal Nacional tem 3 cargos (Diretores 3, Jornalista 2, Holder 1). Top 2
//     inclui JORNALISTA — um repórter comum mandava na redação inteira.
//   - Corporação recém-criada no painel nasce SEM cargo nenhum. Os 2 primeiros
//     cargos criados viram "gerência" sem ninguém decidir isso.
//   - `isHighRank` só era conferido nas rotas de MEMBRO. Nas rotas de CARGO não
//     havia guarda: o 2º cargo editava o PRÓPRIO nível pra 999 e passava o
//     comandante, ou apagava o cargo do topo, ou trocava o salário de todos.
//     É por aí que um cargo baixo acabava "tirando o cargo de qualquer um".
//
// O DESENHO NOVO. Papel em vez de posição na lista:
//   staff   — admin do site com o poder 'corp' (Supervisor+). Entra em qualquer corp.
//   dono    — corporations.owner_id
//   gerente — corp_managers (co-gerente escolhido pelo dono)
//   chefe   — o cargo de MAIOR nível da corp, e só ele. Cuida de MEMBRO
//             (adicionar, remover, trocar cargo) e nada mais.
//   membro  — todo o resto. Vê o nome da corp, o próprio cargo, o próprio
//             salário e o botão Sair. Ponto.
//
// O cargo pode dizer o contrário de propósito: `ranks.permissions.gerir_membros`
// true liga a gerência num cargo que não é o topo, false desliga no topo. É o
// mesmo campo JSONB que o Jornal já usa pra `publicar_materias`, então não é
// tabela nova nem conceito novo.
//
// REGRA DE OURO (igual à do painel de admin): o front esconde botão, o BACK
// barra. Tudo aqui é função pura — sem Instance, sem pool, sem req — pra poder
// ser testado sem subir o site.
// ============================================================================

// poder -> papéis que o exercem
const MATRIZ = {
  ver_painel:     { staff: 1, dono: 1, gerente: 1, chefe: 1 },
  ver_membros:    { staff: 1, dono: 1, gerente: 1, chefe: 1 },
  gerir_membros:  { staff: 1, dono: 1, gerente: 1, chefe: 1 },
  // mexer em cargo é mexer em SALÁRIO, ou seja, na economia do jogo. E era o
  // caminho de escalada (editar o próprio nível). Fica com dono/co-gerente.
  gerir_cargos:   { staff: 1, dono: 1, gerente: 1 },
  editar_corp:    { staff: 1, dono: 1, gerente: 1 },
  // o seletor global de usuários do site (nome, discord_id, roblox_id de TODA
  // a base). Não é coisa de chefe de corp.
  ver_usuarios:   { staff: 1, dono: 1, gerente: 1 },
  gerir_gerentes: { staff: 1, dono: 1 },
  excluir_corp:   { staff: 1, dono: 1 },
};

const ROTULO = {
  ver_painel:     'Abrir o painel da corporação',
  ver_membros:    'Ver a lista de membros',
  gerir_membros:  'Adicionar, remover e trocar o cargo de membros',
  gerir_cargos:   'Criar, editar e apagar cargos (e salários)',
  editar_corp:    'Editar nome, cor, descrição e ícone',
  ver_usuarios:   'Ver a lista de usuários da plataforma',
  gerir_gerentes: 'Gerir co-gerentes',
  excluir_corp:   'Excluir a corporação',
};

const PAPEIS = ['staff', 'dono', 'gerente', 'chefe', 'membro'];

// ---------------------------------------------------------------------------
// ehChefe — o cargo do topo, ou o que o próprio cargo declarar.
//   meuNivel   nível do cargo do sujeito (null = sem cargo)
//   nivelMax   maior nível de cargo que existe na corp
//   qtdNiveis  quantos níveis DISTINTOS a corp tem
//   permissoes ranks.permissions do cargo dele
// Corp com menos de 2 níveis não tem chefe: senão o primeiro cargo criado numa
// corp nova já nasceria mandando.
// ---------------------------------------------------------------------------
function ehChefe({ meuNivel, nivelMax, qtdNiveis, permissoes } = {}) {
  const p = (permissoes && typeof permissoes === 'object') ? permissoes : {};
  if (p.gerir_membros === true) return true;
  if (p.gerir_membros === false) return false;
  if (meuNivel === null || meuNivel === undefined) return false;
  if (!(qtdNiveis >= 2)) return false;
  return Number(meuNivel) === Number(nivelMax);
}

// ctx = { ehStaffCorp, ehDono, ehGerente, meuNivel, nivelMax, qtdNiveis, permissoes }
function papelDe(ctx = {}) {
  if (ctx.ehStaffCorp) return 'staff';
  if (ctx.ehDono) return 'dono';
  if (ctx.ehGerente) return 'gerente';
  if (ehChefe(ctx)) return 'chefe';
  return 'membro';
}

function pode(ctx, poder) {
  const linha = MATRIZ[poder];
  if (!linha) return false;                 // poder desconhecido = NÃO, sempre
  return !!linha[papelDe(ctx)];
}

// Todos os poderes do sujeito, como { poder: true } — é o que a view usa pra
// esconder botão.
function poderesDe(ctx) {
  const papel = papelDe(ctx);
  const out = {};
  for (const [k, linha] of Object.entries(MATRIZ)) if (linha[papel]) out[k] = true;
  return out;
}

// Quem é dono/co-gerente/staff não tem teto de nível. O chefe tem: só age em
// quem está ABAIXO dele, nunca em igual, nunca no dono da corp, nunca em si.
function semTeto(ctx) {
  const p = papelDe(ctx);
  return p === 'staff' || p === 'dono' || p === 'gerente';
}

// alvo = { nivel (null se sem cargo), ehDonoDaCorp, ehEuMesmo }
function podeMexerEmMembro(ctx, alvo = {}) {
  if (!pode(ctx, 'gerir_membros')) return false;
  if (alvo.ehDonoDaCorp) return false;          // o dono não se mexe por aqui
  if (semTeto(ctx)) return true;
  if (alvo.ehEuMesmo) return false;             // pra sair existe o botão Sair
  const meu = Number(ctx.meuNivel);
  const dele = (alvo.nivel === null || alvo.nivel === undefined) ? -Infinity : Number(alvo.nivel);
  return dele < meu;
}

// Dar um cargo: nunca igual nem acima do seu.
function podeDarCargo(ctx, nivelNovo) {
  if (!pode(ctx, 'gerir_membros')) return false;
  if (semTeto(ctx)) return true;
  if (nivelNovo === null || nivelNovo === undefined) return true;   // tirar cargo
  return Number(nivelNovo) < Number(ctx.meuNivel);
}

// Mexer num CARGO (criar/editar/apagar). Quem não tem teto faz; o resto não faz
// nem com permissions ligada — é aqui que mora o salário.
function podeMexerEmCargo(ctx) {
  return pode(ctx, 'gerir_cargos');
}

function explicar(ctx) {
  const papel = papelDe(ctx);
  return {
    papel,
    poderes: poderesDe(ctx),
    teto: semTeto(ctx) ? null : (ctx.meuNivel ?? null),
    rotulos: ROTULO,
  };
}

module.exports = {
  MATRIZ, ROTULO, PAPEIS,
  ehChefe, papelDe, pode, poderesDe, semTeto,
  podeMexerEmMembro, podeDarCargo, podeMexerEmCargo, explicar,
};

// ---------------------------------------------------------------------------
// SQL_CHEFE — o MESMO teste de ehChefe(), escrito em SQL, pra usar nas listagens
// onde não dá pra carregar contexto por corp (dashboard, /faccoes).
// Exige que a subconsulta tenha os aliases `m` (members) e `r` (ranks).
// O CASE existe porque `->>` devolve texto: um valor que não seja 'true'/'false'
// derrubaria o cast e viraria erro 500 na página inteira.
// ---------------------------------------------------------------------------
const SQL_CHEFE = `
  COALESCE(
    CASE WHEN r.permissions->>'gerir_membros' IN ('true','false')
         THEN (r.permissions->>'gerir_membros')::boolean END,
    (
      r.level = (SELECT MAX(rmax.level) FROM ranks rmax WHERE rmax.corporation_id = m.corporation_id)
      AND (SELECT COUNT(DISTINCT rq.level) FROM ranks rq WHERE rq.corporation_id = m.corporation_id) >= 2
    )
  )`;

module.exports.SQL_CHEFE = SQL_CHEFE;
