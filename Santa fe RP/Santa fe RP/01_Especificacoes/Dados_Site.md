# Dados no Site (Postgres)
- Feitas: aparelhos, **aparelho_donos** (histórico de posse), celular_contatos, celular_mensagens, deepweb_posts.
- Planejadas (doc): conversas/conversa_membros, mensagens(pos/rua), notas, fotos(cena jsonb), olx_anuncios/olx_vendas, jornal_materias, chamados/central_turnos, pericia_acessos/inqueritos.

## ⚠️ Onde a migração roda (17/09) — foi isto que derrubou o celular
O Procfile é `web: node src/index.js`. A migração que **vale** é a que está DENTRO do
`src/index.js` (8 blocos de `pool.query`, todos `CREATE IF NOT EXISTS`, rodam no boot).

O `src/db/migrate.js` é um script **separado**, só roda à mão com `npm run db:migrate`.
As tabelas do celular só existiam lá → **no Railway nunca foram criadas** → toda rota
`/celular/*` respondia **HTTP 500** ("relation does not exist"). Corrigido: o bloco do
celular agora está nos dois, e os dois têm que ser mantidos em sincronia.

> Tabela nova ⇒ põe em `src/index.js` (boot). Pôr só no `migrate.js` = tabela que não existe em produção.

## aparelho_donos
`aparelho_uid · de_roblox_id · de_nome · para_roblox_id · para_nome · motivo · pos_x/y/z · criado_em`
motivo: dropar · pegar · dar · confisco · revista · olx · portamalas · morte · combatlog · reset · wipe.
É a base da aba **Rastreio** da [[Pericia]]. Ver [[Aparelhos]].
