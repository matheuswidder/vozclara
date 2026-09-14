#!/usr/bin/env python3
"""VozClara Local — Whisper large-v3 no seu computador.

A extensão do Chrome manda o áudio do WhatsApp Web para cá.
Nada sai da máquina. Primeira execução baixa o modelo.
"""

from __future__ import annotations

import argparse
import gc
import json
import os
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tempfile
import threading
import time
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
    "phase": "idle",
    "percent": 0,
    "detail": "",
}

SUGGEST = {
    "ready": False,
    "loading": False,
    "kind": "qwen",
    "llm": None,
    "error": "",
    "percent": 0,
    "detail": "",
    "lock": threading.Lock(),
}

QWEN_REPO = "Qwen/Qwen2.5-1.5B-Instruct-GGUF"
QWEN_FILE = "qwen2.5-1.5b-instruct-q4_k_m.gguf"
QWEN_BYTES = 1_120_000_000


def token_path() -> Path:
    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")
    return base / "VozClara" / "motor.token"


def claimed_path() -> Path:
    return token_path().parent / "motor.paired"


def is_token_claimed() -> bool:
    try:
        return claimed_path().is_file()
    except Exception:
        return False


def mark_token_claimed() -> None:
    path = claimed_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("1\n", encoding="utf-8")
        if os.name == "posix":
            path.chmod(stat.S_IRUSR | stat.S_IWUSR)
    except Exception as exc:
        log(f"Aviso: não consegui gravar pareamento ({exc}).")


def clear_token_claim() -> None:
    try:
        claimed_path().unlink(missing_ok=True)
    except Exception:
        pass


def unauthorized_payload() -> dict:
    """Após --reset-token / token novo, unpaired=true para a extensão re-parear."""
    return {"error": "bad token", "unpaired": not is_token_claimed()}


def load_or_create_token() -> str:
    path = token_path()
    try:
        if path.is_file():
            token = path.read_text(encoding="utf-8").strip()
            if token:
                return token
    except Exception as exc:
        log(f"Não li o token existente ({exc}); vou gerar outro.")
    clear_token_claim()
    token = secrets.token_hex(16)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(token + "\n", encoding="utf-8")
        if os.name == "posix":
            path.chmod(stat.S_IRUSR | stat.S_IWUSR)
    except Exception as exc:
        log(f"Aviso: não consegui gravar {path} ({exc}).")
    return token


TOKEN = load_or_create_token()


def log(msg: str) -> None:
    print(msg, flush=True)


def ensure_faster_whisper() -> None:
    try:
        import faster_whisper  # noqa: F401
        return
    except ImportError:
        pass
    if not PACKAGED:
        raise RuntimeError(
            "Falta faster-whisper. Rode Instalar-Motor.bat (Windows) ou "
            "Instalar-Motor.command (macOS/Linux) para instalar as bibliotecas."
        )
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


PACKAGED = os.environ.get("VOZCLARA_PACKAGED") == "1"


def set_phase(phase: str, percent: int | None = None, detail: str = "") -> None:
    STATE["phase"] = phase
    if percent is not None:
        STATE["percent"] = max(0, min(100, int(percent)))
    if detail:
        STATE["detail"] = detail


