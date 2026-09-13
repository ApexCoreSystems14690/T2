# Santa Fé Roleplay — Como funciona a DATA do jogo

Versão 13/09/2026. Cobre: boot do servidor, rede (remotes), DataHandler/ProfileService, o que tem no save, fluxo de entrada do jogador (loading → data → personagem → HUD), e como diagnosticar quando "não entra".

---

## 1. Visão geral em 30 segundos

1. **Servidor liga** → `ServerScriptService.Server.boot` carrega os módulos de `Server/Services` um por um (PlayerHandler primeiro, depois os outros em ordem da árvore).
2. **RemotesHandler** é um desses módulos: ele cria os remotes que o cliente usa (`InventarioAction`, `Interact`, `ToolAction`, `SendData`, ...). **Enquanto ele não carrega, o cliente fica esperando.**
3. **Jogador entra** → `DataHandler` checa banimento, carrega o perfil no **ProfileService** (`CBRP_V1.2`, chave `Player_<UserId>`), completa com o `DataTemplate`, aplica kit inicial / pendências.
4. **Cliente** (`ReplicatedFirst.client.Main`) mostra a tela de loading, carrega assets, e fica em `Aguardando data..` até `GuiHandler:Init()` conseguir `RequestData:InvokeServer()`.
5. Data chega → `_G.Data` no cliente → HUD, inventário, garagem. Se `Genero == ''` abre a escolha de gênero (`_` RemoteFunction).
6. Toda mudança de data no servidor passa por **um único funil**: `DataHandler.updateData:Fire(nomeDoJogador, 'Ordem', ...)`. Quem quer LER usa `DataHandler.requestData:Invoke(nome)`.
7. O servidor devolve o save inteiro pro cliente pelo `SendData` sempre que algo muda (o cliente troca `_G.Data` pelo novo e atualiza o HUD).
8. **Salvar** é automático: ProfileService grava periodicamente e no `Release()` (saída do jogador / BindToClose).

---

## 2. Boot do servidor (`Server.boot`)

Ordem real:

| Etapa | O que faz | Atributo `Etapa` no script |
|---|---|---|
| 0 | `_G.Characters = {}`, música, cria remotes básicos (`PingSync`, `ServerAction`, `Interact`, `ToolAction`, `Tilt`, `BCA`, `RequestData`, `CheckBadge`) via NetworkHandler | `0 inicio` |
| 1 | `require(PlayerHandler)` (SEM pcall — se ele quebrar, o boot morre) e depois `require` de cada módulo em `Services` (com pcall). Avisa `[boot] X levou Ns` se algum passar de 1 s. | `1 services carregados` |
| 2-3 | `PlayerRemoving` salva a casa; `BindToClose` salva todas | `2..3` |
| 4-5 | limpeza de Accessory solto; `PlacementHandler:SetDefaultDatas()` | `4..5` |
| 6 | ciclo dia/noite, música, `SetNetworkOwner(nil)` em tudo que não é personagem | `6 network owner varrido` |
| 7 | fim (`BootCompleto = true`) | `7 FIM` |

**Ordem em que os Services carregam** (ordem da árvore, não alfabética): `CarrosHandler_Concenssionaria, ComandosHandler, DataHandler, MainService, MarketplaceHandler, MecanicaHandler, NetworkHandler, NetworkHandler2, PlacementHandler, [PlayerHandler já foi], RemotesHandler, TrabalhoHandler, pingHandler, softShutdownHandler, AmbientHandler, CorpService, AdminBridge, PortaMalasService`.

Consequência: **tudo que está antes do RemotesHandler atrasa a entrada de todo mundo.** Era isso que estava acontecendo (ver seção 8).

Tempo de boot hoje (medido em Play): **~7 s** (`Server Took`). Antes era 45 s.

---

## 3. Rede — como cliente e servidor se falam

