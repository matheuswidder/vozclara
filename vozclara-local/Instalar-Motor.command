#!/bin/bash
cd "$(dirname "$0")"
DEST="$HOME/Library/Application Support/VozClara"
echo
echo " VozClara — instalador do motor Nemotron"
echo " Isso instala um programa no Mac. O Chrome só conversa com ele."
echo
mkdir -p "$DEST"
cp -f "./server.py" "$DEST/server.py"
cp -f "./requirements.txt" "$DEST/requirements.txt"
cp -f "./Iniciar-Motor.command" "$DEST/Iniciar-Motor.command"
chmod +x "$DEST/Iniciar-Motor.command"
if [ ! -f "$DEST/server.py" ]; then
  echo " Não achei server.py. Extraia o zip inteiro e rode de novo."
  read -r _
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo " Instale o Python 3 em python.org (marque o PATH) e rode de novo."
  open "https://www.python.org/downloads/"
  read -r _
  exit 1
fi
echo " Instalando as bibliotecas (uma vez)…"
python3 -m pip install --user --upgrade pip
python3 -m pip install --user transformers torch torchaudio accelerate soundfile librosa scipy numpy soxr einops
PLIST="$HOME/Library/LaunchAgents/com.vozclara.engine.plist"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.vozclara.engine</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>WorkingDirectory</key><string>$DEST</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>$DEST/server.py</string>
    <string>--model</string>
    <string>nemotron</string>
  </array>
  <key>StandardOutPath</key><string>$DEST/engine.log</string>
  <key>StandardErrorPath</key><string>$DEST/engine.log</string>
</dict>
</plist>
EOF
launchctl unload "$PLIST" 2>/dev/null || true
echo
echo " Pronto. Vou ligar o motor numa janela. Deixe-a aberta."
echo " Na primeira vez ele baixa o modelo da NVIDIA (é grande)."
open -a Terminal "$DEST/Iniciar-Motor.command"
echo " Pode fechar esta janela do instalador."
read -r _
