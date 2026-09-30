/*
  IMPORTAR OS PERFIS PRA OUTRA UNIVERSE  (Open Cloud DataStore API)

  SO RODE ISTO SE VOCE DECIDIR MESMO MUDAR DE EXPERIENCIA.
  Ele ESCREVE por cima no destino. Nao tem desfazer.

  COMO RODAR:
      $env:ROBLOX_API_KEY="chave_com_permissao_de_WRITE_no_DESTINO"
      node importar_perfis.js  perfis_2026-09-30  <universeId_de_destino>

  Pra ver o que ele FARIA sem escrever nada (faca isso primeiro):
      node importar_perfis.js  perfis_2026-09-30  <universeId_de_destino>  --teste

  A CHAVE do destino precisa de: Data Store -> Read, Write (List nao precisa).

  O QUE ELE MUDA NO CAMINHO (de proposito):
    . zera o MetaData.ActiveSession de cada perfil. Esse campo e a trava de
      sessao do ProfileService -- diz "este perfil esta aberto no servidor X".
      Copiado como esta, o jogador entraria na experiencia nova e o
      ProfileService ficaria esperando uma sessao que nunca vai fechar, ou
      roubaria a trava depois de ~30 min. Zerar e o certo.
    . nao mexe em mais NADA. Dinheiro, carros, inventario, casas: byte a byte.
*/

const fs     = require("fs");
const path   = require("path");
const crypto = require("crypto");

const [, , pastaArg, destinoArg, ...resto] = process.argv;
const TESTE = resto.includes("--teste");

if (!pastaArg || !destinoArg) {
  console.error("\n  uso: node importar_perfis.js <pasta_do_backup> <universeId_destino> [--teste]\n");
  process.exit(1);
}
const CHAVE = process.env.ROBLOX_API_KEY;
if (!CHAVE) { console.error("\n  Falta ROBLOX_API_KEY.\n"); process.exit(1); }

const DESTINO_UNIVERSO = Number(destinoArg);
if (!Number.isFinite(DESTINO_UNIVERSO) || DESTINO_UNIVERSO <= 0) {
  console.error("\n  universeId de destino invalido.\n"); process.exit(1);
}
const PASTA = path.isAbsolute(pastaArg) ? pastaArg : path.join(__dirname, pastaArg);
if (!fs.existsSync(PASTA)) { console.error("\n  pasta nao existe: " + PASTA + "\n"); process.exit(1); }

const BASE = `https://apis.roblox.com/datastores/v1/universes/${DESTINO_UNIVERSO}/standard-datastores`;

// tira a trava de sessao, mantendo todo o resto igual
function limparTrava(corpo) {
  let dado;
  try { dado = JSON.parse(corpo); } catch { return { corpo, mexeu: false }; }
  let mexeu = false;
  // ProfileService: [1]=Data [2]=MetaData [3]=GlobalUpdates [4]=RobloxMetaData [5]=UserIds
  const meta = Array.isArray(dado) ? dado[1] : (dado && dado.MetaData);
  if (meta && typeof meta === "object" && meta.ActiveSession != null) {
    meta.ActiveSession = null;
    mexeu = true;
  }
  return { corpo: JSON.stringify(dado), mexeu };
}

async function gravar(loja, chave, corpo, userIds, atributos) {
  const url = `${BASE}/datastore/entries/entry?datastoreName=${encodeURIComponent(loja)}&entryKey=${encodeURIComponent(chave)}`;
  const md5 = crypto.createHash("md5").update(corpo, "utf8").digest("base64");
  for (let t = 1; t <= 5; t++) {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": CHAVE,
        "content-type": "application/json",
        "content-md5": md5,
        "roblox-entry-userids": userIds || "[]",
        "roblox-entry-attributes": atributos || "{}",
      },
      body: corpo,
    });
    if (r.status === 429) { await new Promise(s => setTimeout(s, 2000 * t)); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text().catch(()=> "")).slice(0,300)}`);
    return;
  }
  throw new Error("limite de taxa 5x seguidas");
}

(async () => {
  console.log(`\n  ${TESTE ? ">>> MODO TESTE: nao escreve nada <<<" : ">>> ESCREVENDO DE VERDADE <<<"}`);
  console.log(`  de: ${PASTA}`);
  console.log(`  para: universe ${DESTINO_UNIVERSO}\n`);

  const lojas = fs.readdirSync(PASTA, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);

  let totalOk = 0, totalTravas = 0;
  const erros = [];

  for (const loja of lojas) {
    const arquivos = fs.readdirSync(path.join(PASTA, loja)).filter(a => a.endsWith(".json"));
    process.stdout.write(`  ${loja.padEnd(18)} ${arquivos.length} perfis`);
    let ok = 0, travas = 0;
    for (const arq of arquivos) {
      try {
        const e = JSON.parse(fs.readFileSync(path.join(PASTA, loja, arq), "utf8"));
        const { corpo, mexeu } = limparTrava(e.corpo);
        if (mexeu) travas++;
        if (!TESTE) await gravar(loja, e.chave, corpo, e.userIds, e.atributos);
        ok++;
      } catch (err) {
        erros.push(`${loja}/${arq}: ${err.message}`);
      }
    }
    console.log(`  -> ${ok} ${TESTE ? "prontos" : "gravados"}${travas ? `, ${travas} com trava de sessao limpa` : ""}`);
    totalOk += ok; totalTravas += travas;
  }

  console.log(`\n  ${totalOk} perfis ${TESTE ? "passariam" : "gravados"}, ${totalTravas} travas de sessao limpas.`);
  if (erros.length) {
    console.log(`  ${erros.length} ERROS:`);
    for (const e of erros.slice(0, 10)) console.log("    " + e);
  }
  if (TESTE) console.log(`\n  Nada foi escrito. Tire o --teste pra valer.\n`);
  else console.log(`\n  Confira no jogo novo antes de anunciar pra galera.\n`);
})();
