# Blindagem das viaturas (tiro atravessava)

Onde mora: ReplicatedStorage.Resources.MotorArmas.BalaVeiculo; ServerScriptService.Server.[Armas] Services.ArmaMotor (furarJanelaVeiculo, CanPierceFunction); atributos Blindado, LinhaJanela, Furada_<lado>
Estado: feito (falta testar em jogo)

## Decisões do Julio
- 13/10: Viatura tem blindagem: só mata atravessando por janela FURADA. Alguns carros também têm opção de blindagem. Moto sempre toma o tiro.

## O que está feito
- 13/10: Atributo Blindado=true em 73 viaturas (ServerStorage.Assets.VeiculosGovernamentais e workspace.VeiculosGovernamentais), exceto Ambulância (12) e Caminhão MF (3).
- 13/10: BalaVeiculo.decide devolve também "vidroBlindado" e "janelaBlindada" (+ lado E/D/F/T). 1º tiro fura/quebra e PARA; 2º passa. Vidro com LinhaJanela >= 999 sempre para.
- 13/10: ArmaMotor.furarJanelaVeiculo (som, estilhaço, atributo Furada_<lado> por 120 s). Cliente (_pontoAlvo) e acertoDoCliente não mudaram.
- 13/10: Backup em Backups_Blindagem_1310.

## O que falta
- Julio decidir: carro civil recebe blindagem como item na tunagem (com preço) ou só alguns modelos de fábrica?
- GLORIOSO continua sem LinhaJanela medida.
- Teste em jogo: tiro na janela (1º para, 2º passa), porta segura, moto pega.

## Armadilhas
- 13/10: Clone de ModuleScript não tem `Disabled` (ver Armadilhas.md).
