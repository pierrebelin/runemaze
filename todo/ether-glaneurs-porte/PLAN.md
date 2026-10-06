# PLAN — Éther, glaneurs et Porte

> Spec : `todo/ether-glaneurs-porte/SPEC.md`

## Avancement

| Lot | Intention | RM/CU | Dépend de | État |
|-----|-----------|-------|-----------|------|
| F1 | Le joueur en duel achète des glaneurs en or, qui produisent de l'éther en continu. | RM-01, RM-02, RM-03, RM-12 / CU-01 | — | ✅ |
| F2 | Les envois se paient en éther, au nouveau barème, et le revenu n'a plus de plafond. | RM-04, RM-05, RM-06, RM-07 / CU-02 | F1 | ✅ |
| F3 | Le joueur améliore Tir et Remparts de sa Porte avec de l'éther ; la Porte tire et rend des vies. | RM-08, RM-09, RM-10, RM-12 / CU-03 | F2 | ⬜ |
| F4 | L'encart adverse montre revenu, glaneurs, Tir et Remparts, jamais l'éther. | RM-11 / CU-04 | F3 | ⬜ |

## Périmètre

- **Réutilisé** :
  - `World.duel`, `World.income` — `src/domain/model/World.ts:48-49`
  - Ordre d'envoi et réception — `src/application/commands/send.ts:9`, `src/application/commands/receive.ts:8`, relais serveur `src/application/online/duel.ts:188-193`
  - Versement du revenu en fin de vague, sans intérêts en duel — `src/domain/systems/waves.ts:115-120` (RM-05 inchangée)
  - Fuite qui coûte des vies, sans gain pour l'envoyeur — `src/domain/systems/movement.ts` (RM-07 inchangée)
  - Ciblage des tours — `acquireTargets` `src/domain/systems/combat.ts:24`, dégâts et prime — `applyDamage` `src/domain/systems/combat.ts:142`
  - Table Chaos — `src/domain/rules/Damage.ts:10`
  - Centre de la sortie — `World.waypoints` (dernier point) `src/domain/model/World.ts:94-97`
  - Vies de départ — `DIFFICULTY[d].lives` `src/domain/catalog/creeps.ts:72`
  - Instantané et empreinte — `src/domain/model/snapshot.ts`, `src/domain/rules/fingerprint.ts`
  - Lecture des ordres en ligne — `readCommand` `src/application/online/protocol.ts:102`
  - Recalage — `src/application/online/realign.ts` (rejoue tout ordre sauf `Receive`, rien à changer)
  - Panneau d'envois (touche `T`) — `sendPanel` `src/presentation/describe.ts:230`, `Game.toggleSendPanel` `src/presentation/Game.ts:436`
  - Bot d'équilibrage — `tests/support/bot.ts` `Bot.send()`
