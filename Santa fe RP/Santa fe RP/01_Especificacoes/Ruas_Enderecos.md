# Ruas e endereços — Santa Fé

> Toda posição do mapa tem que virar uma frase que um brasileiro reconhece:
> **"Avenida Brasil, Centro"**. É isso que o minimapa (F3), o app Mapa (F4),
> o chamado do SAMU e o card do objetivo vão mostrar.

## O defeito que isso conserta
`GuiHandler:GetBairro()` fazia raycast pra baixo em `workspace.Ruas` e devolvia
`hit.Name`. **MEDIDO 18/09: as 68 peças se chamavam TODAS "Ruas"** — a função
devolvia literalmente a palavra "Ruas" em qualquer canto da cidade. E ninguém
chamava ela (0 chamadas no jogo inteiro). Fora do asfalto devolvia
`Local não mapeado`, que é a maior parte do tempo.

## A decisão
Endereço é **tabela + matemática**, não raycast.
Módulo: `ReplicatedStorage.Resources.Ruas` — **núcleo puro**, sem Instance,
roda por `loadstring`. Funciona na calçada, dentro de casa, no telhado e no
mato, onde o raycast dá nil.

O raycast continua existindo como **caminho independente de conferência**: se
o nome da peça embaixo do pé bate com o que a tabela respondeu, os dois estão
certos. Foi assim que as 68 peças foram validadas.

## Orientação (declarada, não deduzida)
`-Z = Norte` · `+Z = Sul` · `+X = Leste` · `-X = Oeste`. Está em `R.NORTE`.

## De onde vêm os nomes
Santa Fé existe de verdade: Norte Central do Paraná, microrregião de Astorga.

- `[FATO]` Patrimônio em 28/05/1948, colonização desde 1921. Município pela Lei
  Estadual 2.486 de **16/11/1955**, desmembrado de **Astorga**.
- `[FATO]` Primeiros moradores: **José Emídio, Fioravante Zavate, Dante Ozelim,
  Paulo de Oliveira, Valenciano Mendes** (vieram de SP e MG, plantar café).
- `[FATO]` Colonizador: **Lupércio Carezzato**. 1º prefeito: **Salvador
  Domênico Sobrinho**.
- `[FATO]` Na base de CEP a cidade real tem **1 bairro (Centro)** e **uma** via
  cadastrada: **Avenida Presidente Getúlio Vargas**.
- `[OPINIÃO]` "Rodovia do Café", "Grevíleas", "Ipês" e os nomes de santo são o
  registro típico do interior do Paraná — não são cadastro da cidade real.
- **Lacuna declarada:** não existe lista pública de logradouros de Santa Fé-PR
  além dessa. O resto é registro, não cópia.

Por isso os nomes seguem a regra do norte do Paraná: **pioneiro vira rua**.

## As 18 vias + 7 pontos
| Nome | Tipo | Eixo | Onde |
|---|---|---|---|
| Avenida Presidente Getúlio Vargas | Avenida | Leste-Oeste | Z=50, corta a cidade inteira (1.476 studs) |
| Avenida Brasil | Avenida | Norte-Sul | X=−9, o eixo mais longo (1.696) |
| Avenida Astorga | Avenida | Norte-Sul | X=−336, a saída pra cidade-mãe |
| Avenida Paraná | Avenida | Leste-Oeste | Z=−643, a via do norte |
| Avenida dos Pioneiros | Avenida | Leste-Oeste | Z=643, a via do sul |
| Avenida Lupércio Carezzato | Avenida | Norte-Sul | X=−947, oeste |
| Rua Fioravante Zavate | Rua | LO | Z=950 |
| Rua Dante Ozelim | Rua | LO | Z=−157 |
| Rua Nossa Senhora Aparecida | Rua | LO | Z=−1198 (conjunto) |
| Rua José Emídio | Rua | NS | X=488 |
| Rua Valenciano Mendes | Rua | NS | X=−539 |
| Rua Paulo de Oliveira | Rua | NS | X=−383 |
| Rua Salvador Domênico Sobrinho | Rua | NS | X=−198 |
| Rua Duque de Caxias | Rua | NS | X=376 |
| Rua dos Ipês | Rua | NS | X=−791 |
| Rua das Grevíleas | Rua | NS | X=−882 |
| Rodovia do Café | Rodovia | LO | Z=1062, saída sul (112 de largura) |
| Travessa do Posto | Travessa | NS | X=420 |

Pontos (sem eixo): **Praça Santa Fé** (o centrão, onde estão os bancos de
praça), **Praça do Pioneiro**, **Largo da Feira**, **Trevo do Café**,
**Rua São Cristóvão** (2 rampas) e **Rua Santa Terezinha**.

## Os 10 bairros
Retângulos que **não se tocam** (provado por teste). Medidos nos pontos de
trabalho reais do jogo, não chutados:

| Bairro | Onde | O que tem lá |
|---|---|---|
| Centro | X −420..260, Z −420..380 | Praça Santa Fé, Governo, Loja, VerEmpregos |
| Jardim Alvorada | X −700..−420, Z −420..380 | oeste do centro |
| Vila Operária | X −700..260, Z −900..−420 | corredor da Avenida Paraná |
| Conjunto Sol Nascente | X −1280..−700, Z −1800..−620 | ROTAM, CHOQUE, BM |
| Chácaras do Ivaí | X −1280..−700, Z −620..820 | SAMU, PM |
| Jardim Bandeirantes | X −700..260, Z 380..1000 | Posto, Jornal, Joalheria |
| Parque das Palmeiras | X −700..60, Z 1000..1200 | saída sul |
| Distrito Industrial | X 260..820, Z −1250..600 | Polícia Civil, mecânica |
| Vila Pantanal | X 300..1500, Z 600..1950 | a favela (758 peças) |
| Jardim Pavuna | X 1400..1950, Z −1750..−1150 | emprego Pavuna |

