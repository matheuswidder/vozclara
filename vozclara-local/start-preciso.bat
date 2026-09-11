@echo off
cd /d "%~dp0"
echo VozClara Local — Whisper large-v3 (mais preciso)
echo Deixe esta janela aberta. Na primeira vez o modelo e baixado.
echo.
py -3 server.py --model large-v3
if errorlevel 1 python server.py --model large-v3
pause
