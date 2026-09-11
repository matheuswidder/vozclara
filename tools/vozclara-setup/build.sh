#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GO="${GO:-/tmp/go/bin/go}"
cp "$ROOT/vozclara-local/server.py" "$(dirname "$0")/server.py"
cd "$(dirname "$0")"
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 "$GO" build -ldflags="-H windowsgui -s -w" -o "$ROOT/vozclara-local/VozClara-Motor-Setup.exe" .
ls -lh "$ROOT/vozclara-local/VozClara-Motor-Setup.exe"
