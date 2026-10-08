# Runemaze

Runemaze est un tower defense de *mazing* dans l'esprit des cartes personnalisées de Warcraft III
(Wintermaul, Element TD) : pas de chemin imposé, c'est vous qui dessinez le
labyrinthe avec vos tours. TypeScript, Canvas 2D, serveur Node (`ws`) qui arbitre les parties.

## Lancer

Le jeu se joue en ligne : chaque partie est tenue par un serveur qui l'arbitre.

```bash
npm install
npm run build && npm run server   # build puis serveur de partie (http://localhost:8080)
npm test                          # tests de la simulation
npm run build:artifact            # variante sans enveloppe <html>, pour une page hébergée
```

En développement, deux serveurs en parallèle : `npm run server` (arbitre + WebSocket) et
`npm run dev` (Vite, rechargement à chaud). Le jeu n'est plus jouable hors ligne.

## Règles

- Les créatures terrestres partent du portail, **doivent toucher la pierre runique**, puis
  rejoignent la porte. Le champ est traversé deux fois.
- Tours 2×2 posées librement. Une construction qui fermerait le passage (pour le trajet
  complet ou pour une créature déjà en route) est refusée.
- **Murs à 3 or** pour allonger le trajet, transformables en n'importe quelle tour de base
  pour la différence de prix.
- **Table attaque / armure** à la Warcraft III (Normale, Perçante, Siège, Magique, Chaos
  contre Sans armure, Légère, Moyenne, Lourde, Fortifiée, Héroïque), et réduction par
  valeur d'armure `0,06·a / (1 + 0,06·a)`.
- Volants (ignorent le labyrinthe), immunisés à la magie, régénération, trois chefs.
- Remboursement à 50 % de l'or investi, à tout moment : vendre coûte la moitié de la
  mise, le *juggling* (vendre et reconstruire pour détourner le flot) ne paie plus.
- Prime de fin de vague, intérêts de 4 % plafonnés.
- Vagues sans fin.

Commandes : `Q W E A` construire, clic pour poser (clic droit / `Échap` pour annuler),
`P` pause, `M` son, `L` trajet, `H` aide.
Sur une tour : `Q W E` améliorer, `A` ciblage, `D` vendre. Au doigt : premier appui pour
prévisualiser, second appui au même endroit pour bâtir.

## Architecture

Clean architecture en quatre couches ; le sens des dépendances est vérifié par
`tests/architecture.test.ts`.

```
src/
  domain/          ← cœur du jeu, aucune dépendance (ni DOM, ni autre couche)
    model/         World (état complet + step()), Grid (terrain, occupation), types
    rules/         Damage (table attaque/armure), FlowField (Dijkstra 8 directions
                   par tronçon), pricing (coûts, remboursements)
    systems/       waves, movement, combat (+ projectiles, chaînes), status (poison, lenteur…)
    catalog/       towers, creeps (+ vagues, difficultés), map (carte en ASCII)
    Rng.ts         mulberry32, graine
  application/     ← ordres du joueur, dépend de domain
    dispatch.ts    seule porte d'entrée des commandes, journal de rejeu
    commands/      build, upgrade, sell, target
    queries/       canBuild (validation anti-blocage), previewRoute
  infrastructure/  ← adaptateurs techniques, dépend de domain
    render/        Renderer (Canvas 2D), sprites procéduraux, Effects (particules, textes)
    audio/         Sfx : sons synthétisés en Web Audio, aucun fichier
    GameLoop.ts    requestAnimationFrame à pas fixe 1/60 s
  presentation/    Game : entrées, panneau de commandes 4×3, HUD, écrans ; describe.ts : textes ;
                   ServerLink.ts : liaison WebSocket au serveur de partie
  server/          serveur HTTP + WebSocket : sert dist/, relaie les ordres à l'arbitre
                   (application/online/)
tests/             même arborescence que src/ ; architecture, support/
```

Les choix qui comptent :

- **Simulation pure et déterministe.** `World` n'est modifié que par `dispatch(world, commande)`
  et `step()`. Même graine + même journal de commandes = même partie, ce que vérifie un
  test de rejeu. C'est la base d'un replay, d'un mode spectateur ou d'un multijoueur en
  *lockstep* comme celui de Warcraft III. Côté architecture, c'est un modèle
  commande / événement : les commandes entrent, les événements (`kill`, `hit`, `leak`,
  `waveStart`…) sortent et alimentent le rendu, le son et l'interface sans que la
  simulation les connaisse.
- **Champs de flux plutôt que A\* par créature.** Un Dijkstra par tronçon donne à chaque
  case la distance à la cible et la case suivante. Le coût ne dépend pas du nombre de
  créatures, et recalculer après chaque construction est instantané. La même passe sert à
  valider qu'une construction ne ferme pas le passage et à prévisualiser le nouveau trajet.
- **Tout est donnée.** Tours, arbre d'amélioration, créatures, vagues et carte sont des
  objets simples ; ajouter une tour ou une carte ne touche pas au moteur.
- **Rendu interchangeable.** `Renderer` ne fait que lire `World`. Passer à PixiJS ou à
  WebGL ne toucherait ni la simulation ni les tests.

## Pistes

- Multijoueur à plusieurs couloirs (le déterminisme est déjà là : il suffit d'échanger les commandes).
- Éditeur de cartes : la carte est un tableau de chaînes.
- Enregistrement et relecture de parties à partir de `world.log`.
- Rendu PixiJS pour des milliers de particules, sprites dessinés à la main.

## Esprit du projet

Runemaze est un projet pour le plaisir, fait pour jouer entre amis, et entièrement
*vibe codé*. Il ne cherche pas à appliquer des pratiques industrielles : le but est
d'apporter vite de la valeur, c'est-à-dire de pouvoir jouer, en évitant les complexités
d'un code de production (pas de CI, de déploiement, de surveillance ni de compatibilité
à maintenir). L'architecture et les tests ne servent qu'à garder le jeu facile à faire
évoluer.
