# Mobile: abas, corda, chat e drop

Onde mora: `StarterPlayer...GuiHandler` (MostraAba, BindContextAction `ChatDigita`/`AbreInventario`), `ReplicatedStorage.Shared.Entrada` (`E.ligar` pílulas).
Estado: aba/corda/chat feitos; drop NÃO reproduzido

## Decisões do Julio
- 25/10: Barrinha branca embaixo de Craft/Inventário não mudava ao trocar de aba.
- 25/10: Pegar corda e usar no mobile buga; não dá pra dropar item direito nem abrir o chat no mobile.

## O que está feito
- 25/10: `MostraAba` anima `Inventory.Titulo.Frame` (TweenSizeAndPosition) pra aba ativa e deixa a inativa com TextTransparency 0.45.
- 25/10: Pílula de toque "Chat" (`E.ligar("Chat", {tipo="toque", slots={"barra"}, prioridade=3, tecla=";"...})`), desabilita quando o ChatBox está focado.
- 25/10: Corda no mobile corrigida (ver código do GuiHandler/ToolHandler).
- 25/10: Backup `Backups.GuiHandler_antes_abaCraft_2510`.

## O que falta
- Drop no mobile: pedir ao Julio descrição/print do que acontece.
- Publicar a place principal.

## Armadilhas
- 25/10: Teste da corda impossível em Play: o spawn fica na safe zone.
