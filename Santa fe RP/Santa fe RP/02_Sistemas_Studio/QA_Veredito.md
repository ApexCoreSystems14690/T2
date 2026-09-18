---
name: QA_Veredito
description: Teste guiado sem print de tela — eu escrevo um roteiro, o jogo se leva sozinho até o estado e pergunta ao Julio numa caixa de texto; a resposta volta pelo output. Ler antes de pedir screenshot de qualquer coisa.
sources: [cowork]
aliases: [veredito, qa veredito, teste guiado, painel de pergunta, teste sem print]
---
# QA Veredito — o teste que pergunta em vez de fotografar

> Criado em 17/09, a pedido do Julio: *"garanta que o studio chegue na janela
> específica e abra uma janela de pergunta... assim não gastando com prints"*.

**Por que existe:** `screen_capture` é caro e só mostra um quadro. O Julio já está
com o jogo aberto e enxerga melhor que qualquer foto. Então em vez de eu fotografar
e adivinhar, o jogo **se leva sozinho até o estado que interessa** e **pergunta**.

## Caminhos no Studio
- Roteiro (eu escrevo do Edit): `ReplicatedStorage.QA_Roteiro` (StringValue, JSON)
- Motor: `StarterPlayer.StarterPlayerScripts.QA_Veredito` (LocalScript)

## Como a resposta chega até mim
Pelo **output**, com o prefixo `[VEREDITO]`. Leio com `get_console_output` depois
do Play. Nada de foto, nada de copiar e colar no chat.

```
[VEREDITO] ===== F3 volta 2 - o feed =====
[VEREDITO] pergunta 1/4: Olha o canto inferior esquerdo...
[VEREDITO] resposta 1/4: são 3 mesmo
[VEREDITO] ===== FIM =====
```

> Lembrete: o que muda em Play **não persiste** no Edit. Por isso a resposta sai no
> output (que persiste) e não num `StringValue`.

## Portas de segurança
- **Roteiro vazio = o script não faz nada.** Fica dormente, não atrapalha o jogo.
- Só roda para quem está em `Chaves.TESTADORES` (hoje: `masternerdtop`).
- O painel nasce num `ScreenGui` próprio com `DisplayOrder = 9999`, **fora do
  `Main`** — por isso não briga com o `ZIndexBehavior.Global` do Main.
- O painel é ferramenta de QA, **de propósito fora do padrão visual do jogo**
  (ver [[UI_Design_System]]), pra ninguém confundir com a HUD.

## A linguagem do roteiro
```lua
{ titulo = "nome do teste", lado = "direita"|"esquerda"|"topo", atraso = 5,
  passos = { ... } }
```

| Passo | Campos | O que faz |
|---|---|---|
| `esperar` | `seg` | pausa |
| `irPara` | `pos = {x,y,z}` | teleporta o personagem pro lugar do teste |
| `atributo` | `nome`, `valor` | seta atributo no Player (acende peça da HUD — ver [[Hud]]`.N.PECAS`) |
| `aviso` | `titulo`, `texto`, `cor = {r,g,b}`, `dur` | dispara notificação pelo `NotificaHandler` |
| `chamar` | `caminho` (ex. `Client.GuiHandler`), `fn`, `args` | chama método de um módulo do cliente, em `pcall` |
| `perguntar` | `texto`, `dica` | **para tudo**, abre o painel e espera a resposta |

O painel fica no lado oposto ao que está sendo julgado (`lado`), pra não tapar a
coisa. Enter na caixa ou o botão "Responder" enviam.

## Como eu uso
1. Monto a tabela em Lua no Edit e gravo com `HttpService:JSONEncode`.
2. **Provo o round-trip** (`JSONDecode` e conferir a contagem de passos) antes de gravar.
3. Peço o Play ao Julio.
4. Depois, `get_console_output` filtrando por `[VEREDITO]`.
5. Limpo o roteiro (`QA_Roteiro.Value = ""`) quando o teste fecha.

## Regras de boa pergunta
- Uma coisa por pergunta, e sempre com o **esperado na dica** — assim ele responde
  "sim/não/3" e não precisa escrever redação.
- Nunca perguntar o que dá pra medir sozinho. Pergunta é pro que só o olho vê:
  legibilidade, cor, timing, "ficou feio".
- Última pergunta sempre aberta ("algo incomodou?") — é onde aparecem os defeitos
  que eu nem sabia procurar.

## Estado
Em uso desde 17/09. Primeiro roteiro: o feed do [[Hud]] (4 perguntas).
