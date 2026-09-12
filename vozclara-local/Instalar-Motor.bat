@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
set "DEST=%LOCALAPPDATA%\VozClara"
echo.
echo  VozClara — instalador do motor Nemotron
echo  Isso instala um programa no PC. O Chrome só conversa com ele.
echo.
mkdir "%DEST%" 2>nul
copy /Y "%~dp0server.py" "%DEST%\server.py" >nul
copy /Y "%~dp0requirements.txt" "%DEST%\requirements.txt" >nul
copy /Y "%~dp0Iniciar-Motor.bat" "%DEST%\Iniciar-Motor.bat" >nul
if not exist "%DEST%\server.py" (
  echo  Nao achei server.py. Extraia o zip inteiro e rode Instalar-Motor de novo.
  pause
  exit /b 1
)

set "PY="
where py >nul 2>&1 && set "PY=py -3"
if not defined PY where python >nul 2>&1 && set "PY=python"
if not defined PY where python3 >nul 2>&1 && set "PY=python3"
if not defined PY (
  echo  Preciso do Python. Tentando instalar sem senha de administrador...
  winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
  set "PATH=%LocalAppData%\Programs\Python\Python312;%LocalAppData%\Programs\Python\Python312\Scripts;%PATH%"
  where py >nul 2>&1 && set "PY=py -3"
  if not defined PY where python >nul 2>&1 && set "PY=python"
)
if not defined PY (
  echo  Instale o Python em https://www.python.org/downloads/
  echo  Marque "Add python.exe to PATH" e rode este instalador de novo.
  start https://www.python.org/downloads/
  pause
  exit /b 1
)

echo  Instalando as bibliotecas (uma vez^)...
%PY% -m pip install --user --upgrade pip
%PY% -m pip install --user -r requirements.txt
if errorlevel 1 (
  echo  Falhou o pip. Rode de novo depois de instalar o Python com PATH.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=(New-Object -ComObject WScript.Shell); $p=[Environment]::GetFolderPath('Desktop')+'\VozClara Motor.lnk'; $l=$s.CreateShortcut($p); $l.TargetPath=$env:LOCALAPPDATA+'\VozClara\Iniciar-Motor.bat'; $l.WorkingDirectory=$env:LOCALAPPDATA+'\VozClara'; $l.Save()"

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy /Y "%DEST%\Iniciar-Motor.bat" "%STARTUP%\VozClara-Motor.bat" >nul

echo.
echo  Pronto. Vou ligar o motor. Na primeira vez ele baixa o modelo da NVIDIA
echo  (e grande). Deixe a janela preta aberta e volte no WhatsApp.
echo.
start "VozClara Motor" "%DEST%\Iniciar-Motor.bat"
echo  Pode fechar esta janela do instalador.
pause
