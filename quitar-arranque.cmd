@echo off
rem HQ Nova IA: que deje de arrancar sola al iniciar sesion en Windows (borra el acceso directo de tu carpeta Inicio).
rem No cierra lo que ya este abierto: Alt+F4 cierra la pantalla.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$lnk=Join-Path ([Environment]::GetFolderPath('Startup')) 'HQ Nova IA.lnk'; Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\StartupFolder' -Name 'HQ Nova IA.lnk' -ErrorAction SilentlyContinue; if (Test-Path -LiteralPath $lnk) { Remove-Item -LiteralPath $lnk; exit 0 } else { exit 2 }"
set "RC=%errorlevel%"
for /f "tokens=2 delims=:." %%a in ('chcp') do set "CP=%%a"
chcp 65001 >nul
if "%RC%"=="0" echo HQ Nova IA ya no arrancará sola al iniciar sesión.
if "%RC%"=="2" echo El arranque automático ya estaba desactivado.
if not "%RC%"=="0" if not "%RC%"=="2" echo No se pudo quitar el arranque automático.
chcp %CP% >nul
if /i not "%~1"=="/sinpausa" pause
if "%RC%"=="2" exit /b 0
exit /b %RC%
