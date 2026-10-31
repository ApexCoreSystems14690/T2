# /god — cura completa (ComandosHandler)

- 31/10: Julio: "/god agora deve curar tudo, tirar até bandagem médica, faixa na cabeça etc, zerar 100%" e "tirar tela escura do respire".
- 31/10: Antes o /god só fazia Health = MaxHealth.
- 31/10: Agora (função curarTudo no topo do ComandosHandler, também em _G.SantaFeCurarTudo): levanta caído/morto (CaidoService.QA_Limpar, Morte = 0), sangue e O2 cheios (CaidoService.Sangue/O2), ferimentos e sangramento (FerimentoService.Curar), TODAS as sequelas incluindo a grave com prazo (data.Sequelas = {}), desfaz ragdoll, apaga TratamentoVisual/CirurgiaVisual (faixas, curativo, tala), FaixaOlho, Tontura, Ferido_*, WalkSpeedFerido, PodePular, vida máxima.
- 31/10: Tela escura/"respire" = CaidoClient lendo atributos do jogador Estado/O2/Parada/Anestesiado/Morte; o /god zera todos.
- 31/10: Não mexe em fome/sede/sono.
- 31/10: /god all faz a mesma cura em todos. Backup ServerStorage.Backups_Morte_3110.ComandosHandler_antes_godTotal.
- 31/10: Não testado em Play (Play do Studio caindo sozinho).
