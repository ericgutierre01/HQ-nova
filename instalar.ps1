# HQ Nova IA — instalador. Lo corre INSTALAR.cmd (doble clic).
#  1. Copia HQ Nova IA a %LOCALAPPDATA%\HQ-Nova-IA (así el .zip se puede borrar después).
#  2. Instala la banda de Novas en Claude Code (para todas tus sesiones).
#  3. Crea el acceso directo "HQ Nova IA" en el escritorio para abrir la pantalla grande.
#  4. Pregunta si quieres que la pantalla arranque sola con Windows.
# -Prueba: solo copia e instala la banda (sin accesos directos ni preguntas).
param([string]$Destino = (Join-Path $env:LOCALAPPDATA 'HQ-Nova-IA'), [switch]$Prueba)

$ErrorActionPreference = 'Stop'
$origen = Split-Path -Parent $MyInvocation.MyCommand.Path
function Paso($t) { Write-Host ''; Write-Host "» $t" -ForegroundColor Cyan }
function Bien($t) { Write-Host "  ✓ $t" -ForegroundColor Green }
function Ojo($t) { Write-Host "  ! $t" -ForegroundColor Yellow }

Write-Host ''
Write-Host '  HQ Nova IA — Nova y sus ayudantes trabajando en vivo' -ForegroundColor Green
Write-Host '  ────────────────────────────────────────────────────'

# 1. Copiar
Paso "Copiando HQ Nova IA a $Destino"
if ((Resolve-Path $origen).Path.TrimEnd('\') -ne $Destino.TrimEnd('\')) {
  New-Item -ItemType Directory -Force $Destino | Out-Null
  & robocopy $origen $Destino /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "No se pudo copiar a $Destino (robocopy $LASTEXITCODE)." }
}
Get-ChildItem $Destino -Recurse -File | Unblock-File -ErrorAction SilentlyContinue   # quita la marca de "descargado de internet"
Bien 'Copiado.'

# 2. Node.js (solo lo necesita la pantalla grande)
Paso 'Revisando Node.js (para la pantalla grande)'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($node) { Bien "Node.js $(& $node --version) encontrado." }
else { Ojo 'No tienes Node.js. La banda funciona igual; para la pantalla grande instala Node.js 22.13 o más nuevo desde https://nodejs.org y vuelve a correr INSTALAR.cmd.' }

# 3. La banda en Claude Code: el CLI que trae la app de Claude (el más nuevo), si no el de la terminal.
Paso 'Instalando la banda de Novas en Claude Code'
# La app de Claude guarda su Claude Code en %APPDATA%\Claude\claude-code o, desde 2026, en %LOCALAPPDATA%\Claude-Data\*\claude-code.
$raices = @((Join-Path $env:APPDATA 'Claude\claude-code')) + @(Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Claude-Data') -Directory -ErrorAction SilentlyContinue |
  ForEach-Object { Join-Path $_.FullName 'claude-code' })
$cli = $raices | Where-Object { Test-Path $_ } | ForEach-Object { Get-ChildItem $_ -Recurse -Filter claude.exe -ErrorAction SilentlyContinue } |
  Sort-Object { try { [version]$_.Directory.Parent.Name } catch { [version]'0.0' } } -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $cli) { $cli = (Get-Command claude -ErrorAction SilentlyContinue).Source }
if (-not $cli) {
  Ojo 'No encontré Claude Code. Instala la app de Claude (claude.ai/download), ábrela una vez y vuelve a correr INSTALAR.cmd.'
} else {
  Bien "Claude Code $(& $cli --version 2>$null)"
  $add = & $cli plugin marketplace add $Destino 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -and $add -notmatch 'already|ya existe') { Write-Host $add; throw 'No se pudo registrar HQ Nova IA en Claude Code.' }
  if ($add -match 'already|ya existe') { & $cli plugin marketplace update hq-nova-ia 2>&1 | Out-Null }
  $inst = & $cli plugin install nova-hq@hq-nova-ia --scope user 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -and $inst -notmatch 'already') { Write-Host $inst; throw 'No se pudo instalar la banda.' }
  Bien 'Banda instalada: sale en cada sesión nueva de Claude (en una abierta, escribe /reload-plugins).'
}

if ($Prueba) { Write-Host ''; Bien 'Prueba terminada.'; exit 0 }

# 4. Acceso directo en el escritorio
Paso 'Creando el acceso directo "HQ Nova IA" en el escritorio'
$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'HQ Nova IA.lnk'
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$s.TargetPath = Join-Path $Destino 'abrir-pantalla.cmd'
$s.WorkingDirectory = $Destino
$s.WindowStyle = 7
$s.Description = 'HQ Nova IA: la pantalla de tus agentes de Claude'
$s.Save()
Bien 'Listo: doble clic en "HQ Nova IA" abre la pantalla en tu 2º monitor.'

# 5. Arranque con Windows (opcional)
if ($node) {
  Write-Host ''
  $r = Read-Host '¿Quieres que la pantalla arranque sola cada vez que inicies Windows? (s/n)'
  if ($r -match '^(s|si|sí|y|yes)$') { & (Join-Path $Destino 'activar-arranque.cmd') /sinpausa | Out-Null; Bien 'Arranque automático activado (se quita con quitar-arranque.cmd).' }
  $r = Read-Host '¿La abro ahora? (s/n)'
  if ($r -match '^(s|si|sí|y|yes)$') { & (Join-Path $Destino 'abrir-pantalla.cmd') | Out-Null }
}

Write-Host ''
Write-Host '  ¡Listo! En Claude escribe /nova ajustes para cambiar skin, escenario, colores y más.' -ForegroundColor Green
Write-Host '  En la pantalla grande: tecla S = skin, E = escenario, ⚙ abajo a la izquierda.'
