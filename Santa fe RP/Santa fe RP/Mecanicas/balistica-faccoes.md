# Balística + Facções Vivas
- Onde vive: `ArmaRegistro`, `BalisticaService`, `BocaService`, `Boca`, `SuspeitaNucleo`, `F` (cliente/cápsula). Dev place 75467790232298; produção 78083733455249.
## Balística (medido no código, 24/10)
- Cápsula: Neon 150,120,50, 0.30×0.156. Segurar F = 4 s. Revólver não deixa cápsula.
- Evidência: `RAIO_SACO` 3, `RAIO_LIMPAR` 4, `TETO` 150, `ALCANCE_F` 9, `QUEDA_MAX` 8.
- Só Polícia Civil e Federal ensacam (`CORPS_PERICIA`). Outra corp de mão vazia chama `Balistica.limpar` e APAGA as cápsulas.
- Revelar serial: 30–60 s. `LIMA` 1500, 1 uso. `MULTA_PORTE` 2500.
- Origens: loja (registro na pessoa), corp, craft, contrabando, legado (as 3 últimas = "sem registro").
- Serial `AAA-0000-[AAA/dígito]`. Laudo preso à arma, máx. 6. 26 estrias por lado. Aba "Balística" no PC.
- Abordagem marca flagrante: sem registro, no nome de outro, arma de corp com não-membro, arma própria sem porte, raspada.
## Facções
- Níveis: Bonde (sem lab/contrabandista, 0 longa/semana); Firma (lab, contrabandista, 4/sem); Comando (8/sem). `Boca.NIVEL_PADRAO = 2`.
- Cofre `TETO` 150000. Cliente: `INTERVALO` 120, `TETO_SSU` 40, paga 1000–1500, `RESERVA` 1, `SILENCIO_TIRO` 60, `tiroPerto` raio 80.
- Contrabandista (`CATALOGO_CONTRA`): AK47 12000, CAR15 18000, Boito 84 5000, Glock 2500, Colete 8000.
- Produtos (Tools na mochila, `ServerStorage.Tools`): Adrena 45 s/90 s +1.2 vida/s, ressaca 60 s -0.15/s (piso 35); Mira Fina 45/120 s recuo ×0.45, ressaca ×1.30; Casca Grossa 60/150 s caído ×0.55, ressaca 90 s ×1.30.
- `F.estourar`: 50% do cofre vai pro caixa da corp (tipo `patio`), produto/insumo destruído, arma vai pra custódia.
- Insumo controlado: preço 350, peso 0.3; vendido nas lojas ilegais (`PrecosItens`).
- Pavuna não existe mais (boca é de quem chegar). Facção não tem vestiário no jogo.
## Suspeita (`SuspeitaNucleo`)
- Pesos: Mola de Recuo 12, Insumo controlado 5 (`entorpecente`). `LIMITE_PEDIDO` 12, `LIMITE_JANELA` 20, `JANELA_SEG` 3600, `DOBRO_E_ALTA` 2.
- Medido: 1 mola = alerta média; 2 = alta; 1 insumo = nada; 3 no mesmo pedido = média; acumulado: alerta na 4ª em 1 h.
- `alertarCompraIlegal` só dispara perto de loja ilegal (`AlertaPC.Avaliar`, motivo "venda_ilegal").
## Falta / decisões do Julio
- `Boca.estourar` existe mas nada chama (sem ação de jogador).
- Corp de mão vazia apagando cápsula (PM/BOPE/CHOQUE/ROTAM) parece bug.
- Arma "legado" cai em "sem registro" mesmo com porte; não há balcão na DP pra registrar curta antes de 20/11.
- Adulteração (+10 min) NÃO está no regulamento 2.3 nem no código (previsto 2.4).
- Placa numerada: a Tool não faz nada.
