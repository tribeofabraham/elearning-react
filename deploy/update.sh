#!/usr/bin/env bash
# On the VPS: bring the server up to what's on GitHub. Run as your admin user (it uses sudo):
#   /srv/elearning-react/deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
as_app() { sudo -u elearning "$@"; }

as_app git pull --ff-only
# --include=dev: Vite is a dev dependency, and the build needs it even on a production machine
as_app npm ci --include=dev
as_app npm test
as_app npm run build
sudo systemctl restart elearning-react
sleep 1
curl -fsS http://127.0.0.1:3030/api/health && echo && echo "Updated and running."