- Todos os remotes vivem em `ReplicatedStorage.Resources.Network`.
- Servidor: `Server.Services.NetworkHandler:GetRemoteEvent(nome)` / `:GetRemoteFunction(nome)` **cria** o remote se não existir.
- Cliente: `Client.NetworkHandler:GetRemoteEvent(nome)` / `:GetRemoteFunction(nome)` **espera** o remote aparecer (`WaitForChild` 20 s, depois tenta a cada 1 s e avisa `[Network] ainda procurando 'X' (N tentativas)` a cada 10).
- O objeto devolvido é um wrapper: use `.Event` / `.Function` pra chegar no remote de verdade (`Remotes.X.Event.OnServerEvent`, `InventarioAction.Function.OnServerInvoke`).

**Anti-exploit do cliente (importante):** o `Client.NetworkHandler` tem o `RunningNameChanger`: a cada 0,5 s ele **renomeia** localmente todos os remotes que já estão no cache pra um nome aleatório. Por isso:
- só existe **um** cache por nome; quem pedir o mesmo remote depois pega do cache, nunca procura de novo pelo nome;
- corrigido em 13/09: dois scripts pedindo o mesmo remote **ao mesmo tempo** antes dele existir faziam o segundo procurar pra sempre (tabela `pendentes` resolve).

Remotes que a data usa:

| Remote | Tipo | Direção | Pra quê |
|---|---|---|---|
| `RequestData` | RemoteFunction | cliente → servidor | cliente pede o save inteiro (`GuiHandler:Init`) |
| `SendData` | RemoteEvent | servidor → cliente | servidor manda o save inteiro depois de mudar algo |
| `InventarioAdd` | RemoteEvent | servidor → cliente | avisos de inventário: `Add`, `Remove`, `Limpa`, `DesequipaAll`, `ComprouSlots` |
| `InventarioAction` | RemoteFunction | cliente → servidor | equipar/desequipar/dropar/excluir item (tratado no RemotesHandler) |
| `Notify` | RemoteEvent | servidor → cliente | notificação no HUD |
| `_` | RemoteFunction (direto em ReplicatedStorage) | cliente → servidor | escolha de gênero na primeira entrada |

---

## 4. DataHandler — o dono do save

Arquivo: `ServerScriptService.Server.Services.DataHandler` (+ filhos `ProfileService`, `DataTemplate`, `requestData` (BindableFunction), `updateData` (BindableEvent), `QA_Pendencia`).

### 4.1 Onde fica o save
- **ProfileService**, store `CBRP_V1.2`, chave `Player_<UserId>`, modo `ForceLoad`.
- Banimento: DataStore separado `BanidosDB-CampoBeloRP.2`, chave `<UserId>_Banido` (true = banido → kick "Você está banido").
- Em Studio o ProfileService avisa `Roblox API services available - data will be saved` → **Play Solo salva de verdade** (cuidado ao testar com a sua conta).

### 4.2 O que acontece no PlayerAdded (`Functions:NewPlayer`)
1. Conta com menos de 30 dias → kick (fora do Studio).
2. Checa banimento (pcall; se o DataStore falhar, deixa entrar).
3. `LoadProfileAsync` (log: `[DataHandler] Carregando perfil de X...` / `carregado em N s`). Falhou → kick "Data could not be loaded.".
4. `ListenToRelease` → se o perfil for liberado (outro servidor pegou), kick.
5. `MergeDataWithTemplate`: chave que não existe no save ganha o valor do `DataTemplate` (recursivo). Pula `Pizza` e `Garrafa de água` de propósito.
6. Kit inicial uma vez por perfil (`KitInicial_`): 2 Pizza + 2 Garrafa de água.
7. Morte real pendente (`CaidoPendente`): perde 25% do dinheiro, vitais 100, vida 26.
8. `Emprego = ''` **sempre** (emprego nunca persiste entre sessões).
9. Atributos no Player: `TemCelular` (se tem item `A10`), `TemMochila`.
10. Gamepass/asset/badge do AMG → ganha o carro `AMG` e 6 slots.
11. Sanitiza `Carros` (carro que não existe mais em `DefaultConfigs` é removido).
12. Log `Espaço usado na data de X N/4,000,000`.
13. `ResetadoDinheiro_` (uma vez): dinheiro 1000, banco 0. `CombatLog = false`.
14. Quando o personagem nascer, aplica `Data.Health` no Humanoid.

