# Rede v2 (remotes + limitador)
- Pasta `ReplicatedStorage.Rede`: 1 par por área (RF <area> + RE <area>Evt), criado por [[Rede_Server]].
- Valida TIPO e LIMITE (balde de fichas por jogador) antes de chamar o serviço. Estouro = {erro="devagar"}.
- Cliente usa [[RedeCliente]] (chamar/ouvir). Servidor→cliente: Rede.enviar/todos.
- Áreas: Celular (RF+Evt). Planejadas: Minigame, Central, Pericia, Hud.
