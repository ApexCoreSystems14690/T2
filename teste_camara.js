// [23/10] Câmara do Governo: propostas, votação (Regulamento Cap. 10), sanção, veto e aplicação.
// Rodar com o site no ar: TZ=UTC DATABASE_URL=... BASE=http://localhost:4600 node teste_camara.js
const assert = require('assert');
const { Pool } = require('pg');
const sig = require('cookie-signature');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.BASE || 'http://localhost:4600';
const GOV = require('./src/governo');
const CAM = require('./src/governo-camara');
let ok = 0, falhou = 0;
async function caso(n, f) { try { await f(); ok++; console.log('  ok  ' + n); } catch (e) { falhou++; console.log('  FALHOU  ' + n + '\n        ' + e.message); } }
async function sessao(uid, cidadeId) {
  const sid = 'cm' + uid + 'c' + cidadeId + Math.random().toString(36).slice(2);
  await pool.query(`INSERT INTO session (sid, sess, expire) VALUES ($1,$2,NOW()+interval '1 day')`, [sid, { cookie: { originalMaxAge: 864e5, httpOnly: true, path: '/' }, userId: uid, cidadeId }]);
  return 'connect.sid=' + encodeURIComponent('s:' + sig.sign(sid, 'dev-secret-apenas-local'));
}
async function pedir(c, met, path, body) {
  const r = await fetch(BASE + path, { method: met, redirect: 'manual', headers: { cookie: c || '', accept: 'application/json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { s: r.status, j };
}
const prop = async (id) => (await pool.query(`SELECT * FROM governo_propostas WHERE id = $1`, [id])).rows[0];
const pularDebate = (id) => pool.query(`UPDATE governo_propostas SET votacao_em = NOW() - INTERVAL '1 minute' WHERE id = $1`, [id]);
const fecharVotacao = (id) => pool.query(`UPDATE governo_propostas SET fecha_em = NOW() - INTERVAL '1 minute' WHERE id = $1`, [id]);
const lista = (c) => pedir(c, 'GET', '/api/governo/camara');

(async () => {
  const cfg = await GOV.config(pool, 1); const GID = cfg.corporation_id;
  await pool.query(`DELETE FROM governo_propostas WHERE cidade_id = 1`);
  await pool.query(`DELETE FROM members WHERE corporation_id = $1`, [GID]);
  await pool.query(`DELETE FROM users WHERE discord_id LIKE 'cm_%'`);
  const u = async (d, rid) => (await pool.query(`INSERT INTO users (discord_id, discord_username, roblox_id, roblox_username, roblox_verificado) VALUES ($1,$1,$2,$1,true) RETURNING id`, [d, rid])).rows[0].id;
  const rk = async (nome) => (await pool.query(`SELECT id FROM ranks WHERE corporation_id = $1 AND name = $2`, [GID, nome])).rows[0].id;
  const pad = {}; for (const [n, , s] of GOV.CARGOS_PADRAO) { pad[n] = s; await pool.query(`UPDATE ranks SET salary = $3 WHERE corporation_id = $1 AND name = $2`, [GID, n, s]); }
  const ids = {};
  for (const [d, cargo] of [['cm_p1', 'Parlamentar'], ['cm_p2', 'Parlamentar'], ['cm_p3', 'Parlamentar'], ['cm_p4', 'Parlamentar'],
                            ['cm_pcam', 'Presidente da Câmara'], ['cm_pres', 'Presidente da República'], ['cm_min', 'Ministro da Saúde']]) {
    ids[d] = await u(d, null);
    await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3)`, [GID, ids[d], await rk(cargo)]);
  }
  ids.cm_civil = await u('cm_civil', null);
  const S = {}; for (const k of Object.keys(ids)) S[k] = await sessao(ids[k], 1);
  const dono = (await pool.query(`SELECT id FROM users WHERE discord_id = '111'`)).rows[0].id;
  const DN = await sessao(dono, 1);
  const rMin = await rk('Ministro da Saúde'), rParl = await rk('Parlamentar');
  const salario = async (id) => Number((await pool.query(`SELECT salary FROM ranks WHERE id = $1`, [id])).rows[0].salary);

  console.log('\nQUEM PODE');
  await caso('quem não é Parlamentar nem Pres. da Câmara não abre proposta (403)', async () => {
    assert.strictEqual((await pedir(S.cm_min, 'POST', '/api/governo/camara', { tipo: 'salario', rank_id: rMin, valor: 160000, descricao: 'aumento do ministro' })).s, 403);
    assert.strictEqual((await pedir(S.cm_civil, 'POST', '/api/governo/camara', { tipo: 'salario', rank_id: rMin, valor: 160000, descricao: 'aumento do ministro' })).s, 403);
  });
  await caso('salário acima de 2x o padrão é recusado; negativo também', async () => {
    const r = await pedir(S.cm_p1, 'POST', '/api/governo/camara', { tipo: 'salario', rank_id: rMin, valor: pad['Ministro da Saúde'] * 2 + 1, descricao: 'aumento grande' });
    assert.strictEqual(r.s, 400); assert.ok(/teto/i.test(r.j.error));
    assert.strictEqual((await pedir(S.cm_p1, 'POST', '/api/governo/camara', { tipo: 'salario', rank_id: rMin, valor: -5, descricao: 'salario negativo' })).s, 400);
  });

  console.log('\nVOTAÇÃO (Art. 10.2 e 10.14)');
  let A;
  await caso('Parlamentar abre: fica 48 h em debate e não aceita voto ainda', async () => {
    const r = await pedir(S.cm_p1, 'POST', '/api/governo/camara', { tipo: 'salario', rank_id: rMin, valor: 200000, descricao: 'Ministro da Saúde trabalha mais' });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j)); A = r.j.id;
    const p = await prop(A); assert.strictEqual(p.status, 'debate');
    const h = (new Date(p.votacao_em) - new Date(p.criada_em)) / 3600000; assert.ok(Math.abs(h - 48) < 0.01);
    assert.strictEqual((await pedir(S.cm_p2, 'POST', `/api/governo/camara/${A}/voto`, { voto: 'sim' })).s, 400);
  });
  await caso('na votação: Parlamentar vota 1 vez só (409 na 2ª); Ministro não vota (403)', async () => {
    await pularDebate(A); await lista(S.cm_p1);
    assert.strictEqual((await prop(A)).status, 'votacao');
    assert.strictEqual((await pedir(S.cm_p2, 'POST', `/api/governo/camara/${A}/voto`, { voto: 'sim' })).s, 200);
    assert.strictEqual((await pedir(S.cm_p2, 'POST', `/api/governo/camara/${A}/voto`, { voto: 'nao' })).s, 409);
    assert.strictEqual((await pedir(S.cm_min, 'POST', `/api/governo/camara/${A}/voto`, { voto: 'sim' })).s, 403);
    assert.strictEqual((await pedir(S.cm_pcam, 'POST', `/api/governo/camara/${A}/voto`, { voto: 'sim' })).s, 403);   // Pres. da Câmara só desempata
  });
  await caso('voto é público: aparece com o nome', async () => {
    const l = await lista(S.cm_min);
    const p = l.j.propostas.find(x => x.id === A);
    assert.ok(p.votos.some(v => v.nome === 'cm_p2' && v.voto === true));
  });
  await caso('1 SIM x 0 NÃO, sem quórum mínimo: aprovada e vai pra sanção', async () => {
    await fecharVotacao(A); await lista(S.cm_p1);
    assert.strictEqual((await prop(A)).status, 'aguardando_sancao');
  });
  await caso('só o Presidente da República sanciona; sancionada aplica no ranks.salary', async () => {
    assert.strictEqual((await pedir(S.cm_p1, 'POST', `/api/governo/camara/${A}/sancao`, { acao: 'sancionar' })).s, 403);
    const r = await pedir(S.cm_pres, 'POST', `/api/governo/camara/${A}/sancao`, { acao: 'sancionar' });
    assert.strictEqual(r.j.status, 'sancionada', JSON.stringify(r.j));
    assert.strictEqual(await salario(rMin), 200000);
  });
  await caso('ninguém votou: recusada', async () => {
    const id = (await pedir(S.cm_p1, 'POST', '/api/governo/camara', { tipo: 'salario', rank_id: rMin, valor: 180000, descricao: 'ninguem vai votar' })).j.id;
    await pularDebate(id); await lista(S.cm_p1); await fecharVotacao(id); await lista(S.cm_p1);
    assert.strictEqual((await prop(id)).status, 'recusada');
  });
  await caso('empate sem desempate: recusada; empate com desempate SIM do Pres. da Câmara: aprovada', async () => {
    const a = (await pedir(S.cm_p1, 'POST', '/api/governo/camara', { tipo: 'salario', rank_id: rMin, valor: 170000, descricao: 'empate sem desempate' })).j.id;
    const b = (await pedir(S.cm_pcam, 'POST', '/api/governo/camara', { tipo: 'salario', rank_id: rMin, valor: 175000, descricao: 'empate com desempate' })).j.id;
    for (const id of [a, b]) { await pularDebate(id); }
    await lista(S.cm_p1);
    for (const id of [a, b]) {
      await pedir(S.cm_p1, 'POST', `/api/governo/camara/${id}/voto`, { voto: 'sim' });
      await pedir(S.cm_p2, 'POST', `/api/governo/camara/${id}/voto`, { voto: 'nao' });
    }
    assert.strictEqual((await pedir(S.cm_p1, 'POST', `/api/governo/camara/${b}/voto`, { voto: 'sim', desempate: true })).s, 403);
    assert.strictEqual((await pedir(S.cm_pcam, 'POST', `/api/governo/camara/${b}/voto`, { voto: 'sim', desempate: true })).s, 200);
    for (const id of [a, b]) await fecharVotacao(id);
    await lista(S.cm_p1);
    assert.strictEqual((await prop(a)).status, 'recusada');
    assert.strictEqual((await prop(b)).status, 'aguardando_sancao');
  });

  console.log('\nSANÇÃO E VETO');
  const aprovar = async (corpo) => {
    const id = (await pedir(S.cm_p1, 'POST', '/api/governo/camara', corpo)).j.id;
    await pularDebate(id); await lista(S.cm_p1);
    await pedir(S.cm_p1, 'POST', `/api/governo/camara/${id}/voto`, { voto: 'sim' });
    await fecharVotacao(id); await lista(S.cm_p1);
    return id;
  };
  await caso('Presidente não responde em 24 h: sancionada sozinha', async () => {
    const id = await aprovar({ tipo: 'salario', rank_id: rMin, valor: 210000, descricao: 'sancao automatica' });
    await pool.query(`UPDATE governo_propostas SET sancao_ate = NOW() - INTERVAL '1 minute' WHERE id = $1`, [id]);
    await lista(S.cm_p1);
    const p = await prop(id); assert.strictEqual(p.status, 'sancionada'); assert.strictEqual(p.sancao, 'automatica');
    assert.strictEqual(await salario(rMin), 210000);
  });
  await caso('veto volta pra Câmara; 2/3 dos votos derruba e aplica', async () => {
    const id = await aprovar({ tipo: 'salario', rank_id: rMin, valor: 220000, descricao: 'veto derrubado' });
    assert.strictEqual((await pedir(S.cm_pres, 'POST', `/api/governo/camara/${id}/sancao`, { acao: 'vetar' })).j.status, 'vetada');
    await pedir(S.cm_p1, 'POST', `/api/governo/camara/${id}/voto`, { voto: 'sim' });
    await pedir(S.cm_p2, 'POST', `/api/governo/camara/${id}/voto`, { voto: 'sim' });
    await pedir(S.cm_p3, 'POST', `/api/governo/camara/${id}/voto`, { voto: 'nao' });
    await pool.query(`UPDATE governo_propostas SET derrubada_ate = NOW() - INTERVAL '1 minute' WHERE id = $1`, [id]);
    await lista(S.cm_p1);
    const p = await prop(id); assert.strictEqual(p.status, 'sancionada'); assert.strictEqual(p.sancao, 'derrubada');
    assert.strictEqual(await salario(rMin), 220000);
  });
  await caso('veto sem 2/3 é mantido e nada muda', async () => {
    const id = await aprovar({ tipo: 'salario', rank_id: rMin, valor: 230000, descricao: 'veto mantido' });
    await pedir(S.cm_pres, 'POST', `/api/governo/camara/${id}/sancao`, { acao: 'vetar' });
    await pedir(S.cm_p1, 'POST', `/api/governo/camara/${id}/voto`, { voto: 'sim' });
    await pedir(S.cm_p2, 'POST', `/api/governo/camara/${id}/voto`, { voto: 'nao' });
    await pool.query(`UPDATE governo_propostas SET derrubada_ate = NOW() - INTERVAL '1 minute' WHERE id = $1`, [id]);
    await lista(S.cm_p1);
    assert.strictEqual((await prop(id)).status, 'veto_mantido');
    assert.strictEqual(await salario(rMin), 220000);
  });

  console.log('\nPARLAMENTAR (Art. 10.12A) E OBRA');
  await caso('aumento do Parlamentar sancionado só vale na próxima temporada; redução vale na hora', async () => {
    await pool.query(`INSERT INTO game_config (key, value) VALUES ('temporada', '{"n": 3}') ON CONFLICT (cidade_id, key) DO UPDATE SET value = jsonb_set(game_config.value, '{n}', '3')`);
    const id = await aprovar({ tipo: 'salario', rank_id: rParl, valor: pad['Parlamentar'] + 20000, descricao: 'aumento do parlamento' });
    await pedir(S.cm_pres, 'POST', `/api/governo/camara/${id}/sancao`, { acao: 'sancionar' });
    assert.strictEqual((await prop(id)).status, 'aguarda_mandato');
    assert.strictEqual(await salario(rParl), pad['Parlamentar']);
    await pool.query(`UPDATE game_config SET value = jsonb_set(value, '{n}', '4') WHERE key = 'temporada'`);
    await lista(S.cm_p1);
    assert.strictEqual((await prop(id)).status, 'sancionada');
    assert.strictEqual(await salario(rParl), pad['Parlamentar'] + 20000);
    const red = await aprovar({ tipo: 'salario', rank_id: rParl, valor: 50000, descricao: 'reducao do parlamento' });
    await pedir(S.cm_pres, 'POST', `/api/governo/camara/${red}/sancao`, { acao: 'sancionar' });
    assert.strictEqual(await salario(rParl), 50000);
  });
  await caso('obra sancionada debita o tesouro e entra no extrato com o nº da proposta; sem saldo espera', async () => {
    await pool.query(`UPDATE corp_caixa SET saldo = 100 WHERE corporation_id = $1`, [GID]);
    const id = await aprovar({ tipo: 'obra', obra: 'sinalizacao', descricao: 'placas na avenida principal' });
    await pedir(S.cm_pres, 'POST', `/api/governo/camara/${id}/sancao`, { acao: 'sancionar' });
    assert.strictEqual((await prop(id)).status, 'sem_saldo');
    const valor = Number((await pool.query(`SELECT valor FROM governo_obras WHERE cidade_id = 1 AND chave = 'sinalizacao'`)).rows[0].valor);
    await pool.query(`UPDATE corp_caixa SET saldo = $2 WHERE corporation_id = $1`, [GID, valor + 7]);
    await lista(S.cm_p1);
    const p = await prop(id); assert.strictEqual(p.status, 'sancionada');
    assert.strictEqual(Number((await pool.query(`SELECT saldo FROM corp_caixa WHERE corporation_id = $1`, [GID])).rows[0].saldo), 7);
    const l = (await pool.query(`SELECT por, detalhe FROM corp_lancamentos WHERE id = $1`, [p.lancamento_id])).rows[0];
    assert.ok(l.por.includes('nº ' + id)); assert.ok(l.detalhe.descricao.includes('Proposta nº ' + id));
  });

  console.log('\n[24/10] PRESIDENTE ABRE, CORPORAÇÃO E EMPREGO CIVIL');
  const corpPM = (await pool.query(`SELECT c.id, r.id AS rank_id, COALESCE(r.salary,0)::bigint AS sal FROM corporations c JOIN ranks r ON r.corporation_id = c.id
     WHERE c.cidade_id = 1 AND c.is_active AND c.tipo NOT IN ('governo','faccao') ORDER BY r.salary DESC NULLS LAST LIMIT 1`)).rows[0];
  const aprovarESancionar = async (id) => {
    await pularDebate(id); await lista(S.cm_p1);
    assert.strictEqual((await pedir(S.cm_p1, 'POST', `/api/governo/camara/${id}/voto`, { voto: 'sim' })).s, 200);
    await fecharVotacao(id); await lista(S.cm_p1);
    assert.strictEqual((await prop(id)).status, 'aguardando_sancao');
    assert.strictEqual((await pedir(S.cm_pres, 'POST', `/api/governo/camara/${id}/sancao`, { acao: 'sancionar' })).s, 200);
  };
  await caso('Presidente da República abre projeto (antes era 403); Ministro continua sem abrir', async () => {
    const r = await pedir(S.cm_pres, 'POST', '/api/governo/camara', { tipo: 'obra', obra: 'sinalizacao', descricao: 'Placas novas na avenida' });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j));
    assert.strictEqual((await pedir(S.cm_min, 'POST', '/api/governo/camara', { tipo: 'obra', obra: 'sinalizacao', descricao: 'Placas novas na avenida' })).s, 403);
  });
  await caso('o Dono da cidade também abre (staff) e a lista diz pode_abrir', async () => {
    const l = await lista(DN); assert.strictEqual(l.j.pode_abrir, true);
    assert.ok(Array.isArray(l.j.corporacoes) && l.j.corporacoes.length > 0, 'sem corporações na lista');
    assert.strictEqual((await lista(S.cm_min)).j.pode_abrir, false);
  });
  await caso('salário de cargo de corporação: teto 2x, sancionado muda o ranks.salary', async () => {
    const teto = CAM.tetoRelativo(corpPM.sal);
    const alto = await pedir(S.cm_pres, 'POST', '/api/governo/camara', { tipo: 'salario_corp', rank_id: corpPM.rank_id, valor: teto + 1, descricao: 'aumento muito grande' });
    assert.strictEqual(alto.s, 400);
    const novo = Math.max(1, Math.floor(teto * 0.75));
    const r = await pedir(S.cm_pres, 'POST', '/api/governo/camara', { tipo: 'salario_corp', rank_id: corpPM.rank_id, valor: novo, descricao: 'corrige o salário da corporação' });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j));
    await aprovarESancionar(r.j.id);
    assert.strictEqual(await salario(corpPM.rank_id), novo);
    assert.strictEqual((await prop(r.j.id)).status, 'sancionada');
    await pool.query(`UPDATE ranks SET salary = $2 WHERE id = $1`, [corpPM.rank_id, corpPM.sal]);
  });
  await caso('teto de emprego civil: sancionado muda o governo_empregos', async () => {
    const e = (await pool.query(`SELECT emprego, teto FROM governo_empregos WHERE cidade_id = 1 AND emprego = 'Lixeiro'`)).rows[0];
    const r = await pedir(S.cm_p3, 'POST', '/api/governo/camara', { tipo: 'emprego', emprego: 'Lixeiro', valor: Number(e.teto) + 5, descricao: 'gari ganha pouco por saco' });
    assert.strictEqual(r.s, 200, JSON.stringify(r.j));
    await aprovarESancionar(r.j.id);
    assert.strictEqual(Number((await pool.query(`SELECT teto FROM governo_empregos WHERE cidade_id = 1 AND emprego = 'Lixeiro'`)).rows[0].teto), Number(e.teto) + 5);
    await pool.query(`UPDATE governo_empregos SET teto = $1 WHERE cidade_id = 1 AND emprego = 'Lixeiro'`, [e.teto]);
  });
  await caso('cargo de corporação de OUTRA cidade é recusado', async () => {
    let c2 = (await pool.query(`SELECT id FROM cidades WHERE slug = 'teste-sal2'`)).rows[0];
    if (!c2) c2 = (await pool.query(`INSERT INTO cidades (slug, nome, sigla, tipo, status, loja_prefixo, dono_user_id) VALUES ('teste-sal2','Sal2','SL2','comunidade','ativa','SL2',$1) RETURNING id`, [dono])).rows[0];
    const cc = (await pool.query(`INSERT INTO corporations (name, slug, tipo, cidade_id) VALUES ('Corp Fora','corp-fora-' || floor(random()*1e9)::text,'corp',$1) RETURNING id`, [c2.id])).rows[0].id;
    const rr = (await pool.query(`INSERT INTO ranks (corporation_id, name, level, salary) VALUES ($1,'Soldado',1,1000) RETURNING id`, [cc])).rows[0].id;
    assert.strictEqual((await pedir(S.cm_pres, 'POST', '/api/governo/camara', { tipo: 'salario_corp', rank_id: rr, valor: 1500, descricao: 'cargo de outra cidade' })).s, 400);
  });
  await caso('painel do Governo mostra os salários de todas as corporações e pode_propor', async () => {
    const g = await pedir(S.cm_pres, 'GET', '/api/governo');
    assert.strictEqual(g.s, 200); assert.strictEqual(g.j.pode_propor, true);
    assert.ok(g.j.corporacoes.length > 0 && g.j.corporacoes[0].cargos.length > 0);
    assert.ok(!g.j.corporacoes.some(c => c.tipo === 'faccao' || c.tipo === 'governo'));
    assert.strictEqual((await pedir(S.cm_min, 'GET', '/api/governo')).j.pode_propor, false);
  });

  console.log('\nISOLAMENTO');
  await caso('outra cidade não vê as propostas da Santa Fé', async () => {
    let c2 = (await pool.query(`SELECT id FROM cidades WHERE slug = 'teste-sal2'`)).rows[0];
    if (!c2) c2 = (await pool.query(`INSERT INTO cidades (slug, nome, sigla, tipo, status, loja_prefixo, dono_user_id) VALUES ('teste-sal2','Sal2','SL2','comunidade','ativa','SL2',$1) RETURNING id`, [dono])).rows[0];
    const c = await sessao(dono, c2.id);
    const r = await lista(c);
    assert.strictEqual(r.s, 200, JSON.stringify(r.j)); assert.strictEqual(r.j.propostas.length, 0);
    assert.ok((await lista(DN)).j.propostas.length > 0);
  });

  console.log('\nNÚCLEO');
  await caso('resultado(): maioria simples, empate e derrubada 2/3', async () => {
    assert.strictEqual(CAM.resultado(0, 0), 'recusada'); assert.strictEqual(CAM.resultado(3, 2), 'aprovada');
    assert.strictEqual(CAM.resultado(2, 2), 'recusada'); assert.strictEqual(CAM.resultado(2, 2, true), 'aprovada'); assert.strictEqual(CAM.resultado(2, 2, false), 'recusada');
    assert.strictEqual(CAM.derruba(2, 1), true); assert.strictEqual(CAM.derruba(3, 2), false); assert.strictEqual(CAM.derruba(0, 0), false);
  });

  // volta os salários do Governo pro padrão no banco de teste
  for (const [n, , s] of GOV.CARGOS_PADRAO) await pool.query(`UPDATE ranks SET salary = $3 WHERE corporation_id = $1 AND name = $2`, [GID, n, s]);
  console.log(`\n${ok} ok, ${falhou} falharam`);
  await pool.end();
  process.exit(falhou ? 1 : 0);
})();