### 4.3 Ler a data (servidor)
```lua
local data = script.Parent.DataHandler.requestData:Invoke(plr.Name)  -- tabela VIVA do perfil (referência, não cópia)
```
Bloqueia até 60 s se o perfil ainda não carregou (`WaitForData`). Como é referência, dá pra ler direto; **pra escrever, use o updateData** (senão o cliente não é avisado).

### 4.4 Escrever na data (servidor) — o funil `updateData`
```lua
script.Parent.DataHandler.updateData:Fire(plr.Name, 'IncrementDinheiro', 500)
```
Ordens existentes (todas em `updateData.Event`):

| Grupo | Ordens |
|---|---|
| Dinheiro | `IncrementDinheiro`, `UnincrementDinheiro`, `SetarDinheiro`, `Deposito`, `Saque`, `Transferencia(valor, destinoNome)` |
| Inventário | `AddInventario(item, qtd)` (tenta auto-equipar na barra), `RemoveInventario(item, qtd, idTool)`, `ResetaInventario`, `AddSlot`, `RemoveSlot`, `SetarSlots`, `MaisCapacidade`, `Capacidade("+2")`, `SetTemMochila` |
| Vitais | `Vital+ (nome, qtd)`, `Vital- (nome, qtd)`, `Vida`, `MorteReal`, `CaidoPendente` |
| Carros | `CarroAdd`, `CarroRemove`/`RemoveCarro`, `TransfereCarro`, `NovaCorCarro`, `NovoFarolCarro`, `AumentaPotenciaCarro`, `SetaPotencia`, `AddHp`, `UpdateHP`, `HPCarro`, `CarroGasolina`, `RemoveGasolina`, `AbasteceCarros`, `PortaMalasSet` |
| Visual | `CamisaEquipada`, `CalçaEquipada`, `TrocaCabelo`, `Genero`, `CompraRoupa`, `JBLSkin`/`UpdateJBL`, `Config(nome, valor)` |
| Progresso | `IncrementXP` (sobe level a cada `Level*50`), `IncrementLevel` |
| Emprego/corp | `NovoEmprego`, `SetCooldown(nome)` (grava `os.time()`), `ClearCooldown` |
| Prisão | `Preso(segundos)`, `PresoDiminui` |
| Casa | `CompraCasa`, `AddMovel`, `RemoveMovel` |
| Armas (novo motor) | `Equipamento(slot, {item, dur})` |
| Admin | `resetar` (zera tudo e libera o perfil), `Banido`, `SetCombatLog`/`CombatLog`, `ProdutoCompra` |

A maioria termina com `SendData:FireClient(plr, Data)` → cliente atualiza `_G.Data` e o HUD. Ordens que **não** mandam SendData (ex.: `SetCooldown`, `NovaCorCarro`, `TrocaCabelo`) mudam só no servidor até a próxima sincronização.

### 4.5 Saída do jogador (`PlayerLeaving`)
- Apaga `Cone`/`Barricada` do save, tira o nome das pastas `ServerStorage.Assets.*Plrs` (contagem de policiais).
- **CombatLog = true** fora do Studio: dinheiro ÷ 50, inventário zerado, emprego zerado (punição de sair em combate).
- `Profile:Release()` → ProfileService salva.

---

## 5. O que tem dentro do save (`DataTemplate`)

