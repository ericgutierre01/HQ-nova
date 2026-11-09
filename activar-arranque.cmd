@echo off
rem HQ Nova IA: que arranque sola al iniciar sesion en Windows.
rem Crea un acceso directo en TU carpeta Inicio (shell:startup). No pide admin. Se quita con quitar-arranque.cmd.
rem Al iniciar sesion espera 20 s (para que los monitores esten listos) y corre abrir-pantalla.ps1 oculto.
set "AQUI=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $q=[char]34; $lnk=Join-Path ([Environment]::GetFolderPath('Startup')) 'HQ Nova IA.lnk'; $s=(New-Object -ComObject WScript.Shell).CreateShortcut($lnk); $s.TargetPath=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'; $s.Arguments='-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ' + $q + $env:AQUI + 'mod\pantalla\abrir-pantalla.ps1' + $q + ' -Espera 20'; $s.WorkingDirectory=$env:AQUI.TrimEnd([char]92); $s.WindowStyle=7; $s.Description='HQ Nova IA: servidor y pantalla de agentes'; $s.Save(); Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder' -Name 'HQ Nova IA.lnk' -ErrorAction SilentlyContinue; exit 0"
set "RC=%errorlevel%"
for /f "tokens=2 delims=:." %%a in ('chcp') do set "CP=%%a"
chcp 65001 >nul
if "%RC%"=="0" (
  echo HQ Nova IA arrancará sola cada vez que inicies sesión en Windows.
) else (
  echo No se pudo activar el arranque automático.
)
chcp %CP% >nul
if /i not "%~1"=="/sinpausa" pause
exit /b %RC%
