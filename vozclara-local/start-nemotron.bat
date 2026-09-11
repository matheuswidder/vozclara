@echo off
cd /d "%~dp0"
echo VozClara Local — NVIDIA Nemotron 3.5 ASR 0.6B
echo Deixe esta janela aberta. Na primeira vez o modelo e baixado (grande).
echo.
py -3 server.py --model nemotron
if errorlevel 1 python server.py --model nemotron
pause
