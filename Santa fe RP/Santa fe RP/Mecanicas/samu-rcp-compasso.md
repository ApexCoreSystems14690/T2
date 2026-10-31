# SAMU — RCP no compasso, choque combinado e rig do desfibrilador

Onde mora: `ServerScriptService.Server.[Armas] Services.CaidoService` (RCP, qualidade, choque); núcleo puro `ReplicatedStorage.Shared.RCPCompassoN`; HUD `StarterPlayerScripts.RCPCompasso`; aviso em `SamuCliente`; remote `ReplicatedStorage.RCPChoque` (criado no CaidoService).
Estado: feito e testado em Play na dev (place 75467790232298). Não publicado. Julio precisa dar Ctrl+S e publicar.

## Decisões do Julio
- 18/10: RCP vira minigame de compasso (ESPAÇO no ritmo do pulso), não só segurar F.
- 18/10: Choque dos dois jeitos: com a maleta na mão OU com tecla E durante o RCP, sem sacar a maleta.
- 18/10: Pedido do rig de animação do desfibrilador na plataforma de rigs da SAMU.
- 19/10: Manual Clínico e Guia do Instrutor 100% alinhados com o jogo atual, entregues em PDF.

## Como funciona (medido)
- 18/10: F com mão VAZIA no paciente em parada inicia RCP (com Tool na mão volta "mao_ocupada").
- 18/10: Ritmo ~110/min. Janela de 10 batidas (10 gomos no HUD). Qualidade ≥ 60% "segura" a parada; abaixo disso a parada anda. 40–70% do intervalo ideal = batida boa.
- 18/10: S.RCPQ = MIN 0.6, JANELA 10, BOA_MIN 0.40, BOA_MAX 0.70, IGNORA 0.2, FALHA 1.2 s, FRACA_SEGURA 0.5, LARGADA 1.5 s, PAUSA_MAX 15 s.
- 18/10: Máscara de O2 só sobe o O2 enquanto o RCP está "segurando" (qualidade ≥ 0.6 ou em pausa pro choque).
- 18/10: Ordem certa com máscara: máscara primeiro (cilindro vai pro chão), mão vazia, depois RCP.
- 18/10: FV/TV são chocáveis; AESP e assistolia não. AESP reverte (RCE) com adrenalina + RCP + sangue ≥ 22 e O2 ≥ 60.
- 18/10: Assistolia + adrenalina + RCP vira FV.
- 18/10: Tecla E durante o RCP: 1,5 s de análise, aborta se ritmo não é FV/TV, abre desafio "ritmo" (3 choques, janela 0,22), pausa o RCP, no fim devolve o pulso e solta o RCP. Errar = -15 s.
- 18/10: Outro médico abrindo desafio de Desfibrilador no paciente também pausa o RCP dele.

## Rig
- 18/10: `workspace.PACOTE_ANIMADOR_SAMU` ganhou `Desfibrilador_Choque` (clone do RCP_Compressao), `Desfibrilador_PacienteReferencia`, `Desfibrilador_Aparelho` (DEA com cabos RopeConstraint) e `Placa_Desfibrilador_Choque`.
- 18/10: KeyframeSequence `Desfibrilador_Choque` com 5 keyframes (0/0,5/0,62/0,8/1,2 s), Action, sem loop. Cópia em `ServerStorage.RBX_ANIMSAVES`. Instruções no LEIAME_ANIMADOR.
- 18/10: Falta o animador fazer a animação de verdade (o rig é só o esqueleto/poses base).

## Docs
- 19/10: Manual Clínico da SAMU (Claude Docs 1f5a4cef-a75e-4dde-b044-96fd7168379c, 20 págs) e Guia do Instrutor (419050e7-3328-450e-9472-077655c00c3a, 10 págs) revisão 19/10, PDFs entregues.
- 19/10: Treino com boneco já acompanha (Regras.Treino: sangue 30/45/60/80, O2 60/80/98). Lesão de leito estabilizada NÃO levanta o boneco na rua de propósito.

## Pendências
- 24/10: Tester disse "RCP + oxigênio só funciona no boneco, não em jogador". NÃO reproduzido: AESP real (O2 40, sangue 45) com máscara + adrenalina + RCP no ritmo subiu O2 +1/s e deu RCE em ~21 s.
- 24/10: Preciso de print do tester (Sangue %, O2 %, cor dos gomos). Sem isso a causa é desconhecida.
- 24/10: Opção oferecida e sem resposta: máscara subir O2 pela metade mesmo com massagem fraca.
- Julio: Ctrl+S na dev e publicar.
