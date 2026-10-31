# Passada, balanço da câmera e som de pisada

- 30/10: Julio: balanço da câmera (deitado, correndo, agachado) desencaixado na 1ª pessoa e independente do movimento; parado = só o respirar.
- 30/10: Julio: sons de passo/corrida/material/chão molhado têm que bater com o balanço e com o clima; "amaciados", o som de pisar de verdade, não um som aleatório rodando.
- 30/10: Medido antes: passo era UM som em loop por material (RbxCharacterSounds); balanço vinha de 3 lugares com relógio próprio (CameraHandler.N, Bodycam, SensacaoCamera roll).
- 30/10: Feito: StarterPlayerScripts.PassadaCliente. Pisada = extremo da diferença de ângulo entre as pernas (conta da junta do quadril); deitado = a cada 1,8 studs andados; perna sem animar = relógio pela velocidade.
- 30/10: Medido no Edit (StepAnimations): anim de andar 0,83 s/ciclo -> pisada a cada 0,42 s alternando D/E; agachado andando 1,0 s -> a cada 0,50 s.
- 30/10: Som por pisada: Half-Life 2 da Creator Store (concreto, azulejo, madeira, grama, terra, cascalho, areia, metal, grade, água) + roupa; 41 ids carregaram (0 falhas). Nunca repete a última variação; pitch/volume variam; EQ tira agudo (-6); alcance 5–60.
- 30/10: Chão molhado = atributo Molhado do clima e sem telhado em cima (raio 60 pra cima) e piso de rua/grama/terra -> soma "chape" de água. Correndo soma roupa; agachado baixo; deitado = arrasto + roupa. Pouso: som pela velocidade de queda.
- 30/10: Câmera (só a minha): tranco por pisada numa mola (desce + inclina pro lado do pé); 3ª pessoa 35%; parado só respiração; pouso pela queda; troca de postura = assentada. Ordem: aplica Postura(+1) Bodycam(+21) Passada(+22) Deslize(+24) Viewmodel(+25); desfaz Deslize(-3) Passada(-2) Bodycam(-1).
- 30/10: Desligados (relógio próprio): Bodycam PASSO_ALT/PASSO_ROLL/RESPIRA = 0; CameraHandler.N BOB_VERT/BOB_LAT/ELEV_GANHO/RESP = 0; CameraFeel.Roll = false; RbxCharacterSounds para o loop de corrida e o pouso se _G.PassadaAtiva. Backups em ServerStorage.Backups_Passada_3010.
- 30/10: Os outros jogadores: mesmas pisadas (som 3D no corpo deles); postura deles pela peça (tronco deitado / tronco baixo).

- 30/10: Julio (substitui o som por pisada): som de andar/correr ficou "com efeito chato, tipo tecido"; era pra ser o sistema de passos da place do evento. Medido: a place do evento (110213363993329) usa o MESMO RbxCharacterSounds (9946 b) e o mesmo SoundService.Footsteps da dev de antes. Decisão: volta o RbxCharacterSounds original; PassadaCliente fica só com a câmera.
- 30/10: Julio: balanço da 1ª pessoa "rápido dms, parece andar nas pontinhas do pé, tititi". Causa: tranco por pisada numa mola dura (w 13) = desce e repica a cada pé. v2 pronta (scratchpad, ainda não aplicada): pisada só marca o ritmo; câmera faz UMA curva lisa por passo (vale no pé, alto no meio), inclina pro pé de apoio trocando a cada passo, filtro final, some ao parar; amplitudes menores (andar 0,028 studs / 0,30°).
- 30/10: Julio: andando deitado o rastejar tem que mandar no corpo todo (braços também); atirar deitado só parado. Pronto pra aplicar: atributo Rastejando (Animations), Arma solta as anims de arma e bloqueia mira/tiro rastejando, TiroClienteBoot não corrige braço de quem rasteja. O Studio da dev fechou na hora de aplicar — conferir o que ficou salvo.

- 30/10: Aplicado na dev (reaberta; o que foi feito antes do fechamento estava salvo): RbxCharacterSounds original de volta (igual ao evento); PassadaCliente v2 (curva lisa por passo); rastejar manda nos braços e bloqueia mira/tiro (atributo Rastejando).
- 30/10: Julio: "precisa ter inclinação de corpo (1ª e 3ª pessoa), a clássica, Q, E". Feito com arma na mão: SEGURA Q = esquerda, E = direita; em pé/agachado (deitado, sentado e caído não). Câmera: 1ª pessoa 0,9 stud pro lado + 12°; 3ª 1,1 stud + 4°; parede no caminho segura a câmera. Corpo: tronco gira 17° na cintura, pernas paradas (TiroClienteBoot); os outros veem pelo atributo TiroInclina (TiroServer, junto da pose).
- 30/10: O Q deixou de travar a mira no teclado (mira = botão direito segurado; o botão de toque continua travando). Dica da HUD: "Q E — Inclinar (segure)".
- 30/10: Teste de tecla pelo Studio não chega no jogo (IsKeyDown falso): inclinar não foi visto rodando; falta o Julio testar.

## Falta
- Teste em Play (o Play travou no Studio em 30/10 — "Start play hasn't finished yet"): ouvir volumes, sentir o balanço, ver o deslize da arma.
- Julio publicar "Postura | deitar" e "Postura | rastejar".
