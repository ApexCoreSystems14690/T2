# Backup dos perfis do Santa Fé

O que o ProfileService guarda (dinheiro, carros, inventário, casas, level, emprego)
mora no **DataStore da experiência** — universe `10767108673`. Isso não acompanha a
place pra lugar nenhum. A única forma de tirar de lá é pela **Open Cloud DataStore
API**, que é o que estes dois scripts fazem.

O banco do site (`D:\T2`, Postgres no Railway) é outra coisa e **não precisa disto** —
ele é chaveado por `roblox_id` e sobrevive a qualquer mudança de experiência.

## As lojas

| Loja | O que é | Chaves em 26/09 |
|---|---|---|
| `CBRP_V1.2_T2` | temporada 2 — **a viva** | 78 |
| `CBRP_V1.2` | temporada 1 — morta | 1 |
| `CBRP_Temporada` | qual temporada está valendo | 1 |

Chave de cada jogador: `Player_<UserId>`.

## 1. Criar a chave da API

create.roblox.com → Creator Dashboard → **Open Cloud → API Keys** → Create API Key.

- **System:** Data Store
- **Experience:** Santa Fé Roleplay
- **Permissões:** `Read` e `List` (pra exportar). Pra importar num destino novo,
  a chave DO DESTINO precisa de `Read` e `Write`.
- **IP:** `0.0.0.0/0` se não tiver IP fixo
- Copie a chave na hora — o Roblox só mostra uma vez.

A chave não entra em arquivo nenhum. Ela vai por variável de ambiente e não sai do seu PC.

## 2. Exportar (faça hoje, custe o que custar a moderação)

```powershell
cd D:\T2\backup_perfis
$env:ROBLOX_API_KEY="sua_chave"
node exportar_perfis.js
```

Sai uma pasta `perfis_2026-09-30\` com um JSON por jogador. No fim ele **relê tudo
que salvou** e diz quantos arquivos voltam como perfil válido — se esse número não
bater com as 78 chaves, não confie no backup.

Guarde essa pasta fora do PC também (drive, pendrive). É o seu seguro.

## 3. Importar — só se você decidir mudar de experiência

Primeiro em seco, sem escrever nada:

```powershell
$env:ROBLOX_API_KEY="chave_do_DESTINO_com_write"
node importar_perfis.js perfis_2026-09-30 <universeId_novo> --teste
```

Deu certo, tira o `--teste`.

**A única coisa que ele muda no caminho:** zera o `MetaData.ActiveSession` de cada
perfil. Esse campo é a trava de sessão do ProfileService — ele diz "este perfil está
aberto no servidor X". Copiado como está, o jogador entraria na experiência nova e o
ProfileService ficaria esperando uma sessão que nunca vai fechar. O resto vai byte a byte.

## O que continua faltando depois de importar

Os perfis voltam, mas o resto do que amarra o jogo na experiência **não vem junto**:

- **Gamepasses e produtos** (a AMG é gamepass) — id novo, e quem comprou perdeu
- **Badges**
- **Assets do grupo** ligados por id
- O **`game_config.temporada`** no site aponta pra loja, não pra universe — esse continua valendo

Ou seja: mesmo com os 78 perfis salvos, mudar de experiência ainda custa os gamepasses
dos jogadores. Isso não tem migração.
