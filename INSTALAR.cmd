@echo off
chcp 65001 >nul
rem HQ Nova IA: instala la banda en Claude Code y la pantalla grande. Doble clic y listo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1" %*
echo.
pause
