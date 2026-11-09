# HQ Nova IA — desinstalador. Lo corre DESINSTALAR.cmd (doble clic).
param([string]$Destino = (Join-Path $env:LOCALAPPDATA 'HQ-Nova-IA'))
$ErrorActionPreference = 'Continue'

# La pantalla y su servidor
Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*NovaHQ\edge-perfil*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*HQ-Nova-IA*server.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# La banda
# La app de Claude guarda su Claude Code en %APPDATA%\Claude\claude-code o, desde 2026, en %LOCALAPPDATA%\Claude-Data\*\claude-code.
$raices = @((Join-Path $env:APPDATA 'Claude\claude-code')) + @(Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Claude-Data') -Directory -ErrorAction SilentlyContinue |
  ForEach-Object { Join-Path $_.FullName 'claude-code' })
$cli = $raices | Where-Object { Test-Path $_ } | ForEach-Object { Get-ChildItem $_ -Recurse -Filter claude.exe -ErrorAction SilentlyContinue } |
  Sort-Object { try { [version]$_.Directory.Parent.Name } catch { [version]'0.0' } } -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $cli) { $cli = (Get-Command claude -ErrorAction SilentlyContinue).Source }
if ($cli) {
  & $cli plugin uninstall nova-hq@hq-nova-ia 2>&1 | Out-Null
  & $cli plugin marketplace remove hq-nova-ia 2>&1 | Out-Null
}

# Accesos directos
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'HQ Nova IA.lnk') -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('Startup')) 'HQ Nova IA.lnk') -ErrorAction SilentlyContinue

Write-Host 'HQ Nova IA se quitó de Claude, del escritorio y del inicio de Windows.' -ForegroundColor Green
Write-Host "Puedes borrar la carpeta $Destino cuando cierres esta ventana."