- **Hors périmètre** : section 8 de la spec (jeu en équipe, bâtisseurs, revente ou maximum de glaneurs, glaneurs visibles, sort actif, prime reversée à l'envoyeur). Aucun rendu Canvas dédié à la Porte : le tir réutilise l'événement `Chain` déjà dessiné.
- **Supprimé** : `src/domain/rules/income.ts` (`incomeCap`, `raiseIncome`) et `tests/domain/rules/income.test.ts` (RM-06 retire le plafond).
- **Règles N/A** : aucune, ARCH-01 à ARCH-08 appliquées dans les lots.
- **Décisions** (choix du plan, 2026-10-06, à confirmer à la validation manuelle) :
  - H1 de la spec retenue : le panneau `T` a trois onglets — Envois, Glaneurs, Porte.
  - Production exacte par glaneur : chaque glaneur garde son tick d'achat ; il produit quand `(tick − tickAchat)` est un multiple de 300 (5 s à 60 ticks/s). Entiers, pas de dérive flottante.
  - Portée du Tir mesurée comme celle des tours : distance ≤ 4 + rayon de la créature.
  - RM-11 appliquée côté serveur : l'instantané `Rival` envoyé à l'adversaire porte `ether: 0`. L'éther ne quitte jamais le serveur vers l'adversaire.
  - Hors duel, achat de glaneur et amélioration de Porte refusés (« Les glaneurs n'existent qu'en duel. », « La Porte ne s'améliore qu'en duel. »), sur le modèle de `send`.

## Traçabilité

| RM/CU | Porté par | Lot |
|-------|-----------|-----|
| RM-01 — duel seulement | refus hors duel dans `commands/gleaner.ts`, `commands/gate.ts` ; Porte niveau 0 en solo | F1, F3 |
| RM-02 — départ à zéro | `World` : `ether = 0`, `gleaners = []`, `gate = { shot: 0, ramparts: 0, cooldown: 0 }` | F1, F3 |
| RM-03 — production continue | `domain/systems/gleaners.ts` `updateGleaners()` dans `World.step()` | F1 |
| RM-04 — envois payés en éther | `CreepDef.send` (barème en éther) `catalog/creeps.ts` + `commands/send.ts` | F2 |
| RM-05 — revenu en fin de vague | existant `systems/waves.ts:115-120`, test existant `tests/domain/systems/waves.test.ts` | F2 |
| RM-06 — revenu sans plafond | `commands/send.ts`, `commands/gate.ts` : `income += gain` | F2, F3 |
| RM-07 — fuite d'un envoi | existant, test existant `tests/application/commands/receive.test.ts` | F2 |
| RM-08 — prix croissant de la Porte | `domain/rules/pricing.ts` `gateLevelCost()`, `gateLevelIncome()` | F3 |
| RM-09 — Tir | `domain/systems/gate.ts` `updateGate()` + `GATE.shot` `catalog/ether.ts` | F3 |
| RM-10 — Remparts | `systems/waves.ts` à la fin de vague | F3 |
| RM-11 — économie adverse visible sauf l'éther | `application/online/duel.ts` (instantané `Rival` masqué) + `describe.ts` `rivalEconomy()` | F4 |
| RM-12 — partie rejouable | ordres `Gleaner` et `Gate` journalisés par `dispatch`, lus par `readCommand`, état dans `snapshot` | F1, F3 |
| CU-01 — acheter un glaneur | `Command` `gleaner` → `application/commands/gleaner.ts` ; onglet `gleanerPanel()` | F1 |
| CU-02 — envoyer contre de l'éther | `Command` `send` → `application/commands/send.ts` ; `sendPanel()` | F2 |
| CU-03 — améliorer la Porte | `Command` `gate` → `application/commands/gate.ts` ; onglet `gatePanel()` | F3 |
| CU-04 — observer l'économie adverse | `describe.ts` `rivalEconomy()` + encart `Game.ts` | F4 |

---

## Lot F1 — Glaneurs et éther — ✅

### Intention
Le joueur en duel achète des glaneurs en or ; chacun produit 1 éther toutes les 5 s de jeu. **RM** : RM-01, RM-02, RM-03, RM-12 · **CU** : CU-01

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-01 (glaneur, éther), ARCH-02 (catalogue et système en `domain`, ordre en `application`, panneau en `presentation`), ARCH-03, ARCH-05 (aucun aléatoire, temps en ticks), ARCH-06, ARCH-07, ARCH-08 |
| Données | `catalog/ether.ts` (nouveau, calqué sur `catalog/creeps.ts`) : `GLEANER = { cost: 50, period: 5 }`. `World.ether: number`, `World.gleaners: number[]` (tick d'achat de chaque glaneur). ARCH-08 : `World.income` envisagé comme modèle, mais l'éther a besoin d'un état par glaneur. |
| Calcul pur | aucun nouveau : prix lu dans `GLEANER.cost` |
| Ordre du joueur | `CommandType.Gleaner = 'gleaner'`, `{ c: CommandType.Gleaner }` → `application/commands/gleaner.ts` |
| Coût par tick | `O(glaneurs)`, sans allocation |

### Étapes et tests
Tests écrits et **rouges avant toute ligne de production** de l'étape. Ordre : cas nominal d'abord (il fixe les signatures), refus ensuite.

#### Étape 1 — Le joueur en duel achète un glaneur — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-02] démarre à 0 glaneur et 0 éther quand le duel commence` | `tests/application/commands/gleaner.test.ts` | RM-02 |
| 2 | `[CU-01] débite 50 or et ajoute un glaneur quand le joueur en duel en achète un` | idem | CU-01 |
| 3 | `[CU-01] journalise l'achat accepté` | idem | RM-12 |
| 4 | `[CU-01] refuse avec « Pas assez d'or. » et laisse l'état inchangé quand l'or manque` | idem | CU-01 |
| 5 | `[RM-01] refuse l'achat de glaneur quand la partie est en solo` | idem | RM-01 |

**Production autorisée** : `src/domain/catalog/ether.ts` (nouveau, `GLEANER`), `src/domain/model/types.ts` (`CommandType.Gleaner`, variante de `Command`), `src/domain/model/World.ts` (`ether`, `gleaners`), `src/application/commands/gleaner.ts` (nouveau, calqué sur `send.ts`), `src/application/dispatch.ts`.

#### Étape 2 — Chaque glaneur produit de l'éther dès son achat — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-03] produit 1 éther 5 s après l'achat, pas avant` | `tests/domain/systems/gleaners.test.ts` | RM-03 |
| 2 | `[RM-03] produit pendant la préparation comme pendant une vague` | idem | RM-03 |
| 3 | `[RM-03] cadence chaque glaneur depuis son propre achat quand deux glaneurs sont achetés à 2 s d'écart` | idem | RM-03 |
| 4 | `[RM-03] produit 3 éther en 15 s quand le joueur a un glaneur, sans limite au nombre de glaneurs` | idem | RM-03 |

**Production autorisée** : `src/domain/systems/gleaners.ts` (nouveau, `updateGleaners`), `src/domain/model/World.ts` (appel dans `step()`).

#### Étape 3 — Le duel avec glaneurs se rejoue et se recale à l'identique — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-12] restaure l'éther et le tick d'achat de chaque glaneur depuis un instantané` | `tests/domain/model/snapshot.test.ts` | RM-12 |
| 2 | `[RM-12] donne la même empreinte quand le même journal avec achats de glaneurs est rejoué sur la même graine` | `tests/application/commands/gleaner.test.ts` | RM-12 |
| 3 | `[RM-12] lit un ordre d'achat de glaneur reçu du client` | `tests/application/online/protocol.test.ts` | RM-12 |

**Production autorisée** : `src/domain/model/snapshot.ts` (`ether`, `gleaners`), `src/application/online/protocol.ts` (`readCommand`).

#### Étape 4 — Le joueur voit et achète ses glaneurs dans le panneau — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[CU-01] affiche le nombre de glaneurs, l’éther et le prix d’un glaneur` | `tests/presentation/describe.test.ts` | CU-01 |
| 2 | `[CU-01] grise l’achat et donne la raison du refus quand l’achat est refusé` | idem | CU-01 |
| 3 | `[CU-01] accepte sans rien débiter quand le joueur en duel a assez d’or` | `tests/application/queries/canBuyGleaner.test.ts` | CU-01 |
| 4 | `[CU-01] refuse avec « Pas assez d'or. » quand l’or manque` | idem | CU-01 |

**Production autorisée** : `src/application/queries/canBuyGleaner.ts` (nouveau), `src/application/commands/gleaner.ts` (appel de la query), `src/presentation/describe.ts` (`gleanerPanel`), `src/presentation/Game.ts` (onglets du panneau `T`, bouton `data-gleaner`, envoi de l'ordre via `order`).

#### Étape 5 — Vérification — ✅
Pas de nouveau test. `npx tsc --noEmit` + `npm test`.

### Éléments de code
Signatures seulement, jamais de corps.
- `domain/catalog/ether.ts` — `export const GLEANER: { cost: number; period: number }` (nouveau)
- `domain/model/types.ts` — `CommandType.Gleaner = 'gleaner'` ; `| { c: CommandType.Gleaner }`
- `domain/model/World.ts` — `ether = 0` ; `gleaners: number[] = []` (tick d'achat)
- `domain/systems/gleaners.ts` — `export function updateGleaners(world: World): void` —
  - période en ticks = `GLEANER.period / TICK`
  - pour chaque glaneur : `(world.tick − achat) > 0` et multiple de la période → `ether++`
- `application/queries/canBuyGleaner.ts` — `export function canBuyGleaner(world: World): Result` — refuse hors duel (RM-01), refuse si `gold < GLEANER.cost`, sans rien modifier
- `application/commands/gleaner.ts` — `export function gleaner(world: World): Result` — `canBuyGleaner`, puis débite et empile `world.tick`
- `presentation/describe.ts` — `export function gleanerPanel(ether: number, gleaners: number, buy: Result): string` — bouton grisé, raison du refus en infobulle (règle presentation : bouton grisé par une query)

### Hypothèses
- H1 — Le test `[RM-02] démarre à 0 glaneur et 0 éther` est vert dès le premier passage : les valeurs initiales viennent de la déclaration des champs `ether = 0` et `gleaners = []`, posée comme bouchon. Sans ces champs, il serait rouge (`undefined`). Il est gardé comme garde de non-régression de RM-02. — à valider par Pierre
- H2 — Les onglets Envois / Glaneurs / Porte du panneau `T` ne sont pas stylés (`index.html` n'a pas été modifié). Ils s'affichent en boutons bruts, sans raccourci clavier pour passer d'un onglet à l'autre. L'onglet Porte reste vide jusqu'au lot F3. — à valider par Pierre
- H3 — Correction après audit : le grisé du bouton passe par la query `canBuyGleaner`, réutilisée par l’ordre `gleaner`. `sendPanel` garde sa comparaison d’or jusqu’au lot F2, qui refait son barème. Libellés des tests en apostrophe typographique ’, comme le reste de `describe.test.ts`. — à valider par Pierre

---

## Lot F2 — Envois payés en éther, revenu sans plafond — ✅

### Intention
Un envoi se paie en éther au barème de la section 6 et augmente le revenu sans plafond. **RM** : RM-04, RM-05, RM-06, RM-07 · **CU** : CU-02

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-03 (ordre `send` existant), ARCH-04 (aucune formule : prix et gain lus dans le catalogue, plafond supprimé), ARCH-05 (aucun aléatoire), ARCH-06 (barème dans `CreepDef.send`), ARCH-08 (`send.ts` étendu, `income.ts` supprimé) |
| Données | `CreepDef.send.cost` devient un prix en éther : rat 10/+3, loup 16/+4, maraudeur 24/+6, harpie 30/+6, golem 50/+10, spectre 60/+12 |
| Calcul pur | aucun (`incomeCap`, `raiseIncome` supprimés) |
| Ordre du joueur | aucun nouveau ; `send` modifié |
| Coût par tick | hors `step()` |

### Étapes et tests

#### Étape 1 — Le joueur envoie une créature contre de l'éther — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[CU-02] débite 10 éther, laisse l'or intact et augmente le revenu de 3 quand le joueur envoie un rat` | `tests/application/commands/send.test.ts` | RM-04 |
| 2 | `[RM-06] ajoute tout le gain au revenu quand le revenu dépasse l'ancien plafond` | idem | RM-06 |
| 3 | `[CU-02] refuse avec « Pas assez d'éther. » et laisse l'état inchangé quand l'éther manque, même avec de l'or` | idem | RM-04 |
| 4 | `[RM-04] envoie chaque créature au prix et au gain du barème` | `tests/domain/catalog/creeps.test.ts` | RM-04 |

Tests existants de `send.test.ts` et `creeps.test.ts` sur le prix en or et le plafond : réécrits ou retirés. `tests/domain/rules/income.test.ts` supprimé. RM-05 et RM-07 restent portées par les tests existants de `waves.test.ts` et `receive.test.ts`, inchangés.

**Production autorisée** : `src/domain/catalog/creeps.ts` (`send`), `src/application/commands/send.ts`, suppression de `src/domain/rules/income.ts`.

#### Étape 2 — Le joueur voit les envois en éther dans le panneau — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[CU-02] liste chaque créature envoyable avec son prix en éther et son gain, et le revenu sans plafond` | `tests/presentation/describe.test.ts` | CU-02 |
| 2 | `[CU-02] grise une créature quand l'éther ne suffit pas à l'envoyer` | idem | CU-02 |

**Production autorisée** : `src/presentation/describe.ts` (`sendPanel`), `src/presentation/Game.ts` (appel de `sendPanel`, retrait de `incomeCap`).

#### Étape 3 — Le bot qui envoie gagne encore son duel (H3) — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-04] gagne la campagne en duel en achetant des glaneurs et en envoyant contre de l'éther, sur trois graines en Recrue et au moins deux en Vétéran` (remplace le test `[RM-02]` duel existant) | `tests/balance.test.ts` | RM-04, RM-06 |

**Production autorisée** : `tests/support/bot.ts` (`Bot.send` : après ses constructions, achète des glaneurs en gardant une réserve d'or, envoie des rats dès 10 éther). Aucun chiffre de la spec n'est retouché ; un échec se remonte comme hypothèse H3 non tenue.

#### Étape 4 — Vérification — ✅
Pas de nouveau test. `npx tsc --noEmit` + `npm test` (inclut `balance.test.ts` : le barème de `catalog/creeps.ts` a bougé).

### Éléments de code
- `domain/catalog/creeps.ts` — `send: { cost, income }` aux valeurs de la section 6 (coût en éther)
- `application/commands/send.ts` — `export function send(world, cmd): Result` — refuse si `ether < offer.cost` (« Pas assez d'éther. »), débite l'éther, `income += offer.income`
- `presentation/describe.ts` — `export function sendPanel(ether: number, income: number): string`

### Hypothèses
- H1 — Suppression de `src/domain/rules/income.ts` et `tests/domain/rules/income.test.ts` reportée à l'étape 3 : `Game.ts` (étape 2) et `tests/support/bot.ts` (étape 3) importent encore `incomeCap` — à valider par l'utilisateur.
- H2 — `tests/application/online/duel.test.ts` : fixtures d'envoi adaptées (éther posé à la main sur l'hôte, le témoin et le rejeu RM-08 ; refus RM-07 par `ether = 0`), intention des tests inchangée — à valider par l'utilisateur.
- H3 — Bot de duel : `act()` construit puis envoie ; achète des glaneurs en gardant 150 or de réserve, puis envoie des rats dès 10 éther. Mesuré : Recrue 3/3, Vétéran 2/3 (graine 1 perdue) — seuil tenu sans marge — à valider par l'utilisateur.

---

## Lot F3 — Porte : Tir et Remparts — ⬜

### Intention
Le joueur achète des niveaux de Tir et de Remparts en éther ; la Porte tire sur les créatures proches de la sortie et rend des vies en fin de vague. **RM** : RM-08, RM-09, RM-10, RM-12, RM-06 · **CU** : CU-03

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-01 (Porte, Tir, Remparts), ARCH-02, ARCH-03, ARCH-04 (`gateLevelCost`, `gateLevelIncome`), ARCH-05 (dégâts fixes, aucun aléatoire), ARCH-06 (`GATE` dans le catalogue, lu par le système), ARCH-07, ARCH-08 (`acquireTargets` et `applyDamage` réutilisés ; une tour fictive envisagée puis écartée : elle entrerait dans `towers`, la grille, la vente et le bilan) |
| Données | `catalog/ether.ts` : `GATE = { shot: { maxLevel: 10, damage: 15, range: 4, cooldown: 1 }, ramparts: { maxLevel: 5 } }`. `World.gate: { shot: number; ramparts: number; cooldown: number }`. `GateUpgrade = 'shot' \| 'ramparts'` dans `types.ts`. |
| Calcul pur | `domain/rules/pricing.ts` : `gateLevelCost(level)`, `gateLevelIncome(level)` |
| Ordre du joueur | `CommandType.Gate = 'gate'`, `{ c: CommandType.Gate; upgrade: GateUpgrade }` → `application/commands/gate.ts` |
| Coût par tick | `O(créatures)` par tir de la Porte, au plus une fois par seconde ; rien au niveau 0 |

### Étapes et tests

#### Étape 1 — Le joueur achète un niveau de Porte — ⬜
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-08] coûte 12 éther au niveau 1, 20 au niveau 3, 48 au niveau 10` | `tests/domain/rules/pricing.test.ts` | RM-08 |
| 2 | `[RM-08] rapporte un quart du prix en revenu : +3 au niveau 1, +5 au niveau 3, +12 au niveau 10` | idem | RM-08 |
| 3 | `[CU-03] débite 20 éther, passe le Tir au niveau 3 et ajoute 5 au revenu quand le Tir est au niveau 2` | `tests/application/commands/gate.test.ts` | RM-08, RM-06 |
| 4 | `[RM-08] garde un niveau propre à chaque amélioration quand le joueur achète Tir puis Remparts` | idem | RM-08 |
| 5 | `[CU-03] refuse avec « Pas assez d'éther. » et laisse l'état inchangé quand l'éther manque` | idem | CU-03 |
| 6 | `[CU-03] refuse avec « Niveau maximal atteint. » quand le Tir est au niveau 10 ou les Remparts au niveau 5` | idem | CU-03 |
| 7 | `[RM-01] refuse l'amélioration de la Porte quand la partie est en solo` | idem | RM-01 |
| 8 | `[RM-02] démarre avec Tir et Remparts au niveau 0 quand le duel commence` | idem | RM-02 |

**Production autorisée** : `src/domain/catalog/ether.ts` (`GATE`), `src/domain/rules/pricing.ts`, `src/domain/model/types.ts` (`GateUpgrade`, `CommandType.Gate`, variante de `Command`), `src/domain/model/World.ts` (`gate`), `src/application/commands/gate.ts` (nouveau, calqué sur `send.ts`), `src/application/dispatch.ts`.

#### Étape 2 — La Porte tire sur la créature la plus proche — ⬜
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-09] inflige 30 dégâts Chaos à la créature la plus proche de la sortie quand le Tir est au niveau 2` | `tests/domain/systems/gate.test.ts` | RM-09 |
| 2 | `[RM-09] tire une fois par seconde, pas plus` | idem | RM-09 |
| 3 | `[RM-09] tire sur une créature volante comme sur une créature au sol` | idem | RM-09 |
| 4 | `[RM-09] ignore une créature à plus de 4 cases du centre de la porte` | idem | RM-09 |
| 5 | `[RM-09] verse la prime au défenseur quand la Porte tue une créature` | idem | RM-09 |
| 6 | `[RM-09] ne tire pas quand le Tir est au niveau 0` | idem | RM-09, RM-01 |

**Production autorisée** : `src/domain/systems/gate.ts` (nouveau, `updateGate`), `src/domain/systems/combat.ts` (`acquireTargets` accepte un tireur `Pick<Tower, 'cx' | 'cy' | 'targetMode'>`), `src/domain/model/World.ts` (appel dans `step()`).

#### Étape 3 — Les Remparts rendent des vies en fin de vague — ⬜
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-10] rend autant de vies que le niveau de Remparts quand une vague est repoussée` | `tests/domain/systems/waves.test.ts` | RM-10 |
| 2 | `[RM-10] plafonne aux vies de départ : 21 vies et non 22 en Vétéran avec Remparts 3 et 19 vies` | idem | RM-10 |
| 3 | `[RM-10] ne rend aucune vie quand les Remparts sont au niveau 0` | idem | RM-10 |

**Production autorisée** : `src/domain/systems/waves.ts` (fin de vague).

#### Étape 4 — Le duel avec Porte se rejoue et se recale à l'identique — ⬜
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-12] restaure les niveaux de Tir et de Remparts et la recharge du Tir depuis un instantané` | `tests/domain/model/snapshot.test.ts` | RM-12 |
| 2 | `[RM-12] donne la même empreinte quand le même journal avec glaneurs et améliorations de Porte est rejoué sur la même graine` | `tests/application/commands/gate.test.ts` | RM-12 |
| 3 | `[RM-12] lit un ordre d'amélioration de Porte reçu du client et rejette une amélioration inconnue` | `tests/application/online/protocol.test.ts` | RM-12 |

**Production autorisée** : `src/domain/model/snapshot.ts` (`gate`), `src/application/online/protocol.ts` (`readCommand`).

#### Étape 5 — Le joueur voit et achète les niveaux dans l'onglet Porte — ⬜
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[CU-03] affiche le niveau de Tir et de Remparts, le prix et le gain de revenu du niveau suivant` | `tests/presentation/describe.test.ts` | CU-03 |
| 2 | `[CU-03] grise une amélioration quand l'éther manque et affiche « Niveau maximal atteint » au niveau max` | idem | CU-03 |

**Production autorisée** : `src/presentation/describe.ts` (`gatePanel`), `src/presentation/Game.ts` (onglet Porte, bouton `data-gate`, envoi de l'ordre via `order`).

#### Étape 6 — Vérification — ⬜
Pas de nouveau test. `npx tsc --noEmit` + `npm test` (inclut `balance.test.ts` : le solo ne doit pas bouger, la Porte y reste au niveau 0).

### Éléments de code
- `domain/catalog/ether.ts` — `export const GATE: { shot: { maxLevel; damage; range; cooldown }; ramparts: { maxLevel } }`
- `domain/model/types.ts` — `export type GateUpgrade = 'shot' | 'ramparts'` ; `CommandType.Gate = 'gate'` ; `| { c: CommandType.Gate; upgrade: GateUpgrade }`
- `domain/model/World.ts` — `gate = { shot: 0, ramparts: 0, cooldown: 0 }`
- `domain/rules/pricing.ts` — `export function gateLevelCost(level: number): number` — `12 + 4 × (level − 1)` ; `export function gateLevelIncome(level: number): number` — quart de `gateLevelCost`
- `domain/systems/combat.ts` — `acquireTargets(world, shooter: Pick<Tower, 'cx' | 'cy' | 'targetMode'>, a: AttackDef, n: number): Creep[]` (type du tireur élargi)
- `domain/systems/gate.ts` — `export function updateGate(world: World, dt: number): void` —
  - niveau 0 : rien
  - recharge ; à zéro, cible la plus proche (`targetMode: 'close'`, `targets: 'both'`) depuis le dernier point de `world.waypoints`
  - `applyDamage(world, cible, 15 × niveau, 'chaos', 0, false)` (prime versée par `applyDamage`), événement `Chain` pour le trait
- `domain/systems/waves.ts` — en fin de vague : `lives = min(DIFFICULTY[d].lives, lives + gate.ramparts)`
- `application/commands/gate.ts` — `export function gate(world: World, cmd: Extract<Command, { c: CommandType.Gate }>): Result` — refuse hors duel, refuse au niveau max (« Niveau maximal atteint. »), refuse si `ether < gateLevelCost(niveau + 1)` (« Pas assez d'éther. »), débite, monte le niveau, `income += gateLevelIncome(niveau)`
- `presentation/describe.ts` — `export function gatePanel(ether: number, gate: World['gate']): string`

### Hypothèses
_Vide à l'écriture. Rempli par `/implement-tdd` : `Hn — [hypothèse] — à valider par [qui]`._

---

## Lot F4 — Économie adverse visible — ⬜

### Intention
L'encart adverse affiche revenu, glaneurs, Tir et Remparts en direct ; l'éther adverse ne quitte jamais le serveur. **RM** : RM-11 · **CU** : CU-04

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-01, ARCH-02 (masquage en `application/online`, libellé en `presentation`), ARCH-03 (aucune écriture de `World` côté client : l'instantané reçu est restauré tel quel), ARCH-05 (le masquage ne touche que le message, jamais le monde du serveur), ARCH-08 (message `Rival` et encart `rivalPanel` existants étendus) |
| Données | aucune nouvelle |
| Calcul pur | aucun |
| Ordre du joueur | aucun |
| Coût par tick | hors `step()` (une copie d'instantané par `RIVAL_VIEW_MS`, déjà existante) |

### Étapes et tests

#### Étape 1 — L'adversaire ne reçoit jamais l'éther — ⬜
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-11] envoie l'instantané adverse avec revenu, glaneurs et niveaux de Porte mais l'éther à 0` | `tests/application/online/duel.test.ts` | RM-11 |
| 2 | `[RM-11] laisse l'éther du monde serveur intact après l'envoi de la vue adverse` | idem | RM-11 |

Test existant de `duel.test.ts` qui compare `rival` à `snapshot(world)` : adapté à l'éther masqué.

**Production autorisée** : `src/application/online/duel.ts` (construction du message `Rival`).

#### Étape 2 — Le joueur lit l'économie adverse dans l'encart — ⬜
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[CU-04] affiche revenu, nombre de glaneurs, niveaux de Tir et de Remparts de l'adversaire` | `tests/presentation/describe.test.ts` | CU-04 |
| 2 | `[RM-11] ne mentionne jamais l'éther de l'adversaire` | idem | RM-11 |

**Production autorisée** : `src/presentation/describe.ts` (`rivalEconomy`), `src/presentation/Game.ts` (`rivalPanel`, mise à jour à chaque `Rival`).

#### Étape 3 — Vérification — ⬜
Pas de nouveau test. `npx tsc --noEmit` + `npm test`.

### Éléments de code
- `application/online/duel.ts` — instantané `Rival` = `{ ...snapshot(world), ether: 0 }`
- `presentation/describe.ts` — `export function rivalEconomy(income: number, gleaners: number, gate: World['gate']): string`

### Hypothèses
_Vide à l'écriture. Rempli par `/implement-tdd` : `Hn — [hypothèse] — à valider par [qui]`._
