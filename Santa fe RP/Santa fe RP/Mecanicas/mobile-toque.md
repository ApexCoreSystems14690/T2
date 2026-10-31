# Mobile / toque (Entrada + LayoutToque)

Detalhes por mecânica na memória do Project (`santa-fe-mobile-*`). Place DEVTS 78083733455249. NADA publicado ainda.

## Onde mora
- 12/10: `ReplicatedStorage.Shared.Entrada` (núcleo `N` + casca de toque; slots principal/secundario/terciario/barra).
- 12/10: `ReplicatedStorage.Shared.LayoutToque` (UIScale/piso por janela, só em toque verdadeiro).
- 12/10: `Client.ControllerHandler` (carro/moto), `Client.InteractionHandler`, `Client.GuiHandler`, `Client.RadioCarroClient`.
- 16/10: Backups em `ServerStorage.Backups_Mobile_1110` (ex.: `LayoutToque_v4_antes_volta`, `Entrada_v4_2_antes_tela3D`).

## Feito
- 12/10: Volante: `Entrada.N.volante`; zona morta 0.1, trava total 0.8, curva ^1.35; ângulo do dedo decide o gás.
- 12/10: Pedais: CarroAcelerar/Frear e MotoAcelerar/Frear (prio 23); freio de mão e grau foram pra slots terciario/barra.
- 12/10: Rádio do carro: Vol−/Vol+ por bolinha, só com o rádio aberto.
- 16/10: Casa: com HUD aberto os badges [B]/[F] sobem acima do painel; outra tela aberta manda pra fora (y −400).
- 16/10: Permissões da casa: bolinha CasaPermissoes (barra, prio 5).
- 16/10: Craft/GunTab passa pelo LayoutToque v3 e foi provado por foto.
- 16/10: `Entrada.tela3D(nome, aberta, sair)`: registra tela 3D no Telas; esconde bolinhas, sobe HUD e põe FecharTela; no PC Esc chama `sair`. SISPOL (`PCPoliciaClient`) já usa.
- 16/10: SAMU (`SamuCliente`): minigame usa posição do dedo no lugar do mouse.
- 16/10: Janela fechada/invisível volta à escala 1 (`medir()` do LayoutToque).

## Falta
- 16/10: Tela de voto da urna NÃO existe ainda; quando o outro chat criar: botões ≥44 px e chamar `Entrada.tela3D("Urna", ...)` (contrato em memória `santa-fe-eleicao-urna`).
- 16/10: Sentir real do volante, heli e mira no aparelho: não medido (sem Play).
- 16/10: Publicar (Ctrl+S → Publish): Shared.Entrada, LayoutToque, VooAssistido, MiraAssistida; Client ControllerHandler, InteractionHandler, GuiHandler, RadioCarroClient, ToolHandler.ArmaMotor; SamuCliente, PCPoliciaClient; ServerScriptService.Server.rotorKitModule.Controller; mais itens de rodadas anteriores (ToolHandler.Camera, PortaMalasClient, PlacementHandler, AlgemaToque, DynamicThumbstick, StarterGui.MobileUI etc.).
- 16/10: Limpar `ServerStorage.TRABALHANDO_Mobile` ao terminar (hoje não está setado).
