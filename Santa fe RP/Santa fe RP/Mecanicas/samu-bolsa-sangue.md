# SAMU — bolsa de sangue (guardar de volta)

Onde mora: `ServerScriptService.Server.Services.SamuService` (`M.PegarBolsa`, ~214k caracteres); porta em `workspace.GeladeiraSangue.PortaGeladeira` (F, 0,6 s); dica em `StarterPlayerScripts.SamuDicas`.
Estado: feito e testado em Play na dev. Não publicado.

## Decisões do Julio
- 19/10: Tem que dar pra guardar a bolsa depois de pegar (não estava dando).

## Como funciona (medido)
- 19/10: F na geladeira com a bolsa na mão guarda de volta (+1 na geladeira); com mão vazia pega de novo.
- 19/10: Geladeira cheia (8) avisa "A geladeira está cheia (8 bolsas)." e não guarda.
- 19/10: Números: 2 bolsas na maleta, 8 na geladeira, bolsa dá +25 de sangue, dura 60 s.
- 19/10: Descrição da porta: "Pegar ou guardar bolsa de sangue". Dica: "F no paciente caído pra pendurar. F na geladeira guarda de volta."
- 19/10: Manual Clínico ganhou "Como conduzir a transfusão" (7 passos) e o Guia do Instrutor o item "Guardou na geladeira a bolsa que sobrou".

## Pendências
- Julio: Ctrl+S na dev e publicar.
