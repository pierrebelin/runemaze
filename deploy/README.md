# Déploiement de Runemaze sur VPS — td.pierrebelin.fr

Plan étape par étape : VPS Ubuntu/Debian existant (Node, Nginx et Certbot déjà en place), utilisateur dédié `td`, service systemd utilisateur, déploiement automatique par GitHub Actions à chaque push sur `main`.

---

## 0. Vue d'ensemble

```
Navigateur ──HTTPS/WSS──> Nginx (443, certificat Let's Encrypt)
                            │  proxy_pass (HTTP + upgrade WebSocket sur /partie)
                            ▼
                 127.0.0.1:3210  node --import tsx src/server/main.ts
                 (service systemd utilisateur « tower-defense », user « td »)
                            │
                            ├─ sert dist/index.html (build Vite mono-fichier)
                            └─ WebSocket /partie (arbitre, salons de duel)
```

Constats tirés du code, qui guident les choix :

- `src/server/main.ts` sert **à la fois** `dist/` et le WebSocket `/partie` sur un seul port (`PORT`, défaut `8080` ; `3210` en production). Nginx relaie donc tout vers Node ; il faut seulement gérer l'upgrade WebSocket sur `/partie`.
- Le client ouvre `wss://<host>/partie` quand la page est en HTTPS (`src/presentation/ServerLink.ts`). Rien à configurer côté client.
- Le serveur tourne en TypeScript via `tsx`. Aujourd'hui `tsx` est en `devDependencies` : il doit passer en `dependencies` pour un `npm ci --omit=dev` en production.
- L'état des parties vit **en mémoire** : une seule instance, et chaque redéploiement coupe les parties en cours (limite acceptée, voir §12).
- `esbuild` (dépendance de `tsx`) embarque un binaire propre à la plateforme : les dépendances s'installent **sur le VPS**, pas dans la CI.

Arborescence cible dans le home de `td` :

```
/home/td/
├── .ssh/authorized_keys          clé publique de la CI (restreinte)
├── .config/systemd/user/
│   └── tower-defense.service     copié depuis deploy/ à chaque déploiement
└── app/
    ├── current -> releases/<sha> lien symbolique vers la release active
    └── releases/
        ├── <sha1>/               dist/ src/ deploy/ package*.json tsconfig.json node_modules/
        └── <sha2>/               (5 dernières releases conservées, pour le retour arrière)
```

---

## 1. Vérifications préalables sur le VPS

À faire avec ton compte admin habituel (sudo).

```bash
# Node système (pas nvm) : doit être visible par n'importe quel utilisateur
command -v node npm      # attendu : /usr/bin/node, /usr/bin/npm
node -v                  # >= 20.6 requis pour `node --import tsx` ; même majeure que la CI (24)

# Outils utilisés par le script de déploiement
command -v rsync curl

# Port 3210 libre ?
sudo ss -ltnp | grep ':3210' || echo "3210 libre"

# Le serveur écoute sur 127.0.0.1 uniquement (HOST, §5.2) : seul Nginx est exposé

# Restrictions SSH éventuelles (AllowUsers / AllowGroups)
sudo sshd -T | grep -Ei 'allowusers|allowgroups|passwordauthentication|port '
```

À corriger si besoin :

- **Node installé via nvm** sous un autre utilisateur : `td` ne le verra pas. Installer Node en système (paquet NodeSource `nodejs` 24.x) ou ajuster les chemins `/usr/bin/node` dans `deploy/tower-defense.service`.
- **Port déjà pris** : choisir un autre port que 3210 et le reporter dans les 3 fichiers de `deploy/` (service, script, nginx).
- **`AllowUsers` présent** : ajouter `td` dans `/etc/ssh/sshd_config`, puis `sudo systemctl reload ssh`.

---

## 2. DNS

Chez le registrar / la zone `pierrebelin.fr` :

