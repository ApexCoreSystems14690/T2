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
  if (ajustes && ajustes.sessao === chave && Number.isFinite(Number(ajustes.estendidaAte)) && g.tetoExtensao) {
    const nova = Number(ajustes.estendidaAte);
    if (nova > fecha && nova <= g.tetoExtensao) fecha = nova;
  }
  return {
    chave, wday: c.wday, dia: NOME_DIA[c.wday],
    inicio: base + g.abre * 3600,
    fim: base + fecha * 3600,
    abreHora: g.abre, fechaHora: fecha, fechaPadrao: g.fecha, tetoExtensao: g.tetoExtensao || null,
  };
}
function sessaoVigente(epoch, ajustes) {
  for (const recuo of [0, 86400]) {
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
    if (ajustes.sessao === s.chave && ajustes.encerrada === true) {
      const p = proximaSessao(epoch, ajustes);
      return { aberto: false, motivo: 'encerrada', sessao: s, proxima: p, abreEm: p ? p.inicio - epoch : null };
    }
    return { aberto: true, motivo: 'na_grade', sessao: s, fechaEm: s.fim - epoch, estendida: s.fechaHora > s.fechaPadrao };
  }
  const p = proximaSessao(epoch, ajustes);
  return { aberto: false, motivo: 'fora_da_grade', proxima: p, abreEm: p ? p.inicio - epoch : null };
}
function acoesPossiveis(epoch, ajustes) {
  ajustes = (ajustes && typeof ajustes === 'object') ? ajustes : {};
  const s = sessaoVigente(epoch, ajustes);
  const acoes = { encerrar: false, reabrir: false, estender: false, estenderAte: null };
  if (s) {
    const encerrada = (ajustes.sessao === s.chave && ajustes.encerrada === true);
    acoes.encerrar = !encerrada;
    acoes.reabrir = encerrada;
    if (s.tetoExtensao && s.fechaHora < s.tetoExtensao && !encerrada) {
      acoes.estender = true;
      acoes.estenderAte = s.tetoExtensao;
    }
  }
  return acoes;
}
function horaTexto(h) { return h >= 24 ? '00:00' : `${String(h).padStart(2, '0')}:00`; }
function hhmm(seg) {
  seg = Math.max(0, Math.floor(Number(seg) || 0));
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}min` : `${m} min`;
}
function gradeTexto() {
  return [3, 5, 6, 0].map(w => {
    const g = GRADE[w];
    let l = `${NOME_DIA[w]}: ${horaTexto(g.abre)} às ${horaTexto(g.fecha)}`;
    if (g.tetoExtensao) l += ` (pode esticar até ${horaTexto(g.tetoExtensao)})`;
    return l;
  });
}

module.exports = { FUSO, GRADE, NOME_DIA, calendario, chaveDia, sessaoDoDia, sessaoVigente,
  proximaSessao, estado, acoesPossiveis, horaTexto, hhmm, gradeTexto };
