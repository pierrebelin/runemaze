# PLAN — Bâtisseurs

> Spec : `todo/batisseurs/SPEC.md`

## Avancement

| Lot | Intention | RM/CU | Dépend de | État |
|-----|-----------|-------|-----------|------|
| F1 | Les quinze tours signature et leurs effets (corps à corps, épines, étourdissement, auras, montée en puissance) jouent dans la simulation | RM-05, RM-06, RM-07, RM-08, RM-09, RM-10 / CU-03 | — | ✅ |
| F2 | Chaque partie a un bâtisseur obligatoire qui restreint construction et évolutions ; infusion sans condition ; bot et test d'équilibrage supprimés | RM-01, RM-02, RM-03, RM-10, RM-11 / CU-03 | F1 | ✅ |
| F3 | Choix du bâtisseur en ligne : partie solo tenue par le serveur, choix caché dans le salon de duel | RM-01, RM-04, RM-11 / CU-02 | F2 | ✅ |
| F4 | Écrans : choix du bâtisseur, menus de construction et d'évolution, textes des nouveaux effets, bâtisseur adverse | RM-02, RM-04 / CU-01, CU-02, CU-03 | F3 | ✅ |

## Périmètre

- **Réutilisé** :
  - attaque instantanée `projectileSpeed: 0` et ciblage `acquireTargets` (`src/domain/systems/combat.ts:24`, `:52`) pour le corps à corps, les épines et le gong ;
  - `splash` pour le Marteau-pilon, `chain` pour le Prisme volatil, `poison` pour le Roncier, `slow` pour l'Épine-mère et le Carillon (`src/domain/model/types.ts:11`) ;
  - champ `Creep.frozen`, qui immobilise déjà (`src/domain/systems/movement.ts:8`) et coupe le Sapeur (`src/domain/systems/abilities.ts:24`), pour l'étourdissement ;
  - `upgradeCost` (mur → tour, différence de prix) et `refundValue` (50 %) inchangés (`src/domain/rules/pricing.ts:5`) ;
  - `canBuild` et l'anti-blocage (`src/application/queries/canBuild.ts:11`) ;
  - copie générique des tours par `storeTower` (`src/domain/model/snapshot.ts:46`) ;
  - famille existante (`Family`) pour les tours signature : couleur, sons et projectile de la famille du bâtisseur, sans nouvelle valeur de `Family`.