def patch_hf_progress():
    """Espelha o tqdm da Hugging Face em STATE/SUGGEST.percent.

    O downloader Xet da Hugging Face ignora o tqdm; por isso o watcher de
    arquivo em disco é o progresso que a extensão realmente mostra.
    """
    try:
        from tqdm.auto import tqdm as BaseTqdm
    except Exception:
        return None

    class HubTqdm(BaseTqdm):
        def update(self, n=1):
            out = super().update(n)
            try:
                total = int(self.total or 0)
                now = int(self.n or 0)
                desc = str(getattr(self, "desc", None) or "arquivo").strip()
                if total > 0:
                    pct = max(1, min(99, int(now * 100 / total)))
                    set_phase("download", pct, f"Baixando {desc} · {pct}%")
                    if SUGGEST.get("loading"):
                        SUGGEST["percent"] = max(int(SUGGEST.get("percent") or 0), pct)
                        SUGGEST["detail"] = f"Baixando {desc} · {pct}%"
                else:
                    set_phase("download", STATE.get("percent") or 8, f"Baixando {desc}…")
                    if SUGGEST.get("loading"):
                        SUGGEST["detail"] = f"Baixando {desc}…"
            except Exception:
                pass
            return out

    try:
        import huggingface_hub.utils.tqdm as hub_tqdm

        hub_tqdm.tqdm = HubTqdm
    except Exception:
        pass
    try:
        import tqdm as tqdm_mod

        tqdm_mod.tqdm = HubTqdm
    except Exception:
        pass
    return HubTqdm


def pip_install(*packages: str) -> None:
    pkgs = [p for p in packages if p]
    if not pkgs:
        return
    if not PACKAGED:
        raise RuntimeError(
            "Faltam bibliotecas Python. Rode Instalar-Motor.bat (Windows) "
            "ou Instalar-Motor.command (macOS/Linux) para instalá-las."
        )
    set_phase("deps", 6, "Instalando " + ", ".join(pkgs) + "…")
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
    set_phase("deps", 4, "Preparando bibliotecas do Nemotron…")
    try:
        ensure_nemotron_deps()
    except Exception as exc:
        STATE["error"] = str(exc)
        STATE["ready"] = False
        set_phase("error", 0, str(exc))
        log(f"Falha ao preparar o Nemotron: {exc}")
        return
    patch_hf_progress()
    set_phase("download", 8, "Baixando o Nemotron da Hugging Face…")
    last = ""
    for attempt in range(4):
        try:
            import torch
            from transformers import pipeline

            device = 0 if torch.cuda.is_available() else -1
            log("Carregando nvidia/nemotron-3.5-asr-streaming-0.6b…")
            log("Na primeira vez o modelo é baixado da Hugging Face. É grande.")
            set_phase("download", max(STATE.get("percent") or 8, 10), "Baixando o Nemotron da Hugging Face…")
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
            set_phase("ready", 100, "Modelo pronto")
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
    set_phase("error", 0, last)
    log(f"Falha ao carregar o Nemotron: {last}")


def load_model(model_id: str) -> None:
    if model_id in ("nemotron", "nemotron-3.5-asr-streaming-0.6b"):
        load_nemotron()
        return
    try:
        ensure_faster_whisper()
    except Exception as exc:
        STATE["error"] = str(exc)
        STATE["ready"] = False
        log(f"Falha ao preparar o Whisper: {exc}")
        return
    from faster_whisper import WhisperModel

    device, compute = pick_device()
    patch_hf_progress()
    log(f"Carregando {model_id} em {device} ({compute})…")
    log("Na primeira vez o modelo é baixado da Hugging Face. Pode levar alguns minutos.")
    set_phase("download", 10, f"Baixando {model_id}…")
    try:
        STATE["whisper"] = WhisperModel(
            model_id, device=device, compute_type=compute
        )
        STATE["ready"] = True
        STATE["error"] = ""
        set_phase("ready", 100, "Modelo pronto")
        log(f"Pronto. Motor em http://{HOST}:{PORT}")
    except Exception as exc:
        STATE["error"] = str(exc)
        STATE["ready"] = False
        set_phase("error", 0, str(exc))
        log(f"Falha ao carregar o modelo: {exc}")


