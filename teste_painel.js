// Teste do painel admin contra um Postgres de verdade.
// Prova, sem depender do Railway:
//   1. a migração roda duas vezes sem quebrar (idempotência)
//   2. a matriz cargo x poder bate com a lista que o Julio mandou
//   3. cada cargo é BARRADO nas rotas que não são dele (403 de verdade, no back)
//   4. apagar jogador não ressuscita no boot seguinte  <- o bug que ele relatou
//   5. o wipe apaga tudo em transação e trava o backfill
process.env.DATABASE_URL = 'postgres://postgres@/postgres?host=/tmp&port=5433';

const { Pool } = require('pg');
const express = require('express');
const perm = require('./src/permissoes');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let falhas = 0;
const ok  = (c, m) => { console.log((c ? '  OK   ' : '  FALHA') + ' | ' + m); if (!c) falhas++; };
const tit = m => console.log('\n=== ' + m + ' ===');

// ---------------------------------------------------------------- schema
// Mesmas tabelas que o boot do src/index.js cria.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, discord_id VARCHAR(32) UNIQUE NOT NULL, discord_username VARCHAR(128),
  discord_avatar VARCHAR(256), roblox_id BIGINT UNIQUE, roblox_username VARCHAR(64), email VARCHAR(256),
  is_admin BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS corporations (id SERIAL PRIMARY KEY, name VARCHAR(128), slug VARCHAR(128) UNIQUE,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL, is_active BOOLEAN DEFAULT true);
