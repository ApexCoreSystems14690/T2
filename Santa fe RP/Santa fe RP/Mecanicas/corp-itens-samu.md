# Itens de corp (desequipar) e saída de serviço da SAMU

Onde mora: `ServerScriptService.Server.Services.RemotesHandler` (~340 KB: ação `Desequipa` + `PegarEmpregoSamu`); cliente `StarterPlayer...Client.ToolHandler`; estoque em `CaixaCorp`.
Estado: feito, mas RemotesHandler é só RASCUNHO até o Julio dar Validar/Commit em "Rascunhos" e publicar

## Decisões do Julio
- 25/10: Item de corp deve poder ser desequipado e comida não pode ficar presa na mão.
- 25/10: Ao sair de serviço na SAMU, tudo sai sozinho: maleta, bolsa de sangue, cilindro de O2, maca etc.
- 25/10: Slots extras (os 3+): regra pedida = sempre 1 livre só pra item de corp, o resto dos extras usável. Não reproduzi; ele disse "deixa assim".

## O que está feito
- 25/10: Corp `Desequipa`: acha a Tool com atributo `Corp` (nome/ID); se não está em `plrData.Inventario` e `ehCobravel`, devolve ao estoque (`'devolveu'`); destrói e avisa "guardado de volta na corporação".
- 25/10: Saída da SAMU: `UnequipTools`, destrói Tool/Accessory com `Corp` e as 4 do kit SAMU (`Maleta médica`, `Bolsa de sangue`, `Cilindro de O2`, `Maca`) que não estejam no inventário do jogador; devolve transparência do cabelo.
- 25/10: ToolHandler: 1º equipar define `lastTool` e limpa o handler anterior; `Init` pré-cria handler quando a Tool entra na Backpack.
- 25/10: Backups `Backups.Comida_2210.ToolHandler_antes_lastTool`, `Backups.ToolHandler_antes_preparar_2510`.

## O que falta
- Julio: Validar/Commit do rascunho do RemotesHandler e publicar.
- Slots extras: só mexer se ele reportar de novo com passo a passo.

## Armadilhas
- 25/10: Item de corp fica na Backpack com atributo `Corp` e NÃO em `plrData.Inventario` → limpar por atributo, não por inventário.
