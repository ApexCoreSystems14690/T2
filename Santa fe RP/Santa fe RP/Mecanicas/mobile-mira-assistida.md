# Mira assistida no celular

- 16/10: Julio pediu: mira do mobile dá uma "puxadinha" pro tronco/cabeça.
- 16/10: `ReplicatedStorage.Shared.MiraAssistida` (novo): `escolher(origem, dir, partes)`, `puxar(dir, alvo, fator)`; cone 6°, alcance 250, puxa 0.65, só jogadores.
- 16/10: Ligada em `Client.ToolHandler.ArmaMotor._pontoAlvo`, só toque; alvo = Head/UpperTorso/Torso de outro jogador vivo; checa visibilidade por raycast.
- 16/10: Backup `ArmaMotor_antes_miraassistida`.
- 16/10: Falta: sentir no aparelho (não medido); publicar ArmaMotor e MiraAssistida.
- 24/10: Julio: Mira Fina "não só deve tirar recuo como deve puxar um pouquinho". `MiraAssistida.MIRA_FINA` (PC 4°, 35%) e `MIRA_FINA_TOQUE` (7°, 75%) quando `EfeitoRecuo < 1`; ressaca não puxa. `escolher` ganhou 4º argumento `maxGraus`. Detalhes em `Mecanicas/boca-laboratorio.md`.
