# UI — Design System (extraído da UI atual do jogo)

## Cores
- **Background janela:** preto `Color3.new(0,0,0)` com `BackgroundTransparency` (ex. 0.1–0.4). Bordas: `BorderSizePixel = 0` (nunca borda dura).
- **Acento/Tema (do jogador):** padrão laranja `255,170,0` (Resources.Tema, 28 cores). Papéis: destaque, texto, texto2, fundo, perigo(vermelho), ok(verde), aviso(azul).
- **Texto:** branco `255,255,255`; secundário cinza.
- **Botão:** fundo escuro/tema; hover via `AutoButtonColor = true`; clique = tom mais escuro.
- **Sub-tema Celular (apps novos):** card escuro `22,24,30`, header verde `20,130,75` (RoZap/Banco), roxo `28,10,36`/`140,60,200` (Deepweb).

## Tipografia
- **Corpo:** `SourceSansPro` (fonte mais usada). **Títulos/destaque:** `Oswald`. **Números/secundária:** `GothamSSm`.
- **`TextScaled = true` é o PADRÃO** (368 labels usam). Evita fonte fora do padrão. Fixos aparecem só em casos pontuais (14/22/56).
- `RichText` só quando precisa de ênfase inline. Limitar tamanho com `UITextSizeConstraint` quando escalar.

## Arredondamento e Espaçamento
- **`UICorner.CornerRadius`:** pequeno, `UDim.new(0, 3..5)` (offset). Cards celular usam `UDim.new(0.06, 0)`.
- **`UIPadding`:** usar Scale pequeno nas bordas internas (ex. `PaddingLeft = UDim.new(0.03,0)`).

## Efeitos
- **`UIStroke` / `UIGradient`:** uso PONTUAL (não padrão nas janelas). Se usar stroke: fino (1px) na cor do tema.

## Tamanho (responsivo)
- **Só `Scale`** em Size/Position de frames e janelas (`{Scale,0}`). Offset proibido em janela principal.
- Toda janela principal tem **`UIAspectRatioConstraint`** (padrão no jogo) + **`UISizeConstraint`** (evita telas infinitas/minúsculas).
- Lembrete: `StarterGui.Main` usa `ZIndexBehavior.Global` → filho novo precisa `ZIndex` maior que o pai pra não ficar invisível.
