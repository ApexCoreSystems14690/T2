# Sons de veículo (batida, atropelo, vidro, ônibus)

Onde mora: ServerScriptService.Server.[Carros] Services.ColisaoServer (somBatida); ReplicatedStorage.AcidenteSons; Services.AtropeloService; [Armas] Services.Utils; GLORIOSO.DriveSeat.Motor
Estado: feito (falta ouvir em jogo)

## Decisões do Julio
- 14/10: Sons têm que ser proporcionais: ônibus estava muito baixo, toda batida soava igual, quebrar vidro era super estourado.

## O que está feito
- 14/10: Batida em 3 níveis por sevN: <0.55 leve (vol 0.45-0.80, alcance 55); <0.85 média (0.45-0.65, 95); acima forte (1.35-1.80, 150); PlaybackSpeed 0.94-1.06 aleatório. Moto no grau = média (0.7).
- 14/10: AcidenteSons: BatidaLeve=9113525489, BatidaForte=9116546326, Atropelo=9114850360; Batida=132846127748664 virou a média. AtropeloService usa Atropelo vol 1.2.
- 14/10: Vidro: HitVidro 3→1.0; QuebraVidro 1.5→0.7 (atributo VolumeAntes1410).
- 14/10: Ônibus (GLORIOSO.DriveSeat.Motor, ServerStorage e ReplicatedStorage): RollOffMinDistance 2→7 (atributo RollOffMinAntes1410). Backup Backups_Som_1410.
- 14/10: RMS medidos (vol 1): big3 0.58, Metal Crash 2 0.32, Body Impact 3 0.23, Human Body Impact Vehicle 13 0.25, QuebraVidro 0.34, HitVidro 0.16, AcidenteSons.Vidro 0.13, motor do ônibus 0.67.

## O que falta
- Ouvir em jogo: leve/média/forte, vidro e ônibus. Ajustar vol se ainda desbalanceado.

## Armadilhas
- 14/10: PlaybackLoudness dá 0 no Edit; usar AudioAnalyzer (ver Metodos.md).
