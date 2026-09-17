# Arquitetura
- CLIENTE: Tema/Motion, HUD, Telas (pilha), Celular (shell+apps), Minigames, Perícia/Central, Minimapa.
- SERVIDOR: Rede v2, Aparelhos, Social, Banco/Salario/Central, Minigame, Empregos/Postes/Uber, Pericia/Multa/Equipamento, DataHandler.
- SITE (Railway): /api/game/celular|central|pericia + painel + Postgres.
- Roblox: TextService (filtro), CaptureService (fotos), DataStore (ProfileService).
