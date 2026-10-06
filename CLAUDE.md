# CLAUDE.md

Tower Defense : tower defense de *mazing* (TypeScript, Canvas 2D, Vite). Règles du jeu : [README.md](README.md).

## Commandes

```bash
npm run dev          # serveur de dev (port 5173)
npx tsc --noEmit     # typage
npm test             # tous les tests unitaires
npx vitest run <fichier>
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

- **Tests unitaires uniquement** (Vitest, Node, sans mock).
- **Jamais de commit** sans demande explicite.
- Français partout : specs, plans, verdicts, libellés de tests, textes du jeu, commentaires. Identifiants de code en anglais.
- Simple d'abord : pas d'abstraction, d'option ou de mécanisme sans besoin exprimé.
