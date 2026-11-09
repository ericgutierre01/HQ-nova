@echo off
chcp 65001 >nul
rem HQ Nova IA: quita la banda de Claude, los accesos directos y el arranque con Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0desinstalar.ps1" %*
echo.
pause