```
Dinheiro=1000  Banco=0  Fome/Sono/Sede=100  Health=100  Level=1  XP=0
Inventario = { ['Pizza']=2, ['Garrafa de água']=2 }   -- item -> quantidade
Carros = { [nome] = {P=potência, G=gasolina, H=hp, C=cor, CF=farol, PortaMalas={slot=item}} }  (vem de [Carros] Services.Modules.DefaultConfigs)
Casas={}  Moveis={}  Roupas={}
Configs = { Sangue, JBL, CarrosSons, Notificacoes, Tema='255-170-0' }
JBL='' Camisa='' Calca='' Cabelo='' Genero=''   -- '' = padrão / não escolhido
Emprego=''   -- zerado a cada login
Preso=0      -- segundos de pena restantes
Capacidade=12 (kg da mochila)  TemMochila=false  Slots=4 (barra; 6 com gamepass)
CombatLog=false  ResetadoDinheiro_=false  KitInicial_=false
Cooldowns = { [nome] = os.time() }   -- turnos de salário (BM, PC, PF, SAMU...), etc.
Equipamento = { colete={item,dur}, capacete={item,dur} }
CaidoPendente = os.time() | nil
```
Chaves com `_` no fim são "já apliquei uma vez" (migrações). Pra criar uma chave nova: adiciona no `DataTemplate` — o merge coloca em todo perfil antigo no próximo login.

---

## 6. Fluxo de entrada do jogador (cliente)

1. `ReplicatedFirst.client.Main` (roda antes de tudo): desliga CoreGui, `require(Loading):Init()`, depois `require` de todos os módulos de `PlayerScripts.Client` em paralelo e chama `GuiHandler:Init()`. Marca `_G.Loaded = true` e imprime o banner `===== 🧉 SANTA FÉ 🧉 =====`.
2. `Loading` (tela de carregamento): `Aguardando servidor..` → pré-carrega ~200 assets (`Carregando assets...`) → **`Aguardando data..`** (espera `_G.Data`, `_G.Data.Genero`, `_G.Data.Emprego`) → se `Genero == ''` abre a escolha Masculino/Feminino (`ReplicatedStorage["_"]:InvokeServer("Masculino")`) → `Aguardando client..` (espera `_G.Loaded`) → some.
3. `GuiHandler:Init()`: `repeat wait(1) RequestData:InvokeServer() until tabela` → `_G.Data = Data` → inventário, lojas, garagem, HUD, conecta `SendData` e `Notify`, hotbar.
4. Personagem: `PlayerHandler.AddRoupas` espera `_G.Characters[plr]`, lê a data, aplica gênero/camisa/calça, `SetCombatLog false`, e se `Preso ~= 0` manda pra penitenciária.
5. **~25 s depois do spawn** o `Client.CharacterHandler` termina de esperar o BillboardGui e faz `ChangeState(Physics) → Running` (isso desenta o personagem se ele já estiver sentado — só importa pra testes automáticos).

Onde cada "travou" aparece na tela:

| Texto na tela de loading | Está esperando | Onde olhar |
|---|---|---|
| `Aguardando servidor..` | PreloadAsync dos 4 assets iniciais | rede/assets |
| `Carregando assets...` | os ~200 assets (barra) | normal demorar 10-30 s |
| `Aguardando data..` | `RequestData` responder (servidor ainda sem DataHandler/perfil) | console do servidor: `[DataHandler] Carregando perfil...` |
| `Aguardando client..` | `_G.Loaded` (o `client.Main` terminar de dar require nos módulos) | erro em algum módulo de `Client` |

---

## 7. Diagnóstico rápido

**Cliente preso em `[Network] ainda procurando 'X'`**
- Olha o console do **servidor**: apareceu `[boot] chegou ao fim` e `Server Took: N s`? Se não, algum Service travou o boot (o `[boot] X levou Ns` diz quem).
- Se o servidor terminou e o cliente continua: era a corrida do NameChanger (corrigida 13/09). Se voltar, ver `Client.NetworkHandler` → `pendentes`.

