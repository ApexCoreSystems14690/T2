# Drive-by nas viaturas

Onde mora: Client.DriveByAnim, Client.CharacterHandler.TiltHandler, [Armas] Services.MiraService (Studio); atributos nos carros (DBFrente, SemDriveBy, DBOffX/Y/Z)
Estado: feito (falta testar em jogo com 2 pessoas)

## Decisões do Julio
- 12/10: Drive-by liberado no P2 de TODAS as viaturas (antes só P3/P1).
- 24/10: Animação do drive-by (92601262813810) foi feita só na DIREITA; banco traseiro esquerdo usa o espelho em X. "Direita é 10/10, esquerda é esquisito."

## O que está feito
- 12/10: DBFrente=true em 71 caronas; offset por banco DBOffX/Y/Z em 235 bancos de 88 viaturas (lê do banco, depois do carro). HiluxBope P3 não entra mais pra dentro/câmera.
- 24/10: Esquerdo corrigido. Causa real = Lerp do TiltHandler (RenderStepped) sobrescrevendo o C0 do RootJoint/quadris. Conserto: TiltHandler não escreve quando `_G.DriveByLocalAtivo`.
- 24/10: MiraService grava atributo `MiraGraus`; DriveByAnim usa `_G.ArmaMiraRot` (dono) ou MiraGraus (quem vê de fora) → pitch certo pra todos.
- 24/10: Medição de simetria mostrou que o espelho em X estava certo (a hipótese inicial era falsa).
- 24/10: Backups em ServerStorage: Backups_Colisao_1110.DriveByAnim_antes_offbanco e Backups_DriveByEsq_2410.

## O que falta
- Teste em jogo com 2 pessoas: banco traseiro esquerdo e direito, visto de dentro e de fora.
- Duas Duster PM com banco "Deita" sem SemDriveBy (decisão do Julio: bloquear?).
- Aplicar o ajuste de offset aos carros civis (decisão do Julio).
- Se o esquerdo ainda ficar estranho: animador faz versão própria do lado esquerdo.

## Armadilhas
- 24/10: Quem escreve C0 em RenderStepped ganha de quem escreve em BindToRenderStep (ver Armadilhas.md).
