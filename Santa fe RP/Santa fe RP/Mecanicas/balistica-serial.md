# Balística + nº de série (registro de arma, porte, PC, estojo, projétil)

Onde mora: `ServerScriptService.Server.Services.ArmaRegistro`, `BalisticaService`, `Ficha`; `ReplicatedStorage.Shared.BalisticaN`; `ServerStorage.Tools["Porte de armas"].PreencheDoc`; `InteractionHandler` (+ `Actions.PorteDeArma`)
Estado: feito no Studio (place principal 78083733455249); falta o Julio publicar
Histórico completo antes daqui: memória do Project `santa-fe-balistica` e `santa-fe-balistica-2`

## Decisões do Julio
- 24/10: "Cara pode fazer na principal mesmo" (dev 75467790232298 estava fechada).
- 24/10: Art. 4.4C — registrar arma curta no balcão da DP até 20/11. Art. 4.4B — o Porte mostra os números das armas do dono.
- 24/10: Rajada não deixa um estojo por bala: "rajei 10, sair só 3/4; tiro único cai 1; 2 tiros cai 1".
- 24/10: Perguntou se tudo aparece no PC da Polícia Civil → integrar na aba Balística e na Ficha do cidadão.

## O que está feito
- 24/10: 4.4C = E (Key2) no mesmo ponto `PorteDeArma` ("Registrar arma no seu nome", Time2 1,5); `Balistica.registrarNoBalcao`.
- 24/10: Regras do balcão: porte no bolso, arma na mão, classe pistola/revolver (Glock, PT 92, Revolver, RevolverDourado), prazo até 21/11 00:00 BRT (os.time 1795230000).
- 24/10: Só registra arma de origem "legado" (anterior ao serial). Craft/contrabando recusa (não vira lavanderia). Ficha ganha `regularizada`.
- 24/10: 4.4B = campo "ARMAS REGISTRADAS NESTE NOME" nas duas faces do cartão; `ArmaRegistro.armasRegistradasDe`; até 3 + "+N". Foto conferida.
- 24/10: Aba Balística do PC mostra "Registro: feito no balcão da DP em dd/mm/aaaa" (testado por loadstring).
- 24/10: Ficha do cidadão lista as armas em "Bens registrados" + "N arma(s)" no resumo. Índice por dono no DataStore `ArmasPorDono-CBRP.1` (chave `u<UserId>`, máx 30), preenchido em `gravarNacional`; `ArmaRegistro.armasDoDono(uid)` funciona offline.
- 24/10: Arma raspada aparece na ficha SEM aviso de raspada (a polícia descobre na abordagem/perícia).
- 24/10: Estojo na rajada: tiros a < 0,6 s = mesma rajada; sai no 1º e a cada 3 (1→1, 2→1, 3→2, 10→4). Em `Balistica.tiroSaiu`.
- 24/10: Projétil da SAMU: coleta automática (paciente ≥ 45 de vida, socorrista a 16 studs), vira Tool, entrega com F na gaveta da perícia; não usa saco de evidência. Ícone corrigido (era o do cartucho) e lembrete a 14 studs da gaveta.
- 24/10: Contrabandista movido pra (504.695, 124.068, 1581.253) — de 0 pra 70 posições alcançáveis; antiga no atributo `PosicaoAntiga`.
- 24/10: Câmera `CamBancadaLarga` em (549.5, 51.4, -925.6) — as 6 platinas livres do encosto da cadeira.

## O que falta
- Julio publicar (Ctrl+S + Publish).
- Testar o registro com sucesso em jogo (não rodei: grava no DataStore de produção).
- Abrir uma Ficha do cidadão no PC em Play e ver as armas listadas.
- Arma de loja comprada antes do índice só entra na ficha quando o dono está online e a ficha é aberta.

## Armadilhas
- 24/10: Key2 em ponto com Action local nunca chega no servidor → `SegundaNoServidor = true` na Action.
- 31/10: Julio: limite de 4 cápsulas por jogador num raio (atirou mais, apaga as antigas e entram as novas; perícia igual). Feito no BalisticaService.tiroSaiu: cápsula guarda Dono e Ordem; num raio de 30 studs ficam só as 4 mais novas do mesmo jogador (de outros não contam). Teto geral 12 e rajada (1 a cada 3) continuam. Backup ServerStorage.Backups_ACS_3110.BalisticaService_antes_limite4. Não testado em Play.
