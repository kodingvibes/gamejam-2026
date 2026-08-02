#!/bin/bash
# Doble clic para jugar. Levanta el servidor en esta carpeta y abre el navegador.
# Hace falta porque el juego son modulos ES + fetch: con file:// el navegador los bloquea.
cd "$(dirname "$0")" || exit 1
PORT=8123
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT + 1)); done
(sleep 1; (command -v open || command -v xdg-open) >/dev/null && \
  { open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT"; }) &
echo "AI RUNNER en http://localhost:$PORT   (ctrl-c para parar)"
exec python3 -m http.server $PORT
