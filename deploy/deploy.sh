#!/usr/bin/env bash
# Put this repo, exactly as it is on GitHub, on the VPS and restart the server:
#
#   npm run deploy        (or: bash deploy/deploy.sh, from Git Bash)
#
# Refuses unless this copy matches GitHub (nothing uncommitted, unpulled or unpushed). Tests and
# builds here, sends the code and the built page up, installs the server's packages there and
# restarts it. The server's .env (the LRS key) is left as it is; the first deploy copies yours up.
# Needs deploy/setup.sh to have been run once.
set -euo pipefail

SERVER="${ELEARNING_SERVER:-root@50.6.206.202}"
# Which copy: `bash deploy/deploy.sh` is Tribe of Abraham (learn.tribeofabraham.com, port 3030);
# `bash deploy/deploy.sh studios` (npm run deploy:studios) is Ragamuffin Studios
# (learn.ragamuffinstudios.com, port 3031, built with --mode studios). Each has its own folder,
# service and .env on the server.
INSTANCE="${1:-toa}"
if [ "$INSTANCE" = studios ]; then
  DOMAIN="${ELEARNING_DOMAIN:-learn.ragamuffinstudios.com}"; APP=/srv/elearning-studios/app
  PORT=3031; SERVICE=elearning-studios; BUILD="build:studios"; LABEL="Ragamuffin Studios"
else
  DOMAIN="${ELEARNING_DOMAIN:-learn.tribeofabraham.com}"; APP=/srv/elearning/app
  PORT=3030; SERVICE=elearning-react; BUILD="build"; LABEL="Tribe of Abraham"
fi
cd "$(dirname "$0")/.."
quiet() { grep -v -E 'post-quantum|store now|upgraded|^\*\* ' || true; }

if [ -n "$(git status --porcelain)" ]; then echo "✖ You have changes that are not committed. Commit and push them first."; exit 1; fi
git fetch -q origin
read -r ahead behind < <(git rev-list --left-right --count "HEAD...@{u}")
if [ "$behind" -gt 0 ]; then echo "✖ GitHub has $behind newer commit(s). Run git pull first."; exit 1; fi
if [ "$ahead" -gt 0 ]; then echo "✖ You have $ahead commit(s) not on GitHub. Run git push first."; exit 1; fi
commit=$(git rev-parse --short HEAD)

echo "Testing and building…"
# install, not ci: it leaves an up-to-date node_modules alone, so a running dev server is no obstacle
npm install --silent --no-audit --no-fund
npm test --silent >/dev/null 2>&1 || { npm test; echo "✖ Tests failed. Nothing was deployed."; exit 1; }
npm run "$BUILD" --silent >/dev/null || { echo "✖ The page didn't build. Nothing was deployed."; exit 1; }

echo "Deploying $commit ($LABEL) to $SERVER…"
# The LRS key: copied up the first time only, never overwritten (the server's own may differ)
if ! ssh -o BatchMode=yes "$SERVER" "test -f $APP/.env" 2>/dev/null; then
  [ -f .env ] || { echo "✖ No .env here to copy up. Copy .env.example to .env and fill in the LRS details."; exit 1; }
  scp -q -o BatchMode=yes .env "$SERVER:$APP/.env"
  if [ "$INSTANCE" = studios ]; then   # its statements under the Studios' own activity ids
    ssh -o BatchMode=yes "$SERVER" "sed -i '/^ACTIVITY_BASE=/d' $APP/.env && echo ACTIVITY_BASE=https://ragamuffinstudios.com/xapi/elearning >> $APP/.env" 2>&1 | quiet
  fi
  echo "  ✔ Copied your .env (the LRS details) to the server"
fi
# dist/ isn't in git, so the built page goes up beside the code
tar -c dist | ssh -o BatchMode=yes "$SERVER" "rm -rf /tmp/elearning-dist && mkdir /tmp/elearning-dist && tar -x -C /tmp/elearning-dist" 2>&1 | quiet
git archive --format=tar HEAD | ssh -o BatchMode=yes "$SERVER" "
  set -e
  tar -x -C $APP
  rm -rf $APP/dist && mv /tmp/elearning-dist/dist $APP/dist
  echo $commit > $APP/DEPLOYED
  chown -R elearning:elearning $(dirname $APP)
  chmod 600 $APP/.env
  cd $APP && runuser -u elearning -- npm ci --omit=dev --silent --no-audit --no-fund
  systemctl restart $SERVICE
  sleep 2
  systemctl is-active --quiet $SERVICE || { journalctl -u $SERVICE -n 30 --no-pager; exit 1; }
  curl -fsS http://127.0.0.1:$PORT/api/health
" 2>&1 | quiet
echo
code=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "https://$DOMAIN/api/health" || true)
if [ "$code" = 200 ]; then
  echo "✔ Deployed $commit. https://$DOMAIN is up."
else
  echo "✔ Deployed $commit and running on the server."
  echo "  https://$DOMAIN isn't answering yet ($code): add its DNS record if needed, then run bash deploy/setup.sh $INSTANCE."
fi
