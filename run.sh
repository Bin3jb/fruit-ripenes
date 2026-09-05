#!/usr/bin/env bash
# Start the whole stack locally. Ctrl-C stops both services.
#
#   ./run.sh          real detector (needs ml-service/models/*.pt + torch)
#   ./run.sh --dev    synthetic detector, no torch and no weights needed
set -euo pipefail
cd "$(dirname "$0")"

MODE="${1:-}"
trap 'kill 0' EXIT INT TERM

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "created backend/.env — set DB_PASSWORD and JWT_SECRET before anything real"
fi

echo "==> ML service"
if [ "$MODE" = "--dev" ]; then
  (cd ml-service && python3 scripts/dev_server.py) &
else
  (cd ml-service && python3 app.py) &
fi

sleep 3
echo "==> API + frontend"
(cd backend && npm start) &

echo
echo "    frontend + API : http://localhost:${PORT:-3000}"
echo "    ML service     : http://localhost:5001"
echo
wait