| Type | Nom | Valeur |
|---|---|---|
| `A` | `td` | IPv4 du VPS |
| `AAAA` | `td` | IPv6 du VPS (seulement si le VPS en a une et que Nginx écoute en IPv6) |

Vérifier la propagation avant Certbot :

```bash
dig +short td.pierrebelin.fr A
dig +short td.pierrebelin.fr AAAA
```

---

## 3. Créer l'utilisateur `td`

```bash
# Utilisateur sans mot de passe (connexion par clé uniquement), sans sudo
sudo adduser --disabled-password --gecos "Runemaze" td

# Dossiers de l'application et de SSH
sudo -u td mkdir -p /home/td/app/releases /home/td/.ssh /home/td/.config/systemd/user
sudo chmod 700 /home/td/.ssh

# Autoriser le gestionnaire systemd utilisateur à tourner sans session ouverte
# (le service survit à la déconnexion et démarre au boot)
sudo loginctl enable-linger td

# Contrôle : le gestionnaire utilisateur doit être actif
sudo -u td XDG_RUNTIME_DIR=/run/user/$(id -u td) systemctl --user status --no-pager | head -3
```

`td` n'est membre d'aucun groupe privilégié : une clé CI compromise ne donne accès qu'à l'application.

---

## 4. Clé SSH de déploiement

### 4.1 Générer la paire de clés (sur ta machine, pas sur le VPS)

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-deploy@td.pierrebelin.fr" -f ~/.ssh/td_deploy
```

- `~/.ssh/td_deploy` : clé **privée**, ira dans un secret GitHub, nulle part ailleurs.
- `~/.ssh/td_deploy.pub` : clé **publique**, ira sur le VPS.

### 4.2 Installer la clé publique pour `td`

Le préfixe `restrict` coupe le transfert de ports, d'agent, X11 et le pseudo-terminal ; les commandes et `rsync` continuent de fonctionner.

```bash
# Sur le VPS (remplacer par le contenu réel de td_deploy.pub)
echo 'restrict ssh-ed25519 AAAA...  github-actions-deploy@td.pierrebelin.fr' \
  | sudo -u td tee /home/td/.ssh/authorized_keys > /dev/null
sudo chmod 600 /home/td/.ssh/authorized_keys
sudo chown td:td /home/td/.ssh/authorized_keys
```

Optionnel : ajouter ta clé perso (sans `restrict`) sur une seconde ligne pour te connecter directement en `td`.

### 4.3 Tester depuis ta machine

```bash
ssh -i ~/.ssh/td_deploy -p <PORT_SSH> td@td.pierrebelin.fr 'whoami; node -v; npm -v'
# attendu : td, puis les versions
```

### 4.4 Empreinte d'hôte pour la CI

La CI doit connaître l'empreinte du serveur (pas de `StrictHostKeyChecking=no`).

```bash
# Sur ta machine
ssh-keyscan -p <PORT_SSH> -t ed25519 td.pierrebelin.fr
# Sur le VPS, pour comparer l'empreinte
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
ssh-keyscan -p <PORT_SSH> -t ed25519 td.pierrebelin.fr | ssh-keygen -lf -
```

Les deux empreintes `SHA256:...` doivent être identiques. La ligne complète renvoyée par `ssh-keyscan` sera le secret `DEPLOY_KNOWN_HOSTS`.

---

## 5. Modifications du dépôt

Cinq changements, tous versionnés.

### 5.1 `package.json` : `tsx` devient une dépendance de production

```bash
npm install --save tsx
```

Attendu : `tsx` passe de `devDependencies` à `dependencies`, `package-lock.json` mis à jour. Vérifier que `npm run server` fonctionne toujours en local.

### 5.1 bis `src/server/main.ts` : adresse d'écoute réglable

Le serveur écoute sur `127.0.0.1` seulement : seul Nginx est joignable de l'extérieur. Sans `HOST`, le comportement local reste inchangé (toutes les interfaces).

```ts
const HOST = process.env.HOST;
// ...
httpServer.listen(PORT, HOST, () => {
  console.log(`Serveur sur http://${HOST ?? 'localhost'}:${PORT}`);
});
```

### 5.2 `deploy/tower-defense.service`

```ini
# Service systemd utilisateur : installé par deploy/remote-deploy.sh dans ~/.config/systemd/user/.
[Unit]
Description=Runemaze, serveur de partie

