# Manual — Banco de dados do Santa Fé RP

## 1. Como os dados são salvos

- O jogo usa **ProfileService** (módulo em `ServerScriptService.Server.Services.DataHandler.ProfileService`).
- **Nome do DataStore:** `CBRP_V1.2` (definido no `DataHandler`, linha do `GetProfileStore`).
- **Chave de cada jogador:** `Player_<UserId>`. Ex.: `Player_2362538543`.
- O que fica salvo em cada chave é um JSON assim:

```
{
  "Data": { Dinheiro, Banco, Fome, Sede, Sono, Inventario, Carros, Level, XP, ... },
  "MetaData": { ActiveSession, LastUpdate, ... },   ← controle do ProfileService, não mexer
  "GlobalUpdates": [...]
}
```

- Os campos de `Data` e os valores iniciais estão no `DataTemplate` (`DataHandler.DataTemplate`).
- **Por que salva até no Studio?** Porque a opção *"Enable Studio Access to API Services"* está ligada em `Game Settings → Security`. Com ela ligada, o Studio usa o DataStore **real**, o mesmo do jogo publicado. Por isso teu perfil "lembra" o que tu fez nos testes.

> Dica: se quiser testar com dados sempre zerados, é só desligar essa opção. Aí o ProfileService usa um banco falso em memória que some quando o teste fecha. Liga de novo quando quiser testar persistência.

---

## 2. Ver e editar pelo site (jeito mais fácil)

1. Abre o **Creator Hub**: `create.roblox.com` → **Creations** → clica no jogo (Santa Fé).
2. No menu da esquerda: **Data Stores** (em alguns idiomas "Armazenamentos de Dados").
3. Escolhe o store **`CBRP_V1.2`**.
4. Busca a chave: `Player_<UserId>` (o UserId aparece no perfil do jogador no site, na URL `roblox.com/users/<UserId>/profile`).
5. Clica na entrada → aparece o JSON. Dá pra **editar o valor e salvar**.

Regras pra não quebrar nada:
- Edita **só** dentro de `"Data"`. Não mexe em `MetaData` nem `GlobalUpdates`.
- O jogador **precisa estar offline** (fora do jogo e fora do Studio). Se ele estiver online, o ProfileService sobrescreve o que tu editou na próxima gravação.
- Mantém o tipo: número continua número (`"Dinheiro": 5000`), texto com aspas, tabela com chaves.

Exemplo — dar 2 pizzas e 10 mil:

```json
"Dinheiro": 10000,
"Inventario": { "Pizza": 2, "Garrafa de água": 2 }
```

---

## 3. Ver e editar pela Command Bar do Studio

Abre `View → Command Bar` (em modo **Edit**, não em Play). Cola um dos trechos abaixo e dá Enter.

### Ler os dados de um jogador (só leitura, seguro)

```lua
local ds = game:GetService("DataStoreService"):GetDataStore("CBRP_V1.2")
local userId = 2362538543 -- troca pelo UserId
local v = ds:GetAsync("Player_"..userId)
print(game:GetService("HttpService"):JSONEncode(v and v.Data or "sem perfil"))
```

### Editar um campo (jogador OFFLINE)

```lua
local ds = game:GetService("DataStoreService"):GetDataStore("CBRP_V1.2")
local userId = 2362538543
ds:UpdateAsync("Player_"..userId, function(old)
	if not old or not old.Data then return nil end -- não cria perfil do nada
	old.Data.Dinheiro = 5000
	old.Data.Inventario["Pizza"] = 2
	return old
end)
print("ok")
```

### Apagar o perfil (volta ao zero na próxima entrada)

```lua
local ds = game:GetService("DataStoreService"):GetDataStore("CBRP_V1.2")
ds:RemoveAsync("Player_2362538543")
print("perfil removido")
```

### Listar as últimas chaves salvas

```lua
local ds = game:GetService("DataStoreService"):GetDataStore("CBRP_V1.2")
local pages = ds:ListKeysAsync()
for _, k in ipairs(pages:GetCurrentPage()) do print(k.KeyName) end
```

---

## 4. Mexer nos dados com o jogador ONLINE (dentro do Play)

Com o jogador dentro do jogo, o jeito certo é passar pelo `DataHandler`, que já atualiza a HUD sozinho.
Na Command Bar, com o Play rodando e o datamodel **Server** selecionado:

```lua
local upd = game.ServerScriptService.Server.Services.DataHandler.updateData
local nome = "masternerdtop" -- nome do jogador

upd:Fire(nome, 'IncrementDinheiro', 1000)          -- +1000 na carteira
upd:Fire(nome, 'UnincrementDinheiro', 500)         -- -500
upd:Fire(nome, 'AddInventario', 'Pizza', 2)        -- dá 2 pizzas (vai pra barra se tiver vaga)
upd:Fire(nome, 'RemoveInventario', 'Pizza', 1, '') -- tira 1 pizza
upd:Fire(nome, 'IncrementLevel', 5)                -- +5 levels
upd:Fire(nome, 'CarroAdd', 'AMG')                  -- dá um carro
upd:Fire(nome, 'resetar')                          -- zera o perfil e desconecta
```

Ler os dados do jogador online:

```lua
local req = game.ServerScriptService.Server.Services.DataHandler.requestData
local d = req:Invoke("masternerdtop")
print(game:GetService("HttpService"):JSONEncode(d))
```

Todas as ordens aceitas estão no `DataHandler`, dentro do `script.updateData.Event:Connect(...)` — cada `elseif ordem == '...'` é uma.

---

## 5. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Jogador preso em "Aguardando data.." | `LoadProfileAsync` não retornou (DataStore fora do ar, HTTP 500) ou erro antes dele | Abrir o Output (F9) no Studio do jogador e procurar `[DataHandler]` — agora ele loga "Carregando perfil…" e "carregado/FALHOU em Xs" |
| `HTTP 500` / `HTTP 502` no Output | Instabilidade do DataStore da Roblox | Esperar e tentar de novo; o ProfileService tenta sozinho |
| Editei no site e não mudou | Jogador estava online | Tirar o jogador do jogo, editar, depois entrar |
| `Data could not be loaded.` (kick) | Perfil travado por outra sessão que caiu | Esperar ~1 min e entrar de novo (o `ForceLoad` libera) |
| Quero testar como jogador novo | Perfil já existe | Apagar a chave (seção 3) **ou** desligar o acesso à API no Studio |

---

## 6. Flags de "uma vez só" que existem no perfil

- `ResetadoDinheiro_` — já resetou o dinheiro pra 1000 uma vez.
- `KitInicial_` — já recebeu 2 Pizza + 2 Garrafa de água.

Pra reaplicar em um jogador, é só apagar o campo (ou pôr `false`) com o jogador offline.
