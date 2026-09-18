# MapaDesenho — o mapa é DESENHADO, não fotografado

`ServerStorage.MapaDesenho` (F3). Nasceu da frase do Julio em 18/09:

> *"Tem que ser MAPEADO as ruas e meio que 'DESENHADO' os caminhos... não mostrar a dobrinha da estrada."*

**A regra do sistema: detectar e desenhar são etapas DIFERENTES.**
Quem detecta é o `MapaGrade` (raycast). Quem desenha é este módulo. Pintar a célula onde o raycast
achou asfalto é fotografia com passo grosso — serrilha, mostra a dobrinha e faz duas ruas próximas
se atropelarem.

## As 7 etapas

1. **Grade** — categorias por célula (vem do `MapaGrade`, ou do cache `ServerStorage.GRADE_CACHE`).
2. **Limpeza morfológica** — *fechar* sim, *abrir* não: abrir come viela estreita.
3. **Distância chamfer 3-4** — quanto cada célula de rua está longe da borda ⇒ **largura local**.
4. **Afinamento Zhang-Suen** — esqueleto de 1 célula.
5. **Traçado** — o esqueleto vira polilinhas (trata nó, ramo e anel).
6. **Douglas-Peucker** — `TOLERANCIA = 14` studs. **É esta etapa que come a dobrinha.**
7. **Desenho** — traço de largura UNIFORME (`LARG_MIN 9`, `LARG_MAX 26`).

## Constantes que importam

| Constante | Valor | Por quê |
|---|---|---|
| `PASSO` | 6 | grosso de propósito: o desenho é por eixo, sub-célula não serve |
| `TOLERANCIA` | 14 studs | quanto o eixo pode ser simplificado |
| `LARG_PATIO` | 45 studs | **acima disso não é rua, é pátio/praça** |
| `RAMO_MIN` | 7 asfalto / 4 terra | ramo menor é coto/fantasma e sai |

**`LARG_PATIO` é a constante que salva o número.** Asfalto e piso de pátio são o mesmo concreto
branco; 35% da mancha de "rua" tem mais de 45 studs de largura. Sem separar, o teste de cobertura
acusa 42% de rua "perdida" que nunca foi rua (a Praça Santa Fé sozinha é 225×436).

`RAMO_MIN` 4 pra terra em vez de 7 levou a cobertura de **88% → 92,6%** — o que faltava eram
trilhas curtas na Vila Pantanal e no Jardim Pavuna.

## Conferência (o pedido do Julio)

```lua
local D = loadstring(game.ServerStorage.MapaDesenho.Source)()
D.conferir(-150, 75, 3900, 6)   -- traços rosa/amarelo FLUTUANDO sobre a cidade real
D.tirarConfere()
```

**Comparar duas fotos (mundo × desenho) não presta: o enquadramento nunca bate.** Por isso os traços
são desenhados por cima da cidade de verdade, no mesmo X/Z, com transparência 0.25. Uma foto só:
rua do mundo sem barra em cima dela é rua que ficou pra trás.

O teste numérico rasteriza os traços de volta e conta célula de rua *detectada* fora de todo traço
*desenhado*. Portão: ≥ 90%.

## Cache da grade

`ServerStorage.GRADE_CACHE` guarda a classificação 650×650 a passo 6 em RLE por linha
(atributos `N`, `X0`, `Z0`, `PASSO`; códigos `v` via, `t` terra, `c` construção, `p` piso,
`g` verde, `a` água, `s` areia, `f` fundo). Com ele dá pra reexportar sem varrer o mundo de novo
(40–55 s economizados por volta).

**Orientação medida, não deduzida:** a linha do RLE é o índice **Z**, a posição dentro da linha é
o índice **X**. Conferido contra a Av. Brasil (NS em x = −9): 315 células de via na coluna 348,
contra 59 na linha 348.

## Entrega pra IA de imagem (18/09)

`D:\T2\Santa fe RP\04_Mapa\santafe_malha.png` e `santafe_malha_sem_nomes.png`, 3000×3000.
479 traços, massa da cidade em células de 24 studs, 18 nomes de rua, 10 bairros, 32 POIs com ponto.

Máscara cinza limpa por proximidade: célula de cidade só vale a ≤ 4 células (96 studs) de alguma
rua — senão areia e piso enchem o mato de mancha.

Dado grande não passa pelo chat: **encolher o formato antes** (índices de grade em vez de coordenada
de mundo, máscara em RLE em vez de milhares de retângulos) levou 101.871 → 20.509 chars, e toda
linha da máscara é conferida por soma (164/164).

Ligado a: `02_Sistemas_Studio/Minimapa.md`, `01_Especificacoes/Minimapa.md`, `01_Especificacoes/Ruas_Enderecos.md`.
