#!/usr/bin/env python3
"""VozClara Local — Whisper large-v3 no seu computador.

A extensão do Chrome manda o áudio do WhatsApp Web para cá.
Nada sai da máquina. Primeira execução baixa o modelo.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = 8173
STATE = {
    "model_id": "large-v3-turbo",
    "ready": False,
    "error": "",
    "engine": "faster-whisper",
    "whisper": None,
}


def log(msg: str) -> None:
    print(msg, flush=True)


def ensure_faster_whisper() -> None:
    try:
        import faster_whisper  # noqa: F401
        return
    except ImportError:
        pass
    log("Instalando faster-whisper (uma vez)…")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "--user", "faster-whisper"]
    )


def pick_device() -> tuple[str, str]:
    try:
        import ctranslate2

        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda", "float16"
    except Exception:
        pass
    return "cpu", "int8"


NEMOTRON_PIP = [
    "transformers",
    "torch",
    "torchaudio",
    "accelerate",
    "soundfile",
    "librosa",
    "scipy",
    "numpy",
    "soxr",
    "einops",
]
MISSING_LIB = re.compile(
    r"requires the ([a-zA-Z0-9_.-]+) library|No module named ['\"]([a-zA-Z0-9_.-]+)",
    re.I,
)


def pip_install(*packages: str) -> None:
    pkgs = [p for p in packages if p]
    if not pkgs:
        return
    log("Instalando " + ", ".join(pkgs) + "…")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "--user", *pkgs]
    )


def ensure_nemotron_deps() -> None:
    need: list[str] = []
    mapping = {
        "transformers": "transformers",
        "torch": "torch",
        "torchaudio": "torchaudio",
        "librosa": "librosa",
        "soundfile": "soundfile",
        "scipy": "scipy",
        "soxr": "soxr",
        "einops": "einops",
        "numpy": "numpy",
        "accelerate": "accelerate",
    }
    for mod, pkg in mapping.items():
        try:
            __import__(mod)
        except ImportError:
            need.append(pkg)
    if need:
        pip_install(*need)


def ensure_transformers() -> None:
    ensure_nemotron_deps()


def load_nemotron() -> None:
    ensure_nemotron_deps()
    last = ""
    for attempt in range(4):
        try:
            import torch
            from transformers import pipeline

            device = 0 if torch.cuda.is_available() else -1
            log("Carregando nvidia/nemotron-3.5-asr-streaming-0.6b…")
            log("Na primeira vez o modelo é baixado da Hugging Face. É grande.")
            STATE["pipe"] = pipeline(
                "automatic-speech-recognition",
                model="nvidia/nemotron-3.5-asr-streaming-0.6b",
                device=device,
            )
            STATE["whisper"] = None
            STATE["ready"] = True
            STATE["error"] = ""
            STATE["engine"] = "nemotron"
            STATE["model_id"] = "nemotron-3.5-asr-streaming-0.6b"
            log(f"Pronto. Motor Nemotron em http://{HOST}:{PORT}")
            return
        except Exception as exc:
            last = str(exc)
            found = MISSING_LIB.search(last)
            pkg = ""
            if found:
                pkg = (found.group(1) or found.group(2) or "").strip().lower()
                pkg = pkg.replace("_", "-")
            if pkg:
                log(f"Faltou {pkg}. Instalando e tentando de novo…")
                try:
                    pip_install(pkg)
                    continue
                except Exception as pip_exc:
                    last = f"{last} | pip: {pip_exc}"
            if attempt == 0:
                try:
                    pip_install(*NEMOTRON_PIP)
                    continue
                except Exception as pip_exc:
                    last = f"{last} | pip: {pip_exc}"
            break
    STATE["error"] = last
    STATE["ready"] = False
    log(f"Falha ao carregar o Nemotron: {last}")


def load_model(model_id: str) -> None:
    if model_id in ("nemotron", "nemotron-3.5-asr-streaming-0.6b"):
        load_nemotron()
        return
    ensure_faster_whisper()
    from faster_whisper import WhisperModel

    device, compute = pick_device()
    log(f"Carregando {model_id} em {device} ({compute})…")
    log("Na primeira vez o modelo é baixado da Hugging Face. Pode levar alguns minutos.")
    try:
        STATE["whisper"] = WhisperModel(
            model_id, device=device, compute_type=compute
        )
        STATE["ready"] = True
        STATE["error"] = ""
        log(f"Pronto. Motor em http://{HOST}:{PORT}")
    except Exception as exc:
        STATE["error"] = str(exc)
        STATE["ready"] = False
        log(f"Falha ao carregar o modelo: {exc}")


def parse_multipart(body: bytes, content_type: str) -> tuple[dict[str, str], dict[str, bytes]]:
    fields: dict[str, str] = {}
    files: dict[str, bytes] = {}
    m = re.search(r"boundary=([^;]+)", content_type, re.I)
    if not m:
        return fields, files
    boundary = m.group(1).strip().strip('"').encode("utf-8")
    for raw in body.split(b"--" + boundary):
        if not raw or raw in (b"--\r\n", b"--", b"--\n"):
            continue
        if raw.startswith(b"\r\n"):
            raw = raw[2:]
        header_b, sep, content = raw.partition(b"\r\n\r\n")
        if not sep:
            continue
        if content.endswith(b"\r\n"):
            content = content[:-2]
        if content.endswith(b"--"):
            content = content[:-2]
        header = header_b.decode("utf-8", "replace")
        name_m = re.search(r'name="([^"]+)"', header)
        if not name_m:
            continue
        name = name_m.group(1)
        if re.search(r'filename="', header):
            files[name] = content
        else:
            fields[name] = content.decode("utf-8", "replace")
    return fields, files


def transcribe_bytes(data: bytes, language: str) -> str:
    suffix = ".ogg"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp.write(data)
        tmp.close()
        lang = language or None
        if lang in ("auto",):
            lang = None
        if STATE.get("engine") == "nemotron":
            pipe = STATE.get("pipe")
            if pipe is None or not STATE["ready"]:
                raise RuntimeError(STATE["error"] or "O Nemotron ainda está carregando.")
            extra = {}
            if lang:
                extra["generate_kwargs"] = {"language": lang}
            out = pipe(tmp.name, **extra)
            if isinstance(out, dict):
                return str(out.get("text") or "").strip()
            return str(out or "").strip()
        model = STATE["whisper"]
        if model is None or not STATE["ready"]:
            raise RuntimeError(STATE["error"] or "O modelo ainda está carregando.")
        segments, _info = model.transcribe(
            tmp.name,
            language=lang,
            vad_filter=True,
            beam_size=5,
        )
        return " ".join(seg.text.strip() for seg in segments).strip()
    finally:
        Path(tmp.name).unlink(missing_ok=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        log("%s - " % self.address_string() + fmt % args)

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Access-Control-Request-Private-Network")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, code: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in ("/", "/health"):
            self._json(
                200,
                {
                    "ok": True,
                    "ready": STATE["ready"],
                    "model": STATE["model_id"],
                    "engine": STATE["engine"],
                    "error": STATE["error"] or None,
                },
            )
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path not in ("/v1/audio/transcriptions", "/inference"):
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or "0")
        body = self.rfile.read(length) if length else b""
        ctype = self.headers.get("Content-Type") or ""
        fields, files = parse_multipart(body, ctype)
        audio = files.get("file") or files.get("audio")
        if not audio:
            self._json(400, {"error": "Envie o campo file com o áudio."})
            return
        language = (fields.get("language") or "").strip()
        try:
            text = transcribe_bytes(audio, language)
        except Exception as exc:
            self._json(500, {"error": str(exc)})
            return
        self._json(200, {"text": text})


def main() -> int:
    parser = argparse.ArgumentParser(description="Motor local VozClara (Whisper)")
    parser.add_argument(
        "--model",
        default="large-v3-turbo",
        choices=("large-v3-turbo", "large-v3", "tiny", "nemotron"),
        help="turbo, large-v3, tiny ou nemotron (NVIDIA, no PC)",
    )
    parser.add_argument("--port", type=int, default=PORT)
    args = parser.parse_args()
    STATE["model_id"] = args.model
    threading.Thread(target=load_model, args=(args.model,), daemon=True).start()
    httpd = ThreadingHTTPServer((HOST, args.port), Handler)
    log(f"VozClara Local escutando em http://{HOST}:{args.port}")
    log("Deixe esta janela aberta enquanto usa o WhatsApp Web.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log("Encerrado.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
