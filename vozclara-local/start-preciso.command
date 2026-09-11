#!/bin/bash
cd "$(dirname "$0")"
echo "VozClara Local — Whisper large-v3 (mais preciso)"
echo "Deixe esta janela aberta. Na primeira vez o modelo é baixado."
echo
python3 server.py --model large-v3
