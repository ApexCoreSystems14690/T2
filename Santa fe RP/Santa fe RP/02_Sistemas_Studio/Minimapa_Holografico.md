# Minimapa holográfico — mostrar o mundo, não interpretá-lo

`StarterPlayer.StarterPlayerScripts.Client.Minimapa` (F3). Substituiu a cartografia inteira em 18/09.
Backup da versão anterior: `ServerStorage.Backups.Minimapa_antes_holo`.

## Por que existe

Seis versões tentaram DESENHAR a planta da cidade e nenhuma ficou boa. A medição fechou o caso:
**este mapa foi construído sem nada que diga "aqui é rua"** — calçada, praça, estacionamento e pista
usam a mesma peça, o mesmo material e a mesma cor (ver `MapaDesenho.md`).

A saída, ideia do Julio: parar de interpretar e passar a **mostrar**. Um holograma do que está em volta.
E aí a rua aparece sozinha, como o **vazio entre os blocos** — ninguém precisa detectar rua nenhuma.

## Como funciona

- a cada **0,2 s** `workspace:GetPartBoundsInBox` em volta do jogador;
- cada peça vira uma **caixa lisa** de mesmo `Size`/`CFrame` — MeshPart e Union viram caixa também,
  o que dá a cara de holograma e de quebra tira todo o custo de malha e textura;
- dicionário `[original] = clone`, com entrada e saída incremental (andar não reconstrói nada);
- câmera **inclinada 55°**, girando com a câmera do jogador (não é vista de cima chapada);
- `WorldModel` dentro do `ViewportFrame`, com luz chapada: `Ambient` branco + `LightColor` preto.

## Custo medido (antes de construir)

Raio 110 studs, filtrando peça com mais de 60 studs³:

| lugar | peças |
|---|---|
| Centro | 324 |
| Sol Nascente | 293 |
| D. Industrial | 269 |
| Favela | 225 |

Sem filtro seriam 784 a 2.030. Ajustes finais: raio **110 a pé / 190 dirigindo**, volume mínimo
**22 / 70**, teto duro **620** caixas com histerese (estourou, o filtro de volume sobe sozinho).
Na prática desenha 280–500 caixas.

## A regra de leitura (o teste do Julio)

> *"Só vale quando você olhar para o mapa e dizer: eu conseguiria me guiar por isso, saber o que é
> aquele prédio, saber o que é aquele azul mais forte."*

- **COR = o que a coisa É** — serviço na cor do `N.CORPOI`, carro/peça solta âmbar (255,150,40),
  resto azul (0,196,240).
- **BRILHO e TRANSPARÊNCIA = ALTURA em relação a você** — acima de +10 studs vira vidro
  (transparência 0,74–0,96), e é isso que deixa ver **dentro** do prédio em que você entrou;
  abaixo de −2,5 escurece.

Antes disso era tudo o mesmo azul e "o azul mais forte" não queria dizer nada.

## Chão pintado pelo material

Não é classificação de rua — é só mostrar o material que o motor já sabe:

| material | cor |
|---|---|
| grama, folha | 13,26,18 |
| piso duro (concreto, asfalto, calçada) | 34,44,58 |
| água | 12,30,52 |

Grama × concreto o motor acerta **100%** (medido). Só isso já faz o caminho aparecer.
**O chão é fino:** se o filtro exigir volume ele nunca entra e não há caminho nenhum desenhado —
por isso peça de pegada grande entra pela **pegada**, não pelo volume.

## Rótulos

Até 3 nomes de serviço na tela, os mais próximos. Projeção à mão:

```lua
local rel = cam.CFrame:PointToObjectSpace(p)
local fpx = (lado/2) / math.tan(math.rad(FOV)/2)
local px  =  rel.X / -rel.Z * fpx
local py  = -rel.Y / -rel.Z * fpx
```

A FOV do Roblox é **vertical** e o quadro é quadrado, então a mesma conta serve pros dois eixos.
As âncoras saem das tags `Interact` + `Description` (mesma tabela do `AssarMapa`, copiada pro cliente),
agrupadas a 60 studs.

