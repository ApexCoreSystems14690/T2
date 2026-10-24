// [24/10] Anti-alt: conta Roblox nova só entra com vínculo verificado e Discord não recém-criado.
// Rodar com o site no ar: TZ=UTC DATABASE_URL=... node teste_conta_nova.js
const SEG = require('./src/seguranca');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let ok = 0, falhou = 0;
const t = (n, c, x) => { if (c) { ok++; console.log('  ok  ' + n); } else { falhou++; console.log('  FALHOU  ' + n, x || ''); } };
const cfg = { conta_nova_dias: 30, discord_min_dias: 14 };
(async () => {
  console.log('\nNÚCLEO');
  t('conta de 2 dias sem vínculo = bloqueia', !!SEG.decidirContaNova(cfg, 2, { verificado: false }, null));
  t('conta de 400 dias sem vínculo = entra', SEG.decidirContaNova(cfg, 400, { verificado: false }, null) === null);
  t('conta de 2 dias COM vínculo e Discord velho = entra', SEG.decidirContaNova(cfg, 2, { verificado: true }, 900) === null);
  t('conta de 2 dias com vínculo e Discord de 3 dias = bloqueia', !!SEG.decidirContaNova(cfg, 2, { verificado: true }, 3));
  t('regra desligada (0) = entra', SEG.decidirContaNova({ conta_nova_dias: 0 }, 1, { verificado: false }, null) === null);
  t('idade ausente (jogo antigo) = não bloqueia', SEG.decidirContaNova(cfg, undefined, { verificado: false }, null) === null);
  // snowflake do Discord: 175928847299117063 = 2016-04-30
  const d = SEG.idadeDiscordDias('175928847299117063', Date.UTC(2026, 9, 24));
  t('idade do Discord pelo ID (2016 → ~3800 dias)', d > 3700 && d < 3900, d);
  t('ID torto = null', SEG.idadeDiscordDias('roblox_123') === null);

  console.log('\nROTA /api/game/acesso');
  const rid = 880000000 + Math.floor(Math.random() * 1e6);
  const r1 = await (await fetch(`http://localhost:4600/api/game/acesso/${rid}?idade=3`, { headers: { 'x-api-key': 'k123' } })).json();
  t('conta de 3 dias, sem vínculo: bloquear + mensagem', r1.bloquear === true && /Conta Roblox nova/.test(r1.msg || ''), JSON.stringify(r1).slice(0, 200));
  const r2 = await (await fetch(`http://localhost:4600/api/game/acesso/${rid}?idade=900`, { headers: { 'x-api-key': 'k123' } })).json();
  t('mesma conta com 900 dias: entra', r2.bloquear === false, JSON.stringify(r2).slice(0, 200));
  const r3 = await (await fetch(`http://localhost:4600/api/game/acesso/${rid}`, { headers: { 'x-api-key': 'k123' } })).json();
  t('jogo antigo (sem idade): entra', r3.bloquear === false);
  t('config devolve os dias', r1.config && r1.config.conta_nova_dias === 30 && r1.config.discord_min_dias === 14, JSON.stringify(r1.config));
  console.log(`\n== ${ok} ok, ${falhou} falharam`);
  await pool.end(); process.exit(falhou ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
