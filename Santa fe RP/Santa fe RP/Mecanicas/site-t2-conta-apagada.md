# Site T2: ameaça de apagar contas, buraco do link-roblox e auditoria

Onde mora: `D:\T2\src\routes\dashboard.js` (`POST /link-roblox`), `D:\T2\src\views\admin.ejs` (aba Banidos, desbanir), `D:\T2\auditoria_sumico.js` (novo, só leitura).
Estado: corrigido no disco em 05–06/10. O deploy é do Julio (`git push`, Railway roda o `Procfile`). Não conferi depois se subiu.
Ver também: `Mecanicas/vinculo-roblox.md` (fluxo de vínculo de 25/10 mexe na mesma tela).

## Decisões / fatos
- 05/10: Julio perguntou se hacker consegue apagar coisas do site T2. Print: jogador "MotorBike" disse "aproveitando vou apagar o resto das contas do vosso website". Julio: o painel mostrava que nada foi apagado ainda, acha blefe.
- 05/10: Buraco achado no código: `POST /link-roblox` fazia merge de placeholder (`UPDATE members SET user_id`, `DELETE FROM members`, `UPDATE corporations SET owner_id = NULL`, `DELETE FROM users`). Quem vinculasse o roblox_id de outra conta apagava a conta.
- 05/10: Troquei por recusa: `ROLLBACK`, `console.warn('[seguranca] link-roblox RECUSADO ...')`, redirect `?error=already_linked`. Verificado: nenhuma rota do site apaga linha de `users` agora.
- 05/10: O merge legítimo de placeholder (`discord_id LIKE 'roblox\_%'`) saiu junto. OFERECI refazer como ação de admin. Não construído.
- 05/10: Dados do jogo não se apagam de vez: `Temporada.nomeDaLoja(t)` → `CBRP_V1.2`, `_T2`, `_T3`… O número só sobe; o wipe incrementa e a loja antiga fica intacta. `WipeProfileAsync` existe na biblioteca mas nunca é chamado. O Roblox guarda ~30 dias de versões de chave.
- 05/10: Julio pediu pra verificar se algo sumiu ("resto das contas"). `auditoria_sumico.js` tem 7 blocos: buracos na sequência `users.id`; corps com `owner_id IS NULL`; memberships roubadas (`m.joined_at < u.created_at - INTERVAL '1 minute'`); concentração de membership; users mexidos em 48 h; placeholders vivos; últimos `admin_audit`. Testado contra ataque simulado num Postgres descartável: achou 2 contas apagadas e nomeou o atacante.
- 05/10: O resultado da execução com o banco real não chegou até mim.
- 06/10: Desbanir falhava com "Parâmetro inválido: roblox_id". Causa: eu mandava `roblox_id` no topo; `/api/admin/command` lê de `payload`. Corrigido em `admin.ejs` ~682: `api('POST','/command',{tipo:'unban',payload:{roblox_id:id}})`.

## O que falta
- Julio: `git push` do `D:\T2` (se ainda não fez).
- Recomendado por mim, ele não respondeu: 2FA em Discord/GitHub/Railway, definir `DONO_DISCORD_ID`, rotacionar `SESSION_SECRET` e a chave de API do jogo, backup do Postgres.

## Armadilhas
- 06/10: Julio colou o texto-modelo literal `<a DATABASE_URL pública do Railway>` e rodou sem `npm install` → "Cannot find module 'pg'". Pedi `npm install` e a URL real, e que NÃO mande a URL no chat, só a saída do script.
