# Retomada de casa financiada: itens do armário voltam pro inventário

Onde mora: `ServerScriptService.Server.Services.FinanciamentoService` (`tickLogin`, `esvaziarCasa`, `resgatarArmarioBackup`); `ImoveisService` (~linha 520 chama `tickLogin` no login); `PlacementHandler` (`LoadData`, `SalvarArmario`, `ArmarioBackup`).
Estado: consertado no código em 12/10. Compila. NÃO rodou em servidor. Falta Ctrl+S + Publish.
Prazo fixo de 72 h por parcela e migração: outro chat, ver memória `santa-fe-financiamento` (não repetido aqui).

## Decisões do Julio
- 04/10 (comentário no código, palavras dele): cancelar financiamento "perde o carro ou movel (qualquer item na casa etc e devolvido pro teu inv)" e recebe uma parte do que pagou.
- 12/10: Trouxe a denúncia de um jogador (print do Discord, "Luc"): não conseguiu pagar as parcelas, o governo pegou a casa, comprou outra, o armário não voltou pro inventário, "tinha 2ak e 2mp5".

## O que está feito
- 12/10: Causa lida no código: `esvaziarCasa` só enxerga móvel que está NO MUNDO, e no login o `ImoveisService` carrega móveis de UMA casa só (`primeira`, o 1º do `pairs`). Quem tem 2 casas e perde a que não foi carregada roda o laço numa pasta `Moveis` vazia e solta o plot com o armário cheio.
- 12/10: Os itens NÃO foram apagados: seguem no save do plot (`Imovel_<PlotId>`, 1 chave por jogador) e na cópia do perfil `Data.ArmarioBackup["<PlotId>|<idDoMóvel>"]`. Só `/resetar` (PD) zera essa cópia (`DataHandler` ~1127).
- 12/10: Conserto (backup `ServerStorage.Backups.FinanciamentoService_antes_resgateArmario1210`):
- (1) `tickLogin` chama `PlacementHandler:LoadData(casaDoPlot, plr)` ANTES de esvaziar. `LoadData` é idempotente desde 05/10, não duplica móvel.
- (2) `resgatarArmarioBackup(plr, casa)` no fim do `esvaziarCasa`: devolve por `AddInventario` tudo das chaves `"<PlotId>|..."` do `ArmarioBackup` e zera a chave. Não duplica: a cópia é zerada quando o armário esvazia de verdade.
- (3) Saiu o `if not moveis then return 0 end`, que pulava o resgate. `cancelar` e `anunciar` usam a mesma função e ganharam a rede.
- 12/10: Provas: compila (413 linhas); 0 PlotId com `|` no nome; varredura por prefixo testada com plot certo, outro plot e plot de nome parecido (pegou só o certo).

## O que falta
- Recuperar os itens do jogador da denúncia: preciso do NOME ROBLOX dele (o "Luc" é do Discord) pra ler o `ArmarioBackup` do perfil e devolver os 2 AK e 2 MP5.
- Provar em servidor: jogador com 2 casas perde a financiada não carregada e recebe o armário.

## Armadilhas
- 12/10: "Item sumiu" na retomada não era dupe nem apagão: era o laço enxergando só o mundo. Antes de supor roubo, ver o que a função devolve enxerga (mundo x perfil).
