#!/usr/bin/env bash
# One-time setup of the VPS for the e-learning server. Safe to run again: each step is skipped
# when it's already done. Run from Git Bash on your PC (it logs in as root with your SSH key):
#
#   bash deploy/setup.sh
#
# 1. Node.js 22, a user to run the app (elearning), and /srv/elearning/app
# 2. The systemd service (deploy/elearning-react.service)
# 3. The HTTPS site in Caddy, once learn.tribeofabraham.com points at the server
#    (until then it says so and stops; run it again after adding the DNS record)
# Then run deploy/deploy.sh to put the app there.
set -euo pipefail

SERVER="${ELEARNING_SERVER:-root@50.6.206.202}"
# `bash deploy/setup.sh` sets up the Tribe of Abraham copy; `bash deploy/setup.sh studios` the
# Ragamuffin Studios one (learn.ragamuffinstudios.com, /srv/elearning-studios/app, port 3031, service
# elearning-studios). Both run as the elearning user.
INSTANCE="${1:-toa}"
if [ "$INSTANCE" = studios ]; then
  DOMAIN="${ELEARNING_DOMAIN:-learn.ragamuffinstudios.com}"; HOME_DIR=/srv/elearning-studios
  PORT=3031; SERVICE=elearning-studios; LABEL="Ragamuffin Studios"
else
  DOMAIN="${ELEARNING_DOMAIN:-learn.tribeofabraham.com}"; HOME_DIR=/srv/elearning
  PORT=3030; SERVICE=elearning-react; LABEL="Tribe of Abraham"
fi
cd "$(dirname "$0")/.."
quiet() { grep -v -E 'post-quantum|store now|upgraded|^\*\* ' || true; }

echo "Setting up $SERVER…"
# The service file, for this copy's folder and port
sed -e "s|/srv/elearning/app|$HOME_DIR/app|" -e "s|PORT=3030|PORT=$PORT|" -e "s|^Description=Tribe of Abraham|Description=$LABEL|"   deploy/elearning-react.service | ssh -o BatchMode=yes "$SERVER" "cat > /tmp/$SERVICE.service"
ssh -o BatchMode=yes "$SERVER" "DOMAIN=$DOMAIN HOME_DIR=$HOME_DIR PORT=$PORT SERVICE=$SERVICE LABEL='$LABEL' bash -s" 2>&1 <<'REMOTE' | quiet
set -euo pipefail

# -- 1. Node, the user, the folder --
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  echo "Installing Node.js 22…"
  dnf -y -q module reset nodejs >/dev/null
  dnf -y -q module enable nodejs:22 >/dev/null
  dnf -y -q install nodejs >/dev/null
fi
# On AlmaLinux npm is its own package
command -v npm >/dev/null || dnf -y -q install npm >/dev/null
echo "  ✔ Node $(node --version), npm $(npm --version)"
if ! id elearning >/dev/null 2>&1; then
  useradd --system --home-dir /srv/elearning --shell /sbin/nologin elearning
fi
mkdir -p $HOME_DIR/app
chown -R elearning:elearning $HOME_DIR
chmod 750 $HOME_DIR
echo "  ✔ User elearning, $HOME_DIR/app"

# -- 2. The service --
if ! cmp -s /tmp/$SERVICE.service /etc/systemd/system/$SERVICE.service; then
  mv /tmp/$SERVICE.service /etc/systemd/system/$SERVICE.service
  restorecon /etc/systemd/system/$SERVICE.service 2>/dev/null || true
  systemctl daemon-reload
fi
rm -f /tmp/$SERVICE.service
systemctl enable -q $SERVICE
echo "  ✔ Service $SERVICE (starts once the app is deployed)"

# -- 3. Caddy, once the DNS is in place --
here=$(curl -s -4 -m 10 https://api.ipify.org || true)
there=$( (getent ahostsv4 "$DOMAIN" || true) | awk 'NR==1{print $1}')   # empty while there's no record
if grep -q "^$DOMAIN {" /etc/caddy/Caddyfile; then
  echo "  ✔ Caddy already serves https://$DOMAIN"
elif [ -z "$there" ] || [ "$there" != "$here" ]; then
  echo
  echo "  … $DOMAIN doesn't point here yet (it's ${there:-not set}, this server is $here)."
  echo "    Add an A record for it pointing to $here, then run this again to turn on HTTPS."
else
  cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak
  cat >> /etc/caddy/Caddyfile <<CADDY

# $LABEL e-learning: HTTPS (automatic certificate) in front of the app on 127.0.0.1:$PORT
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:$PORT
}
CADDY
  if caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
    systemctl reload caddy
    echo "  ✔ Caddy now serves https://$DOMAIN (the certificate arrives within a minute)"
  else
    mv /etc/caddy/Caddyfile.bak /etc/caddy/Caddyfile
    echo "  ✖ Caddy didn't accept the new site, so the Caddyfile was put back as it was."
    exit 1
  fi
fi
REMOTE
echo "Done. Next: bash deploy/deploy.sh $INSTANCE"
