#!/bin/bash
cd "$(dirname "$0")"
export VOZCLARA_PACKAGED=1
DEST="$HOME/Library/Application Support/VozClara"
if [ -f "$DEST/server.py" ]; then
  cd "$DEST"
fi
echo
echo " VozClara Motor — Nemotron 3.5 ASR"
echo " Deixe esta janela aberta. O WhatsApp Web usa este programa."
echo
python3 server.py --model nemotron
echo
echo " O motor parou."
read -r _