def explain_suggest_exc(exc: BaseException) -> str:
    s = str(exc or "").strip()
    low = s.lower()
    if any(x in low for x in ("gated", "401", "403", "restricted", "cannot access gated")):
        return "A Hugging Face recusou o download. Confira a internet e tente de novo."
    if any(x in low for x in ("no space", "enospc", "espaço em disco")):
        return "Falta espaço em disco para o Qwen (cerca de 1,2 GB)."
    if any(
        x in low
        for x in ("out of memory", "can't allocate", "cannot allocate", "memoryerror")
    ):
        return "Faltou memória RAM. Feche outros programas e clique em Tentar de novo."
    if any(x in low for x in ("timed out", "timeout", "failed to resolve", "connection reset")):
        return "A Hugging Face não respondeu. Confira a internet e tente de novo."
    if "llama" in low and any(x in low for x in ("error", "failed", "building", "cmake", "cl.exe")):
        return (
            "Não instalei o llama-cpp-python neste Python. "
            "Feche o motor, rode o Setup de novo e tente Baixar outra vez."
        )
    return s[:400] if s else "Não carreguei o Qwen."


def hf_cache_dir() -> Path:
    return token_path().parent / "hf"


def qwen_repo_dir() -> Path:
    return hf_cache_dir() / f"models--{QWEN_REPO.replace('/', '--')}"


def dir_bytes(root: Path) -> int:
    if not root.exists():
        return 0
    total = 0
    for path in root.rglob("*"):
        if path.is_file():
            try:
                total += path.stat().st_size
            except OSError:
                pass
    return total


def qwen_cached_bytes() -> int:
    return dir_bytes(qwen_repo_dir())


def format_bytes(n: int) -> str:
    if n <= 0:
        return "0 B"
    if n < 1024 * 1024:
        return f"{max(1, n // 1024)} KB"
    gb = n / (1024**3)
    if gb >= 0.95:
        return f"{gb:.1f}".replace(".", ",") + " GB"
    return f"{int(round(n / (1024**2)))} MB"


def suggest_status() -> dict:
    cached_bytes = qwen_cached_bytes()
    return {
        "ready": bool(SUGGEST.get("ready")),
        "loading": bool(SUGGEST.get("loading")),
        "kind": SUGGEST.get("kind") or "qwen",
        "error": SUGGEST.get("error") or None,
        "percent": int(SUGGEST.get("percent") or 0),
        "detail": SUGGEST.get("detail") or "",
        "name": "Qwen2.5-1.5B-Instruct Q4",
        "cached": cached_bytes > 8 * 1024 * 1024,
        "bytes": int(cached_bytes),
    }


def watch_qwen_bytes() -> None:
    """Percentual pelo tamanho do cache — funciona mesmo sem tqdm/Xet."""
    while SUGGEST.get("loading") and not SUGGEST.get("ready"):
        n = qwen_cached_bytes()
        if n > 4 * 1024 * 1024:
            pct = max(10, min(90, int(n * 80 / QWEN_BYTES) + 10))
            with SUGGEST["lock"]:
                if SUGGEST.get("loading") and not SUGGEST.get("ready"):
                    cur = int(SUGGEST.get("percent") or 0)
                    if pct >= cur:
                        SUGGEST["percent"] = pct
                        SUGGEST["detail"] = (
                            f"Baixando Qwen · {format_bytes(n)} de ~1,1 GB ({pct}%)"
                        )
        time.sleep(0.45)


def unload_qwen() -> None:
    llm = SUGGEST.get("llm")
    SUGGEST["llm"] = None
    SUGGEST["ready"] = False
    if llm is None:
        gc.collect()
        return
    closer = getattr(llm, "close", None)
    if callable(closer):
        try:
            closer()
        except Exception:
            pass
    try:
        del llm
    except Exception:
        pass
    gc.collect()


def delete_qwen() -> None:
    with SUGGEST["lock"]:
        SUGGEST["loading"] = False
        SUGGEST["error"] = ""
        SUGGEST["percent"] = 0
        SUGGEST["detail"] = "Apagando o Qwen…"
        unload_qwen()
    root = qwen_repo_dir()
    last = None
    for _ in range(8):
        gc.collect()
        try:
            if root.exists():
                shutil.rmtree(root)
            last = None
            break
        except Exception as exc:
            last = exc
            time.sleep(0.35)
    if last is not None and root.exists():
        raise RuntimeError(
            "Não apaguei o arquivo (ainda em uso). Feche o motor na bandeja "
            f"e tente de novo. {last}"
        )
    with SUGGEST["lock"]:
        SUGGEST["ready"] = False
        SUGGEST["loading"] = False
        SUGGEST["llm"] = None
        SUGGEST["error"] = ""
        SUGGEST["percent"] = 0
        SUGGEST["detail"] = "Modelo apagado"