**`Aguardando data..` sem fim**
- Servidor: tem `[DataHandler] Carregando perfil de X...`? Se tem "Carregando" sem "carregado", o ProfileService está preso (outro servidor/Studio segurando o perfil — `ForceLoad` costuma resolver em ~10-60 s; ou API services desligados no Studio: `Game Settings → Security → Enable Studio Access to API Services`).
- Kick `Data could not be loaded.` = DataStore falhou.

**Data errada / não salvou**
- Só mexa no save pelo `updateData`; escrita direta na tabela funciona mas não avisa o cliente.
- Play Solo **salva**; pra testar sem sujar o save use outra conta ou o comando `resetar` do painel.
- Tamanho do save aparece no log (`Espaço usado ... /4,000,000`).

**Avisos que são normais (pré-existentes, não bloqueiam)**
- `Sertex is not a valid member of ModuleScript MainService` — módulo de lista de servidores privados que nunca existiu; o boot ignora (pcall).
- `Infinite yield possible on ReplicatedStorage:WaitForChild("LeakPunishEvent")` / `("RemoteEvents")` — scripts antigos esperando remotes que não existem mais.
- `rotorKitModule:WaitForChild("Main")`, `Workspace:WaitForChild("SafeZones")`.
- `Clamped specified Density value of 0` (CriarAmbulancia).

---

## 8. O que foi corrigido em 13/09/2026 (entrada lenta / travada)

1. **Corrida no `Client.NetworkHandler`** (backup `ServerStorage.Backups.NetworkHandler_cli_antes_corrida`): dois pedidos simultâneos do mesmo remote + NameChanger = segundo pedido nunca achava. Agora só um procura por nome; o resto espera o cache.
2. **Boot de 45 s → 7 s** (`CarrosHandler_Concenssionaria`, backup `_antes_boot`): o `Start()` das 61-69 viaturas rodava em série (2 `wait()` + solda de todas as peças por carro) antes do RemotesHandler existir. Agora cada viatura inicia em `task.spawn` (com pcall); o boot segue e as viaturas ficam prontas em background (~30 s, log `[boot/carros] N viaturas prontas em Ns`).
3. **`CriarVeiculosGovernamentas.SpawnVeiculos`** (backup `_antes_boot`): varria o workspace inteiro 11 vezes; agora 1 vez com índice por nome.
4. **`boot`**: avisa `[boot] <Service> levou Ns` pra qualquer módulo acima de 1 s.

**Achado para decidir:** 8 viaturas PF pré-colocadas no workspace (Camburão PF ×4, Corolla PF ×3, S10 PF ×1, em torno de (540..571, y 24-32, -1050..-1133)) estão **abaixo do piso** da base (piso ≈ y 45). Todo boot elas desancoram, caem no vazio e somem. A base já recebe Duster PC ×7 + S10 PC ×3 + Blindado PF pelos spawns. Sugestão: apagar essas 8 do workspace (ou subir pro piso).

---

## 9. Receitas

**Dar dinheiro / item pra alguém (servidor):**
```lua
local DH = game.ServerScriptService.Server.Services.DataHandler
DH.updateData:Fire("NomeDoJogador", "IncrementDinheiro", 1000)
DH.updateData:Fire("NomeDoJogador", "AddInventario", "Pizza", 3)
```

**Ler algo (servidor):**
```lua
local d = DH.requestData:Invoke("NomeDoJogador")
print(d.Dinheiro, d.Emprego, d.Inventario["Glock"])
```

**Ler no cliente:** `_G.Data` (só leitura; qualquer mudança tem que vir do servidor via SendData).

**Criar uma chave nova no save:** adiciona no `DataHandler.DataTemplate` → todo perfil ganha no próximo login. Se precisar migrar valor, crie uma flag `MinhaMigracao_ = false` e trate no `NewPlayer` como o `ResetadoDinheiro_`.

**Testar a entrada do zero:** outra conta ou `resetar` pelo painel; pra ver os tempos, procure no console `Server Took`, `[boot]`, `[DataHandler]`, `[Network]`, `=====` (banner do cliente = client carregado).
