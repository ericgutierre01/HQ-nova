# HQ Nova IA: arranca el servidor (si no está corriendo) y abre la pantalla en el 2º monitor.
# Uso: doble clic en abrir-pantalla.cmd   (o: powershell -File abrir-pantalla.ps1 [-Monitor 2] [-SinPantalla] [-Espera 20])
#   -SinPantalla  solo arranca el servidor; no abre ninguna ventana.
#   -Espera N     espera N segundos antes de abrir la ventana (el arranque con Windows usa 20, para que los monitores estén listos).
#   -Escena X     oficina | playa | espacio | ciudad | bosque      -Skin X  clasica | pava | gorra | audifonos | lentes | corona | mago | navidad
#   -Rotar        cambia de escenario solo cada 10 minutos
#   -Ventana      la abre en una ventana normal del navegador (no a pantalla completa)
#   -Cerrar       cierra la pantalla (el servidor sigue)      -Apagar  cierra la pantalla y apaga el servidor
param([int]$Monitor = 0, [switch]$SinPantalla, [int]$Espera = 0, [string]$Escena = '', [string]$Skin = '', [switch]$Rotar, [switch]$Ventana, [switch]$Cerrar, [switch]$Apagar)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$puerto = if ($env:NOVA_HQ_PORT) { $env:NOVA_HQ_PORT } else { '4747' }   # el mismo NOVA_HQ_PORT que lee server.mjs
$url = "http://127.0.0.1:$puerto/"

function Cerrar-Pantalla {
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*NovaHQ\edge-perfil*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
if ($Cerrar -or $Apagar) {
  Cerrar-Pantalla
  if ($Apagar) {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*$here*server.mjs*" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host 'HQ Nova IA: pantalla cerrada y servidor apagado.'
  } else { Write-Host 'HQ Nova IA: pantalla cerrada (el servidor sigue listo).' }
  exit 0
}

function Test-NovaHQ {
  try { (Invoke-WebRequest -Uri ($url + 'api/state') -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { $false }
}

if (-not (Test-NovaHQ)) {
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $node) {
    Write-Host 'No encuentro Node.js. Instálalo desde https://nodejs.org y vuelve a intentar.'
    if (-not $SinPantalla -and $Espera -eq 0) { Read-Host 'Enter para salir' }   # en arranque oculto no hay quien pulse Enter
    exit 1
  }
  if (-not (Test-Path "$here\node_modules")) { Push-Location $here; & npm install --omit=dev --no-audit --no-fund | Out-Null; Pop-Location }   # recién descargado de GitHub no trae sus librerías
  Start-Process -FilePath $node -ArgumentList "`"$here\server.mjs`"" -WorkingDirectory $here -WindowStyle Hidden
  for ($i = 0; $i -lt 40 -and -not (Test-NovaHQ); $i++) { Start-Sleep -Milliseconds 250 }
}

$query = @()
if ($Escena) { $query += "escena=$Escena" }
if ($Skin) { $query += "skin=$Skin" }
if ($Rotar) { $query += 'rotar=1' }
$pagina = if ($query) { $url + '?' + ($query -join '&') } else { $url }

if ($Ventana) { Start-Process $pagina; Write-Host "HQ Nova IA abierta en tu navegador: $pagina"; exit 0 }
if ($SinPantalla) { Write-Host "HQ Nova IA: servidor listo en $url (sin pantalla)."; exit 0 }
if ($Espera -gt 0) { Start-Sleep -Seconds $Espera }

# El monitor: el que pidas (-Monitor 2), si no el primero que no sea el principal, si no el principal.
Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens
$target = if ($Monitor -ge 1 -and $Monitor -le $screens.Count) { $screens[$Monitor - 1] }
          else { ($screens | Where-Object { -not $_.Primary } | Select-Object -First 1) }
if (-not $target) { $target = [System.Windows.Forms.Screen]::PrimaryScreen }
$b = $target.Bounds

$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path $_ } | Select-Object -First 1
$perfil = Join-Path $env:LOCALAPPDATA 'NovaHQ\edge-perfil'
# Modo kiosco: pantalla completa de verdad, sin barras. Se cierra con Alt+F4.
$edgeArgs = @('--kiosk', $pagina, '--edge-kiosk-type=fullscreen', "--user-data-dir=`"$perfil`"",
          "--window-position=$($b.X),$($b.Y)", "--window-size=$($b.Width),$($b.Height)", '--no-first-run', '--disable-features=Translate')
Cerrar-Pantalla   # una sola pantalla a la vez (y toma la skin/escenario nuevos)
Start-Sleep -Milliseconds 600
if ($edge) { Start-Process -FilePath $edge -ArgumentList $edgeArgs }
else { Start-Process $pagina }
Write-Host "HQ Nova IA abierta en el monitor $([array]::IndexOf($screens, $target) + 1) ($($b.Width)x$($b.Height)). Alt+F4 la cierra."