def ensure_llama() -> None:
    try:
        import llama_cpp  # noqa: F401
        return
    except Exception:
        pass
    SUGGEST["detail"] = "Instalando llama-cpp-python…"
    SUGGEST["percent"] = 8
    log("Instalando llama-cpp-python (CPU)…")
    if not PACKAGED:
        raise RuntimeError(
            "Falta llama-cpp-python. Rode o Setup do zip para instalar as bibliotecas."
        )
    try:
        subprocess.check_call(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "--user",
                "llama-cpp-python",
                "--extra-index-url",
                "https://abetlen.github.io/llama-cpp-python/whl/cpu",
            ]
        )
        import llama_cpp  # noqa: F401
        return
    except Exception:
        pip_install("llama-cpp-python")


def load_qwen(_kind: str = "qwen") -> None:
    with SUGGEST["lock"]:
        if SUGGEST["ready"] and SUGGEST.get("llm") is not None:
            return
        SUGGEST["loading"] = True
        SUGGEST["error"] = ""
        SUGGEST["kind"] = "qwen"
        SUGGEST["percent"] = 5
        SUGGEST["detail"] = f"Baixando {QWEN_FILE}…"
    threading.Thread(target=watch_qwen_bytes, daemon=True).start()
    try:
        os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
        os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "0")
        ensure_llama()
        tqdm_cls = patch_hf_progress()
        try:
            from huggingface_hub import hf_hub_download
        except Exception:
            pip_install("huggingface_hub")
            from huggingface_hub import hf_hub_download
        from llama_cpp import Llama

        cached = qwen_cached_bytes()
        if cached > 80 * 1024 * 1024:
            SUGGEST["detail"] = f"Arquivo no disco ({format_bytes(cached)}) — carregando…"
            SUGGEST["percent"] = max(int(SUGGEST.get("percent") or 0), 70)
        else:
            SUGGEST["detail"] = f"Baixando {QWEN_FILE} (~1,1 GB)…"
            SUGGEST["percent"] = max(int(SUGGEST.get("percent") or 0), 10)
        log(f"Baixando {QWEN_REPO}/{QWEN_FILE}…")
        cache = hf_cache_dir()
        cache.mkdir(parents=True, exist_ok=True)
        kwargs = {
            "repo_id": QWEN_REPO,
            "filename": QWEN_FILE,
            "cache_dir": str(cache),
        }
        if tqdm_cls is not None:
            kwargs["tqdm_class"] = tqdm_cls
        try:
            path = hf_hub_download(**kwargs)
        except TypeError:
            kwargs.pop("tqdm_class", None)
            path = hf_hub_download(**kwargs)
        SUGGEST["detail"] = "Carregando Qwen 1.5B Q4 na memória…"
        SUGGEST["percent"] = 92
        n_threads = max(1, min(4, os.cpu_count() or 2))
        log(f"Carregando Qwen em CPU ({n_threads} threads)…")
        llm = Llama(
            model_path=path,
            n_ctx=2048,
            n_threads=n_threads,
            n_gpu_layers=0,
            verbose=False,
        )
        with SUGGEST["lock"]:
            SUGGEST["llm"] = llm
            SUGGEST["ready"] = True
            SUGGEST["loading"] = False
            SUGGEST["error"] = ""
            SUGGEST["kind"] = "qwen"
            SUGGEST["percent"] = 100
            SUGGEST["detail"] = "Pronto"
        log("Qwen pronto para sugerir respostas.")
    except Exception as exc:
        with SUGGEST["lock"]:
            SUGGEST["ready"] = False
            SUGGEST["loading"] = False
            SUGGEST["error"] = explain_suggest_exc(exc)
            SUGGEST["llm"] = None
            SUGGEST["percent"] = 0
            SUGGEST["detail"] = SUGGEST["error"]
        log(f"Falha ao carregar o Qwen: {exc}")


