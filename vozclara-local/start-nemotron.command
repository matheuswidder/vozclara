#!/bin/bash
cd "$(dirname "$0")"
echo "VozClara Local — NVIDIA Nemotron 3.5 ASR 0.6B"
echo "Deixe esta janela aberta. Na primeira vez o modelo é baixado (grande)."
python3 server.py --model nemotron
