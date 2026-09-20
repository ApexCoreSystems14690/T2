# OLX — mercado de itens entre jogadores

Reescrita em 20/09 (item 1 da ordem do [[Mapa_Celular]]). Antes era um mural volátil
alimentado pelo `/olx` do chat; agora o anúncio mora no site e sobrevive à troca de servidor.

## Regras
- Anúncio dura **7 dias**, **5 ativos** por jogador, preço 1..100.000.000.
- **O item sai do inventário no anúncio** e só volta se cancelar ou vencer.
- Compra direta: cobra o comprador, entrega o item, credita o vendedor.
  Vendedor online recebe na hora; offline recebe **no próximo login** (`olx_vendas.pago_em`).
- Não dá pra comprar o próprio anúncio.
- Confirmação em dois cliques no card (o primeiro arma por 4 s), pra um toque errado não
  gastar o dinheiro do jogador.

## Onde está
- Cliente: `StarterPlayer...Client.GuiHandler.Celular.OLX` (módulo; o hub `Celular:Init()`
  requer todos os filhos). Tela: `StarterGui.Main.Celular.Telas.OLX`.
  Backup do bloco inline antigo: `ServerStorage.Backups.GuiHandler_antes_olx`.
- Servidor: ações `olx_feed / olx_meus / olx_anunciar / olx_comprar / olx_cancelar` no
  [[CelularService]]; chamadas HTTP no [[SiteCelular]]; `Site.postar` (bloqueante) no [[Site]].
- Site: tabelas `olx_anuncios` / `olx_vendas`, rotas `/olx/*` — ver [[Dados_Site]] e [[API_Site]].

## As três armadilhas que o desenho evita
1. **Item duplicado.** O item sai do inventário ANTES de chamar o site. Se ficasse lá
   enquanto o site pensa, dava pra anunciar e largar o item no chão antes da resposta.
   Se o site recusar, o item volta na hora.
2. **Dois compradores, um item.** Quem reserva é o `UPDATE ... WHERE status='ativo'` dentro
   de uma transação no Postgres. Quem chega segundo recebe 0 linhas → 409 → o jogo nem cobra.
   Testado com 8 compradores simultâneos: 1 leva, 7 tomam "já foi vendido".
3. **Item somindo.** Depois que o site reserva, o anúncio já é do comprador. Se ele não
   tiver saldo, o jogo desfaz devolvendo o anúncio pro vendedor (o item volta pra ele pelo
   `/olx/devolver`) em vez de simplesmente recusar — senão o item ficaria preso.

## Detalhes de UI que custaram foto
- `Main` usa `ZIndexBehavior.Global`: filho com o MESMO ZIndex do pai pode ser desenhado
  ATRÁS dele. No molde do card tudo estava em 2 e o texto sumia. Agora card=4, filhos=5.
- A bolinha `bola` do molde caía em cima do preço (medido: valor ia até x=243, bolinha
  começava em 215). Ela foi pro canto direito e o valor encolheu.
- O `ScrollingFrame` da tela nasce `Visible = false` no StarterGui — quem liga é o `Init()`.
- **Névoa engana foto de SurfaceGui.** A 17 studs o texto escuro do card sumia na captura e
  parecia bug de UI; a 8 studs lê perfeitamente. Fotografar painel de QA de perto.

## O que ainda NÃO faz
- **Item único.** O anúncio guarda `nome + quantidade`. Uma arma com histórico próprio
  perderia a identidade ao trocar de mão. Depende de `ItensUnicos` no perfil, que não existe.
- Anunciar carro/casa (só entra o que está no `Inventario`).
- O celular vendido pela OLX não grava `motivo='olx'` em `aparelho_donos` (o rastreio da
  [[Pericia]] fica cego nessa passagem).
