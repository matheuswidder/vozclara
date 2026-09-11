import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "extension/vendor");
const transformersSrc = path.join(
  root,
  "node_modules/@huggingface/transformers/dist/transformers.web.js",
);
const ortDir = path.join(root, "node_modules/onnxruntime-web/dist");

if (!fs.existsSync(transformersSrc)) {
  throw new Error(
    "bundle-whisper: @huggingface/transformers não está instalado.",
  );
}
if (!fs.existsSync(ortDir)) {
  throw new Error("bundle-whisper: onnxruntime-web não está instalado.");
}

fs.mkdirSync(destDir, { recursive: true });

let transformers = fs.readFileSync(transformersSrc, "utf8");
transformers = transformers.replaceAll(
  'from "onnxruntime-web/webgpu"',
  'from "./ort.webgpu.bundle.min.mjs"',
);
transformers = transformers.replaceAll(
  'from "onnxruntime-common"',
  'from "./ort.webgpu.bundle.min.mjs"',
);
if (transformers.includes("onnxruntime-web/webgpu") || transformers.includes("onnxruntime-common")) {
  throw new Error("bundle-whisper: falhou ao reescrever os imports do ONNX.");
}
fs.writeFileSync(path.join(destDir, "transformers.js"), transformers);

const copies = [
  "ort.webgpu.bundle.min.mjs",
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
];
for (const name of copies) {
  const src = path.join(ortDir, name);
  if (!fs.existsSync(src)) throw new Error(`bundle-whisper: falta ${name}`);
  fs.copyFileSync(src, path.join(destDir, name));
}

const listed = fs.readdirSync(destDir).sort();
console.log(`vendor: ${listed.join(", ")}`);
for (const name of listed) {
  const size = fs.statSync(path.join(destDir, name)).size;
  console.log(`  ${name} ${size} bytes`);
}
