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
skip_names = {"__pycache__", ".DS_Store", "Thumbs.db"}

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
motor_dir = os.path.join(root, "vozclara-local")
setup = os.path.join(motor_dir, "VozClara-Motor-Setup.exe")
engine_dir = os.path.join(root, "extension", "engine")
os.makedirs(engine_dir, exist_ok=True)
if os.path.isfile(setup):
    import shutil
    shutil.copy2(setup, os.path.join(engine_dir, "VozClara-Motor-Setup.exe"))
walk(os.path.join(root, "extension"), "", files)
walk(os.path.join(root, "vozclara-local"), "vozclara-local", files)

motor_dir = os.path.join(root, "vozclara-local")
motor_zip = os.path.join(root, "public", "VozClara-Motor.zip")
motor_names = [
    "server.py",
    "requirements.txt",
    "Instalar-Motor.bat",
    "Instalar-Motor.command",
    "Iniciar-Motor.bat",
    "Iniciar-Motor.command",
    "LEIA-ME.txt",
    "start-nemotron.bat",
    "start-nemotron.command",
]
os.makedirs(os.path.dirname(motor_zip), exist_ok=True)
with zipfile.ZipFile(motor_zip, "w", zipfile.ZIP_DEFLATED) as mz:
    for name in motor_names:
        abs_path = os.path.join(motor_dir, name)
        if os.path.isfile(abs_path):
            mz.write(abs_path, name)
files.append((motor_zip, "engine/VozClara-Motor.zip"))

names = [rel for _, rel in files]
if "manifest.json" not in names:
    raise SystemExit("pack-extension: manifest.json missing at zip root")
if "vendor/ort.webgpu.bundle.min.mjs" not in names:
    raise SystemExit("pack-extension: falta o ONNX no vendor")
if "vendor/ogg-opus-decoder.min.js" not in names:
    raise SystemExit("pack-extension: falta o decoder Opus")
if "engine/VozClara-Motor-Setup.exe" not in names:
    raise SystemExit("pack-extension: falta o instalador .exe do motor")
os.makedirs(os.path.dirname(out), exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
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
