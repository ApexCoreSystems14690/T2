# Vínculo Roblox ↔ site (entrada no jogo)

Onde mora: site `D:\T2\src\seguranca.js`, `src\routes\dashboard.js`, `src\views\link-roblox.ejs` + `dashboard.ejs`; config "Exige vínculo" no painel Segurança (`SEG.config exige_vinculo`); jogo: `/api/game/acesso`.
Estado: feito no código, falta `git push`

## Decisões do Julio
- 25/10: Bug relatado: com o modo "precisa estar logado site↔Roblox" ligado, ninguém entrava mesmo estando linkado.
- 25/10: Quis saber se o site deixa claro que precisa finalizar a verificação.

## O que está feito
- 25/10: Código de vínculo = 3 palavras sem espaço (`SEG.novoCodigo()`, `PALAVRAS`); `bioTemCodigo` confere a bio do Roblox; `codigoLegivel` vai pra tela.
- 25/10: POST `/link-roblox` grava `vinculo_codigo` + `vinculo_codigo_em` e redireciona pra `/dashboard/link-roblox?ok=vinculado`.
- 25/10: Textos de "2 passos": laranja "Vinculado! Falta 1 passo", vermelho "Falta verificar seu Roblox… Verificar agora", verde "verificado" (`users.roblox_verificado`).
- 25/10: Backups em `D:\T2\_backup_vinculo_2510`.

## O que falta
- `git push` (Julio) pro Railway. Enquanto não sobe, ele pode desligar "Exige vínculo" no painel Segurança.
- Conferir no jogo que `/vincular` não corta o código em 12 letras (ver `seguranca-anticheat.md`).

## Armadilhas
- 25/10: Gente "linkada" não entrava → faltava a etapa de verificar a bio, e o site não deixava isso claro → texto de 2 passos + botão "Verificar agora".