- **Hors périmètre** : bâtisseur tiré au sort, changement en cours de partie, mélange de bâtisseurs, niveau 3 signature, nouveaux bâtisseurs, déverrouillage (spec §8). Retouche des chiffres de la spec. Garde-fou automatique d'équilibrage (supprimé, voir Décisions).
- **Règles N/A** : aucune ; les huit règles ARCH sont appliquées dans au moins un lot.
- **Décisions** (2026-10-06, avec l'utilisateur) :
  - D1 — Bâtisseur **obligatoire** : `World` n'existe plus sans bâtisseur. Les tests existants reçoivent un bâtisseur compatible avec les tours qu'ils posent.
  - D2 — **Infusion sans condition** : plus de verrou de vague ni d'exigence d'une tour de l'autre élément. Suppression de `domain/rules/infusion.ts`, `application/queries/infusionLock.ts` et `INFUSION_WAVE`.
  - D3 — Duel : l'hôte garde son bouton « Lancer » ; le serveur refuse le lancement tant qu'un des deux joueurs n'a pas choisi.
  - D4 — Épines : une impulsion par seconde (6 dégâts toutes les 1 s pour Ronces), même mécanisme que le corps à corps et le gong.
  - D5 — Bot (`tests/support/bot.ts`) et `tests/balance.test.ts` **supprimés** ; l'hypothèse H3 de la spec est abandonnée.
- **Décisions de conception** (à valider à la relecture du plan) :
  - D6 — Portées : corps à corps 1,5 et gong 2,5 sont mesurés depuis le centre, comme toute portée. Épines « à 1 case ou moins d'elle » = portée 2 depuis le centre (bord de la tour 2×2 + 1 case).
  - D7 — Un immunisé à la magie n'est pas étourdi, comme pour le gel et la lenteur.
  - D8 — Étourdie, une créature ne soigne plus (Chaman) et ne déclenche plus son sprint ; le Sapeur est déjà coupé par `frozen`. Le gel des obus cryogéniques en profite aussi.
  - D9 — Fiche bâtisseur : la spec ne chiffre pas de « forces » à part ; la fiche affiche nom, style, faiblesse et les deux tours de base.
  - D10 — Rayon d'aura mesuré entre les centres des deux tours.
- **Travail parallèle** : `World.ts` et `types.ts` portent des modifications non commitées (éther, glaneurs, `todo/ether-glaneurs-porte`). Ce plan n'y touche pas ; fusion à faire au premier lot qui modifie ces fichiers.

## Traçabilité

| RM/CU | Porté par | Lot |
|-------|-----------|-----|
| RM-01 — un bâtisseur par partie, fixe | `WorldOptions.builder` + `World.builder` (`readonly`) ; `snapshot`/`restore` ; `Open`, `ChooseBuilder` | F2, F3 |
| RM-02 — seules les tours du bâtisseur | `domain/rules/builder.ts` `builderTowers()`, `buildMenu()`, `upgradeOptions()` lues par `canBuild` et `upgrade` | F2 |
| RM-03 — deux hybrides par bâtisseur | `BuilderDef.hybrids` + filtrage de `builderTowers()` | F2 |
| RM-04 — choix caché en duel | `Lobby.choose()` ; message `Room` sans identifiant de bâtisseur ; révélation par l'instantané de `DuelStarted` | F3, F4 |
| RM-05 — corps à corps sans arrêt | `AttackDef.area` lu par `updateCombat` ; mouvement inchangé | F1 |
| RM-06 — auras non cumulables | `TowerDef.aura` + `domain/rules/aura.ts` `auraBonus()` lue par `updateCombat` | F1 |
| RM-07 — épines | `AttackDef.area`, cadence 1 s, portée 2, sol (D4, D6) | F1 |
| RM-08 — étourdissement | `AttackDef.stun` + `stunDuration()` dans `domain/rules/stun.ts`, appliquée par `applyOnHit` sur `Creep.frozen` | F1 |
| RM-09 — montée en puissance | `AttackDef.rampUp` + `Tower.ramp` + `domain/rules/attackSpeed.ts` | F1 |
| RM-10 — règles de construction inchangées | `canBuild`, `refundValue`, emprise 2×2 inchangés ; tests sur tours signature | F1, F2 |
| RM-11 — partie rejouable | bâtisseur dans `WorldOptions` et l'instantané ; aucun aléatoire nouveau | F2, F3 |
| CU-01 — choisir son bâtisseur en solo | `Game` (écran de départ) + `describe.ts` `builderCard()` | F4 |
| CU-02 — choisir son bâtisseur en duel | `ClientMessageType.ChooseBuilder` → `Lobby.choose()` ; `Game` (salon, panneau adverse) | F3, F4 |
| CU-03 — construire avec son bâtisseur | `buildMenu()` (Q W E), `upgradeOptions()` ; `Game.computeSlots()` | F1, F2, F4 |

---

## Lot F1 — Tours signature et nouveaux effets — ✅

### Intention
Ajouter au catalogue les quinze tours signature et les mécanismes qu'elles demandent. Toutes restent constructibles par tout joueur jusqu'à F2. **RM** : RM-05, RM-06, RM-07, RM-08, RM-09, RM-10 · **CU** : CU-03

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-01, ARCH-02, ARCH-04, ARCH-05, ARCH-06, ARCH-07, ARCH-08 |
| Données | `AttackDef.area?: true` (frappe toutes les cibles à portée), `AttackDef.stun?: { duration }`, `AttackDef.rampUp?: { max }`, `TowerDef.aura?: { kind: 'damage' \| 'attackSpeed'; pct; radius }`, `Tower.ramp: number`. 15 entrées dans `catalog/towers.ts` (ids : `guard`, `champion`, `standard`, `anvil`, `furnace`, `triphammer`, `bramble`, `briar`, `mothertorn`, `gong`, `greatgong`, `chime`, `pylon`, `capacitor`, `volatileprism`), `family` = famille du bâtisseur. Les 5 bases s'ajoutent à `wall.upgrades`. |
| Calcul pur | `auraBonus` (`rules/aura.ts`), `rampBonus` et `attackCooldown` (`rules/attackSpeed.ts`), `stunDuration` (`rules/stun.ts`) |
| Ordre du joueur | aucun (construction et évolution existantes) |
| Aléatoire | `world.rng` seulement, comme aujourd'hui (jet de dégâts par cible) ; aucun nouveau tirage |
| Coût par tick | tir : `O(cibles à portée)` + `O(tours)` pour l'aura au moment du tir ; montée en puissance : `O(tours à montée × créatures)` par tick, sans allocation ; étourdissement : O(1) par touche |
| ARCH-08 | `area` étend l'attaque instantanée existante au lieu d'un nouveau système ; l'étourdissement réutilise `frozen` au lieu d'un nouveau champ ; pas de famille nouvelle |

### Étapes et tests
Tests écrits et **rouges avant toute ligne de production** de l'étape. Ordre : cas nominal d'abord (il fixe les signatures), refus ensuite.

#### Étape 1 — Corps à corps et épines frappent toute la zone sans arrêter les créatures — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-05] la Garde blesse à chaque coup toutes les créatures au sol à sa portée` | `tests/domain/systems/combat.test.ts` | RM-05 |
| 2 | `[RM-05] la Garde ignore les volants` | idem | RM-05 |
| 3 | `[RM-05] une créature au contact d'une Garde poursuit son trajet sans s'arrêter` | idem | RM-05 |
| 4 | `[RM-07] les Ronces infligent 6 dégâts par seconde à chaque créature au sol à une case de leur bord` | idem | RM-07 |
| 5 | `[RM-07] les Ronces épargnent une créature au sol à plus d'une case de leur bord` | idem | RM-07 |
| 6 | `[RM-07] le Roncier empoisonne au plus trois fois une créature qui reste à son contact` | idem | RM-07 |
| 7 | `[RM-05] toute attaque de zone du catalogue est instantanée` | `tests/domain/catalog/towers.test.ts` | RM-05 |
| 8 | `[RM-10] un mur devient une Garde pour la différence de prix et se revend à 50 %` | `tests/application/commands/upgrade.test.ts` | RM-10 |

**Production autorisée** : `src/domain/model/types.ts` (`AttackDef.area`), `src/domain/systems/combat.ts` (`updateCombat`), `src/domain/catalog/towers.ts` (`guard`, `champion`, `bramble`, `briar`, `mothertorn`, ajout à `wall.upgrades`), `src/infrastructure/render/sprites.ts` (dessins de ces tours, exigés par `tests/infrastructure/render/sprites.test.ts`).

#### Étape 2 — Le gong étourdit — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-08] le Gong immobilise 0,5 s toutes les créatures, au sol et en vol, à 2,5 cases` | `tests/domain/systems/combat.test.ts` | RM-08 |
| 2 | `[RM-08] divise par deux la durée d'étourdissement d'un chef` | `tests/domain/rules/stun.test.ts` | RM-08 |
| 3 | `[RM-08] n'étourdit pas un immunisé à la magie` | idem | RM-08 |
| 4 | `[RM-08] un Chaman étourdi ne soigne pas` | `tests/domain/systems/abilities.test.ts` | RM-08 |
| 5 | `[RM-08] une créature étourdie ne déclenche pas son sprint quand elle est touchée` | `tests/domain/systems/status.test.ts` | RM-08 |
| 6 | `[RM-08] le Carillon étourdit 0,4 s et ralentit de 30 %` | `tests/domain/systems/combat.test.ts` | RM-08 |
| 7 | `[RM-08] le coup qui étourdit ne déclenche pas le sprint` (H3) | `tests/domain/systems/status.test.ts` | RM-08 |

**Production autorisée** : `src/domain/model/types.ts` (`AttackDef.stun`), `src/domain/rules/stun.ts` (nouveau, `stunDuration`), `src/domain/systems/status.ts` (`applyOnHit`), `src/domain/systems/combat.ts` (`hitCreep`, sprint), `src/domain/systems/abilities.ts` (soin), `src/domain/catalog/towers.ts` (`gong`, `greatgong`, `chime`), `src/infrastructure/render/sprites.ts`.

#### Étape 3 — Les auras renforcent les tours voisines — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-06] donne à une tour le bonus de dégâts d'une aura à portée` | `tests/domain/rules/aura.test.ts` | RM-06 |
| 2 | `[RM-06] ne garde que la plus forte de deux auras du même type` | idem | RM-06 |
| 3 | `[RM-06] cumule une aura de dégâts et une aura de vitesse d'attaque` | idem | RM-06 |
| 4 | `[RM-06] ne donne pas à une tour sa propre aura` | idem | RM-06 |
| 5 | `[RM-06] ignore une aura dont la tour est à plus de 3 cases` | idem | RM-06 |
| 6 | `[RM-06] une tour à côté d'une Enclume tire plus souvent que seule` | `tests/domain/systems/combat.test.ts` | RM-06 |
| 7 | `[RM-06] une Garde à côté d'un Porte-étendard inflige plus de dégâts que seule` | idem | RM-06 |

**Production autorisée** : `src/domain/model/types.ts` (`TowerDef.aura`), `src/domain/rules/aura.ts` (nouveau), `src/domain/rules/attackSpeed.ts` (nouveau, `attackCooldown`), `src/domain/systems/combat.ts` (`updateCombat`), `src/domain/catalog/towers.ts` (`standard`, `anvil`, `furnace`, `triphammer`), `src/infrastructure/render/sprites.ts`.

#### Étape 4 — La montée en puissance accélère le Pylône — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-09] donne 1 % de vitesse d'attaque par seconde avec une cible, plafonné au maximum` | `tests/domain/rules/attackSpeed.test.ts` | RM-09 |
| 2 | `[RM-09] le Pylône tire plus souvent après 30 s avec une cible qu'au premier tir` | `tests/domain/systems/combat.test.ts` | RM-09 |
| 3 | `[RM-09] la montée n'avance pas tant qu'aucune créature n'est à portée` | idem | RM-09 |
| 4 | `[RM-09] la montée retombe à zéro quand plus aucune créature n'est sur la carte` | idem | RM-09 |
| 5 | `[RM-09] la montée d'un Pylône survit à un instantané` | `tests/domain/model/snapshot.test.ts` | RM-09 |

**Production autorisée** : `src/domain/model/types.ts` (`AttackDef.rampUp`, `Tower.ramp`), `src/domain/rules/attackSpeed.ts` (`rampBonus`), `src/domain/systems/combat.ts` (`updateCombat`), `src/application/commands/build.ts` (`ramp: 0`), `src/domain/catalog/towers.ts` (`pylon`, `capacitor`, `volatileprism`), `src/infrastructure/render/sprites.ts`.

#### Étape 5 — Vérification — ✅
Pas de nouveau test. `npx tsc --noEmit` + `npm test`.

### Éléments de code
Signatures seulement, jamais de corps.
- `domain/model/types.ts` — `AttackDef.area?: true` ; `AttackDef.stun?: { duration: number }` ; `AttackDef.rampUp?: { max: number }` ; `TowerDef.aura?: { kind: AuraKind; pct: number; radius: number }` ; `type AuraKind = 'damage' | 'attackSpeed'` ; `Tower.ramp: number` (secondes cumulées avec une cible) (nouveaux)
- `domain/rules/aura.ts` — `export function auraBonus(t: Tower, towers: Tower[]): Record<AuraKind, number>`
  - pour chaque autre tour avec `aura` dont le centre est à ≤ `radius` : garde le max par `kind`
  - la tour elle-même est exclue
- `domain/rules/attackSpeed.ts` — `export function rampBonus(seconds: number, max: number): number` (min(max, 0,01 × secondes)) ; `export function attackCooldown(base: number, speedBonus: number): number` (base / (1 + bonus))
- `domain/rules/stun.ts` — `export function stunDuration(duration: number, def: CreepDef): number` (0 si `magicImmune`, moitié si `boss`)
- `domain/systems/combat.ts` — `updateCombat` :
  - `area` cible toutes les créatures à portée et émet un `Hit` centré sur la tour (rayon = portée) au lieu de `Chain`
  - le jet est multiplié par 1 + aura `damage`
  - le recharge vaut `attackCooldown(a.cooldown, aura attackSpeed + rampBonus)`
  - `ramp` augmente de `dt` quand une cible est à portée (test sans allocation) et revient à 0 quand `world.creeps` est vide
- `domain/systems/status.ts` — `applyOnHit` : `c.frozen = max(c.frozen, stunDuration(…))`, sans toucher `freezeGuard`

### Hypothèses
- H1 — Les évolutions signature (`champion`, `briar`, `mothertorn`, et suivantes) sont en `tier: 3`, pas 2 : le test existant « offre à chaque tour de niveau 2 toutes les infusions de sa famille » l'impose tant que l'infusion n'est pas filtrée par bâtisseur. À reconsidérer en F2 — à valider par l'utilisateur.
- H2 — Chiffres absents de la spec, repris du catalogue existant : lenteur sur 2 s (Épine-mère, Carillon), rebond `range: 2.5, decay: 0.8` (Prisme volatil), `falloff: 0.5` (Marteau-pilon) — à valider par l'utilisateur.
- H3 — Le coup qui étourdit ne déclenche pas le sprint de la créature touchée (lecture stricte de RM-08, cohérente avec D8) — à valider par l'utilisateur.

---

## Lot F2 — Bâtisseur obligatoire dans la partie — ✅

### Intention
Une partie a toujours un bâtisseur, fixé à la création. Il restreint ce que le joueur construit et fait évoluer à son jeu de tours. Les hybrides de son bâtisseur s'infusent sans condition. **RM** : RM-01, RM-02, RM-03, RM-10, RM-11 · **CU** : CU-03

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-06, ARCH-08 |
| Données | `domain/catalog/builders.ts` : `BUILDERS` (5 entrées `bastion`, `forge`, `sylve`, `sanctuary`, `arcanists`) ; `BuilderDef` dans `types.ts` ; `WorldOptions.builder: string` (requis) ; `World.builder: BuilderDef` (`readonly`) ; `WorldSnapshot.builder` |
| Calcul pur | `builderTowers`, `buildMenu`, `upgradeOptions` dans `domain/rules/builder.ts` |
| Ordre du joueur | aucun nouveau ; `build` et `upgrade` refusent hors du jeu du bâtisseur (`canBuild`, `upgrade`) |
| Aléatoire | aucun |
| Coût par tick | hors `step()` |
| ARCH-08 | `BUILD_MENU` remplacé par `buildMenu(builder)` ; les arbres d'évolution existants (`upgrades`) sont filtrés, pas dupliqués par bâtisseur |
| Retraits | `domain/rules/infusion.ts`, `application/queries/infusionLock.ts`, `INFUSION_WAVE`, `BUILD_MENU` ; `tests/domain/rules/infusion.test.ts`, `tests/application/queries/infusionLock.test.ts`, test `infusionBlocker` de `tests/presentation/describe.test.ts` ; `tests/support/bot.ts`, `tests/balance.test.ts` ; mentions dans `README.md`, `CLAUDE.md`, `.claude/rules/tests.md`, `.claude/skills/plan-implementation/SKILL.md`, `.claude/skills/tests-unit-tests/SKILL.md` |

### Étapes et tests
Tests écrits et **rouges avant toute ligne de production** de l'étape. Ordre : cas nominal d'abord (il fixe les signatures), refus ensuite.

#### Étape 1 — Chaque bâtisseur a son jeu de tours — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-02] le jeu du Bastion contient le mur, l'arbre des archers, la lignée de la Garde, Baliste et Flèches de givre et leurs évolutions` | `tests/domain/rules/builder.test.ts` | RM-02 |
| 2 | `[RM-02] le jeu du Bastion exclut les tours des autres familles et les autres hybrides` | idem | RM-02 |
| 3 | `[RM-03] propose à un niveau 2 son niveau 3 et les deux hybrides du bâtisseur seulement` | idem | RM-03 |
| 4 | `[RM-02] propose au mur la base de la famille et la base signature du bâtisseur` | idem | RM-02 |
| 5 | `[RM-03] chaque bâtisseur a deux hybrides accessibles depuis ses deux niveaux 2` | `tests/domain/catalog/builders.test.ts` | RM-03 |
| 6 | `chaque bâtisseur garde au moins une tour qui touche les volants` | idem | — |
| 7 | `aucune tour signature n'appartient à deux bâtisseurs` | idem | RM-02 |

**Production autorisée** : `src/domain/model/types.ts` (`BuilderDef`), `src/domain/catalog/builders.ts` (nouveau), `src/domain/rules/builder.ts` (nouveau).

#### Étape 2 — La partie se joue avec un bâtisseur fixe — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-01] garde le bâtisseur choisi à la création de la partie` | `tests/domain/model/World.test.ts` | RM-01 |
| 2 | `[RM-01] rend le même bâtisseur après un instantané` | `tests/domain/model/snapshot.test.ts` | RM-01 |
| 3 | `[RM-11] rejoue la même partie avec même graine, même bâtisseur et mêmes ordres` | `tests/domain/model/World.test.ts` | RM-11 |

**Production autorisée** : `src/domain/model/World.ts` (`WorldOptions.builder`, `builder`), `src/domain/model/snapshot.ts` (`builder`), `src/application/online/referee.ts`, `src/application/online/duel.ts`, `src/presentation/Game.ts` (`createWorld` : bâtisseur passé tel quel, sans écran à ce stade), `tests/support/helpers.ts` (`newWorld(difficulty, seed, map, builder = 'bastion')`, `newDuelWorld` idem).
**Tests existants à adapter** (bâtisseur compatible avec les tours posées) : les fichiers de `tests/` qui font `new World(...)` ou posent `cannon`, `frost`, `storm`, `venom` ; voir `grep -rln "'cannon'\|'frost'\|'storm'\|'venom'\|new World" tests`.

#### Étape 3 — Le joueur ne construit et ne fait évoluer que ses tours — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[CU-03] construit la base de sa famille et sa base signature` | `tests/application/commands/build.test.ts` | CU-03 |
| 2 | `[RM-02] refuse de construire la base d'un autre bâtisseur` | idem | RM-02 |
| 3 | `[RM-10] refuse une Garde qui fermerait le passage` | idem | RM-10 |
| 4 | `[RM-02] refuse qu'un joueur Forge fasse évoluer un mur en Tour d'archers` | `tests/application/commands/upgrade.test.ts` | RM-02 |
| 5 | `[RM-03] fait évoluer un niveau 2 en hybride de son bâtisseur dès la première vague` | idem | RM-03 |
| 6 | `[RM-03] refuse un hybride qui n'est pas celui de son bâtisseur` | idem | RM-03 |
| 7 | `[RM-02] n'inscrit pas au journal un ordre refusé hors du jeu du bâtisseur` | idem | RM-02 |

**Production autorisée** : `src/application/queries/canBuild.ts`, `src/application/commands/upgrade.ts`, `src/domain/catalog/towers.ts` (retrait `INFUSION_WAVE`, `BUILD_MENU`), suppression de `src/domain/rules/infusion.ts` et `src/application/queries/infusionLock.ts`, `src/presentation/Game.ts` (menu par `buildMenu`, évolutions par `upgradeOptions`, retrait de `infusionLock`), `src/presentation/describe.ts` (retrait du paramètre `locked` de `towerInfo` s'il n'a plus d'usage).

#### Étape 4 — Retrait du bot d'équilibrage — ✅
Pas de nouveau test : suppression de `tests/support/bot.ts` et `tests/balance.test.ts` (D5), mise à jour des mentions listées dans Conception > Retraits.

#### Étape 5 — Vérification — ✅
Pas de nouveau test. `npx tsc --noEmit` + `npm test`.

### Éléments de code
Signatures seulement, jamais de corps.
- `domain/model/types.ts` — `interface BuilderDef { id: string; name: string; style: string; weakness: string; roots: [string, string]; hybrids: [string, string] }` (nouveau ; `roots` = base de la famille, base signature)
- `domain/catalog/builders.ts` — `export const BUILDERS: Record<string, BuilderDef>` ; `export function builder(id: string): BuilderDef` (lève une erreur si l'id est inconnu, comme `tower()`)
- `domain/rules/builder.ts` — `export function builderTowers(b: BuilderDef, towers: Record<string, TowerDef>): Set<string>`
  - parcours depuis `wall` puis `b.roots` le long de `upgrades`
  - entrée dans un hybride (`elements`) depuis une tour sans `elements` : seulement si l'id est dans `b.hybrids`
  - au départ du mur : seulement `b.roots`
- `domain/rules/builder.ts` — `export function buildMenu(b: BuilderDef): string[]` (`['wall', ...b.roots]`) ; `export function upgradeOptions(def: TowerDef, allowed: Set<string>): string[]` (`def.upgrades` filtrés)
- `domain/model/World.ts` — `WorldOptions.builder: string` ; `readonly builder: BuilderDef`
- `application/queries/canBuild.ts` — refuse `fail('Construction inconnue.')` si l'id n'est pas dans `buildMenu(world.builder)`
- `application/commands/upgrade.ts` — refuse `fail('Amélioration indisponible.')` si `cmd.def` n'est pas dans `upgradeOptions(t.def, builderTowers(world.builder, TOWERS))` ; plus d'appel à `infusionLock`

### Hypothèses
- H1 — En attendant F3 (protocole) et F4 (écran), `Game`, `referee` et `duel` créent la partie avec le bâtisseur `bastion` fixe ; les helpers de test l'ont aussi par défaut — à valider par l'utilisateur.
- H2 — Tests existants multi-familles adaptés sans toucher aux assertions : seconde tour remplacée par `guard`, ou deux mondes de bâtisseurs différents pour `familyDamage`. Tests d'infusion contraires à D2/RM-03 supprimés (« tour de guet en Dard corrosif », « refusée pour la vague ») ; la Grêle est testée depuis un glacier (Sanctuaire), plus depuis une tour d'orage — à valider par l'utilisateur.
- H3 — Reprise de H1 (F1) : les évolutions signature restent en `tier: 3` ; la fiche et le rendu affichent donc « niveau 3 » pour une évolution qui suit directement la base signature. À trancher par l'utilisateur : garder, ou passer en `tier: 2` (vérifier alors le test « offre à chaque tour de niveau 2 toutes les infusions de sa famille » s'il existe encore) — à valider par l'utilisateur.
- H4 — Les mentions du bot dans `.claude/` (ignoré par git) ont été retirées dans le dépôt principal `/Users/pierre/Documents/Dev/tower-defense/.claude/`, le worktree n'en ayant pas de copie : `rules/tests.md`, skills `plan-implementation`, `tests-unit-tests`, `implement-tdd` — à valider par l'utilisateur.

---

## Lot F3 — Choix du bâtisseur en ligne — ✅

### Intention
La partie solo tenue par le serveur reçoit le bâtisseur choisi. Dans le salon de duel, chaque joueur choisit le sien sans voir celui de l'autre. L'hôte ne peut lancer qu'une fois les deux choix faits. **RM** : RM-01, RM-04, RM-11 · **CU** : CU-02

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-01, ARCH-02, ARCH-03, ARCH-05, ARCH-08 |
| Données | `ClientMessage` `Open` + `builder` ; nouveau `ClientMessageType.ChooseBuilder` `{ builder }` ; `Room` du salon : `builders: { host?: string; guest?: string }` ; `ServerMessage` `Room` + `picked: { host: boolean; guest: boolean }` (jamais l'id) ; `DuelConfig.builders: [string, string]` ; `OpenRequest.builder` |
| Calcul pur | aucun (validation de l'id par `BUILDERS`) |
| Ordre du joueur | aucun ordre de partie : le choix précède la création du `World` |
| Aléatoire | aucun ; la graine reste tirée par le serveur |
| Coût par tick | hors `step()` |
| ARCH-08 | message `Room` existant enrichi plutôt qu'un nouveau message serveur ; révélation par l'instantané adverse déjà envoyé dans `DuelStarted` et `Rival` |

### Étapes et tests
Tests écrits et **rouges avant toute ligne de production** de l'étape. Ordre : cas nominal d'abord (il fixe les signatures), refus ensuite.

#### Étape 1 — La partie solo en ligne s'ouvre avec le bâtisseur choisi — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-01] ouvre la partie avec le bâtisseur demandé` | `tests/application/online/referee.test.ts` | RM-01 |
| 2 | `[RM-01] lit une ouverture qui porte un bâtisseur connu` | `tests/application/online/protocol.test.ts` | RM-01 |
| 3 | `[RM-01] rejette une ouverture sans bâtisseur ou avec un bâtisseur inconnu` | idem | RM-01 |

**Production autorisée** : `src/application/online/protocol.ts` (`Open`, `readClientMessage`), `src/application/online/referee.ts` (`OpenRequest.builder`), `src/server/main.ts` (transmission de `builder`), `src/presentation/Game.ts` (envoi de `builder` à l'ouverture).

#### Étape 2 — Choix caché dans le salon, lancement quand les deux ont choisi — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[CU-02] annonce aux deux joueurs qu'un joueur a choisi sans dire lequel` | `tests/application/online/lobby.test.ts` | RM-04 |
| 2 | `[CU-02] lance le duel avec le bâtisseur choisi par chaque joueur` | idem | CU-02 |
| 3 | `[RM-04] révèle à chaque joueur le bâtisseur adverse au lancement` | idem | RM-04 |
| 4 | `[CU-02] lance le duel quand les deux joueurs ont choisi le même bâtisseur` | idem | CU-02 |
| 5 | `[RM-01] refuse le lancement tant qu'un joueur n'a pas choisi son bâtisseur` | idem | RM-01 |
| 6 | `[RM-01] garde le dernier choix d'un joueur qui change d'avis dans le salon` | idem | RM-01 |
| 7 | `[RM-04] oublie le choix de l'invité qui quitte le salon` | idem | RM-04 |
| 8 | `[CU-02] lit un choix de bâtisseur connu et rejette un inconnu` | `tests/application/online/protocol.test.ts` | CU-02 |
| 9 | `[RM-11] donne à chaque siège une carte au bâtisseur de son joueur` | `tests/application/online/duel.test.ts` | RM-11 |

**Production autorisée** : `src/application/online/protocol.ts` (`ChooseBuilder`, `Room.picked`, `readClientMessage`), `src/application/online/lobby.ts` (`choose`, `start`, `leaveRoom`), `src/application/online/duel.ts` (`DuelConfig.builders`), `src/server/main.ts` (routage de `ChooseBuilder`), `src/presentation/Game.ts` (envoi de `ChooseBuilder 'bastion'`, H5).

#### Étape 3 — Vérification — ✅
Pas de nouveau test. `npx tsc --noEmit` + `npm test`.

### Éléments de code
Signatures seulement, jamais de corps.
- `application/online/protocol.ts` — `| { t: ClientMessageType.ChooseBuilder; builder: string }` ; `Open.builder: string` ; `Room.picked: { host: boolean; guest: boolean }`
- `application/online/lobby.ts` — `choose(key: string, builder: string): Addressed[]` : enregistre le choix du siège, renvoie `Room` aux deux joueurs ; `start(...)` : `Refused` avec `'En attente du choix des bâtisseurs.'` si un choix manque
- `application/online/duel.ts` — `DuelConfig.builders: [string, string]` ; une `World` par siège avec son bâtisseur

### Hypothèses
- H1 — En attendant l'écran de F4, `Game` envoie `builder: 'bastion'` à l'ouverture solo en ligne — à valider par l'utilisateur.
- H2 — Un choix de bâtisseur venant d'une connexion hors de tout salon (ou en duel lancé) est ignoré sans réponse — à valider par l'utilisateur.
- H3 — Le choix de l'hôte survit au départ de l'invité ; seul le choix de l'invité qui part est oublié — à valider par l'utilisateur.
- H4 — Refus « En attente du choix des bâtisseurs. » évalué après les refus existants (non-hôte, pas d'invité) — à valider par l'utilisateur.
- H5 — En attendant l'écran de F4, `Game` envoie `ChooseBuilder 'bastion'` en entrant au salon (hôte à `Hosted`, invité au premier `Room`), sinon le duel en ligne ne se lance plus ; `Game.ts` ajouté à la production de l'étape 2 pour cet envoi (correction d'audit, sans test : présentation) — à valider par l'utilisateur.

---

## Lot F4 — Écrans des bâtisseurs — ✅

### Intention
Le joueur voit les cinq bâtisseurs et en choisit un, en solo comme dans le salon. Il construit avec Q W E et lit les nouveaux effets dans les fiches des tours. En duel, il voit le bâtisseur adverse. **RM** : RM-02, RM-04 · **CU** : CU-01, CU-02, CU-03

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-01, ARCH-02, ARCH-03, ARCH-06 |
| Données | aucune nouvelle ; lecture de `BUILDERS`, `TowerDef.aura`, `AttackDef.area/stun/rampUp` |
| Calcul pur | textes dans `presentation/describe.ts` (fonctions pures testables) |
| Ordre du joueur | aucun nouveau ; choix solo passé à `createWorld`, choix duel envoyé par `ChooseBuilder` |
| Coût par tick | hors `step()` |

### Étapes et tests
Tests écrits et **rouges avant toute ligne de production** de l'étape. Ordre : cas nominal d'abord (il fixe les signatures), refus ensuite.

#### Étape 1 — Fiche d'un bâtisseur — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[CU-01] présente le nom, le style, la faiblesse et les deux tours de base d'un bâtisseur` | `tests/presentation/describe.test.ts` | CU-01 |

**Production autorisée** : `src/presentation/describe.ts` (`builderCard`), `src/presentation/Game.ts` (choix sur l'écran de départ, choix dans le salon, nom du bâtisseur adverse dans le panneau adverse), `index.html` (styles des cartes de bâtisseur).

#### Étape 2 — Textes des nouveaux effets — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-05] annonce « corps à corps » pour une attaque de zone au sol de portée 1,5` | `tests/presentation/describe.test.ts` | RM-05 |
| 2 | `[RM-06] annonce l'aura, son bonus et son rayon` | idem | RM-06 |
| 3 | `[RM-08] annonce la durée d'étourdissement` | idem | RM-08 |
| 4 | `[RM-09] annonce le maximum de montée en puissance` | idem | RM-09 |
| 5 | `[RM-07] annonce une frappe de toute la zone pour une attaque de zone hors corps à corps` (correction d'audit) | idem | RM-07, RM-08 |

**Production autorisée** : `src/presentation/describe.ts` (`towerSpecials`).

#### Étape 3 — Vérification — ⬜
Pas de nouveau test. `npx tsc --noEmit` + `npm test`. Contrôle manuel (`npm run dev`) : choix solo, touches Q W E, menu d'évolution limité, salon à deux onglets.

### Éléments de code
Signatures seulement, jamais de corps.
- `presentation/describe.ts` — `export function builderCard(b: BuilderDef): string` ; `towerSpecials(def)` lit aussi `def.aura`, `a.area`, `a.stun`, `a.rampUp`
- `presentation/Game.ts` — `private builderId: string` (choix courant) ; `createWorld(map, d, builder)` ; envoi de `ChooseBuilder` depuis le salon

### Hypothèses
- H1 — Dans le salon, aucun bâtisseur n'est envoyé par défaut : le joueur doit cliquer une carte ; il peut rechoisir tant que le duel n'est pas lancé (dernier clic gardé, RM-01 F3). Le choix de l'écran de départ ne pré-sélectionne pas le salon côté serveur — à valider par l'utilisateur.
- H2 — L'écran de départ présélectionne Bastion, comme la carte et la difficulté : « Commencer » lance sans clic sur un bâtisseur (CU-01 dit « en choisit un, puis lance »). Un clic dans le salon met aussi à jour ce choix solo, repris à l'écran de départ après le duel — à valider par l'utilisateur.
