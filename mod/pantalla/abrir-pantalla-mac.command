#!/bin/zsh
# HQ Nova IA en Mac: arranca el servidor si hace falta y abre la pantalla grande en el navegador.
# Doble clic, o desde Claude con /nova pantalla. Opciones: escena X · skin X · rotar · apagar
# · servidor (solo arranca el servidor, sin abrir el navegador: lo usa Nova al abrir Claude si tienes cubo)
cd "$(dirname "$0")"
URL="http://127.0.0.1:${NOVA_HQ_PORT:-4747}/"
up() { curl -s -o /dev/null --max-time 2 "${URL}api/state"; }

if [[ "$1" == "apagar" ]]; then
  pkill -f "$PWD/server.mjs" && echo "Servidor apagado." || echo "El servidor no estaba corriendo."
  exit 0
fi

query=()
solo=0
while (( $# )); do
  case "$1" in
    escena) query+=("escena=$2"); shift ;;
    skin) query+=("skin=$2"); shift ;;
    rotar) query+=("rotar=1") ;;
    servidor) solo=1 ;;
  esac
  shift
done

if ! up; then
  # Claude arranca sin el PATH de la terminal: busca node también en nvm y Homebrew.
  [ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
  export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
  if ! command -v node >/dev/null; then
    echo "No encuentro Node.js. Instálalo desde https://nodejs.org (versión 22 o más nueva)."
    exit 1
  fi
  # Recién descargado de GitHub no trae sus librerías.
  [ -d node_modules ] || npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1 || { echo "No pude instalar las librerías (npm install)."; exit 1; }
  nohup node "$PWD/server.mjs" > /tmp/nova-hq.log 2>&1 &!
  for i in {1..40}; do up && break; sleep 0.25; done
  up || { echo "El servidor no arrancó. Mira /tmp/nova-hq.log"; exit 1; }
fi

(( solo )) && { echo "Servidor listo en $URL"; exit 0; }

PAGE="$URL"
(( ${#query} )) && PAGE="$URL?${(j:&:)query}"
open "$PAGE"
echo "Abierta: $PAGE"
