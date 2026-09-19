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
CREATE TABLE IF NOT EXISTS corporations (id SERIAL PRIMARY KEY, name VARCHAR(128), slug VARCHAR(128) UNIQUE, is_active BOOLEAN DEFAULT true);
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
  await pool.query(`TRUNCATE users, game_players, game_item_fila, game_logs, game_commands, game_config,
    admin_audit, aparelhos, aparelho_donos, celular_contatos, celular_mensagens, deepweb_posts, game_servers RESTART IDENTITY CASCADE`);
  const u = {};
  const cria = async (nome, cargo, admin) => {
    const r = await pool.query(
      'INSERT INTO users (discord_id, discord_username, is_admin, admin_cargo) VALUES ($1,$2,$3,$4) RETURNING *',
      ['d_' + nome, nome, admin, cargo]);
    u[nome] = r.rows[0];
  };
  await cria('dono', null, true);              // setado "direto no banco": cargo NULL
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
    moderador:     { tem: ['banir', 'expulsar', 'item'],                                   naoTem: ['noclip', 'item_todos', 'servidor', 'wipe', 'registro'] },
    administrador: { tem: ['banir', 'expulsar', 'item', 'noclip'],                          naoTem: ['item_todos', 'servidor', 'wipe', 'registro'] },
    supervisor:    { tem: ['banir', 'expulsar', 'item', 'item_todos', 'servidor', 'noclip', 'economia', 'teleporte', 'corp'], naoTem: ['wipe', 'registro', 'admins'] },
    diretor:       { tem: ['banir', 'expulsar', 'item', 'item_todos', 'servidor', 'noclip', 'registro', 'admins'], naoTem: ['wipe'] },
    dono:          { tem: ['wipe', 'admins', 'registro', 'item_todos'],                     naoTem: [] },
  };
  for (const [cargo, e] of Object.entries(esperado)) {
    const fake = { is_admin: true, admin_cargo: cargo === 'dono' ? null : cargo };
    for (const p of e.tem)    ok(perm.pode(fake, p),  cargo + ' TEM ' + p);
    for (const p of e.naoTem) ok(!perm.pode(fake, p), cargo + ' NÃO tem ' + p);
  }
  ok(perm.cargoDe({ is_admin: true, admin_cargo: null }) === 'dono', 'is_admin com admin_cargo NULL = DONO (setado no banco)');
  ok(perm.cargoDe({ is_admin: false, admin_cargo: 'diretor' }) === null, 'sem is_admin não é admin nenhum, mesmo com cargo');

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
  ok((await req('POST', '/users/' + U['dono'].id + '/cargo', { cargo: 'moderador' })).status === 403, 'diretor NÃO rebaixa o dono');
  ok((await req('POST', '/users/' + U['diretor'].id + '/cargo', { cargo: 'moderador' })).status === 400, 'diretor não mexe em si mesmo');
  ok((await req('POST', '/users/' + U['moderador'].id + '/cargo', { cargo: 'diretor' })).status === 403, 'diretor não promove ninguém a diretor (seu próprio nível)');
  const promo = await req('POST', '/users/' + U['moderador'].id + '/cargo', { cargo: 'supervisor' });
  ok(promo.status === 200, 'diretor promove moderador a supervisor');
  const chk = await pool.query('SELECT admin_cargo FROM users WHERE id=$1', [U['moderador'].id]);
  ok(chk.rows[0].admin_cargo === 'supervisor', 'gravou supervisor no banco');
  USUARIO_ATUAL = U['dono'];
  ok((await req('POST', '/users/' + U['diretor'].id + '/cargo', { cargo: null })).status === 200, 'dono tira o admin do diretor');
  await pool.query('UPDATE users SET is_admin=true, admin_cargo=$1 WHERE id=$2', ['diretor', U['diretor'].id]);

  tit('5. O BUG: apagar jogador e ele voltar no boot seguinte');
  await pool.query(`INSERT INTO game_players (roblox_id, nome) VALUES (111,'Ana'), (222,'Bia'), (333,'Caio')`);
  await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe) VALUES
    ('entrou','Ana','{"userId":"111"}'), ('entrou','Bia','{"userId":"222"}'), ('entrou','Caio','{"userId":"333"}')`);
  await pool.query(`INSERT INTO game_item_fila (roblox_id, item, qtd, entregue_em) VALUES (111,'pao',1,NOW())`);
  await pool.query(`INSERT INTO aparelhos (uid, numero, dono_roblox_id) VALUES ('ap1','5551',111)`);

  USUARIO_ATUAL = U['dono'];
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

  tit('7. Wipe brutal, em transação');
  await pool.query(`INSERT INTO game_players (roblox_id, nome) VALUES (111,'Ana'),(222,'Bia') ON CONFLICT (roblox_id) DO NOTHING`);
  await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe) VALUES ('entrou','Ana','{"userId":"111"}')`);
  await pool.query(`INSERT INTO game_item_fila (roblox_id, item) VALUES (111,'pao')`);
  await pool.query(`INSERT INTO celular_mensagens (de_numero,para_numero,par_key,texto) VALUES ('1','2','1-2','oi')`);
  await pool.query(`INSERT INTO deepweb_posts (chip_nome, corpo) VALUES ('corvo_71','teste')`);
  await pool.query(`INSERT INTO aparelhos (uid, numero, dono_roblox_id) VALUES ('ap2','5552',222)`);

  USUARIO_ATUAL = U['dono'];
  ok((await req('POST', '/registro/wipe', { confirm: 'NAO' })).status === 400, 'wipe sem digitar WIPE é recusado');
  const w = await req('POST', '/registro/wipe', { confirm: 'WIPE', celular: true, auditoria: true, saves: true });
  ok(w.status === 200, 'wipe respondeu 200');
  for (const t of ['game_players', 'game_item_fila', 'game_logs', 'celular_mensagens', 'deepweb_posts', 'aparelhos']) {
    const n = await pool.query('SELECT COUNT(*)::int n FROM ' + t);
    ok(n.rows[0].n === 0, t + ' zerada');
  }
  ok(w.body.resets_online === 1, 'enfileirou resetar_dados pro jogador online (' + w.body.resets_online + ')');
  const cmd = await pool.query(`SELECT tipo FROM game_commands WHERE tipo='resetar_dados'`);
  ok(cmd.rows.length === 1, 'o comando resetar_dados sobreviveu ao wipe (foi criado depois da limpeza)');
  const marca = await pool.query(`SELECT value->>'em' em FROM game_config WHERE key='wipe_em'`);
  ok(!!marca.rows[0], 'gravou o marcador wipe_em');

  tit('8. Depois do wipe, o backfill não repõe nada');
  await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe, created_at) VALUES ('entrou','Ana','{"userId":"111"}', NOW() - INTERVAL '2 days')`);
  await backfillDoBoot();
  const depois = await pool.query('SELECT COUNT(*)::int n FROM game_players');
  ok(depois.rows[0].n === 0, 'log velho (anterior ao wipe) NÃO repovoa o registro');
  await pool.query(`INSERT INTO game_logs (tipo, jogador, detalhe) VALUES ('entrou','Novo','{"userId":"999"}')`);
  await backfillDoBoot();
  const novo = await pool.query('SELECT COUNT(*)::int n FROM game_players');
  ok(novo.rows[0].n === 1, 'mas quem entrou DEPOIS do wipe entra normal (temporada nova)');

  tit('9. Comando novo sem poder mapeado é recusado, não liberado');
  const semMapa = Object.keys(perm.PODER_DO_COMANDO);
  const todosComandos = ['dinheiro_set','dinheiro_add','banco_set','item_add','item_remove','emprego','level_set','slots_set',
    'tp_local','tp_jogador','tp_coord','trazer','curar','matar','kick','mensagem','carro_add','carro_remove','resetar_dados',
    'corp_refresh','noclip','ban','unban','hora','clima','anuncio'];
  const faltando = todosComandos.filter(c => !semMapa.includes(c));
  ok(faltando.length === 0, 'todo comando do painel tem poder definido' + (faltando.length ? ' — FALTAM: ' + faltando.join(', ') : ''));

  srv.close(); await pool.end();
  console.log('\n' + (falhas ? '### ' + falhas + ' FALHA(S)' : '### TUDO PASSOU'));
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('EXPLODIU:', e); process.exit(1); });
