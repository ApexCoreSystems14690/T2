# Minigames (protocolo anti-trapaça)
- Cliente só desenha. Servidor gera desafio com seed + guarda t0 + confere com a mesma função pura.
- Fluxo: pedir → {id,tipo,seed,params} → jogar+mandar tempos → conferir (t <= decorrido+0,25; tolerância ±80ms).
- Tipos: Ponteiro (eletricista), Onda (perícia 4 díg 60s), Cartas (carteiro), Cabos/Pneu (mecânico), Pizza, Lixo, Ritmo (SAMU).
- Erro custa tempo/pouca vida, nunca item/dinheiro.
