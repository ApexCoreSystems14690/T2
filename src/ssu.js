// SSU — quando o servidor abre e fecha (espelho do Regras.SSU do jogo, 25/09/2026)
//
// ATENÇÃO: este arquivo é uma SEGUNDA implementação da mesma regra. A primeira,
// e a que manda no jogo, é `ReplicatedStorage.Shared.Regras.SSU` (Luau). Duas
// implementações da mesma regra é exatamente como nasce divergência — foi assim
// que o jogo acabou com seis verdes diferentes.
//
// Por isso existe `teste_ssu.js`: ele compara as DUAS, minuto a minuto, numa
// semana inteira mais os casos de ajuste. Se divergirem em um único ponto, o
// teste quebra. Mexeu aqui, roda o teste.
//
// Por que não uma só: o jogo precisa decidir com o site fora do ar (senão não
// "roda sozinho"), e o painel precisa mostrar o estado sem perguntar ao jogo.

const FUSO = -3 * 3600; // America/Sao_Paulo, UTC-3 fixo (sem horário de verão desde 2019)

// 0=domingo ... 6=sábado no JS. O Lua usa 1..7; a conversão é +1.
const GRADE = {
  3: { abre: 19, fecha: 22, tetoExtensao: 23 }, // quarta
  5: { abre: 19, fecha: 24 },                   // sexta
  6: { abre: 19, fecha: 24 },                   // sábado
  0: { abre: 19, fecha: 22 },                   // domingo
};
// [03/10] Julio: "todo dia ter opcao de aumentar uma hora, infinitamente". Qualquer dia
// da grade estica de 1 em 1 hora. O unico limite e tecnico: a sessao vigente e procurada
// ate 2 dias pra tras, entao o fim maximo e 71 (23:00 de dois dias depois do inicio).
const EXTENSAO_MAX = 71;
// [05/10] SESSAO AVULSA — Julio: "o dono, cargo dono na administracao, deveria poder
// abrir ssu a qualquer hora". E a UNICA coisa no sistema que CRIA sessao fora da grade,
// e por isso e exclusiva do DONO (quem barra e a rota; aqui so mora a regra).
// Nao toca na grade: e uma sessao paralela, com inicio e fim proprios em epoch.
const AVULSA_HORAS = 3;        // duracao padrao = a menor sessao da grade
const AVULSA_MAX = 71 * 3600;  // mesmo teto tecnico da extensao

const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function calendario(epoch) {
  const d = new Date((epoch + FUSO) * 1000);
  return {
    ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(),
    hora: d.getUTCHours(), min: d.getUTCMinutes(), seg: d.getUTCSeconds(),
    wday: d.getUTCDay(),
  };
}
function chaveDia(epoch) {
  const c = calendario(epoch);
  return `${String(c.ano).padStart(4, '0')}-${String(c.mes).padStart(2, '0')}-${String(c.dia).padStart(2, '0')}`;
}
function meiaNoiteDe(epoch) {
  const c = calendario(epoch);
  return (epoch + FUSO) - (c.hora * 3600 + c.min * 60 + c.seg) - FUSO;
}

function sessaoDoDia(epoch, ajustes) {
  const c = calendario(epoch);
  const g = GRADE[c.wday];
  if (!g) return null;
  const base = meiaNoiteDe(epoch);
  const chave = chaveDia(epoch);
  let fecha = g.fecha;
  if (ajustes && ajustes.sessao === chave && Number.isFinite(Number(ajustes.estendidaAte))) {
    const nova = Number(ajustes.estendidaAte);
    if (nova > fecha && nova <= EXTENSAO_MAX) fecha = nova;
  }
  // [27/09] INICIO ANTECIPADO — espelho do Regras.SSU do jogo (o comentario longo esta la).
  // O diretor aperta "Iniciar SSU agora" e a sessao DE HOJE comeca na hora do clique.
  // So mexe no COMECO: `fim` continua o da grade. Tres travas: mesma noite, nunca antes
  // da meia-noite local do proprio dia, e so ANTECIPA (mandar hora maior nao atrasa).
  const inicioGrade = base + g.abre * 3600;
  let inicio = inicioGrade;
  if (ajustes && ajustes.sessao === chave && Number.isFinite(Number(ajustes.iniciadaAs))) {
    const n = Number(ajustes.iniciadaAs);
    if (n >= base && n < inicio) inicio = n;
  }
  return {
    chave, wday: c.wday, dia: NOME_DIA[c.wday],
    inicio,
    antecipada: inicio < inicioGrade,
    inicioGrade,
    fim: base + fecha * 3600,
    abreHora: g.abre, fechaHora: fecha, fechaPadrao: g.fecha, tetoExtensao: g.tetoExtensao || null,
  };
}
// [05/10] A sessao AVULSA que o dono abriu, se estiver valendo AGORA.
// Vive em `ajustes.avulsa = { inicio, fim }` (epoch) e NAO usa `ajustes.sessao`:
// ela pode comecar 23h de uma segunda e acabar 02h da terca, entao amarrar numa
// chave de dia so daria errado na virada.
function sessaoAvulsa(epoch, ajustes) {
  if (!ajustes || typeof ajustes !== 'object') return null;
  const a = ajustes.avulsa;
  if (!a || typeof a !== 'object') return null;
  const inicio = Number(a.inicio), fim = Number(a.fim);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return null;
  if (fim <= inicio) return null;                   // fim antes do comeco: lixo
  if ((fim - inicio) > AVULSA_MAX) return null;     // sessao eterna por bug nao vale
  if (epoch < inicio || epoch >= fim) return null;  // ja passou ou ainda nao comecou
  const c = calendario(inicio);
  return {
    chave: chaveDia(inicio), avulsa: true,
    wday: c.wday, dia: NOME_DIA[c.wday],
    inicio, antecipada: false, inicioGrade: inicio, fim,
    abreHora: c.hora, fechaHora: calendario(fim).hora, fechaPadrao: calendario(fim).hora,
    tetoExtensao: null,
  };
}

