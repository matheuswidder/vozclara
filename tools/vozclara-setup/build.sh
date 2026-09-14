#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [ -x /tmp/go/bin/go ]; then
  GO=/tmp/go/bin/go
elif command -v go >/dev/null 2>&1; then
  GO="$(command -v go)"
else
  GO="${GO:-go}"
fi
cp "$ROOT/vozclara-local/server.py" "$(dirname "$0")/server.py"
cd "$(dirname "$0")"
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 "$GO" build -ldflags="-H windowsgui -s -w" -o "$ROOT/vozclara-local/VozClara-Motor-Setup.exe" .
ls -lh "$ROOT/vozclara-local/VozClara-Motor-Setup.exe"
