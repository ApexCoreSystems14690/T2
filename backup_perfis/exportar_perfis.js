/*
  EXPORTAR OS PERFIS DO SANTA FE  (Open Cloud DataStore API)

  Tira uma copia FIEL de tudo que o ProfileService guardou na universe, em
  arquivos JSON aqui no seu PC. Nao escreve nada no Roblox -- so le.

  COMO RODAR (PowerShell, na pasta D:\T2\backup_perfis):
      $env:ROBLOX_API_KEY="cole_sua_chave_aqui"
      node exportar_perfis.js

  COMO RODAR (cmd):
      set ROBLOX_API_KEY=cole_sua_chave_aqui
      node exportar_perfis.js

  A CHAVE: crie em create.roblox.com -> Creator Dashboard -> Open Cloud ->
  API Keys -> Create API Key.
    . System: "Data Store"
    . Experience: Santa Fe Roleplay (universe 10767108673)
    . Permissoes: Read  E  List  (pra exportar so precisa dessas duas)
    . IP: 0.0.0.0/0 se nao souber seu IP fixo
  A chave NAO entra neste arquivo e nao sai do seu PC.
*/

const fs   = require("fs");
const path = require("path");

const UNIVERSO = 10767108673;               // Santa Fe Roleplay
const LOJAS = [
  "CBRP_V1.2_T2",   // temporada 2 -- a loja VIVA (78 chaves em 26/09)
  "CBRP_V1.2",      // temporada 1 -- morta, mas backup e backup
  "CBRP_Temporada", // qual temporada esta valendo
];

const CHAVE = process.env.ROBLOX_API_KEY;
if (!CHAVE) {
  console.error("\n  Falta a chave. Rode assim:\n");
  console.error('    $env:ROBLOX_API_KEY="sua_chave"   (PowerShell)');
  console.error("    set ROBLOX_API_KEY=sua_chave      (cmd)\n");
  process.exit(1);
}

const BASE = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSO}/standard-datastores`;
const DESTINO = path.join(__dirname, "perfis_" + new Date().toISOString().slice(0, 10));

async function pedir(url) {
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    const r = await fetch(url, { headers: { "x-api-key": CHAVE } });
    if (r.status === 429) {                       // limite de taxa: espera e tenta de novo
      await new Promise((s) => setTimeout(s, 2000 * tentativa));
      continue;
    }
    if (!r.ok) {
      const corpo = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status} em ${url}\n${corpo.slice(0, 400)}`);
    }
    return r;
  }
  throw new Error("estourou o limite de taxa 5 vezes seguidas: " + url);
}

async function listarChaves(loja) {
  const chaves = [];
  let cursor = "";
  do {
    const url = `${BASE}/datastore/entries?datastoreName=${encodeURIComponent(loja)}&limit=100`
      + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : "");
    const r = await pedir(url);
    const j = await r.json();
    for (const k of j.keys || []) chaves.push(k.key);
    cursor = j.nextPageCursor || "";
  } while (cursor);
  return chaves;
}

async function pegarEntrada(loja, chave) {
  const url = `${BASE}/datastore/entries/entry?datastoreName=${encodeURIComponent(loja)}&entryKey=${encodeURIComponent(chave)}`;
  const r = await pedir(url);
  // o corpo cru, sem passar por JSON.parse/stringify: o import tem que gravar
  // byte a byte o que estava la
  const corpo = await r.text();
  return {
    chave,
    corpo,
    // esses cabecalhos fazem parte do dado. UserIds e o vinculo de GDPR que o
    // ProfileService grava; sem eles a copia fica incompleta.
    versao:     r.headers.get("roblox-entry-version") || null,
    criadoEm:   r.headers.get("roblox-entry-created-time") || null,
    userIds:    r.headers.get("roblox-entry-userids") || "[]",
    atributos:  r.headers.get("roblox-entry-attributes") || "{}",
  };
}

(async () => {
  console.log(`\n  Universe ${UNIVERSO} -> ${DESTINO}\n`);
  fs.mkdirSync(DESTINO, { recursive: true });
  const resumo = { universo: UNIVERSO, quando: new Date().toISOString(), lojas: {} };

  for (const loja of LOJAS) {
    process.stdout.write(`  ${loja.padEnd(18)} listando... `);
    let chaves;
    try {
      chaves = await listarChaves(loja);
    } catch (e) {
      console.log(`FALHOU -> ${e.message.split("\n")[0]}`);
      resumo.lojas[loja] = { erro: e.message };
      continue;
    }
    console.log(`${chaves.length} chaves`);

    const pasta = path.join(DESTINO, loja.replace(/[^\w.-]/g, "_"));
    fs.mkdirSync(pasta, { recursive: true });

    let ok = 0, falhas = [];
    for (const chave of chaves) {
      try {
        const e = await pegarEntrada(loja, chave);
        fs.writeFileSync(
          path.join(pasta, chave.replace(/[^\w.-]/g, "_") + ".json"),
          JSON.stringify(e, null, 2), "utf8");
        ok++;
        process.stdout.write(`\r    ${ok}/${chaves.length}   `);
      } catch (err) {
        falhas.push({ chave, erro: err.message.split("\n")[0] });
      }
    }
    console.log(`\r    ${ok}/${chaves.length} salvos${falhas.length ? `, ${falhas.length} falharam` : ""}      `);
    resumo.lojas[loja] = { chaves: chaves.length, salvos: ok, falhas };
  }

  fs.writeFileSync(path.join(DESTINO, "_resumo.json"), JSON.stringify(resumo, null, 2), "utf8");

  // conferencia: reabre tudo que foi salvo e confirma que e JSON valido com Data dentro
  let bons = 0, ruins = [];
  for (const loja of Object.keys(resumo.lojas)) {
    const pasta = path.join(DESTINO, loja.replace(/[^\w.-]/g, "_"));
    if (!fs.existsSync(pasta)) continue;
    for (const arq of fs.readdirSync(pasta)) {
      try {
        const e = JSON.parse(fs.readFileSync(path.join(pasta, arq), "utf8"));
        const dado = JSON.parse(e.corpo);
        // ProfileService guarda uma tabela de 5 posicoes: [Data, MetaData, GlobalUpdates, RobloxMetaData, UserIds]
        const temData = Array.isArray(dado) ? dado[0] && typeof dado[0] === "object"
                                            : dado && typeof dado === "object";
        if (temData) bons++; else ruins.push(loja + "/" + arq);
      } catch { ruins.push(loja + "/" + arq); }
    }
  }
  console.log(`\n  CONFERIDO: ${bons} arquivos releem como perfil valido${ruins.length ? `, ${ruins.length} suspeitos: ${ruins.slice(0,5).join(", ")}` : ""}`);
  console.log(`\n  Pronto. Guarde a pasta inteira: ${DESTINO}\n`);
})();
