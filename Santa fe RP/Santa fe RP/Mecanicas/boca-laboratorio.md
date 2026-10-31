# Boca de facção — laboratório, produtos e itens

Onde mora: `ServerScriptService.Server.Services.BocaService`, `ArmaRegistro.aoAtualizar` (trava de compra), `CorpService.loadPlayerData`, `StarterPlayerScripts.BocaLabClient`, `ToolHandler.ArmaMotor` + `Shared.MiraAssistida`; `ServerStorage.Tools` (Lima, Adrena, Mira Fina, Casca Grossa); `workspace.BOCA_Armazem`
Estado: feito no Studio (place principal); falta o Julio publicar
Histórico antes daqui: memória `santa-fe-balistica-2`

## Decisões do Julio
- 24/10: Itens "FEIOS DEMAIS, MINÚSCULO A LIMA" → usar da toolbox e só modificar coisinha.
- 24/10: Prancheta com papel colado por cima "feião, tá repreendido".
- 24/10: Mira Fina "não só deve tirar recuo como deve puxar um pouquinho", igual à mira do cll.

## O que está feito
- 24/10: Lima = chave de fenda do Tools Pack 13247527273 escala 0,9 (2,2 studs) + lâmina DiamondPlate; aponta pra frente.
- 24/10: Adrena = frasco âmbar 17171515424; Mira Fina = caixinha "PROPills" (pro pull 2) de 8296983803; Casca Grossa = pote de cápsulas 140618018939865 com tampa verde (14 cápsulas).
- 24/10: Itens antigos guardados em `ServerStorage.Backups_Itens_2410`; `IconesModelos` refeitos de pé.
- 24/10: Grip conferido em Play: tudo em pé, objeto à frente do punho.
- 24/10: Rack (`desenharRack`) mostra os produtos em MINIATURA (cabe 0,22 x 0,62 por vaga).
- 24/10: `LAB_Receita`: o `Papel` ficou invisível, rente à folha da prancheta (toolbox 11329271645), girado 90°, texto à esquerda. Nome `Papel`+SurfaceGui mantido (contrato do código).
- 24/10: Mira Fina puxa a mira: PC 4° / 35%, toque 7° / 75%, enquanto `EfeitoRecuo < 1`; ressaca não puxa. Descrição atualizada no ToolData e FaccaoBocaN.
- 24/10: Nível da facção: `CorpService` passou a copiar `nivel` (antes toda facção caía no padrão 2). `nivel` ≠ `rankLevel`.
- 24/10: `Boca.fabricar` não fabrica mais instantâneo: encaminha pro preparo demorado (`labIniciar`).
- 24/10: Exploit `CompraTool` travado na entrega: produto da boca comprado longe de balcão volta (dinheiro não); Lima/Insumo fora do balcão avisam a aba Suspeitas.
- 24/10: Autoteste da balística: 243 ok / 1 falha (o teste do vão media o frasco antigo; corrigido, confirma na próxima sessão).

## O que falta
- Julio publicar.
- Prova no celular das duas bancadas (boca e perícia).
- Julio decidir qual cargo da facção saca do cofre (hoje qualquer membro tira R$ 5.000 por F).

## Armadilhas
- 24/10: Free models "Vitamins" 134769853837735 / 82346506512582 têm payload escondido — nunca usar.
