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
DOMAIN="${ELEARNING_DOMAIN:-learn.tribeofabraham.com}"
cd "$(dirname "$0")/.."
quiet() { grep -v -E 'post-quantum|store now|upgraded|^\*\* ' || true; }

echo "Setting up $SERVER…"
scp -q -o BatchMode=yes deploy/elearning-react.service "$SERVER:/tmp/elearning-react.service"
ssh -o BatchMode=yes "$SERVER" "DOMAIN=$DOMAIN bash -s" 2>&1 <<'REMOTE' | quiet
set -euo pipefail

# -- 1. Node, the user, the folder --
if ! node --version 2>/dev/null | grep -q '^v22\.'; then
  echo "Installing Node.js 22…"
  dnf -y -q module reset nodejs >/dev/null
  dnf -y -q module enable nodejs:22 >/dev/null
  dnf -y -q install nodejs >/dev/null
fi
echo "  ✔ Node $(node --version)"
if ! id elearning >/dev/null 2>&1; then
  useradd --system --home-dir /srv/elearning --shell /sbin/nologin elearning
fi
mkdir -p /srv/elearning/app
chown -R elearning:elearning /srv/elearning
chmod 750 /srv/elearning
echo "  ✔ User elearning, /srv/elearning/app"

# -- 2. The service --
if ! cmp -s /tmp/elearning-react.service /etc/systemd/system/elearning-react.service; then
  mv /tmp/elearning-react.service /etc/systemd/system/elearning-react.service
  restorecon /etc/systemd/system/elearning-react.service 2>/dev/null || true
  systemctl daemon-reload
fi
rm -f /tmp/elearning-react.service
systemctl enable -q elearning-react
echo "  ✔ Service elearning-react (starts once the app is deployed)"

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

# Tribe of Abraham e-learning: HTTPS (automatic certificate) in front of the app on 127.0.0.1:3030
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:3030
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
echo "Done. Next: bash deploy/deploy.sh"
