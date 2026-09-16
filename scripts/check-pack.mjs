// Valida que o zip do site acompanha a extensão:
// - public/vozclara.zip existe e o manifest.json de dentro tem a MESMA
//   versão de extension/manifest.json (o dessync 1.13.14 já mordeu uma vez)
// - arquivos obrigatórios estão no zip (espelha scripts/pack-extension.mjs)
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extManifest = JSON.parse(readFileSync(path.join(root, "extension/manifest.json"), "utf8"));
const version = extManifest.version;
const zip = path.join(root, "public", "vozclara.zip");

if (!existsSync(zip)) {
  console.error(`check-pack: falta ${zip} — rode: node scripts/pack-extension.mjs`);
  process.exit(1);
}

const py = `
import sys, zipfile, json
z = zipfile.ZipFile(sys.argv[1])
print(json.loads(z.read("manifest.json").decode())["version"])
print("\\n".join(sorted(z.namelist())))
`;
const out = execFileSync("python3", ["-c", py, zip], { encoding: "utf8" }).split("\n");
const zipVersion = out[0].trim();
const names = new Set(out.slice(1).map((l) => l.trim()).filter(Boolean));

const required = [
  "manifest.json",
  "background.js",
  "content.js",
  "dock.js",
  "shared.js",
  "popup.js",
  "vendor/ort.webgpu.bundle.min.mjs",
  "vendor/ogg-opus-decoder.min.js",
];
let fail = 0;
if (zipVersion !== version) {
  console.error(`check-pack: zip=${zipVersion} ≠ extension=${version} — reempacote.`);
  fail = 1;
}
for (const n of required) {
  if (!names.has(n)) {
    console.error(`check-pack: falta ${n} no zip.`);
    fail = 1;
  }
}
if (fail) process.exit(1);
console.log(`check-pack: ok (vozclara.zip = ${version}, ${names.size} arquivos)`);