Fora de tudo: **Zona Rural**. É resposta legítima, não falha.

## O nome curto é CAMPO DA TABELA, não cirurgia de string (18/09)
MEDIDO no card do objetivo: `"Av. Presidente Getúlio Vargas - 180 m"` dá **38
caracteres** num rótulo de 170 px com `TextScaled` — encolhe até ficar ilegível.
**11 das 18 vias estouravam.**

O brasileiro já resolve isso sozinho falando só o sobrenome ("a Getúlio", "a
Sobrinho"), então cada via e cada bairro ganharam um campo `curto`:

| Inteiro | Curto |
|---|---|
| Avenida Presidente Getúlio Vargas | **Av. Vargas** |
| Avenida Lupércio Carezzato | **Av. Carezzato** |
| Rua Salvador Domênico Sobrinho | **R. Sobrinho** |
| Rua Nossa Senhora Aparecida | **R. Aparecida** |
| Jardim Bandeirantes | **J. Bandeirantes** |
| Distrito Industrial | **D. Industrial** |
| Conjunto Sol Nascente | **Sol Nascente** |

`R.endereco()` **continua devolvendo o nome inteiro** — quem encurta é só o
`R.curto()`, pra HUD. Um teste garante que todo `curto + " - 180 m"` cabe em 26
caracteres, e que dois logradouros não compartilham o mesmo apelido.

## API
```lua
local R = require(game.ReplicatedStorage.Resources.Ruas)
R.endereco(x, z)   -- "Avenida Brasil, Centro"
R.curto(x, z)      -- "Av. Brasil"  (cabe no card do objetivo)
R.bairroCurto(x,z) -- "J. Bandeirantes"
R.via(x, z)        -- { nome, tipo, dist } ou nil se ninguém está perto
R.bairro(x, z)     -- "Centro" / "Zona Rural"
R.naVia(x, z)      -- está em cima do asfalto?
R.deVetor(pos)     -- mesma coisa com Vector3
R.listar()         -- 25 entradas {nome,tipo,x,z,comp,eixo} pro mapa e o minimapa
```
`R.ALCANCE = 220`: mais longe que isso, "a via mais próxima" seria mentira —
devolve só o bairro.

No GuiHandler: `GetBairro()` (endereço completo), `GetVia()` (curto, pra HUD) e
`EnderecoDe(pos)` (endereço de qualquer ponto — chamado, entrega, ponto do mapa).

## Nas peças
Cada uma das 68 peças de `workspace.Ruas` foi renomeada pra sua via e ganhou
atributos `Via`, `Tipo` e `Bairro`.
**Reversível:** `QA_nome_orig` guarda o nome de antes em cada peça.

## O que isso destrava
- **Minimapa (F3):** rótulo de rua e bússola (`R.NORTE`).
- **App Mapa (F4):** `R.listar()` já entrega nome + posição + comprimento.
- **Chamado do SAMU / polícia:** "ocorrência na Avenida Paraná, Vila Operária".
- **Objetivo da HUD:** `ObjetivoOnde` deixa de ser texto escrito na mão.
- **Entrega / Uber:** destino com endereço de verdade.

## Armadilha anotada
Ao clusterizar as peças, `Size` **não** é a medida no mundo: metade das peças
tem `ry = ±90`, e aí o X local vira Z do mundo. Tem que converter
(`wx = |sx·cos| + |sz·sin|`) antes de decidir se a rua corre em X ou em Z.
Medir `Size` cru dá o eixo trocado em 50% do mapa.


## LIGADO NO CARTEIRO (18/09) — a primeira mecânica de verdade
`RemotesHandler`, ramo `PegarCarta`: assim que a carta entra na mochila, o
servidor publica os três atributos e a HUD acende sozinha.

```lua
plr:SetAttribute("Objetivo", "Entregar carta")
plr:SetAttribute("ObjetivoOnde", Ruas.curto(alvo.Position.X, alvo.Position.Z))
plr:SetAttribute("ObjetivoAlvo", alvo.Position)
```
No ramo `EntregaCarta`, os três voltam pra `nil` antes de destruir a carta.

**PROVADO EM PLAY, ponta a ponta:** o servidor publicou, replicou, e o card
mostrou **"Entregar carta / Av. Astorga - 668 m"**. Andando 120 studs virou
**548 m** sozinho. Texto em 168 px de 170 disponíveis — coube.

### O que a medição pegou nos 18 endereços de entrega
- **8 não têm rua num raio de 220 studs** — 7 deles na favela (Vila Pantanal),
  até 986 studs da avenida mais perto. O `R.curto` cai no **nome do bairro**, que
  é resposta honesta: beco de favela não tem nome de rua mesmo. Se quiser nomear
  (ex.: *Estrada da Vila Pantanal*, *Beco do Cruzeiro*), é linha na `R.VIAS`.
- **`EntregaCarta15` (899, 568) caía em "Zona Rural".** O Distrito Industrial ia
  só até x=820. Passou pra 920.

## Armadilha de Lua anotada
`s:gsub(p, r:gsub(...))` — o `gsub` de dentro devolve **dois** valores e o segundo
vira o **limite** do `gsub` de fora. Como o meu texto não tinha `%`, o contador
era 0, ou seja *"substitua no máximo 0 vezes"*: **25 substituições viraram zero,
em silêncio, sem erro nenhum**. Tem que pôr parênteses: `(r:gsub(...))`.
