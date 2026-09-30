// ============================================================================
// CAIXA E ESTOQUE — a camada de BANCO (28/09/2026)
//
// O núcleo `corp-caixa.js` decide; este arquivo persiste o que ele decidiu.
// Nenhuma regra mora aqui de propósito: se uma conta aparecer neste arquivo,
// ela vai divergir do núcleo no primeiro mês.
//
// TUDO EM TRANSAÇÃO, COM LOCK POR CORPORAÇÃO. Dois servidores do jogo rodam ao
// mesmo tempo: sem o lock, dois policiais retiram a última arma do estoque
// juntos e o saldo/estoque fica errado sem ninguém ver. O lock é a linha do
// `corp_caixa` da corp — toda operação passa por ela, então serializa a corp
// inteira. O volume é baixo (retirada de vestiário, não frame de física).
//
// O CHECK do banco (`qtd >= 0`) é a segunda rede: se algum dia uma rota nova
// esquecer de perguntar pro núcleo, o insert estoura em vez de envenenar a
// economia em silêncio.
// ============================================================================
const pool = require('./db/pool');
const C = require('./corp-caixa');

// Garante a linha do caixa e a tranca. Todo caminho de escrita começa aqui.
async function travar(client, corpId) {
  await client.query(
    `INSERT INTO corp_caixa (corporation_id, saldo) VALUES ($1, 0) ON CONFLICT DO NOTHING`, [corpId]);
  const r = await client.query(
    `SELECT saldo FROM corp_caixa WHERE corporation_id = $1 FOR UPDATE`, [corpId]);
  return Number(r.rows[0] ? r.rows[0].saldo : 0);
}