// [05/10] A AVULSA GANHA da grade: ela foi aberta na mao, agora, de proposito.
function sessaoVigente(epoch, ajustes) {
  const av = sessaoAvulsa(epoch, ajustes);
  if (av) return av;
  for (const recuo of [0, 86400, 172800]) {
    const s = sessaoDoDia(epoch - recuo, ajustes);
    if (s && epoch >= s.inicio && epoch < s.fim) return s;
  }
  return null;
}
function proximaSessao(epoch, ajustes) {
  for (let d = 0; d <= 8; d++) {
    const s = sessaoDoDia(epoch + d * 86400, ajustes);
    if (s && s.inicio > epoch) return s;
  }
  return null;
}
function estado(epoch, ajustes) {
  ajustes = (ajustes && typeof ajustes === 'object') ? ajustes : {};
  const s = sessaoVigente(epoch, ajustes);
  if (s) {
    // [05/10] `encerrada` e ajuste da SESSAO DA GRADE daquela noite; nao pode apagar
    // uma avulsa aberta depois (quem fecha a avulsa e apagar a propria `avulsa`).
    if (!s.avulsa && ajustes.sessao === s.chave && ajustes.encerrada === true) {
      const p = proximaSessao(epoch, ajustes);
      return { aberto: false, motivo: 'encerrada', sessao: s, proxima: p, abreEm: p ? p.inicio - epoch : null };
    }
    return { aberto: true, motivo: s.avulsa ? 'avulsa' : 'na_grade', sessao: s,
      fechaEm: s.fim - epoch, estendida: s.avulsa ? false : (s.fechaHora > s.fechaPadrao) };
  }
  const p = proximaSessao(epoch, ajustes);
  return { aberto: false, motivo: 'fora_da_grade', proxima: p, abreEm: p ? p.inicio - epoch : null };
}
// [05/10] `ehDono` e o 3o argumento e vale SO pro `abrirAgora`. Quem nao passa nada
// recebe exatamente o que recebia antes.
function acoesPossiveis(epoch, ajustes, ehDono) {
  ajustes = (ajustes && typeof ajustes === 'object') ? ajustes : {};
  const s = sessaoVigente(epoch, ajustes);
  const acoes = { encerrar: false, reabrir: false, estender: false, estenderAte: null,
                  iniciarAgora: false, abrirAgora: false, abrirAte: null, estenderAvulsaAte: null };

  // ABRIR AGORA: so o DONO, e so quando NAO tem nada acontecendo.
  const e = estado(epoch, ajustes);
  if (ehDono === true && !e.aberto) {
    acoes.abrirAgora = true;
    acoes.abrirAte = epoch + AVULSA_HORAS * 3600;
  }

  if (s) {
    const encerrada = (ajustes.sessao === s.chave && ajustes.encerrada === true);
    acoes.encerrar = !encerrada;
    acoes.reabrir = encerrada;
    if (s.avulsa) {
      // na avulsa nao existe "hora da grade": estica o FIM em epoch, +1h por clique.
      acoes.encerrar = true;
      acoes.reabrir = false;
      if ((s.fim + 3600 - s.inicio) <= AVULSA_MAX) {
        acoes.estender = true;
        acoes.estenderAvulsaAte = s.fim + 3600;
      }
    } else if (!encerrada && s.fechaHora < EXTENSAO_MAX) {
      // [03/10] qualquer dia estica +1h por clique, sem teto (ver EXTENSAO_MAX)
      acoes.estender = true;
      acoes.estenderAte = s.fechaHora + 1;
    }
  }
  // [27/09] INICIAR AGORA olha a sessao DO DIA, nao a vigente: o sentido do botao e
  // que ela ainda NAO comecou. Some sozinho quando a sessao abre — inclusive quando
  // foi o proprio botao que antecipou.
  const hoje = sessaoDoDia(epoch, ajustes);
  if (hoje && epoch < hoje.inicio) {
    acoes.iniciarAgora = !(ajustes.sessao === hoje.chave && ajustes.encerrada === true);
  }
  return acoes;
}
function horaTexto(h) { return `${String(((Number(h) % 24) + 24) % 24).padStart(2, '0')}:00`; }
function hhmm(seg) {
  seg = Math.max(0, Math.floor(Number(seg) || 0));
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}min` : `${m} min`;
}
function gradeTexto() {
  return [3, 5, 6, 0].map(w => {
    const g = GRADE[w];
    let l = `${NOME_DIA[w]}: ${horaTexto(g.abre)} às ${horaTexto(g.fecha)}`;
    return l;
  });
}

module.exports = { FUSO, GRADE, EXTENSAO_MAX, AVULSA_HORAS, AVULSA_MAX, NOME_DIA, calendario, chaveDia, sessaoDoDia, sessaoAvulsa, sessaoVigente,
  proximaSessao, estado, acoesPossiveis, horaTexto, hhmm, gradeTexto };
