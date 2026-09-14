#!/usr/bin/env python3
"""Smoke test: after token reset, 401 must include unpaired:true."""
from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path


def load_server(mod_path: Path):
    spec = importlib.util.spec_from_file_location("vozclara_server", mod_path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def http_json(method: str, url: str, body: bytes | None = None, headers: dict | None = None):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            raw = res.read().decode("utf-8")
            return res.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        return exc.code, json.loads(raw) if raw else {}


def main() -> int:
    root = Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["XDG_DATA_HOME"] = tmp
        # Avoid loading heavy models: we only exercise Handler auth.
        mod = load_server(root / "server.py")
        mod.STATE["ready"] = True
        mod.STATE["engine"] = "whisper"
        mod.STATE["model_id"] = "tiny"
        mod.STATE["whisper"] = object()  # unused if we only hit auth fail / pair

        port = 18173
        httpd = mod.ThreadingHTTPServer(("127.0.0.1", port), mod.Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        time.sleep(0.15)
        base = f"http://127.0.0.1:{port}"

        # Fresh token is unclaimed → unpaired true
        code, payload = http_json(
            "POST",
            f"{base}/inference",
            body=b"--x\r\n\r\n--x--\r\n",
            headers={"Content-Type": "multipart/form-data; boundary=x"},
        )
        assert code == 401, code
        assert payload.get("unpaired") is True, payload

        # Pair claims the token
        code, pair = http_json("POST", f"{base}/pair", body=b"{}", headers={"Content-Type": "application/json"})
        assert code == 200 and pair.get("token"), pair
        token = pair["token"]
        assert mod.is_token_claimed() is True

        # Wrong token while claimed → unpaired false (no lockout-healing)
        code, payload = http_json(
            "POST",
            f"{base}/inference",
            body=b"--x\r\n\r\n--x--\r\n",
            headers={
                "Content-Type": "multipart/form-data; boundary=x",
                "Authorization": "Bearer deadbeef",
            },
        )
        assert code == 401, code
        assert payload.get("unpaired") is False, payload

        # Reset token → unclaimed again
        mod.token_path().unlink(missing_ok=True)
        mod.clear_token_claim()
        mod.TOKEN = mod.load_or_create_token()
        assert mod.is_token_claimed() is False

        code, payload = http_json(
            "POST",
            f"{base}/inference",
            body=b"--x\r\n\r\n--x--\r\n",
            headers={
                "Content-Type": "multipart/form-data; boundary=x",
                "Authorization": f"Bearer {token}",
            },
        )
        assert code == 401, code
        assert payload.get("unpaired") is True, payload

        # Re-pair recovers
        code, pair2 = http_json(
            "POST",
            f"{base}/pair",
            body=b"{}",
            headers={"Content-Type": "application/json", "Origin": "chrome-extension://abc"},
        )
        assert code == 200 and pair2.get("token") != token, pair2
        assert mod.is_token_claimed() is True

        httpd.shutdown()
        print("PASS unpaired contract")
        return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print("FAIL", exc, file=sys.stderr)
        raise SystemExit(1)