async function gravarLancamento(client, corpId, l) {
  await client.query(
    `INSERT INTO corp_lancamentos
       (corporation_id, tipo, motivo, valor, saldo_depois, item, qtd, perda, quem, por, detalhe)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [corpId, l.tipo, l.motivo || null, l.valor || 0, l.saldo_depois ?? null,
     l.item || null, l.qtd ?? null, !!l.perda, l.quem || null, l.por || null,
     JSON.stringify(l.detalhe || {})]);
}

// ---------------------------------------------------------------- dinheiro
// motivo: multa|patio|divida|venda|aporte (entra) · compra|bonus|ajuste (sai)
async function movDinheiro(corpId, motivo, valor, extra = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const saldo = await travar(client, corpId);
    const r = C.aplicarDinheiro(saldo, motivo, valor, extra);
    if (!r.ok) { await client.query('ROLLBACK'); return r; }
    await client.query(
      `UPDATE corp_caixa SET saldo = $2, atualizado_em = NOW() WHERE corporation_id = $1`,
      [corpId, r.saldo]);
    await gravarLancamento(client, corpId, r.lancamento);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}

// ---------------------------------------------------------------- estoque
// Monta pro núcleo só o pedaço do estado que ele precisa (este item, esta
// pessoa) — carregar o estoque inteiro pra mexer numa peça é desperdício, e o
// núcleo não olha o resto mesmo.
// motivo: retirou|devolveu|saiu|roubada|morreu|comprou|baixa
async function movEstoque(corpId, motivo, quem, item, extra = {}) {
  const nome = String(quem || '');
  const it = String(item || '');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await travar(client, corpId);

    const est = C.novoEstoque();
    const q = await client.query(
      `SELECT qtd, perdidos FROM corp_estoque WHERE corporation_id = $1 AND item = $2`, [corpId, it]);
    if (q.rows[0]) {
      est.itens[it] = Number(q.rows[0].qtd);
      est.perdidos[it] = Number(q.rows[0].perdidos);
    }
    const p = await client.query(
      `SELECT qtd FROM corp_emprestimos WHERE corporation_id = $1 AND nome = $2 AND item = $3`,
      [corpId, nome, it]);
    if (p.rows[0]) est.emprestado[nome] = { [it]: Number(p.rows[0].qtd) };

    const r = C.aplicarEstoque(est, motivo, nome, it, extra);
    if (!r.ok) { await client.query('ROLLBACK'); return r; }

    // grava exatamente o estado que o núcleo deixou
    await client.query(
      `INSERT INTO corp_estoque (corporation_id, item, qtd, perdidos, atualizado_em)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (corporation_id, item)
       DO UPDATE SET qtd = $3, perdidos = $4, atualizado_em = NOW()`,
      [corpId, it, C.naPrateleira(est, it), C.positivo(est.perdidos[it])]);

    const naMao = C.comAPessoa(est, nome, it);
    if (naMao > 0) {
      await client.query(
        `INSERT INTO corp_emprestimos (corporation_id, nome, roblox_id, item, qtd)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (corporation_id, nome, item) DO UPDATE SET qtd = $5`,
        [corpId, nome, extra.roblox_id || null, it, naMao]);
    } else if (nome) {
      await client.query(
        `DELETE FROM corp_emprestimos WHERE corporation_id = $1 AND nome = $2 AND item = $3`,
        [corpId, nome, it]);
    }

    await gravarLancamento(client, corpId, r.lancamento);
    await client.query('COMMIT');
    return r;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}

// COMPRAR é dinheiro E estoque na MESMA transação: comprar e não receber a
// peça (ou receber sem pagar) é o pior bug possível num caixa.
async function comprar(corpId, item, qtd, precos, extra = {}) {
  const conta = C.custoDaCompra(precos, item, qtd);
  if (!conta.ok) return conta;
  const n = C.positivo(qtd);
  const it = String(item);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const saldo = await travar(client, corpId);

    const pago = C.aplicarDinheiro(saldo, 'compra', conta.total, {
      item: it, qtd: n, por: extra.por, quem: extra.por,
      detalhe: { unitario: conta.unitario },
    });
    if (!pago.ok) { await client.query('ROLLBACK'); return pago; }

    await client.query(
      `UPDATE corp_caixa SET saldo = $2, atualizado_em = NOW() WHERE corporation_id = $1`,
      [corpId, pago.saldo]);
    await client.query(
      `INSERT INTO corp_estoque (corporation_id, item, qtd, atualizado_em)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (corporation_id, item)
       DO UPDATE SET qtd = corp_estoque.qtd + $3, atualizado_em = NOW()`,
      [corpId, it, n]);
    await gravarLancamento(client, corpId, pago.lancamento);
    await gravarLancamento(client, corpId, {
      tipo: 'estoque', motivo: 'comprou', valor: 0, item: it, qtd: n,
      perda: false, quem: '', por: extra.por || '',
      detalhe: { unitario: conta.unitario, total: conta.total },
    });
    await client.query('COMMIT');

    const novo = await pool.query(
      `SELECT qtd FROM corp_estoque WHERE corporation_id = $1 AND item = $2`, [corpId, it]);
    return { ok: true, saldo: pago.saldo, total: conta.total, unitario: conta.unitario,
             prateleira: Number(novo.rows[0] ? novo.rows[0].qtd : n) };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { client.release(); }
}

// ---------------------------------------------------------------- leitura
async function painel(corpId, limite = 60) {
  const lim = Math.min(200, Math.max(1, parseInt(limite) || 60));
  // [29/09] O EXTRATO NÃO MOSTRA MOVIMENTO DE EQUIPAMENTO -- `tipo <> 'estoque'`.
  // [stated] Julio: o comandante "só pode ver quantas armas foram perdidas no dia
  // etc quantas tinham e pa, ele que descubra e cobre seus agentes".
  // Uma linha "FAL tomada numa revista · PolicialX" entregaria de bandeja quem
  // está desviando -- e a graça da corrupção é ele ter que desconfiar e cobrar.
  // Sobra o extrato de DINHEIRO, que é gestão dele mesmo (multa, pátio, compra,
  // bônus). Os lançamentos de estoque têm valor 0, então o balanço não muda.
  const [cx, est, empr, lanc, perd] = await Promise.all([
    pool.query(`SELECT saldo FROM corp_caixa WHERE corporation_id = $1`, [corpId]),
    pool.query(`SELECT item, qtd, perdidos FROM corp_estoque WHERE corporation_id = $1 ORDER BY item`, [corpId]),
    pool.query(`SELECT nome, item, qtd, pego_em FROM corp_emprestimos WHERE corporation_id = $1 ORDER BY nome, item`, [corpId]),
    pool.query(
      `SELECT * FROM corp_lancamentos
        WHERE corporation_id = $1 AND tipo <> 'estoque'
        ORDER BY id DESC LIMIT $2`, [corpId, lim]),
    // PERDAS AGREGADAS POR DIA: quantas peças sumiram na rua, sem nome nenhum.
    // `baixa` fica de fora porque é o próprio comando dando baixa -- misturar
    // sujaria justamente o número que ele usa pra desconfiar.
    pool.query(
      `SELECT criado_em::date AS dia, item, COUNT(*)::int AS qtd
         FROM corp_lancamentos
        WHERE corporation_id = $1 AND tipo = 'estoque' AND perda AND motivo <> 'baixa'
        GROUP BY 1, 2 ORDER BY 1 DESC, 3 DESC LIMIT 60`, [corpId]),
  ]);

  const naRua = {};
  for (const e of empr.rows) naRua[e.item] = (naRua[e.item] || 0) + Number(e.qtd);

  const itens = est.rows.map(r => ({
    item: r.item,
    prateleira: Number(r.qtd),
    rua: naRua[r.item] || 0,
    perdido: Number(r.perdidos),
  }));
  // item que só existe emprestado (estoque zerado) não pode sumir da tela
  for (const [item, rua] of Object.entries(naRua)) {
    if (!itens.some(i => i.item === item)) itens.push({ item, prateleira: 0, rua, perdido: 0 });
  }
  itens.sort((a, b) => a.item.localeCompare(b.item));

  return {
    saldo: Number(cx.rows[0] ? cx.rows[0].saldo : 0),
    itens,
    emprestimos: empr.rows.map(e => ({ nome: e.nome, item: e.item, qtd: Number(e.qtd), pego_em: e.pego_em })),
    extrato: lanc.rows.map(l => ({ ...l, valor: Number(l.valor), saldo_depois: l.saldo_depois === null ? null : Number(l.saldo_depois) })),
    perdas_dia: perd.rows.map(r => ({ dia: r.dia, item: r.item, qtd: Number(r.qtd) })),
    balanco: C.balanco(lanc.rows.map(l => ({ tipo: l.tipo, valor: Number(l.valor) }))),
  };
}

// Preços vêm do JOGO (ToolData), guardados em game_config. O site não tem
// tabela de preço própria: duas listas divergem no primeiro dia.
async function precos(slug) {
  const r = await pool.query(`SELECT value FROM game_config WHERE key = 'precos_itens'`);
  const v = r.rows[0] && r.rows[0].value;
  const todos = (v && typeof v === 'object' && v.itens && typeof v.itens === 'object') ? v.itens : {};
  if (!slug) return todos;
  // [29/09] com slug, devolve SÓ o que o vestiário DAQUELA corp entregava. Sem
  // isso o comandante comprava AK47 e CAR15 pro armário -- arma de crime, que
  // nunca saiu de vestiário nenhum. Filtrar aqui, e não na tela, é o que faz a
  // trava valer também na rota de compra.
  const cat = await catalogo(slug);
  if (cat === null) return {};          // catálogo ainda não publicado: não libera nada
  const so = {};
  for (const item of cat) if (todos[item] > 0) so[item] = todos[item];
  return so;
}

// A lista de itens do vestiário de uma corp, como o JOGO publicou.
// null = o jogo ainda não publicou catálogo nenhum (diferente de [] = corp sem
// vestiário, que não pode comprar nada mesmo).
async function catalogo(slug) {
  const r = await pool.query(`SELECT value FROM game_config WHERE key = 'catalogo_corps'`);
  const v = r.rows[0] && r.rows[0].value;
  const corps = (v && typeof v === 'object' && v.corps && typeof v.corps === 'object') ? v.corps : null;
  if (!corps) return null;
  const lista = corps[String(slug || '').toLowerCase()];
  return Array.isArray(lista) ? lista : [];
}

// ===================================================================== ORÇAMENTO
// O repasse do governo, a cada 7 dias: base fixa + parte por atividade.
// A CONTA mora em corp-orcamento.js (puro, 38/38). Aqui fica a trava.
const ORC = require('./corp-orcamento');

// Registra uma ocorrência. É a ÚNICA definição de "atividade" — o site chama sozinho
// quando entra dinheiro, e o jogo chama pra SAMU (reanimação), que não gera dinheiro.
async function registrarAtividade(corpId, tipo, quem, cliente) {
  const c = cliente || pool;
  try {
    await c.query(
      `INSERT INTO corp_atividade (corporation_id, tipo, quem) VALUES ($1, $2, $3)`,
      [corpId, String(tipo || '').slice(0, 24), String(quem || '').slice(0, 64)]);
    return true;
  } catch (err) {
    // atividade é métrica, não dinheiro: se falhar, NÃO derruba a operação que a gerou
    console.error('corp_atividade:', err.message);
    return false;
  }
}

// Paga o repasse SE estiver pendente. Idempotente de verdade: a corrida é resolvida
// pelo UNIQUE(corporation_id, periodo) — dois servidores tentando ao mesmo tempo, um
// leva o conflito e sai sem pagar. Chamar à vontade, de qualquer lugar.
// Devolve { pagou, periodo, valor?, motivo? }.
// [30/09 Julio] EMPRESA NUNCA RECEBE REPASSE DO GOVERNO.
// "e ja começam com 40 mil, o caixa deveria ser so oque a empresa ganha, ou oque
//  o cara depositar no banco pelo cnpj da empresa".
// O QUE ACONTECIA: `ORC.BASE_POR_CORP` não tem linha pra 'mercado-fechado', então
// ela caía na BASE_PADRAO (R$ 40.000/semana) — e o repasse é pago no instante em
// que alguém ABRE o painel, por isso o caixa "nascia" com 40 mil sozinho.
// A trava é por TIPO, não por slug: empresa nova criada amanhã já nasce barrada,
// sem ninguém precisar lembrar de adicionar o slug em lugar nenhum.
async function ehEmpresa(corpId) {
  try {
    const r = await pool.query(`SELECT tipo FROM corporations WHERE id = $1`, [corpId]);
    return r.rows[0] ? String(r.rows[0].tipo) === 'empresa' : false;
  } catch (_) { return false; }   // na dúvida não barra: erro de leitura não pode travar o repasse de uma corp de verdade
}

async function pagarOrcamentoSePendente(corpId, slug, agoraMs) {
  const agora = Number.isFinite(Number(agoraMs)) ? Number(agoraMs) : Date.now();
  const periodo = ORC.periodoDe(agora);
  if (await ehEmpresa(corpId)) return { pagou: false, periodo, motivo: 'empresa não recebe do governo' };

  const ja = await pool.query(
    `SELECT periodo FROM corp_orcamento_pago
      WHERE corporation_id = $1 ORDER BY periodo DESC LIMIT 1`, [corpId]);
  const ultimo = ja.rows[0] ? Number(ja.rows[0].periodo) : null;
  const d = ORC.decidir(ultimo, agora);
  if (!d.pagar) return { pagou: false, periodo, motivo: d.motivo };

  // quantas ocorrências no período que está fechando
  const desde = new Date(periodo * ORC.DIA * ORC.ORC.DIAS - ORC.DIA * ORC.ORC.DIAS);
  const at = await pool.query(
    `SELECT COUNT(*)::int AS n FROM corp_atividade
      WHERE corporation_id = $1 AND em >= $2`, [corpId, desde]);
  const conta = ORC.valorDe(slug, at.rows[0] ? at.rows[0].n : 0);
  // [29/09] corp sem repasse (pavuna, loja) não gera linha nenhuma. Sem isto o
  // INSERT abaixo gravaria um pagamento de R$ 0 e o movDinheiro recusaria depois
  // -- ficaria um registro de repasse que nunca creditou nada.
  if (conta.total <= 0) return { pagou: false, periodo, motivo: 'corp sem repasse' };

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    // a TRAVA: quem chegar segundo bate no UNIQUE e não paga
    const ins = await cliente.query(
      `INSERT INTO corp_orcamento_pago (corporation_id, periodo, valor, base, atividade)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (corporation_id, periodo) DO NOTHING
       RETURNING id`,
      [corpId, periodo, conta.total, conta.base, conta.atividade]);
    if (ins.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return { pagou: false, periodo, motivo: 'outro servidor pagou primeiro' };
    }
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    cliente.release();
  }

  // o dinheiro entra pelo MESMO caminho de sempre (extrato, saldo, trava por corp)
  const r = await movDinheiro(corpId, 'aporte', conta.total, {
    quem: 'Governo',
    por: 'reforço semanal',
    detalhe: { orcamento: true, periodo, base: conta.base, atividade: conta.atividade },
  });
  if (!r.ok) return { pagou: false, periodo, motivo: r.erro };
  return { pagou: true, periodo, valor: conta.total, base: conta.base, atividade: conta.atividade, saldo: r.saldo };
}

/* SÓ LEITURA: o que o painel precisa mostrar sobre o repasse -- quando cai o
 * próximo, o que caiu no último, e quanto está previsto pro período que está
 * correndo. Não paga nada: quem paga é pagarOrcamentoSePendente, e ela é
 * chamada antes disto na rota do painel.
 *
 * A janela da atividade é a MESMA que o pagamento usa: o período que está
 * correndo agora é exatamente o que vai ser contado quando ele fechar. */
async function resumoOrcamento(corpId, slug, agoraMs) {
  const agora = Number.isFinite(Number(agoraMs)) ? Number(agoraMs) : Date.now();
  const periodo = ORC.periodoDe(agora);
  // empresa não tem repasse, então não tem resumo de repasse pra mostrar --
  // devolver `previsto` aqui seria prometer no painel um dinheiro que não vem.
  if (await ehEmpresa(corpId)) return null;
  const inicio = new Date(periodo * ORC.DIA * ORC.ORC.DIAS);
  const [ult, at] = await Promise.all([
    pool.query(
      `SELECT periodo, valor, base, atividade, em FROM corp_orcamento_pago
        WHERE corporation_id = $1 ORDER BY periodo DESC LIMIT 1`, [corpId]),
    pool.query(
      `SELECT COUNT(*)::int AS n FROM corp_atividade
        WHERE corporation_id = $1 AND em >= $2`, [corpId, inicio]),
  ]);
  const n = at.rows[0] ? at.rows[0].n : 0;
  const previsto = ORC.valorDe(slug, n);
  const u = ult.rows[0];
  return {
    dias: ORC.ORC.DIAS,
    periodo,
    proximo_em: ORC.proximoEm(agora),
    atividade_periodo: n,
    previsto,
    ultimo: u ? {
      periodo: Number(u.periodo), valor: Number(u.valor),
      base: Number(u.base), atividade: Number(u.atividade), em: u.em,
    } : null,
  };
}

module.exports = { movDinheiro, movEstoque, comprar, painel, precos, catalogo, registrarAtividade, pagarOrcamentoSePendente, resumoOrcamento, ehEmpresa, ORC };