## Duas armadilhas pagas

- **Com StreamingEnabled as peças com tag chegam aos poucos.** Indexar os POIs uma vez no `iniciar`
  pegou o mapa quase vazio (numa volta 1 rótulo, na seguinte nenhum; o cliente tinha 4.701 das 6.664
  tags). Agora reindexa a cada 6 s, com agrupamento O(n) por grade.
- **`require` do módulo a partir do contexto do assistente devolve OUTRA instância**, não a que o jogo
  está rodando. Mudei `PASSO`, `RECUO` e as cores ao vivo e nada mudou; a leitura de volta mostrava os
  valores originais. Ajuste ao vivo em Play **não funciona**: editar a fonte, parar e reiniciar.

## Transparência sobre transparência vira mingau

A primeira versão, com tudo translúcido, virou um borrão azul sem borda nenhuma. O que funciona é o
contrário: **sólido, com o chão quase preto**.

## As quatro evidências — o método que destacou a rua

Pedido do Julio: *"as ruas, os caminhos, precisam ficar destacados de alguma forma, descubra um método."*

O método é **parar de tentar detectar rua e desenhar as pistas que o autor do mapa já deixou.**
Cada uma sozinha é fraca — meio-fio fecha 63%, poste 69%, nome da peça 54% — mas desenhadas juntas
o olho funde as quatro em "rua".

Medido num raio de 110 no Centro, numa área de ~220 studs de lado:

| evidência | quanto tem | como é desenhada |
|---|---|---|
| `Meio-Fio` | 8 peças, **1.171 studs de linha** | ciano claríssimo (150,250,255) |
| `Poste` | 34 | pontinho de 4 studs **na base**, não risco vertical |
| nome Rua/Avenida/Rodovia/Travessa | 7 lajes | asfalto (62,84,110), mais claro que a calçada |
| `Faixa de Pedestre` / `Ruas-Decais` | 3 | branco — marca o cruzamento |

**Peso de linha:** um meio-fio de 1 stud some num minimapa de 200px. O eixo curto engorda pra 3 studs
e a peça sobe 0,8 — a linha fica por cima do asfalto em vez de brigar com ele. Mesma ideia no poste.

## A hierarquia que fechou

**A rua é a coisa mais clara da tela e todo o resto recua.**

Na primeira volta o prédio era ciano vivo (0,196,240) e roubava o olho do contorno da pista. Virou
massa apagada (32,84,112). Ordem de brilho: guia da rua → POI colorido → massa de prédio → chão.

## "Decalque virando parede" — medido, e não era decalque

São **banco de praça, cadeira, mesa e barraca**: 66 peças rasas no nível do chão virando bloco sólido
e tapando a pista, mais 21 pedaços de árvore.

Regra que ficou — é **tralha** se `altura < 6` **e** `maior lado da pegada < 12` **e** `altura >= 2`.
Raso demais já é chão e passa; alto **ou** comprido é parede de verdade (um muro de 0,8 × 3,4 × 17,4
tem que ficar). Folhagem sai por nome: Leaf, Leaves, Bark, Tree, Planta, Palm.

## Buraco no chão

O chão é **fino**, então exigir volume mínimo (22 studs³) deixava laje de piso de fora e o mapa ficava
com vazio preto. Agora entra também por **pegada**: `pegada >= 28 e altura < 3`, ou
`pegada >= PEGADA_CHAO`. As caixas desenhadas subiram de 269 para 343 no mesmo ponto.

## O que ainda não passa no teste

- prédio genérico continua sendo só um bloco azul sem nome (só serviço tem nome);
- a regra "cor = o que é, brilho = altura" precisa ser aprendida uma vez — não há legenda no jogo;
- árvore fica de fora pelo filtro de volume, então praça só se lê pelo chão verde;
- dois rótulos perto um do outro ainda se sobrepõem.

Ligado a: `02_Sistemas_Studio/MapaDesenho.md`, `01_Especificacoes/Minimapa.md`.
