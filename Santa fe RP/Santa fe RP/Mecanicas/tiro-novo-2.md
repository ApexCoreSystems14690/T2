# Tiro novo (parte 2) — continua Mecanicas/tiro-novo.md

- 30/10: Julio: "n curti muito as animações que trouxe, repita com outras; o sistema já tá legal". Feito: 3 conjuntos novos da Creator Store no Garimpo (Toasty M4A1 128624272518252, Rifle letanhung 10059649810, AK47 B 110945380137881) + o AKMS de antes. Cópias em ReplicatedStorage.Tiro.AnimTeste.<TOASTY|LETAN|AK47B|AKMS>.
- 30/10: Teste das animações no Studio: F7 com a T4 na mão troca o conjunto e re-equipa; o nome aparece na tela. Padrão = TOASTY (descanso = arma atravessada no peito, mira = arma no ombro).
- 30/10: Alinhamento de cada pack conferido por conta: nas poses de mira o cano da T4 sai com pitch ~0, yaw ~0 e a mão esquerda no guarda-mão. Foto: TOASTY descanso e mira certos na mão.
- 30/10: Julio: agachar e deitar com arma na mão, podendo atirar; mirando ficava em pé. Causa: CharacterHandler.Animations PARAVA o agachar enquanto mirava. Feito: não para mais; animações de arma com peso 0 em tronco/pernas/cabeça e prioridade um degrau acima (Action2..4). Foto: agachado mirando.
- 30/10: Deitar: SEGURAR o C deita; tocar o C deitado volta pra agachado; Espaço deitado levanta pra agachado; deitado anda 3, não pula; sentou no carro = levanta. Atributo "Deitado" no personagem (só local, como o "Agachado").
- 30/10: Animação de deitar feita por código (KeyframeSequence ReplicatedStorage.Tiro.AnimTeste.Posturas.deitar), no Studio roda por id temporário. Dummy "Postura | deitar" na Plataforma_Anims_Tiro pro Julio publicar; o id entra em IDS_ANIMACOES.deitar (hoje 0 = fora do Studio o deitar não liga).
- 30/10: Deitado com arma: braços sobem ~90° pelo TiroClienteBoot (tronco deitado); mirando segue a câmera, sem mirar fica a arma pra frente rente ao chão. Os outros jogadores: detecta deitado pela inclinação do tronco (a animação replica, o atributo não).
- 30/10: Câmera desce com a postura (RenderStep Camera+1, só translação): agachado -1; deitado -3,6 na 1ª pessoa e -2,4 na 3ª. Medido: sem deriva em 1 s parado.
- 30/10: Precisão: deitado usa o mesmo bônus do agachado (cfg.agachado) no Arma.
- 30/10: Backups em ServerStorage.Backups_ACS_3010: AnimTeste_antes_sets_3010, Animations_antes_deitar_3010, Arma_antes_deitar_3010, TiroClienteBoot_antes_deitar.

- 30/10: Julio: pegar a arma e virar 1ª pessoa é "rápido demais, esquisito". Escolheu: câmera desliza da 3ª até o olho (~0,35 s) e as mãos da 1ª pessoa sobem de baixo; guardar = o contrário; Z usa o mesmo.
- 30/10: Feito (Viewmodel): deslize 3ª→1ª 0,35 s / 1ª→3ª 0,30 s preso na cabeça (anda junto com o boneco), corpo some só aos 0,22 s, mãos sobem de baixo dos 0,18 s aos 0,48 s. Backup Viewmodel_antes_transicao_3010. Não testado em Play (Play travou no Studio).
- 30/10: Julio: deitado andando "fica deslizando no chão". Feito: animação "rastejar" por código (ReplicatedStorage.Tiro.AnimTeste.Posturas.rastejar, dummy "Postura | rastejar" pra publicar); Animations toca rastejar andando deitado, na velocidade do corpo; parado volta pro deitar. IDS_ANIMACOES.rastejar = 0 até publicar.

- 31/10: Julio gostou do conjunto Toasty M4A1; pediu fila só com o que publicar e apagar o inútil. Feito: Plataforma_Anims_Tiro só com 7 dummies em fila (1 T4 descanso, 2 mirando, 3 atira, 4 recarrega, 5 equipa, 6 Postura deitar, 7 Postura rastejar), KeyframeSequence em AnimSaves de cada um. Apagados: os outros conjuntos (M4, AKMS, AK47B, LETAN) e os packs de animação do Garimpo; ficaram os kits ACS (pra migrar as outras armas).
- 31/10: Julio: descanso do Toasty em 3ª pessoa "uma bosta, braços longe demais". Trocado por low ready = pose de mira do Toasty baixada 34° (e 11° pra dentro) na linha dos ombros: braços colados, arma apontando pro chão à frente. Antigo guardado em Backups_Passada_3010.segurando_SAFETY_antigo. Foto: fila na plataforma.

- 31/10: Julio publicou a T4 (pacote Toasty): descanso 130576305661260, mirando 79232339531625, atira 139431993676044, recarga 91507385955589, equipa 89784631582122. Ligados em ReplicatedStorage.Resources.Assets.Animations (Segurando/Mirando/Atira/Carrega/Equipa T4); Arma põe prioridade Action2..4 e toca o equipa ao pegar. Medido em Play: "Segurando T4" carrega (5,0 s) e toca.
- 31/10: Encaixe da T4 agora no SERVIDOR (todo mundo vê igual): motor CharacterHandler.T4 com C0/C1 do Toasty e RightGrip desligado enquanto a T4 está na mão. Medido: T4 en=true, RightGrip en=false. AnimTeste não sobrepõe mais a T4 (M.ARMAS vazio).
- 31/10: "Postura | deitar" e "| rastejar" não publicavam ("sem root part"): sobrou um Motor6D "RootPart" com Part1 vazio do dummy de onde vieram. Apagado; falta o Julio publicar de novo.

- 31/10: Julio publicou as posturas: deitar 96404697833551, rastejar 124129661044840 (IDS_ANIMACOES no CharacterHandler.Animations). Medido em Play: deitar 2,40 s, rastejar 1,20 s, descanso 5,00 s, equipa 1,27 s carregam.
- 31/10: Pra testers: plataforma Plataforma_Anims_Tiro e ReplicatedStorage.Tiro.AnimTeste apagadas (tudo publicado); texto de teste no topo da tela (AnimTeste) desligado.

- 31/10: Testers: Cidade trata a place de dev (servidor público, fora do Studio) como cidade "testes" com status "testers" — entra direto pela página da experiência de dev, não vai pro lobby, save separado; RegistroCidade não redireciona. Testado o núcleo sem Play (dev = testes/testers; principal = sem-cidade/publico; Studio = santa-fe/estudio). Backups Cidade/RegistroCidade_antes_testers_3110.

- 31/10: Postura x corrida: agachado trava em 8 e deitado em 3 todo quadro; corrida não liga agachado/deitado/caído. Caído/morto solta a anim de agachar/deitar na hora. Backups em ServerStorage.Backups_Morte_3110.
- 31/10: Queda/morte: membros colidem desde o 1º instante e o corpo é erguido se afundou (Ragdoll.desafundar). Testado no Play com RagdollEmEtapas em pé e agachado: corpo deitado no chão, pernas fora do piso.

## Falta
- Julio testar os 4 conjuntos (F7) e escolher; publicar os escolhidos + "Postura | deitar" e mandar os IDs.
- Deitar no celular (hoje só tecla).
- Motor T4 do CharacterHandler com o C0 do conjunto escolhido pra todos verem a arma igual.
