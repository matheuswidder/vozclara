import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const bundle = spawnSync("node", [path.join(root, "scripts/bundle-whisper.mjs")], {
  encoding: "utf8",
});
if (bundle.stdout) process.stdout.write(bundle.stdout);
if (bundle.stderr) process.stderr.write(bundle.stderr);
if (bundle.status !== 0) process.exit(bundle.status ?? 1);

const py = `
import os, zipfile, sys
root = sys.argv[1]
out = os.path.join(root, "public", "vozclara.zip")
skip_names = {"__pycache__", ".DS_Store", "Thumbs.db", "engine"}

def walk(src, prefix, files):
    for name in sorted(os.listdir(src)):
        if name in skip_names or name.endswith(".pyc"):
            continue
        abs_path = os.path.join(src, name)
        rel = f"{prefix}/{name}" if prefix else name
        if os.path.isdir(abs_path):
            walk(abs_path, rel, files)
        else:
            files.append((abs_path, rel.replace(os.sep, "/")))

files = []
walk(os.path.join(root, "extension"), "", files)

names = [rel for _, rel in files]
if "manifest.json" not in names:
    raise SystemExit("pack-extension: manifest.json missing at zip root")
if "vendor/ort.webgpu.bundle.min.mjs" not in names:
    raise SystemExit("pack-extension: falta o ONNX no vendor")
if "vendor/ogg-opus-decoder.min.js" not in names:
    raise SystemExit("pack-extension: falta o decoder Opus")
os.makedirs(os.path.dirname(out), exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_STORED) as z:
    for abs_path, rel in files:
        compress = zipfile.ZIP_STORED if rel.endswith(".wasm") else zipfile.ZIP_DEFLATED
        z.write(abs_path, rel, compress)
print(f"packed {len(files)} files -> {out}")
print("\\n".join(sorted(names)))
`;

const result = spawnSync("python3", ["-c", py, root], { encoding: "utf8" });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 1);
