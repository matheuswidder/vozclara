@echo off
chcp 65001 >nul
setlocal
if exist "%LOCALAPPDATA%\VozClara\server.py" (
  cd /d "%LOCALAPPDATA%\VozClara"
) else (
  cd /d "%~dp0"
)
echo.
echo  VozClara Motor — Nemotron 3.5 ASR
echo  Deixe esta janela aberta. O WhatsApp Web usa este programa.
echo  Nada sai do computador.
echo.
py -3 server.py --model nemotron
if errorlevel 1 python server.py --model nemotron
if errorlevel 1 python3 server.py --model nemotron
echo.
echo  O motor parou. Pode fechar.
pause