def parse_replies(raw: str) -> list[str]:
    lines = []
    for line in str(raw or "").splitlines():
        bit = line.strip()
        bit = re.sub(r"^[\-\*\d\.\)\]]+\s*", "", bit)
        bit = bit.strip(" \"'`")
        if bit:
            lines.append(bit)
    uniq: list[str] = []
    seen = set()
    for line in lines:
        key = line.lower()
        if key in seen:
            continue
        seen.add(key)
        uniq.append(line)
        if len(uniq) == 3:
            break
    return uniq


def suggest_replies(payload: dict) -> list[str]:
    load_qwen("qwen")
    llm = SUGGEST.get("llm")
    if llm is None:
        raise RuntimeError(SUGGEST.get("error") or "O Qwen ainda não carregou.")
    who = str(payload.get("who") or "").strip() or "Atendimento no WhatsApp"
    tone = str(payload.get("tone") or "cliente")
    notes = str(payload.get("notes") or "").strip()
    text = str(payload.get("text") or "").strip()
    tone_line = {
        "curto": "Respostas curtas, uma frase.",
        "formal": "Tom formal e educado.",
        "comercial": "Tom comercial, direto, sem enrolação.",
    }.get(tone, "Espelhe o clima de quem falou.")
    system = (
        "Você sugere respostas prontas para colar no WhatsApp. "
        "Responda só ao recado de voz transcrito. Não use outra conversa. "
        "Não invente assunto (parabéns, notícia, convite) que não esteja no texto. "
        f"Quem responde: {who}. {tone_line} "
        "Só 3 linhas, cada uma uma mensagem pronta. Sem numerar, sem aspas, sem explicação."
    )
    if notes:
        system += " Consulte isto se couber: " + notes[:3500]
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": "Mensagem recebida:\n" + text},
    ]
    try:
        out = llm.create_chat_completion(
            messages=messages,
            max_tokens=180,
            temperature=0.45,
        )
        raw = str(out["choices"][0]["message"]["content"] or "")
    except Exception:
        prompt = (
            "<|im_start|>system\n"
            + system
            + "<|im_end|>\n<|im_start|>user\nMensagem recebida:\n"
            + text
            + "<|im_end|>\n<|im_start|>assistant\n"
        )
        out = llm(
            prompt,
            max_tokens=180,
            temperature=0.45,
            stop=["<|im_end|>", "<|endoftext|>"],
        )
        raw = str(out["choices"][0].get("text") or "")
    replies = parse_replies(raw)
    if len(replies) < 2:
        replies = [text[:120], "Pode falar mais um pouco?", "Já te retorno."][:3]
    return replies[:3]


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
        self.send_header(
            "Access-Control-Allow-Headers",
            "Authorization, Content-Type, Access-Control-Request-Private-Network",
        )
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

    def _authorized(self, fields: dict[str, str]) -> bool:
        header = self.headers.get("Authorization") or ""
        expected = f"Bearer {TOKEN}"
        if header.strip() == expected:
            return True
        return fields.get("token", "").strip() == TOKEN

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
                    "paired": True,
                    "error": STATE["error"] or None,
                    "phase": STATE.get("phase") or ("ready" if STATE["ready"] else "load"),
                    "percent": int(STATE.get("percent") or (100 if STATE["ready"] else 0)),
                    "detail": STATE.get("detail") or "",
                    "alive": True,
                    "suggest": suggest_status(),
                    "gemma": suggest_status(),
                },
            )
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/pair":
            self._pair()
            return
        if path == "/v1/suggest":
            self._suggest()
            return
        if path in ("/v1/suggest/load", "/v1/gemma/load"):
            self._suggest_load()
            return
        if path in ("/v1/suggest/delete", "/v1/gemma/delete"):
            self._suggest_delete()
            return
        if path not in ("/v1/audio/transcriptions", "/inference"):
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or "0")
        body = self.rfile.read(length) if length else b""
        ctype = self.headers.get("Content-Type") or ""
        fields, files = parse_multipart(body, ctype)
        if not self._authorized(fields):
            self._json(401, unauthorized_payload())
            return
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

    def _pair(self) -> None:
        origin = (self.headers.get("Origin") or "").strip()
        if origin and not origin.startswith("chrome-extension://"):
            self._json(403, {"error": "Origem não permitida para parear.", "unpaired": False})
            return
        mark_token_claimed()
        self._json(200, {"token": TOKEN})

    def _suggest(self) -> None:
        length = int(self.headers.get("Content-Length") or "0")
        body = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(body.decode("utf-8") or "{}")
        except Exception:
            payload = {}
        if not isinstance(payload, dict):
            payload = {}
        if not self._authorized({}):
            header = self.headers.get("Authorization") or ""
            if header.strip() != f"Bearer {TOKEN}":
                self._json(401, unauthorized_payload())
                return
        text = str(payload.get("text") or "").strip()
        if not text:
            self._json(400, {"error": "Envie o texto da mensagem."})
            return
        try:
            replies = suggest_replies(payload)
        except Exception as exc:
            self._json(500, {"error": str(exc)})
            return
        self._json(200, {"replies": replies, "kind": "qwen"})

    def _suggest_load(self) -> None:
        length = int(self.headers.get("Content-Length") or "0")
        body = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(body.decode("utf-8") or "{}")
        except Exception:
            payload = {}
        if not isinstance(payload, dict):
            payload = {}
        header = self.headers.get("Authorization") or ""
        if header.strip() != f"Bearer {TOKEN}" and not self._authorized({}):
            self._json(401, unauthorized_payload())
            return
        if SUGGEST.get("ready") and SUGGEST.get("llm") is not None:
            self._json(200, {"ok": True, "ready": True, "kind": "qwen"})
            return
        if not SUGGEST.get("loading"):
            def _run() -> None:
                try:
                    load_qwen("qwen")
                except Exception as exc:
                    log(f"Qwen parou: {exc}")

            threading.Thread(target=_run, args=(), daemon=True).start()
        self._json(200, {"ok": True, "started": True, "ready": False, "kind": "qwen"})

    def _suggest_delete(self) -> None:
        length = int(self.headers.get("Content-Length") or "0")
        if length:
            self.rfile.read(length)
        header = self.headers.get("Authorization") or ""
        if header.strip() != f"Bearer {TOKEN}" and not self._authorized({}):
            self._json(401, unauthorized_payload())
            return
        try:
            delete_qwen()
        except Exception as exc:
            self._json(500, {"error": str(exc), "ok": False})
            return
        log("Qwen apagado do disco.")
        self._json(200, {"ok": True, "deleted": True, "ready": False, "kind": "qwen"})


def main() -> int:
    parser = argparse.ArgumentParser(description="Motor local VozClara (Whisper)")
    parser.add_argument(
        "--model",
        default="large-v3-turbo",
        choices=("large-v3-turbo", "large-v3", "tiny", "nemotron"),
        help="turbo, large-v3, tiny ou nemotron (NVIDIA, no PC)",
    )
    parser.add_argument("--port", type=int, default=PORT)
    parser.add_argument(
        "--reset-token",
        action="store_true",
        help="Apaga o token pareado e gera outro (pareie de novo pelo painel VozClara).",
    )
    args = parser.parse_args()
    if args.reset_token:
        try:
            token_path().unlink(missing_ok=True)
        except Exception:
            pass
        clear_token_claim()
        globals()["TOKEN"] = load_or_create_token()
        log("Token novo gerado. Pareie de novo pelo painel VozClara.")
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
