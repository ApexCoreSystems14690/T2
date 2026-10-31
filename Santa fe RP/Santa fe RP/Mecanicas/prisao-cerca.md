# Cerca da prisão
- 24/10: preso fugia da cadeia (`CaidoService.Morrer` teleporta pro hospital sem checar `Preso`).
- Feito: `Server.CercaPrisao`: preso fora da caixa X -2050..-1860, Y 20..130, Z -335..-170 volta à cela (-1924.955, 44.273, -272.936) a cada 0.5 s. Teste 6/6.
- Falta: teste em Play; decidir se o hospital deve respeitar `Preso` direto no `CaidoService`.
