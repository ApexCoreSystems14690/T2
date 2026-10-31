# CNH / prova da auto escola (Gol Auto)

Onde mora: `Modules.CriarGolAuto` (TEMPO_PROVA=420, filtro Hit.Touched, `Reprovar`, `HPProva`); início da prova em `RemotesHandler` (`IniciaCNH`). Gol Auto: HP=100, Blindado=true, HitSpeed=60.
Estado: diagnosticado, CORREÇÃO NÃO APLICADA

## Decisões do Julio
- 25/10: Continua reprovando com "você bateu" mesmo depois do primeiro conserto; mandou arrumar.
- 25/10: "O ideal é geral passar".

## O que está feito
- 25/10: Causa medida: o carro é de rede do cliente, o servidor lê velocidade com atraso/trancos e vê "batida forte" falsa no handler `Hit` ("Você bateu forte o carro e reprovou").

## O que falta
- Tirar a reprovação por batida; reprovar só por tempo (7 min), ficar >5 s fora do carro, ou carro quebrado (HP ≤ 15).
- Zerar HP pra 100 no início de cada prova.
- Backup `ServerStorage.Backups.CNH_<data>` antes; aplicar na place principal 78083733455249 (estava fechada; só o Evento estava aberto); testar; publicar (Julio).

## Armadilhas
- 25/10: Velocidade de carro lida no servidor não é confiável (dono de rede é o cliente) → não reprovar por pico de velocidade/freada.