CREATE TABLE IF NOT EXISTS corp_managers (id SERIAL PRIMARY KEY, corporation_id INTEGER REFERENCES corporations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, added_at TIMESTAMP DEFAULT NOW(), UNIQUE(corporation_id, user_id));
CREATE TABLE IF NOT EXISTS ranks (id SERIAL PRIMARY KEY, corporation_id INTEGER REFERENCES corporations(id) ON DELETE CASCADE, name VARCHAR(64), level INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS members (id SERIAL PRIMARY KEY, corporation_id INTEGER, user_id INTEGER, rank_id INTEGER, UNIQUE(corporation_id, user_id));
CREATE TABLE IF NOT EXISTS game_servers (job_id VARCHAR(64) PRIMARY KEY, place_id BIGINT, players JSONB DEFAULT '[]', catalog JSONB, updated_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS game_commands (id SERIAL PRIMARY KEY, tipo VARCHAR(48) NOT NULL, target_roblox_id BIGINT, target_name VARCHAR(64),
  payload JSONB DEFAULT '{}', job_id VARCHAR(64), status VARCHAR(16) DEFAULT 'pending', result TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT NOW(), sent_at TIMESTAMP, executed_at TIMESTAMP);
CREATE TABLE IF NOT EXISTS game_logs (id SERIAL PRIMARY KEY, tipo VARCHAR(32) NOT NULL, jogador VARCHAR(64), alvo VARCHAR(64),
  detalhe JSONB DEFAULT '{}', job_id VARCHAR(64), ocorrido_em TIMESTAMP, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS game_config (key VARCHAR(32) PRIMARY KEY, value JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS admin_audit (id SERIAL PRIMARY KEY, admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_nome VARCHAR(128), acao VARCHAR(64) NOT NULL, detalhe JSONB DEFAULT '{}', created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS game_players (roblox_id BIGINT PRIMARY KEY, nome VARCHAR(64), primeira_vez TIMESTAMP DEFAULT NOW(),
  ultima_vez TIMESTAMP DEFAULT NOW(), visitas INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS game_item_fila (id SERIAL PRIMARY KEY, roblox_id BIGINT NOT NULL, item VARCHAR(64) NOT NULL, qtd INTEGER DEFAULT 1,
  criado_por INTEGER REFERENCES users(id) ON DELETE SET NULL, criado_em TIMESTAMP DEFAULT NOW(), entregue_em TIMESTAMP);
CREATE TABLE IF NOT EXISTS aparelhos (uid VARCHAR(64) PRIMARY KEY, numero VARCHAR(24), dono_roblox_id BIGINT, dono_nome VARCHAR(64), ativo BOOLEAN DEFAULT true);
CREATE TABLE IF NOT EXISTS aparelho_donos (id SERIAL PRIMARY KEY, aparelho_uid VARCHAR(64), de_roblox_id BIGINT, para_roblox_id BIGINT);
CREATE TABLE IF NOT EXISTS celular_contatos (id SERIAL PRIMARY KEY, dono_numero VARCHAR(24), numero VARCHAR(24));
CREATE TABLE IF NOT EXISTS celular_mensagens (id SERIAL PRIMARY KEY, de_numero VARCHAR(24), para_numero VARCHAR(24), par_key VARCHAR(49), texto VARCHAR(300));
CREATE TABLE IF NOT EXISTS deepweb_posts (id SERIAL PRIMARY KEY, chip_nome VARCHAR(32), autor_numero VARCHAR(24), autor_roblox_id BIGINT, corpo VARCHAR(200));
`;

// A migração nova, copiada verbatim do src/index.js.
const MIGRACAO = `ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_cargo VARCHAR(24);`;

// A migracao do boot que tira o admin de quem era "dono por banco", copiada do index.js.
async function migracaoDonoFixo() {
  const donos = perm.DONO_DISCORD;
  await pool.query(
    `UPDATE users SET is_admin = true, updated_at = NOW()
     WHERE LOWER(TRIM(COALESCE(discord_username, ''))) = ANY($1::text[])`, [donos]);
  const r = await pool.query(
    `UPDATE users SET is_admin = false, admin_cargo = NULL, updated_at = NOW()
     WHERE is_admin = true AND admin_cargo IS NULL
       AND LOWER(TRIM(COALESCE(discord_username, ''))) <> ALL($1::text[])`, [donos]);
  return r.rowCount;
}

// O backfill do boot, também copiado verbatim (é o que ressuscitava jogador).
async function backfillDoBoot() {
  let desde = '1970-01-01';
  const w = await pool.query(`SELECT value->>'em' AS em FROM game_config WHERE key = 'wipe_em'`);
  if (w.rows[0] && w.rows[0].em) desde = w.rows[0].em;
  await pool.query(`
    INSERT INTO game_players (roblox_id, nome, primeira_vez, ultima_vez, visitas)
    SELECT (detalhe->>'userId')::bigint, MAX(jogador), MIN(COALESCE(ocorrido_em, created_at)),
           MAX(COALESCE(ocorrido_em, created_at)), COUNT(*)
    FROM game_logs
    WHERE tipo = 'entrou' AND detalhe->>'userId' ~ '^[0-9]+$'
      AND COALESCE(ocorrido_em, created_at) > $1::timestamptz
    GROUP BY (detalhe->>'userId')::bigint
    ON CONFLICT (roblox_id) DO UPDATE SET
      nome = COALESCE(EXCLUDED.nome, game_players.nome),
      primeira_vez = LEAST(game_players.primeira_vez, EXCLUDED.primeira_vez),
      ultima_vez = GREATEST(game_players.ultima_vez, EXCLUDED.ultima_vez),
      visitas = GREATEST(game_players.visitas, EXCLUDED.visitas);
  `, [desde]);
}

// ---------------------------------------------------------------- servidor de teste
let USUARIO_ATUAL = null;
function subirApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = USUARIO_ATUAL; next(); });
  app.use('/api/admin', require('./src/routes/admin-api'));
  return new Promise(r => { const s = app.listen(0, () => r(s)); });
}
let BASE;
async function req(metodo, caminho, corpo) {
  const r = await fetch(BASE + caminho, {
    method: metodo, headers: { 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined, redirect: 'manual',
  });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j };
}

// ---------------------------------------------------------------- dados
async function semear() {
  await pool.query(`TRUNCATE users, corporations, corp_managers, ranks, members, game_players, game_item_fila, game_logs, game_commands, game_config,
    admin_audit, aparelhos, aparelho_donos, celular_contatos, celular_mensagens, deepweb_posts, game_servers RESTART IDENTITY CASCADE`);
  const u = {};
  const cria = async (nome, cargo, admin) => {
    const r = await pool.query(
      'INSERT INTO users (discord_id, discord_username, is_admin, admin_cargo) VALUES ($1,$2,$3,$4) RETURNING *',
      ['d_' + nome, nome, admin, cargo]);
    u[nome] = r.rows[0];
  };
  await cria('julio14690', null, true);        // o DONO: reconhecido pelo usuario do Discord
  await cria('exdono', null, true);            // era "dono por banco" (is_admin + cargo NULL)
  await cria('estagiario', 'estagiario', true);
  await cria('diretor', 'diretor', true);
  await cria('supervisor', 'supervisor', true);
  await cria('administrador', 'administrador', true);
  await cria('moderador', 'moderador', true);
  await cria('zé', null, false);               // não é admin
  return u;
}

// ---------------------------------------------------------------- testes
(async () => {
  tit('1. Migração roda duas vezes (idempotência)');
  await pool.query(SCHEMA);
  await pool.query(MIGRACAO);
  await pool.query(MIGRACAO);
  const col = await pool.query(`SELECT data_type FROM information_schema.columns WHERE table_name='users' AND column_name='admin_cargo'`);
  ok(col.rows.length === 1, 'coluna users.admin_cargo existe depois de 2 rodadas');

  const srv = await subirApp();
  BASE = 'http://127.0.0.1:' + srv.address().port + '/api/admin';
  const U = await semear();

  tit('2. Matriz cargo x poder vs. a lista do Julio');
  const esperado = {
    estagiario:    { tem: ['ver_registro', 'mensagem', 'expulsar', 'item'],                 naoTem: ['banir', 'noclip', 'item_todos', 'servidor', 'wipe', 'registro', 'admins'] },
    moderador:     { tem: ['banir', 'expulsar', 'item'],                                   naoTem: ['noclip', 'item_todos', 'servidor', 'wipe', 'registro'] },
    administrador: { tem: ['banir', 'expulsar', 'item', 'noclip'],                          naoTem: ['item_todos', 'servidor', 'wipe', 'registro'] },
    supervisor:    { tem: ['banir', 'expulsar', 'item', 'item_todos', 'servidor', 'noclip', 'economia', 'teleporte', 'corp'], naoTem: ['wipe', 'registro', 'admins'] },
    diretor:       { tem: ['banir', 'expulsar', 'item', 'item_todos', 'servidor', 'noclip', 'registro', 'admins'], naoTem: ['wipe'] },
    dono:          { tem: ['wipe', 'admins', 'registro', 'item_todos'],                     naoTem: [] },
  };
  for (const [cargo, e] of Object.entries(esperado)) {
    // o Dono agora e reconhecido pelo usuario do Discord, nao por cargo NULL
    const fake = cargo === 'dono'
      ? { discord_username: 'julio14690', is_admin: true }
      : { discord_username: 'staff_' + cargo, is_admin: true, admin_cargo: cargo };
    for (const p of e.tem)    ok(perm.pode(fake, p),  cargo + ' TEM ' + p);
    for (const p of e.naoTem) ok(!perm.pode(fake, p), cargo + ' NÃO tem ' + p);
  }

  tit('2b. DONO é conta fixa, não vem do banco');
  ok(perm.cargoDe({ discord_username: 'julio14690', is_admin: false }) === 'dono', 'julio14690 é DONO mesmo com is_admin false no banco');
  ok(perm.cargoDe({ discord_username: '  JULIO14690 ', is_admin: false }) === 'dono', 'reconhece com maiúscula e espaço sobrando');
  ok(perm.cargoDe({ discord_username: 'fulano', is_admin: true, admin_cargo: null }) === 'estagiario',
    'admin SEM cargo cai no MENOR degrau, não no maior — é o bug antigo invertido');
  ok(perm.cargoDe({ discord_username: 'fulano', is_admin: true, admin_cargo: 'dono' }) === 'estagiario',
    'ninguém vira Dono escrevendo "dono" no banco');
  ok(perm.cargoDe({ discord_username: 'fulano', is_admin: false, admin_cargo: 'diretor' }) === null, 'sem is_admin não é staff, mesmo com cargo');
  ok(!perm.podeDarCargo({ discord_username: 'julio14690' }, 'dono'), 'nem o Dono consegue conceder Dono pelo painel');

  tit('2c. A migração do boot tira o admin de quem era "dono por banco"');
  const rebaixados = await migracaoDonoFixo();
  ok(rebaixados === 1, 'rebaixou exatamente o exdono (' + rebaixados + ')');
  const ex = await pool.query(`SELECT is_admin, admin_cargo FROM users WHERE discord_username = 'exdono'`);
  ok(ex.rows[0].is_admin === false, 'o exdono perdeu o admin inteiro, como o Julio pediu');
  const ju = await pool.query(`SELECT is_admin FROM users WHERE discord_username = 'julio14690'`);
  ok(ju.rows[0].is_admin === true, 'o julio14690 continua com is_admin (rotas antigas ainda olham essa coluna)');
  const dir = await pool.query(`SELECT is_admin, admin_cargo FROM users WHERE discord_username = 'diretor'`);
  ok(dir.rows[0].is_admin === true && dir.rows[0].admin_cargo === 'diretor', 'quem tinha cargo de verdade não foi tocado');
  ok((await migracaoDonoFixo()) === 0, 'rodar de novo não rebaixa mais ninguém (idempotente)');
  // recarrega os usuarios em memoria depois da migracao
  for (const nome of Object.keys(U)) {
    const q = await pool.query('SELECT * FROM users WHERE id = $1', [U[nome].id]);
    if (q.rows[0]) U[nome] = q.rows[0];
  }

  tit('3. O BACK barra de verdade (não só o botão sumir)');
  USUARIO_ATUAL = U['moderador'];
  ok((await req('POST', '/command', { tipo: 'noclip', target_roblox_id: 1, payload: { ativar: true } })).status === 403, 'moderador levando 403 no noclip');
  ok((await req('POST', '/registro/dar-todos', { tipo: 'item_add', item: 'pao' })).status === 403, 'moderador levando 403 no dar-todos');
  ok((await req('POST', '/registro/wipe', { confirm: 'WIPE' })).status === 403, 'moderador levando 403 no wipe');
  USUARIO_ATUAL = U['administrador'];
  ok((await req('POST', '/registro/dar-todos', { tipo: 'item_add', item: 'pao' })).status === 403, 'administrador levando 403 no dar-todos');
  ok((await req('POST', '/command', { tipo: 'hora', payload: { clock: 12 } })).status === 403, 'administrador levando 403 na hora');
  USUARIO_ATUAL = U['supervisor'];
  ok((await req('POST', '/registro/wipe', { confirm: 'WIPE' })).status === 403, 'supervisor levando 403 no wipe');
  ok((await req('GET', '/users')).status === 403, 'supervisor levando 403 em gerir admins');
  const cl = await req('POST', '/command', { tipo: 'clima', payload: { chuva: 2 } });
  ok(cl.status === 200, 'supervisor MUDA o clima (' + cl.status + ')');
  USUARIO_ATUAL = U['diretor'];
  ok((await req('POST', '/registro/wipe', { confirm: 'WIPE' })).status === 403, 'diretor levando 403 no wipe — era o pedido');
  ok((await req('GET', '/users')).status === 200, 'diretor gere admins');

  tit('4. Escada de admin: ninguém alcança quem está acima');
  USUARIO_ATUAL = U['diretor'];
  ok((await req('POST', '/users/' + U['julio14690'].id + '/cargo', { cargo: 'moderador' })).status === 403, 'diretor NÃO rebaixa o dono');
  ok((await req('POST', '/users/' + U['diretor'].id + '/cargo', { cargo: 'moderador' })).status === 400, 'diretor não mexe em si mesmo');
  ok((await req('POST', '/users/' + U['moderador'].id + '/cargo', { cargo: 'diretor' })).status === 403, 'diretor não promove ninguém a diretor (seu próprio nível)');
  const promo = await req('POST', '/users/' + U['moderador'].id + '/cargo', { cargo: 'supervisor' });
  ok(promo.status === 200, 'diretor promove moderador a supervisor');
  const chk = await pool.query('SELECT admin_cargo FROM users WHERE id=$1', [U['moderador'].id]);
  ok(chk.rows[0].admin_cargo === 'supervisor', 'gravou supervisor no banco');
  USUARIO_ATUAL = U['julio14690'];
  ok((await req('POST', '/users/' + U['diretor'].id + '/cargo', { cargo: null })).status === 200, 'dono tira o admin do diretor');
  await pool.query('UPDATE users SET is_admin=true, admin_cargo=$1 WHERE id=$2', ['diretor', U['diretor'].id]);

  tit('5. O BUG: apagar jogador e ele voltar no boot seguinte');
  await pool.query(`INSERT INTO game_players (roblox_id, nome) VALUES (111,'Ana'), (222,'Bia'), (333,'Caio')`);
  await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe) VALUES
    ('entrou','Ana','{"userId":"111"}'), ('entrou','Bia','{"userId":"222"}'), ('entrou','Caio','{"userId":"333"}')`);
  await pool.query(`INSERT INTO game_item_fila (roblox_id, item, qtd, entregue_em) VALUES (111,'pao',1,NOW())`);
  await pool.query(`INSERT INTO aparelhos (uid, numero, dono_roblox_id) VALUES ('ap1','5551',111)`);

  USUARIO_ATUAL = U['julio14690'];
  const ap = await req('POST', '/registro/apagar', { roblox_id: 111 });
  ok(ap.status === 200 && ap.body.apagados === 1, 'apagou a Ana');
  ok(ap.body.logs === 1, 'levou o log de entrada junto (' + ap.body.logs + ')');
  ok(ap.body.aparelhos === 1, 'levou o aparelho dela junto');
  await backfillDoBoot();   // <- simula o deploy/restart do Railway
  const volta = await pool.query('SELECT roblox_id FROM game_players ORDER BY roblox_id');
  ok(!volta.rows.some(r => Number(r.roblox_id) === 111), 'depois do boot a Ana NÃO voltou  <<< era este o bug');
  ok(volta.rows.length === 2, 'Bia e Caio continuam lá (' + volta.rows.length + ')');

  // prova de que o bug existia mesmo: sem apagar o log, o backfill ressuscita
  await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe) VALUES ('entrou','Ana','{"userId":"111"}')`);
  await pool.query('DELETE FROM game_players WHERE roblox_id = 111');
  await backfillDoBoot();
  const zumbi = await pool.query('SELECT 1 FROM game_players WHERE roblox_id = 111');
  ok(zumbi.rows.length === 1, 'controle: apagando SÓ o game_players (jeito antigo), ela ressuscita mesmo');

  tit('6. Aviso de jogador online');
  await pool.query(`INSERT INTO game_servers (job_id, players, updated_at) VALUES ('job1','[{"userId":222,"name":"Bia"}]',NOW())`);
  const ap2 = await req('POST', '/registro/apagar', { roblox_ids: [222, 333] });
  ok(ap2.body.online === 1, 'avisou que 1 dos apagados está online e vai voltar');

  tit('7. Wipe = TEMPORADA NOVA, em transação');
  await pool.query(`INSERT INTO game_players (roblox_id, nome) VALUES (111,'Ana'),(222,'Bia') ON CONFLICT (roblox_id) DO NOTHING`);
  await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe) VALUES ('entrou','Ana','{"userId":"111"}')`);
  await pool.query(`INSERT INTO game_item_fila (roblox_id, item) VALUES (111,'pao')`);
  await pool.query(`INSERT INTO celular_mensagens (de_numero,para_numero,par_key,texto) VALUES ('1','2','1-2','oi')`);
  await pool.query(`INSERT INTO deepweb_posts (chip_nome, corpo) VALUES ('corvo_71','teste')`);
  await pool.query(`INSERT INTO aparelhos (uid, numero, dono_roblox_id) VALUES ('ap2','5552',222)`);
  await pool.query(`INSERT INTO celular_contatos (dono_numero, numero) VALUES ('1','2')`);
  await pool.query(`INSERT INTO corporations (name, slug) VALUES ('Policia Civil','policia-civil')`);
  await pool.query(`INSERT INTO ranks (corporation_id, name, level) SELECT id,'Delegado',18 FROM corporations WHERE slug='policia-civil'`);
  await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) SELECT c.id, $1, r.id FROM corporations c JOIN ranks r ON r.corporation_id=c.id WHERE c.slug='policia-civil'`, [U['julio14690'].id]);
  await pool.query(`INSERT INTO game_config (key, value) VALUES ('temporada','{"n":1}') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`);

  USUARIO_ATUAL = U['julio14690'];
  ok((await req('POST', '/registro/wipe', { confirm: 'NAO' })).status === 400, 'wipe sem digitar WIPE é recusado');
  const w = await req('POST', '/registro/wipe', { confirm: 'WIPE' });
  ok(w.status === 200, 'wipe respondeu 200');

  for (const t of ['game_players', 'game_item_fila', 'game_logs', 'celular_mensagens', 'celular_contatos', 'deepweb_posts', 'aparelhos', 'aparelho_donos']) {
    const n = await pool.query('SELECT COUNT(*)::int n FROM ' + t);
    ok(n.rows[0].n === 0, t + ' zerada');
  }
  // a auditoria tambem e apagada, mas o registro DO PROPRIO WIPE entra depois do
  // commit -- de proposito, senao o wipe apagaria a prova de que aconteceu
  const aud = await pool.query('SELECT acao FROM admin_audit');
  ok(aud.rows.length === 1 && aud.rows[0].acao === 'registro:wipe', 'auditoria zerada, sobrando só o registro do próprio wipe');

  tit('7b. O que o wipe NÃO pode tocar');
  for (const t of ['corporations', 'ranks', 'members', 'users']) {
    const n = await pool.query('SELECT COUNT(*)::int n FROM ' + t);
    ok(n.rows[0].n > 0, t + ' INTACTA (' + n.rows[0].n + ') — pedido explícito do Julio');
  }
  const eu = await pool.query('SELECT is_admin, admin_cargo FROM users WHERE id=$1', [U['julio14690'].id]);
  ok(eu.rows[0].is_admin === true && eu.rows[0].admin_cargo === null, 'o Dono continua Dono depois do wipe');

  tit('7c. A temporada virou — é isso que zera o save de todo mundo');
  ok(w.body.temporada === 2, 'temporada 1 -> 2 (resposta: ' + w.body.temporada + ')');
  const tp = await pool.query(`SELECT value->>'n' n FROM game_config WHERE key='temporada'`);
  ok(Number(tp.rows[0].n) === 2, 'gravada no game_config, que é o que o jogo lê');
  ok(w.body.derrubados === 1, 'contou 1 jogador pra derrubar (' + w.body.derrubados + ')');
  const cmds = await pool.query(`SELECT tipo, payload, job_id FROM game_commands`);
  ok(cmds.rows.length === 1 && cmds.rows[0].tipo === 'wipe', 'sobrou exatamente 1 comando e é o wipe (os antigos foram apagados ANTES dele nascer)');
  ok(Number(cmds.rows[0].payload.temporada) === 2, 'o comando leva a temporada 2 pro jogo');
  const w2 = await req('POST', '/registro/wipe', { confirm: 'WIPE' });
  ok(w2.body.temporada === 3, 'wipe de novo -> temporada 3 (sempre sobe, nunca reusa)');

  tit('7d. Wipe que explode no meio não apaga NADA (transação)');
  await pool.query(`INSERT INTO game_players (roblox_id, nome) VALUES (777,'Teste')`);
  await pool.query(`INSERT INTO celular_mensagens (de_numero,para_numero,par_key,texto) VALUES ('9','8','8-9','sobrevive?')`);
  // gatilho que estoura: celular_mensagens é apagada DEPOIS de game_players
  await pool.query(`CREATE OR REPLACE FUNCTION explode() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'falha de proposito'; END; $$ LANGUAGE plpgsql`);
  await pool.query(`CREATE TRIGGER t_explode BEFORE DELETE ON celular_mensagens FOR EACH ROW EXECUTE FUNCTION explode()`);
  const tAntes = (await pool.query(`SELECT value->>'n' n FROM game_config WHERE key='temporada'`)).rows[0].n;
  const cmdAntes = (await pool.query(`SELECT COUNT(*)::int n FROM game_commands WHERE tipo='wipe'`)).rows[0].n;

  const wf = await req('POST', '/registro/wipe', { confirm: 'WIPE' });
  ok(wf.status === 500, 'o wipe falhou, como o teste queria (' + wf.status + ')');
  ok((await pool.query('SELECT COUNT(*)::int n FROM game_players')).rows[0].n === 1, 'o jogador NÃO foi apagado — rollback funcionou');
  const tDepois = (await pool.query(`SELECT value->>'n' n FROM game_config WHERE key='temporada'`)).rows[0].n;
  ok(tDepois === tAntes, 'a temporada NÃO virou num wipe que falhou (' + tAntes + ' -> ' + tDepois + ')');
  ok((await pool.query(`SELECT COUNT(*)::int n FROM game_commands WHERE tipo='wipe'`)).rows[0].n === cmdAntes, 'e nenhum comando de derrubar foi criado à toa');

  await pool.query('DROP TRIGGER t_explode ON celular_mensagens');
  await pool.query('DELETE FROM celular_mensagens');
  await pool.query('DELETE FROM game_players');

  tit('8. Depois do wipe, o backfill não repõe nada');
  await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe, created_at) VALUES ('entrou','Ana','{"userId":"111"}', NOW() - INTERVAL '2 days')`);
  await backfillDoBoot();
  ok((await pool.query('SELECT COUNT(*)::int n FROM game_players')).rows[0].n === 0, 'log velho (anterior ao wipe) NÃO repovoa o registro');
  await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe) VALUES ('entrou','Novo','{"userId":"999"}')`);
  await backfillDoBoot();
  ok((await pool.query('SELECT COUNT(*)::int n FROM game_players')).rows[0].n === 1, 'mas quem entrou DEPOIS do wipe entra normal (temporada nova)');

  tit('9. Comando novo sem poder mapeado é recusado, não liberado');
  const semMapa = Object.keys(perm.PODER_DO_COMANDO);
  const todosComandos = ['dinheiro_set','dinheiro_add','banco_set','item_add','item_remove','emprego','level_set','slots_set',
    'tp_local','tp_jogador','tp_coord','trazer','curar','matar','kick','mensagem','carro_add','carro_remove','resetar_dados',
    'corp_refresh','noclip','ban','unban','hora','clima','anuncio'];
  const faltando = todosComandos.filter(c => !semMapa.includes(c));
  ok(faltando.length === 0, 'todo comando do painel tem poder definido' + (faltando.length ? ' — FALTAM: ' + faltando.join(', ') : ''));

  tit('9b. Sair da corporação por conta própria');
  {
    const express2 = require('express');
    const app2 = express2();
    app2.use(express2.json());
    app2.use((rq, _rs, nx) => { rq.user = USUARIO_ATUAL; nx(); });
    app2.use('/api/corps', require('./src/routes/corps-api'));
    const s2 = await new Promise(r => { const x = app2.listen(0, () => r(x)); });
    const base2 = 'http://127.0.0.1:' + s2.address().port + '/api/corps';
    const post = async (caminho, corpo) => {
      const r = await fetch(base2 + caminho, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}), redirect: 'manual' });
      let j = null; try { j = await r.json(); } catch (e) {}
      return { status: r.status, body: j };
    };

    // monta: corp com dono (diretor), um membro comum (moderador) e um co-gerente (supervisor)
    await pool.query(`INSERT INTO corporations (name, slug, owner_id) VALUES ('Mecanica','mecanica',$1)`, [U['diretor'].id]);
    const cid = (await pool.query(`SELECT id FROM corporations WHERE slug='mecanica'`)).rows[0].id;
    await pool.query(`INSERT INTO ranks (corporation_id, name, level) VALUES ($1,'Aprendiz',1)`, [cid]);
    const rid = (await pool.query(`SELECT id FROM ranks WHERE corporation_id=$1`, [cid])).rows[0].id;
    await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3)`, [cid, U['moderador'].id, rid]);
    await pool.query(`INSERT INTO corp_managers (corporation_id, user_id) VALUES ($1,$2)`, [cid, U['supervisor'].id]);

    USUARIO_ATUAL = U['moderador'];
    const r1 = await post('/' + cid + '/sair');
    ok(r1.status === 200, 'membro comum consegue sair (' + r1.status + ')');
    ok((await pool.query('SELECT COUNT(*)::int n FROM members WHERE corporation_id=$1 AND user_id=$2', [cid, U['moderador'].id])).rows[0].n === 0, 'saiu mesmo do members');

    const r2 = await post('/' + cid + '/sair');
    ok(r2.status === 400, 'sair duas vezes dá erro claro, não 500 (' + r2.status + ')');

    USUARIO_ATUAL = U['diretor'];
    const r3 = await post('/' + cid + '/sair');
    ok(r3.status === 400 && /dono/i.test(r3.body.error || ''), 'o DONO não consegue sair — a corp ficaria órfã');
    ok((await pool.query('SELECT owner_id FROM corporations WHERE id=$1', [cid])).rows[0].owner_id === U['diretor'].id, 'e continua sendo dono');

    USUARIO_ATUAL = U['supervisor'];
    const r4 = await post('/' + cid + '/sair');
    ok(r4.status === 200 && r4.body.era_gerente === true, 'co-gerente sai e perde o co-gerenciamento junto');
    ok((await pool.query('SELECT COUNT(*)::int n FROM corp_managers WHERE corporation_id=$1 AND user_id=$2', [cid, U['supervisor'].id])).rows[0].n === 0, 'saiu do corp_managers');

    USUARIO_ATUAL = U['estagiario'];
    const r5 = await post('/9999/sair');
    ok(r5.status === 404, 'corporação inexistente dá 404');

    // o ponto que mais importa: ninguem usa isto pra expulsar outra pessoa
    await pool.query(`INSERT INTO members (corporation_id, user_id, rank_id) VALUES ($1,$2,$3)`, [cid, U['moderador'].id, rid]);
    USUARIO_ATUAL = U['estagiario'];
    const r6 = await post('/' + cid + '/sair', { user_id: U['moderador'].id, corporation_id: cid });
    ok(r6.status === 400, 'mandar o id de OUTRA pessoa no corpo não expulsa ela (' + r6.status + ')');
    ok((await pool.query('SELECT COUNT(*)::int n FROM members WHERE corporation_id=$1 AND user_id=$2', [cid, U['moderador'].id])).rows[0].n === 1, 'o moderador continua na corp — o id vem da SESSÃO');

    s2.close();
  }

  tit('9c. Corporação: Estagiário não manda em corp nenhuma');
  ok(!perm.pode(U['estagiario'], 'corp'), 'estagiário NÃO tem o poder corp');
  ok(!perm.pode(U['moderador'], 'corp') && !perm.pode(U['administrador'], 'corp'), 'moderador e administrador também não');
  ok(perm.pode(U['supervisor'], 'corp') && perm.pode(U['julio14690'], 'corp'), 'supervisor pra cima, sim');

  tit('10. O painel (admin.ejs): nada de função duplicada nem botão órfão');
  // [19/09] Este teste nasceu de um bug REAL: eu criei uma setCargo(id, cargo, el)
  // pro cargo de ADMIN sem ver que já existia uma setCargo(remover) pro cargo em
  // CORPORAÇÃO. As duas são `function` no mesmo escopo, então a de baixo apagou a
  // de cima, e o seletor de cargo da aba Usuários caía na função errada e
  // respondia "Selecione um usuário". Sintaxe válida, tudo compilando, e quebrado.
  {
    const fs = require('fs');
    const html = fs.readFileSync(__dirname + '/src/views/admin.ejs', 'utf8');
    const js = (html.match(/<script>([\s\S]*)<\/script>/) || [])[1] || '';
    ok(js.length > 1000, 'achei o script do painel (' + js.length + ' chars)');

    let parseOk = true;
    try { new Function(js); } catch (e) { parseOk = false; }
    ok(parseOk, 'o JavaScript do painel faz parse');

    const nomes = {};
    const re = /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm;
    let m; while ((m = re.exec(js))) { nomes[m[1]] = (nomes[m[1]] || 0) + 1; }
    const dup = Object.keys(nomes).filter(n => nomes[n] > 1);
    ok(dup.length === 0, 'nenhuma função declarada duas vezes' + (dup.length ? ' — DUPLICADAS: ' + dup.join(', ') : ''));

    const chamadas = new Set();
    const re2 = /on(?:click|change)=\\?["']([A-Za-z_$][\w$]*)\(/g;
    let m2; while ((m2 = re2.exec(html))) chamadas.add(m2[1]);
    const orfaos = [...chamadas].filter(n => !nomes[n]);
    ok(chamadas.size > 10, 'achei os handlers dos botões (' + chamadas.size + ')');
    ok(orfaos.length === 0, 'todo botão aponta pra uma função que existe' + (orfaos.length ? ' — ÓRFÃOS: ' + orfaos.join(', ') : ''));

    ok(js.includes('setCargoAdmin'), 'o seletor de cargo de admin usa o nome próprio setCargoAdmin');
  }

  srv.close(); await pool.end();
  console.log('\n' + (falhas ? '### ' + falhas + ' FALHA(S)' : '### TUDO PASSOU'));
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('EXPLODIU:', e); process.exit(1); });
