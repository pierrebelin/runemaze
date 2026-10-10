# CLAUDE.md

Runemaze : tower defense de *mazing* (TypeScript, Canvas 2D, Vite). Règles du jeu : [README.md](README.md).

## Commandes

```bash
npm run dev          # serveur de dev (port 5173)
npx tsc --noEmit     # typage
npm test             # tous les tests unitaires
npx vitest run <fichier>
npm run build:sprites # planche des sprites → dist/sprites.html (en dev : /sprites.html)
```

## Architecture

Clean architecture en 4 couches sous `src/`. Sens des dépendances verrouillé par `tests/architecture.test.ts`.

| Couche | Contenu | Peut importer |
|---|---|---|
| `domain/` | `model/` (World, Grid, types), `rules/` (Damage, FlowField, pricing), `systems/` (waves, movement, combat, status), `catalog/` (tours, créatures, carte), `Rng` | rien |
| `application/` | `dispatch` (seule entrée des ordres, journal de rejeu), `commands/` (un ordre par fichier), `queries/` (canBuild, previewRoute) | `domain` |
| `infrastructure/` | `render/` (Canvas), `audio/` (Web Audio), `GameLoop` (rAF à pas fixe) | `domain` |
| `presentation/` | `Game` (entrées, HUD, écrans), `describe` (textes) | tout |

Conventions détaillées : `.claude/rules/<couche>.md`, chargées automatiquement selon le fichier ouvert.

Invariants à ne jamais casser :
- **Déterminisme** : même graine + même journal de commandes = même partie. Aléatoire du jeu par `world.rng` seulement.
- **Tout ordre du joueur passe par `dispatch(world, cmd)`**.
- **Tout est donnée** : du contenu de jeu s'ajoute dans `domain/catalog/`, pas dans le moteur.

## Façon de travailler

Pour une fonctionnalité non triviale, chaîne de skills ; chaque étape produit un fichier que la suivante lit :

1. `/business-spec` → `todo/<slug>/SPEC.md` (règles `RM-XX`, cas d'usage `CU-XX`, chiffres)
2. `/plan-implementation` → `todo/<slug>/PLAN.md` (lots `F1`, `F2`…, tests nommés, règles `ARCH-XX`)
3. `/implement-tdd F1 todo/<slug>/PLAN.md` → TDD strict via les agents `tdd-test-author` (RED) et `tdd-implementer` (GREEN)
4. `/verify-tdd` → audit en lecture seule, verdict `VALIDE` / `ÉCARTS`

Petite correction : pas besoin de la chaîne, mais test d'abord quand même (`/tests-unit-tests`).

**Workflow `run-lot`** (`.claude/workflows/run-lot.js`) : les étapes 3 et 4 sans intervention — conception, RED puis GREEN par comportement, `tsc` + `npm test`, audit `tdd-auditor` (deux reprises au plus), lot coché après `VALIDE` ; rend `TERMINÉ`, `BLOQUÉ` ou `ÉCARTS`. Argument : `F1 todo/<slug>/PLAN.md`. Prérequis dans les settings, posés par l'utilisateur : `disableWorkflows: false` et la permission `Workflow(run-lot)`. Suivi dans le pane `run-lot-pane@cctoolkit`.

- **Tests unitaires uniquement** (Vitest, Node, sans mock).
- **Jamais de commit** sans demande explicite.
- Français partout : specs, plans, verdicts, libellés de tests, textes du jeu, commentaires. Identifiants de code en anglais.
- Simple d'abord : pas d'abstraction, d'option ou de mécanisme sans besoin exprimé.