[Service]
WorkingDirectory=%h/app/current
Environment=NODE_ENV=production
Environment=PORT=3210
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node --import tsx src/server/main.ts
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
```

`%h` vaut `/home/td`. Le lien `current` est résolu au démarrage : après bascule du lien, un `restart` lance la nouvelle release.

### 5.3 `deploy/remote-deploy.sh`

Exécuté **sur le VPS** par la CI, depuis la release fraîchement envoyée. Installe les dépendances, bascule le lien, redémarre, vérifie, et revient à la release précédente si le serveur ne répond pas.

```bash
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
```

Le contrôle de santé demande `/` : si `dist/index.html` est servi, le process Node tourne et le build est présent.

### 5.4 `deploy/nginx/td.pierrebelin.fr.conf`

Modèle de départ, copié une seule fois sur le VPS (§6). Certbot le complètera ensuite avec le bloc 443 : la version sur le serveur divergera du modèle, c'est normal.

```nginx
# Modèle initial : Certbot ajoute ensuite le bloc HTTPS et la redirection 80 -> 443.
server {
    listen 80;
    server_name td.pierrebelin.fr;

    gzip on;
    gzip_proxied any;
    gzip_types text/javascript application/javascript text/css application/json;

    # WebSocket du serveur de partie
    location /partie {
        proxy_pass http://127.0.0.1:3210;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # Une connexion de salon peut rester longtemps silencieuse
        proxy_read_timeout 1h;
        proxy_send_timeout 1h;
    }

    # Page du jeu (dist/index.html servi par Node)
    location / {
        proxy_pass http://127.0.0.1:3210;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Pas de `listen [::]:80;` : à ajouter seulement si le VPS a une IPv6 configurée.

`Connection "upgrade"` en dur (plutôt qu'un `map $http_upgrade`) évite un conflit si un `map` du même nom existe déjà dans la config globale du VPS.

### 5.5 `.github/workflows/deploy.yml`

Deux jobs : `verifier` (typage, tests, build) puis `deployer` (envoi et bascule), seulement si le premier passe.

```yaml
name: Déploiement

on:
  push:
    branches: [main]
  workflow_dispatch:

# Jamais deux déploiements en parallèle ; celui en cours va jusqu'au bout.
concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  verifier:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm test
      - run: npm run build
      - uses: actions/upload-artifact@v7
        with:
          name: dist
          path: dist/
          retention-days: 7

  deployer:
    needs: verifier
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://td.pierrebelin.fr
    steps:
      - uses: actions/checkout@v7
      - uses: actions/download-artifact@v8
        with:
          name: dist
          path: dist/

      - name: Préparer SSH
        env:
          SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
          KNOWN_HOSTS: ${{ secrets.DEPLOY_KNOWN_HOSTS }}
        run: |
          install -m 700 -d "$HOME/.ssh"
          printf '%s\n' "$SSH_KEY" > "$HOME/.ssh/deploy_key"
          chmod 600 "$HOME/.ssh/deploy_key"
          printf '%s\n' "$KNOWN_HOSTS" > "$HOME/.ssh/known_hosts"

      - name: Envoyer et activer la release
        env:
          TARGET: ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}
          PORT: ${{ secrets.DEPLOY_PORT }}
          RELEASE: ${{ github.sha }}
        run: |
          SSH="ssh -i $HOME/.ssh/deploy_key -p $PORT"
          rsync -az -e "$SSH" \
            dist src deploy package.json package-lock.json tsconfig.json \
            "$TARGET:app/releases/$RELEASE/"
          $SSH "$TARGET" "bash app/releases/$RELEASE/deploy/remote-deploy.sh $RELEASE"
```

Notes :

- Vérifier au moment de l'écriture la dernière version majeure de chaque action (`checkout`, `setup-node`, `upload-artifact`, `download-artifact`).
- La version de Node de la CI (24) doit avoir la même majeure que celle du VPS, pour que ce qui est testé soit ce qui tourne.
- `rsync` crée le dossier `releases/<sha>/` ; son parent `app/releases/` existe déjà (§3).

---

## 6. Nginx et HTTPS (sur le VPS, une seule fois)

```bash
# 1. Copier le modèle (depuis ta machine : scp, ou coller le contenu)
sudo tee /etc/nginx/sites-available/td.pierrebelin.fr > /dev/null < td.pierrebelin.fr.conf
sudo ln -s /etc/nginx/sites-available/td.pierrebelin.fr /etc/nginx/sites-enabled/

# 2. Valider puis recharger
sudo nginx -t && sudo systemctl reload nginx

# 3. Certificat Let's Encrypt (le DNS doit déjà pointer, §2)
sudo certbot --nginx -d td.pierrebelin.fr --redirect

# 4. Revalider après la modification par Certbot
sudo nginx -t && sudo systemctl reload nginx

# 5. Le renouvellement automatique existant couvre ce certificat
sudo certbot renew --dry-run
```

Tant que le premier déploiement n'a pas eu lieu, `https://td.pierrebelin.fr` répond `502 Bad Gateway` : normal.

---

## 7. Secrets GitHub

Dans le dépôt `pierrebelin/runemaze` : *Settings → Environments → New environment* `production`, puis y ajouter les secrets suivants (secrets d'environnement, pas de dépôt : seul le job `deployer` y a accès).

| Secret | Valeur |
|---|---|
| `DEPLOY_HOST` | `td.pierrebelin.fr` (ou l'IP du VPS) |
| `DEPLOY_PORT` | port SSH du VPS (`22` par défaut) |
| `DEPLOY_USER` | `td` |
| `DEPLOY_SSH_KEY` | contenu **complet** de `~/.ssh/td_deploy`, lignes `-----BEGIN/END OPENSSH PRIVATE KEY-----` comprises |
| `DEPLOY_KNOWN_HOSTS` | ligne complète issue de `ssh-keyscan` (§4.4) |

Optionnel, dans *Deployment branches* de l'environnement : limiter à `main`.

Une fois le secret enregistré, supprimer la clé privée locale si elle ne sert qu'à la CI (`rm ~/.ssh/td_deploy`) ; en cas de perte, on régénère une paire (§4).

---

## 8. Premier déploiement

1. Commiter `package.json`, `package-lock.json`, `deploy/` et `.github/workflows/deploy.yml`, puis pousser sur `main`.
2. Suivre le run dans l'onglet *Actions* : `verifier` puis `deployer` doivent passer au vert. La dernière ligne attendue est `Release <sha> en ligne.`
3. Si `deployer` échoue sur SSH : relire §4.3 et §4.4 (clé, port, empreinte, `AllowUsers`).

Le script active lui-même le service (`enable` + `restart`) : aucune commande systemd manuelle n'est nécessaire au premier passage.

---

## 9. Vérifications de bout en bout

```bash
# Sur le VPS
sudo -u td XDG_RUNTIME_DIR=/run/user/$(id -u td) systemctl --user status tower-defense --no-pager
readlink -f /home/td/app/current                     # pointe sur le dernier sha
curl -fsSI http://127.0.0.1:3210/ | head -1          # HTTP/1.1 200 OK

# Depuis ta machine
curl -sI http://td.pierrebelin.fr | head -3          # 301 vers https
curl -sI https://td.pierrebelin.fr | head -1         # 200
curl -s -o /dev/null -w '%{http_code}\n' http://td.pierrebelin.fr:3210/ --max-time 5   # doit échouer (port fermé)
```

Dans le navigateur :

1. Ouvrir `https://td.pierrebelin.fr` : l'écran titre s'affiche.
2. DevTools → Réseau → filtre `WS` : la connexion `wss://td.pierrebelin.fr/partie` est en `101 Switching Protocols`.
3. Lancer un duel dans deux onglets : les deux joueurs se voient.
4. Redémarrer le VPS (`sudo reboot`) : le service repart seul (linger + `WantedBy=default.target`).

---

## 10. Exploitation courante

Raccourci à mettre dans le `~/.bashrc` du compte admin :

```bash
alias td-ctl='sudo -u td XDG_RUNTIME_DIR=/run/user/$(id -u td) systemctl --user'
```

| Besoin | Commande |
|---|---|
| État du service | `td-ctl status tower-defense` |
| Redémarrer | `td-ctl restart tower-defense` |
| Logs en direct | `sudo journalctl _SYSTEMD_USER_UNIT=tower-defense.service -f` |
| Logs depuis une heure | `sudo journalctl _SYSTEMD_USER_UNIT=tower-defense.service --since "1 hour ago"` |
| Releases présentes | `ls -1t /home/td/app/releases` |

### Retour arrière

- **Automatique** : si le contrôle de santé échoue, le script revient seul à la release précédente et le job CI passe au rouge.
- **Manuel, immédiat** (une release précédente est encore là) :

  ```bash
  sudo -u td ln -sfn /home/td/app/releases/<sha_precedent> /home/td/app/current
  td-ctl restart tower-defense
  ```

  Le prochain push sur `main` redéploiera par-dessus : corriger ou `git revert` rapidement.
- **Durable** : `git revert <commit>` puis push sur `main`, la CI redéploie l'état corrigé.

---

## 11. Sécurité, récapitulatif

- `td` : pas de mot de passe, pas de sudo, connexion par clé uniquement.
- Clé CI dédiée, `restrict` dans `authorized_keys`, stockée seulement dans un secret d'environnement GitHub.
- Empreinte d'hôte épinglée (`DEPLOY_KNOWN_HOSTS`) : pas de confiance aveugle au premier contact.
- Node n'est joignable que via Nginx ; 3210 écoute sur 127.0.0.1 seulement.
- Rotation de la clé : générer une nouvelle paire (§4.1), remplacer la ligne dans `authorized_keys` et le secret `DEPLOY_SSH_KEY`.

---

## 12. Limites connues

- **Coupure des parties à chaque déploiement** : l'arbitre et les salons sont en mémoire. Un push sur `main` pendant un duel le termine. Pour l'éviter plus tard, il faudrait un arrêt gracieux (attendre la fin des duels) ou un déploiement à heure creuse ; pas nécessaire pour démarrer.
- **Une seule instance** : l'état en mémoire interdit de lancer plusieurs process derrière Nginx.
- **`tsx` en production** : compilation à la volée au démarrage (quelques centaines de ms). Suffisant ici ; un bundle JS du serveur serait l'étape suivante si le démarrage devenait gênant.

---

## Checklist

- [ ] §1 Node système v24 OK, `rsync` et `curl` présents, port 3210 libre
- [ ] §2 DNS `td.pierrebelin.fr` pointe sur le VPS
- [ ] §3 Utilisateur `td` créé, `enable-linger` activé
- [ ] §4 Clé de déploiement installée et testée, empreinte d'hôte relevée
- [ ] §5 `tsx` en `dependencies`, `HOST` dans `main.ts`, fichiers `deploy/` et workflow ajoutés
- [ ] §6 Site Nginx activé, certificat obtenu, `certbot renew --dry-run` OK
- [ ] §7 Environnement `production` et 5 secrets créés
- [ ] §8 Premier run CI vert
- [ ] §9 Page en HTTPS, WebSocket en `101`, duel à deux OK, service relancé après reboot
