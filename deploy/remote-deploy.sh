#!/usr/bin/env bash
# Exécuté sur le VPS par la CI : installe la release, bascule, vérifie, sinon revient en arrière.
set -euo pipefail

RELEASE="$1"
APP="$HOME/app"
NEW="$APP/releases/$RELEASE"
SERVICE=tower-defense
PORT=3210   # même valeur que dans tower-defense.service
KEEP=5

# Nécessaire pour `systemctl --user` dans une session SSH non interactive
export XDG_RUNTIME_DIR="/run/user/$(id -u)"

cd "$NEW"
npm ci --omit=dev --no-audit --no-fund

install -Dm644 "$NEW/deploy/tower-defense.service" "$HOME/.config/systemd/user/$SERVICE.service"
systemctl --user daemon-reload
systemctl --user enable "$SERVICE"

PREVIOUS=""
if [ -L "$APP/current" ]; then
  PREVIOUS="$(readlink -f "$APP/current")"
fi

ln -sfn "$NEW" "$APP/current"
systemctl --user restart "$SERVICE"

for _ in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/"; then
    echo "Release $RELEASE en ligne."
    ls -1dt "$APP"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf
    exit 0
  fi
  sleep 1
done

echo "Échec du contrôle de santé, retour à ${PREVIOUS:-rien}" >&2
if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$NEW" ]; then
  ln -sfn "$PREVIOUS" "$APP/current"
  systemctl --user restart "$SERVICE"
fi
exit 1
