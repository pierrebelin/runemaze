# PLAN — Jeu en ligne (serveur de partie)

> Spec : `todo/jeu-serveur/SPEC.md`

## Avancement

| Lot | Intention | RM/CU | Dépend de | État |
|-----|-----------|-------|-----------|------|
| F1 | Une partie se fige en instantané, se restaure à l'identique, se résume en empreinte ; le mode infini devient un ordre journalisé. | RM-04, RM-05, RM-06, RM-10 | — | ✅ |
| F2 | L'arbitre tient une partie à son horloge, contrôle chaque ordre, fournit le recalage et arbitre la fin. | RM-02, RM-04, RM-05, RM-06, RM-08, RM-10 / CU-01, CU-02 | F1 | ✅ |
| F3 | L'arbitre gèle la partie à la coupure, la rend dans les 30 s au même navigateur, sinon la termine par abandon. | RM-07, RM-09 / CU-03, CU-04 | F2 | ✅ |
| F4 | Le serveur héberge le jeu ; le jeu lance, joue et termine ses parties en ligne. | RM-01, RM-02, RM-03, RM-08, RM-10 / CU-01, CU-02 | F2 | ✅ |
| F5 | Le jeu gèle, décompte, se reconnecte et propose « Reprendre la partie ». | RM-07, RM-09 / CU-03, CU-04 | F3, F4 | ✅ |

## Périmètre

- **Réutilisé** :
  - `src/application/dispatch.ts:11` — seule entrée des ordres, côté jeu comme côté serveur.
  - `src/domain/model/World.ts:198` `continueEndless()` — appelé par le nouvel ordre `endless`.
  - `src/domain/Rng.ts:4` — `new Rng(état)` reprend exactement la suite : l'instantané n'a besoin que d'un accesseur d'état.
  - `src/domain/model/World.ts:118` `refreshPaths()` — recalcule `FlowField` et `legRest` après restauration.
  - `src/infrastructure/GameLoop.ts:7` `speed` / `paused` — inchangés, relayés au serveur.
  - `src/presentation/Game.ts:708` `loadBest` / `saveBest` — record toujours dans le navigateur, écrit depuis la partie recalée sur le serveur.
  - `tests/support/helpers.ts` `newWorld`, `run`, `killAllCreeps` ; `tests/support/maps.ts`.
- **Hors périmètre** : comptes joueurs ; records côté serveur ; reprise depuis un autre navigateur ; jeu hors ligne ; duel. Mise à jour de `todo/duel-en-ligne/SPEC.md` (RM-15 caduque) : à faire dans la spec du duel. Protection contre la triche au-delà du contrôle (l'horloge serveur limite déjà les ticks fantaisistes). Persistance des parties au redémarrage du serveur (H2 de la spec).
- **Règles N/A** : ARCH-06 — aucun contenu de jeu ajouté (ni tour, ni créature, ni vague, ni carte).
- **Décisions** (2026-09-28, Pierre) :
  - D1 — Transport WebSocket, dépendance `ws` (+ `@types/node`, `@types/ws`, `tsx` en dev).
  - D2 — Nouvelle couche `src/server/` (transport, fichiers de `dist/`), qui importe `domain` et `application`. Logique pure de l'arbitre dans `application/online/`, temps réel **injecté** (`now` en ms), testée sans réseau.
  - D3 — Recalage et reprise par **instantané complet** de `World` (pas de rejeu depuis la graine).
  - D4 — **Horloge temps réel du serveur** : sa partie avance seule (× vitesse, sauf pause ou gel). Marge de **15 ticks (250 ms)** derrière l'horloge : un ordre arrivé dans la marge s'applique au tick du joueur ; au-delà, il s'applique au tick courant du serveur et compte comme écart.
  - D5 — Onglet masqué = pause automatique envoyée au serveur, reprise au retour (H1 de la spec respectée).
  - D6 — L'identifiant, le jeton et la graine sont tirés par `server/` (aléatoire système) et passés à l'arbitre : `application` ne lit ni l'heure ni l'aléatoire du système.
  - D7 (audit F2) — Recalage : au tick de l'instantané, le joueur rejoue ses ordres au-delà du nombre déjà présents dans le journal du serveur à ce tick (sinon un second ordre du même tick est perdu).
  - D8 (audit F2) — Tick du joueur borné à `horloge + LAG_TICKS` : un `order` au-delà s'applique à cette borne et compte comme écart ; `pace` ne recale pas l'horloge au-delà. Empêche un tick fantaisiste de jouer la partie d'un coup.
  - D9 (audit F3, 2026-09-28, Pierre) — Retour après 30 s, partie encore tenue : `resume` rend `over { verdict: 'abandon', snapshot }` (bilan du serveur pour l'écran de fin de F5). Partie déjà balayée ou inconnue : `ended` (H2 de la spec).
  - D10 (vérification F4, 2026-09-28, Pierre) — `pace` cale l'horloge sur le tick du joueur (borné), sans ajouter `LAG_TICKS` : la partie du serveur reste 15 ticks derrière le joueur, la marge D4 absorbe son retard sur le temps réel.

## Traçabilité

| RM/CU | Porté par | Lot |
|-------|-----------|-----|
| RM-01 — En ligne uniquement | `src/server/main.ts` (sert `dist/` + `/partie`) ; `presentation/ServerLink.ts` (connexion à `location.host`) | F4 |
| RM-02 — Partie tenue dès le lancement | `Referee.open()` → instantané de départ ; `Game.newGame()` attend `opened` | F2, F4 |
| RM-03 — Réactivité inchangée | `Game` applique l'ordre par `dispatch` puis envoie `order` sans attendre ; `HeldGame.order()` n'est jamais bloquant pour le jeu | F4 |
| RM-04 — Même partie des deux côtés | `snapshot`/`restore` ; `HeldGame.order()` applique au tick du joueur ; ordre `endless` journalisé | F1, F2 |
| RM-05 — Contrôle après chaque ordre et en fin | `fingerprint()` ; `HeldGame.order()` / `HeldGame.check()` → `drift` | F1, F2 |
| RM-06 — Recalage silencieux | `realign(snapshot, ownLog, untilTick)` | F1, F2 |
| RM-07 — Gel 30 s puis abandon | `HeldGame.lose()` / `Referee.resume()` / `Referee.sweep()` ; overlay de décompte dans `Game` | F3, F5 |
| RM-08 — Le serveur fait foi | `HeldGame.advance()` → `over` avec instantané du serveur ; `Game` affiche la fin depuis la partie restaurée | F2, F4 |
| RM-09 — Reprise au même navigateur | jeton de partie vérifié par `Referee.resume()` / `resumable()` ; jeton gardé dans `localStorage` | F3, F5 |
| RM-10 — Règles solo inchangées | message `pace` (pause, vitesse) ; ordre `endless` ; record inchangé | F1, F2, F4 |
| CU-01 — Lancer une partie | `Referee.open()` ; `Game.newGame()` ; refus « Impossible de lancer la partie, vérifiez votre connexion. » | F2, F4 |
| CU-02 — Jouer | `HeldGame.order()` ; `realign()` ; `Game` | F2, F4 |
| CU-03 — Coupure, page ouverte | `HeldGame.lose()`, `Referee.resume()` ; `Game` gèle, décompte, retente | F3, F5 |
| CU-04 — Coupure, page rechargée | `Referee.resumable()`, `Referee.resume()`, `Referee.open(…, previous)` ; bouton « Reprendre la partie » | F3, F5 |

---

## Lot F1 — Instantané, empreinte, mode infini par ordre — ✅

### Intention
Figer une partie en données, la restaurer à l'identique et la résumer en empreinte ; faire passer le mode infini par `dispatch` pour que le serveur le voie. **RM** : RM-04, RM-05, RM-06, RM-10

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-07, ARCH-08 |
| Données | `WorldSnapshot` : objet JSON pur (carte `MapDef` complète, difficulté, état `Rng`, `nextId`, champs mutables de `World`, `grid.tower`, tours, créatures, projectiles, lanceurs, `pending`, `stats`, `log`). Définitions stockées par id, résolues par `TOWERS` / `CREEPS`. Événements non drainés exclus. |
| Calcul pur | `fingerprint(world) → string` dans `domain/rules/fingerprint.ts` (hachage de l'instantané) |
| Ordre du joueur | Nouvelle variante `Command` `{ c: 'endless' }` → `application/commands/endless.ts` (réutilise `World.continueEndless`, ARCH-08) |
| Coût par tick | `step()` inchangé. Instantané et empreinte : O(état), appelés par ordre, hors `step()` (ARCH-07) |
| Aléatoire | Aucun nouveau ; l'état de `world.rng` voyage dans l'instantané (ARCH-05) |

### Étapes et tests
Tests écrits et **rouges avant toute ligne de production** de l'étape. Ordre : cas nominal d'abord (il fixe les signatures), refus ensuite.

#### Étape 1 — Une partie restaurée depuis son instantané continue à l'identique — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-06] continue à l'identique quand la partie est restaurée en pleine vague` | `tests/domain/model/snapshot.test.ts` | RM-06 |
| 2 | `[RM-06] reste identique après un passage par JSON` | idem | RM-06 |
| 3 | `[RM-06] garde les tours vendues et détruites du bilan quand la partie est restaurée` | idem | RM-06 |
| 4 | `[RM-04] accepte les ordres suivants comme la partie d'origine quand la partie est restaurée` | idem | RM-04 |
| 5 | `[RM-06] restaure l'état de l'instantané quand la partie d'origine a continué avec des créatures empoisonnées` | idem | RM-06 |
| 6 | `[RM-06] restaure l'état de l'instantané quand la partie d'origine a continué avec un Sapeur gobelin` | idem | RM-06 |
| 7 | `[RM-06] donne deux parties identiques quand le même instantané est restauré deux fois` | idem | RM-06 |

**Production autorisée** : `src/domain/model/snapshot.ts` (nouveau), `src/domain/Rng.ts` (accesseur d'état), `src/domain/model/World.ts` (`nextId` accessible à `snapshot.ts`).

#### Étape 2 — L'empreinte distingue deux parties qui divergent — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-05] donne la même empreinte quand deux parties ont même graine et mêmes ordres aux mêmes ticks` | `tests/domain/rules/fingerprint.test.ts` | RM-05 |
| 2 | `[RM-05] change d'empreinte quand l'or diffère` | idem | RM-05 |
| 3 | `[RM-05] change d'empreinte quand un même ordre est appliqué à un autre tick` | idem | RM-05 |

**Production autorisée** : `src/domain/rules/fingerprint.ts` (nouveau).

#### Étape 3 — Le joueur passe en mode infini par un ordre journalisé — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-10] relance les vagues en mode infini quand la campagne est gagnée` | `tests/application/commands/endless.test.ts` | RM-10 |
| 2 | `[RM-04] journalise l'ordre de mode infini pour le rejeu` | idem | RM-04 |
| 3 | `[RM-10] refuse le mode infini quand la campagne n'est pas gagnée` | idem | RM-10 |
| 4 | `[RM-10] refuse le mode infini quand la partie est perdue` | idem | RM-10 |

**Production autorisée** : `src/domain/model/types.ts` (`Command`), `src/application/commands/endless.ts` (nouveau), `src/application/dispatch.ts` (laisser passer `endless` en victoire), `src/presentation/Game.ts` (bouton « Continuer en mode infini » → `dispatch`).

#### Étape 4 — Vérification — ✅
Pas de nouveau test. `npx tsc --noEmit` + `npm test`.

### Éléments de code
- `domain/Rng.ts` — `get state(): number` (nouveau)
- `domain/model/snapshot.ts` — `export interface WorldSnapshot { … }` (JSON pur) ; `export function snapshot(world: World): WorldSnapshot` ; `export function restore(snap: WorldSnapshot): World`
  - restaure : `new World({ map, difficulty, seed: rngState })`, recopie des champs mutables et de `grid.tower`, puis `refreshPaths()` et enfin `stats` (ne pas laisser `refreshPaths` écraser `longestMaze`)
  - une tour présente dans `towers` et `stats.towers` reste un **seul** objet ; `towerById` reconstruit
- `domain/rules/fingerprint.ts` — `export function fingerprint(world: World): string` — hachage (FNV-1a 32 bits) de `JSON.stringify(snapshot(world))`
- `domain/model/types.ts` — `Command` : `| { c: 'endless' }` (nouveau)
- `application/commands/endless.ts` — `export function endless(world: World): Result` — `fail('La campagne n'est pas encore gagnée.')` hors victoire, sinon `world.continueEndless()`
- `application/dispatch.ts` — la garde de fin de partie laisse passer `endless` en `victory` uniquement

### Hypothèses
- H1 — Test `refuse le mode infini quand la partie est perdue` vert dès le premier passage (refus assuré par la garde `defeat` de `dispatch`, écrite au cycle nominal) ; conservé car une mutation laissant passer `endless` en `defeat` le fait échouer — à valider par Pierre
- H2 — `[RM-06] garde les tours vendues et détruites du bilan` scindé en deux `it` (tour vendue conservée ; même référence entre `towers` et `stats.towers`) — à valider par Pierre
- H3 — Tests 5-7 de l'étape 1 ajoutés après l'audit : l'instantané copie `poisons` et `breaker` des créatures (sinon partagés avec la partie, qui les modifie en place) ; il ne partage aucun objet mutable, ce qui permet de restaurer plusieurs fois le même instantané en mémoire (reprise F3) — à valider par Pierre
- H4 — `WorldSnapshot` n'est pas du JSON strict : `nextWaveIn` et `remaining` peuvent valoir `Infinity`, qui devient `null` après passage par JSON. Sans effet aujourd'hui (empreinte identique, champs recalculés ou inutilisés dans ce cas) ; à trancher en F2 avant le recalage par le réseau — à valider par Pierre

---

## Lot F2 — Partie tenue par l'arbitre — ✅

### Intention
L'arbitre ouvre une partie, la fait avancer à son horloge, applique et contrôle chaque ordre, fournit de quoi recaler le joueur et arbitre la fin. **RM** : RM-02, RM-04, RM-05, RM-06, RM-08, RM-10 · **CU** : CU-01, CU-02

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-01 (`Referee` = arbitre, `HeldGame` = partie tenue, `realign` = recalage), ARCH-02, ARCH-03, ARCH-05, ARCH-07, ARCH-08 |
| Données | Constantes `LAG_TICKS = 15`, `LOST_LIMIT_MS = 30_000` dans `application/online/heldGame.ts` (règles d'arbitrage en ligne, pas de simulation) |
| Calcul pur | `realign(snap, ownLog, untilTick) → World` dans `application/online/realign.ts` |
| Ordre du joueur | Aucune variante de `Command` ; l'arbitre applique les ordres reçus par `dispatch` (ARCH-03) |
| Coût par tick | `World.step()` inchangé. `HeldGame.advance(now)` : O(ticks dus) par partie ; contrôle O(état) par ordre, hors `step()` |
| Temps et aléatoire | `now` (ms) passé en paramètre ; graine, identifiant, jeton passés par l'appelant (D6, ARCH-05) |

### Étapes et tests

#### Étape 1 — L'arbitre ouvre une partie dont il fixe le départ — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-02] ouvre la partie à la carte, la difficulté et la graine fixées par le serveur` | `tests/application/online/referee.test.ts` | RM-02 |
| 2 | `[RM-02] rend l'instantané de départ au tick 0 avec l'or et les vies de la difficulté` | idem | RM-02 |
| 3 | `[CU-01] tient plusieurs parties sans qu'un ordre de l'une touche l'autre` | idem | CU-01 |

**Production autorisée** : `src/application/online/referee.ts` (nouveau), `src/application/online/heldGame.ts` (nouveau, constructeur seulement), `src/application/online/protocol.ts` (nouveau, types de messages).

#### Étape 2 — La partie du serveur avance à son horloge, pause et vitesse comprises — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[CU-02] avance de 60 ticks par seconde en restant 15 ticks derrière son horloge` | `tests/application/online/heldGame.test.ts` | CU-02 |
| 2 | `[RM-10] avance deux fois plus vite quand la vitesse passe à 2` | idem | RM-10 |
| 3 | `[RM-10] n'avance plus quand le joueur met en pause, quelle que soit la durée` | idem | RM-10 |
| 4 | `[RM-10] se cale sur le tick du joueur quand la pause ou la vitesse change` | idem | RM-10 |
| 5 | `[RM-10] reprend au tick du joueur quand le mode infini suit la victoire` | idem | RM-10 |
| 6 | `[RM-10] ne cale pas son horloge au-delà de sa marge quand le joueur annonce un tick trop en avance` (D8) | idem | RM-10 |

**Production autorisée** : `src/application/online/heldGame.ts` (`advance`, `pace`).

#### Étape 3 — Le serveur applique chaque ordre au tick du joueur et le contrôle — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-04] applique l'ordre au tick du joueur sans écart quand les deux parties sont identiques` | `tests/application/online/heldGame.test.ts` | RM-04 |
| 2 | `[RM-05] signale un écart avec l'instantané du serveur quand l'empreinte du joueur diffère` | idem | RM-05 |
| 3 | `[RM-05] signale un écart quand le serveur refuse un ordre accepté par le joueur` | idem | RM-05 |
| 4 | `[RM-05] applique l'ordre au tick courant et signale un écart quand il arrive après la marge de 250 ms` | idem | RM-05 |
| 5 | `[RM-05] applique l'ordre à la borne de son horloge et signale un écart quand le tick du joueur la dépasse` (D8) | idem | RM-05 |

**Production autorisée** : `src/application/online/heldGame.ts` (`order`).

#### Étape 4 — Le joueur est recalé sur la partie du serveur sans perdre ses ordres en route — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-06] remet l'or du joueur à celui du serveur quand les parties divergent` (120 → 95) | `tests/application/online/realign.test.ts` | RM-06 |
| 2 | `[RM-06] rejoue les ordres du joueur postérieurs à l'instantané jusqu'à son tick courant` | idem | RM-06 |
| 3 | `[RM-06] ignore les ordres du joueur déjà contenus dans l'instantané` (D7 : antérieurs à son tick, ou présents à son tick dans le journal du serveur) | idem | RM-06 |
| 4 | `[RM-06] rejoue les ordres du joueur au tick de l'instantané absents du journal du serveur` (D7) | idem | RM-06 |

**Production autorisée** : `src/application/online/realign.ts` (nouveau).

#### Étape 5 — Le serveur arbitre la fin de partie — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-08] annonce la défaite avec son instantané quand sa partie tombe à 0 vie` | `tests/application/online/heldGame.test.ts` | RM-08 |
| 2 | `[RM-08] annonce la victoire avec son instantané quand sa dernière vague est repoussée` | idem | RM-08 |
| 3 | `[RM-05] signale un écart quand le joueur déclare une fin que le serveur n'atteint pas au même tick` | idem | RM-05 |
| 4 | `[RM-08] n'annonce la fin qu'une seule fois quand la partie reste finie` | idem | RM-08 |

**Production autorisée** : `src/application/online/heldGame.ts` (`advance` rend `over`, `check`).

#### Étape 6 — Vérification — ✅
Pas de nouveau test. `npx tsc --noEmit` + `npm test`.

### Éléments de code
- `application/online/protocol.ts` — types seuls :
  - `ClientMessage` = `open { map, difficulty, previous? }` · `order { tick, cmd, fingerprint }` · `check { tick, fingerprint }` · `pace { tick, paused, speed }` · `resumable { id, token }` · `resume { id, token }`
  - `ServerMessage` = `opened { id, token, snapshot }` · `drift { snapshot }` · `over { verdict: 'victory' | 'defeat' | 'abandon', snapshot }` · `resumed { snapshot, paused, speed }` · `resumable { ok }` · `ended`
- `application/online/heldGame.ts` — `export class HeldGame`
  - `constructor(world: World, token: string, now: number)`
  - `advance(now: number): ServerMessage | null` — horloge += écoulé × vitesse (sauf pause / gel) ; `step()` tant que `world.tick < horloge − LAG_TICKS` ; draine les événements ; horloge bornée à `world.tick + LAG_TICKS` quand la partie ne peut plus avancer (victoire) ; rend `over` une seule fois à la fin
  - `order(msg, now): ServerMessage | null` — `advance(now)` ; tick du joueur ≥ tick serveur : `step()` jusqu'à lui, sinon ordre tardif ; `dispatch` ; refus, retard ou empreinte différente → `drift`
  - `check(msg, now): ServerMessage | null` — même contrôle sans ordre
  - `pace(msg, now): void` — horloge := `msg.tick + LAG_TICKS`, pause et vitesse enregistrées
- `application/online/referee.ts` — `export class Referee`
  - `open(req: { map: MapDef; difficulty: Difficulty; seed: number; id: string; token: string; previous?: … }, now: number): ServerMessage`
  - `game(id: string): HeldGame | undefined` ; `advance(now: number): { id: string; msg: ServerMessage }[]`
- `application/online/realign.ts` — `export function realign(snap: WorldSnapshot, ownLog: World['log'], untilTick: number): World` — `restore(snap)` puis `step()` jusqu'à `untilTick`, en re-dispatchant les ordres de `ownLog` de tick > `snap.tick` à leur tick

### Hypothèses
- H5 — Messages discriminés par un champ `t` (`{ t: 'opened', … }`), comme `GameEvent` — à valider par Pierre
- H6 — Rattrapage de l'horloge arrêté dès `victory`/`defeat` (sinon boucle infinie : `step()` n'avance plus `tick` en fin de partie) ; horloge alors bornée à `world.tick + LAG_TICKS` en victoire comme en défaite — à valider par Pierre
- H7 — `order`, `check`, `pace` avancent l'horloge sans consommer l'annonce `over` : seul `advance` la rend (relayée par `Referee.advance`, lot F4) — à valider par Pierre
- H8 — `over` annoncé une seule fois pour toute la partie : une défaite en mode infini après une victoire annoncée n'est pas annoncée. À trancher en F4 (le jeu affiche-t-il la fin depuis `over` en mode infini ?) — à valider par Pierre
- H9 — `Referee.advance(now)` prévu aux éléments de code, non écrit en F2 (aucun test du lot ne le demande) ; à écrire en F3/F4 avec son test — à valider par Pierre
- H10 — `LOST_LIMIT_MS` et `previous?` de `Referee.open` relèvent de la coupure : reportés en F3, non écrits en F2 — à valider par Pierre
- H11 — H4 (`Infinity` devient `null` en JSON) reportée en F4 : F2 échange les instantanés en mémoire, sans passage par le réseau ; à trancher avant le premier envoi par WebSocket — à valider par Pierre
- H12 — RM-03 retirée de F2 : aucun test du lot ne la porte ; sa preuve (le jeu applique l'ordre sans attendre le serveur) est dans `Game`, lot F4 — à valider par Pierre
- H13 — `pace` n'impose pas la vitesse : une vitesse hors {1, 2, 3} relève de la validation des messages (F4 étape 1, « messages bien formés »), qui doit la refuser ; sinon `speed: 1e6` joue la partie d'un coup — à valider par Pierre

---

## Lot F3 — Coupure, gel et reprise côté arbitre — ✅

### Intention
À la coupure, l'arbitre gèle la partie 30 s ; il la rend au même navigateur dans le délai (état, pause, vitesse), sinon la termine par abandon ; une nouvelle partie abandonne l'ancienne. **RM** : RM-07, RM-09 · **CU** : CU-03, CU-04

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-01, ARCH-02, ARCH-05, ARCH-08 (étend `HeldGame` / `Referee`, pas de nouveau type) |
| Données | `HeldGame` : `lostAt?: number`, verdict `abandon` ; `LOST_LIMIT_MS` (F2) |
| Calcul pur | aucun nouveau |
| Ordre du joueur | aucun |
| Coût par tick | `Referee.sweep(now)` : O(parties tenues), appelé par le serveur à intervalle, hors `step()` |

### Étapes et tests

#### Étape 1 — La partie se gèle à la coupure et reprend dans le délai — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-07] gèle la partie du serveur quand la connexion du joueur tombe` | `tests/application/online/referee.test.ts` | RM-07 |
| 2 | `[CU-03] rend l'instantané du serveur quand le joueur revient dans les 30 s` | idem | CU-03 |
| 3 | `[CU-04] rend la pause et la vitesse d'avant la coupure quand le joueur reprend` | idem | CU-04 |
| 4 | `[RM-07] reprend l'horloge au tick du gel quand le joueur revient` | idem | RM-07 |

**Production autorisée** : `src/application/online/heldGame.ts` (`lose`, `back`), `src/application/online/referee.ts` (`lose`, `resume`).

#### Étape 2 — Sans retour en 30 s, la partie se termine par abandon — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-07] termine la partie en défaite par abandon quand 30 s passent sans retour` | `tests/application/online/referee.test.ts` | RM-07 |
| 2 | `[RM-07] rend la défaite par abandon et le bilan du serveur quand le joueur revient après 30 s` (réécrit après audit F3, D9) | idem | RM-07 |
| 3 | `[RM-07] annonce la fin quand la partie est inconnue du serveur` (H2 de la spec) | idem | RM-07 |
| 4 | `[RM-08] retire au balayage les parties finies` (ajouté par `/implement-tdd` : `sweep` le prévoit, aucun test ne le couvrait) | idem | RM-08 |
| 5 | `[RM-10] garde au balayage la partie passée en mode infini après la victoire` (audit F3) | idem | RM-10 |

**Production autorisée** : `src/application/online/referee.ts` (`sweep`).

#### Étape 3 — La reprise est réservée au même navigateur ; une nouvelle partie abandonne l'ancienne — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[CU-04] propose la reprise quand le jeton correspond et que la coupure date de moins de 30 s` | `tests/application/online/referee.test.ts` | CU-04 |
| 2 | `[RM-09] refuse la reprise quand le jeton ne correspond pas` | idem | RM-09 |
| 3 | `[CU-04] termine l'ancienne partie par abandon quand le joueur en lance une nouvelle` | idem | CU-04 |

**Production autorisée** : `src/application/online/referee.ts` (`resumable`, `open` avec `previous`).

#### Étape 4 — Vérification — ✅
Pas de nouveau test. `npx tsc --noEmit` + `npm test`.

### Éléments de code
- `application/online/heldGame.ts` — `lose(now: number): void` (horloge figée) ; `back(now: number): ServerMessage` (`resumed { snapshot, paused, speed }`, horloge repart du tick gelé)
- `application/online/referee.ts`
  - `lose(id: string, now: number): void`
  - `resumable(id: string, token: string, now: number): boolean` — partie connue, jeton égal, gel ≤ `LOST_LIMIT_MS`
  - `resume(id: string, token: string, now: number): ServerMessage` — `resumed` ; `over { verdict: 'abandon', snapshot }` si la coupure dépasse 30 s (D9) ; `ended` si la partie est inconnue, le jeton faux ou la partie non gelée (H7)
  - `sweep(now: number): string[]` — retire les parties en défaite et celles gelées depuis plus de 30 s (abandon) ; une victoire reste tenue (H3) ; rend leurs identifiants
  - `open(…)` — `previous { id, token }` valide : partie retirée (abandon)

### Hypothèses
- H1 — `HeldGame.expired(now)` publique (hors `### Éléments de code`) : seule définition de « coupure de plus de 30 s », partagée par `resumable`, `resume` et `sweep` — à valider par Pierre
- H2 — Le gel se lit sur `lostAt !== undefined` ; pas d'indicateur séparé — à valider par Pierre
- H3 — `sweep` retire la défaite et la coupure expirée seulement ; une victoire reste tenue (mode infini possible, RM-10), et elle est retirée 30 s après la déconnexion du joueur — à valider par Pierre
- H4 — Pendant le gel, `order`/`check`/`pace` font encore avancer la partie et appliquent l'ordre (RM-07 : « ni temps ni ordre ») : en F4, `server/` ne relaie rien vers une partie gelée — à valider par Pierre (F4)
- H5 — Un second `lose` sans `back` entre les deux repousse `lostAt`, donc le délai de 30 s : en F4, `server/` n'appelle `lose` qu'une fois par coupure — à valider par Pierre (F4)
- H6 — `ClientMessage.open.previous` est une `string` dans `protocol.ts`, alors que `OpenRequest.previous` vaut `{ id, token }` : alignement du protocole en F4 — à valider par Pierre (F4)
- H7 — `resume` sur une partie non gelée (bon jeton) rend `ended` : `back()` ne rattrape pas le temps écoulé. Garde ajoutée au GREEN sans test dédié. En F4, `server/` appelle `lose` sur l'ancienne connexion avant de relayer un `resume` — à valider par Pierre (F4)

---

## Lot F4 — Serveur de partie et jeu en ligne — ✅

### Intention
Le serveur sert le jeu et tient ses parties ; le jeu lance, joue, se recale et termine ses parties en ligne, sans changement visible. **RM** : RM-01, RM-02, RM-03, RM-08, RM-10 · **CU** : CU-01, CU-02

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-01, ARCH-02 (couche `server` verrouillée), ARCH-03 (le jeu remplace sa partie par `realign`/`restore`, n'écrit jamais dans `World`), ARCH-05 (`application` sans heure ni aléatoire système), ARCH-08 |
| Données | `package.json` : `ws`, `@types/node`, `@types/ws`, `tsx` ; script `server` ; `tsconfig.json` : types `node` ; `vite.config.ts` : proxy `/partie` (ws) vers le serveur |
| Calcul pur | `readClientMessage(raw: string) → ClientMessage \| null` dans `application/online/protocol.ts` (entrée réseau non fiable) |
| Ordre du joueur | inchangé côté jeu ; chaque ordre accepté part vers le serveur |
| Coût par tick | intervalle serveur 50 ms : `Referee.advance(now)` + `sweep(now)`, O(parties × ticks dus), hors `step()` du jeu |

### Étapes et tests

#### Étape 1 — Le serveur n'accepte que des messages bien formés — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[CU-02] lit un ordre de construction bien formé` | `tests/application/online/protocol.test.ts` | CU-02 |
| 2 | `rejette un message qui n'est pas du JSON` | idem | CU-02 |
| 3 | `rejette un message de type inconnu ou aux champs manquants` | idem | CU-02 |
| 4 | `[RM-10] rejette un message de rythme dont la vitesse n'est pas 1, 2 ou 3` (H13, audit F2) | idem | RM-10 |
| 5 | `[CU-01] rejette une ouverture de partie à difficulté inconnue ou carte mal formée` (H3, audit F4) | idem | CU-01 |

**Production autorisée** : `src/application/online/protocol.ts` (`readClientMessage`).

#### Étape 2 — Le serveur héberge le jeu et tient les parties des joueurs connectés — ✅
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `server n'importe que domain, application` | `tests/architecture.test.ts` | RM-01 |
| 2 | ~~`aucune couche n'importe server`~~ — supprimé : couvert par la boucle `n'importe que` (H1) | idem | RM-01 |
| 3 | `[RM-04] domain et application ne lisent ni l'heure ni l'aléatoire du système` | idem | RM-04 |

**Production autorisée** : `src/server/main.ts` (nouveau : HTTP qui sert `dist/`, WebSocket sur `/partie`, un `Referee`, intervalle 50 ms, `crypto` pour id / jeton / graine, fermeture de socket → `referee.lose` ; exception au traitement d'un message → fermeture de la socket, H3), `tests/architecture.test.ts`, `package.json`, `tsconfig.json`, `vite.config.ts`.

#### Étape 3 — Le jeu lance, joue et termine sa partie en ligne — ✅
Logique couverte par F2 (`heldGame`, `realign`) ; aucun test unitaire possible sur DOM et WebSocket (`.claude/rules/presentation.md`). Vérification manuelle, `npm run build && npm run server` + `npm run dev` :
- CU-01 : lancer → partie identique à aujourd'hui ; serveur arrêté → « Impossible de lancer la partie, vérifiez votre connexion. », reste sur l'écran titre.
- RM-03 : construire, améliorer, vendre, cibler, appeler une vague → effet immédiat, mêmes messages de refus.
- RM-06 : forcer un écart (or modifié dans la console) → recalage silencieux.
- RM-10 / D5 : `P`, `1 2 3`, onglet masqué → le serveur suit ; mode infini après victoire.
- RM-08 : fin de partie affichée à la réception de `over`, bilan et record depuis la partie du serveur.
- RM-01 : `dist/index.html` ouvert hors serveur → refus CU-01.

**Production autorisée** : `src/presentation/ServerLink.ts` (nouveau : WebSocket vers `location.host/partie`, envoi / réception typés), `src/presentation/Game.ts` (`newGame` attend `opened` ; ordre accepté → `order` ; `drift` → `realign` ; `pace` sur `P`, `1 2 3`, `visibilitychange` ; `check` à la fin locale ; `over` → `showEnd`), `README.md` (lancement serveur, fin du hors-ligne).

#### Étape 3b — Le serveur annonce la défaite d'une partie poursuivie en mode infini — ✅
Défaut F2 relevé en F4 : `HeldGame` n'annonce `over` qu'une fois ; après victoire puis `endless`, la défaite n'est jamais annoncée et l'écran de fin ne s'affiche pas (RM-08, RM-10).
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-08] annonce la défaite d'une partie poursuivie en mode infini après la victoire` | `tests/application/online/heldGame.test.ts` | RM-08 |

**Production autorisée** : `src/application/online/heldGame.ts`.

#### Étape 3c — Le recalage ne rejoue ni message, ni son, ni effet — ✅
Écart bloquant relevé à l'audit F4 : `realign` rejoue des ticks par `world.step()`, leurs événements (`leak`, éliminations, tirs) restent dans `world.events` et `Game.stepSim()` les draine une seconde fois (toast, son, particules), contre RM-06 (« sans message »).
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-06] rend un monde recalé sans les événements des ticks rejoués` | `tests/application/online/realign.test.ts` | RM-06 |

**Production autorisée** : `src/application/online/realign.ts`.

#### Étape 3d — Le rythme du joueur garde la partie du serveur 15 ticks derrière lui — ✅
Défaut F2 relevé à la vérification manuelle F4 (2026-09-28) : `pace` pose `clock = tick + LAG_TICKS`, le monde du serveur rattrape exactement le tick du joueur ; le joueur, toujours 1 à 3 ticks derrière le temps réel, arrive « tardif » à chaque ordre, d'où un `drift` systématique (contre D4). Correction D10 : `pace` pose `clock = min(tick, borne)`, sans `LAG_TICKS`.
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-04] applique sans écart l'ordre d'un joueur qui suit le temps réel après un changement de rythme` | `tests/application/online/heldGame.test.ts` | RM-04 |
| 2 | Tests `[RM-10]` de `pace` existants (vitesse 2, pause, calage, borne) : attentes réécrites, monde 15 ticks derrière le tick annoncé | idem | RM-10 |

**Production autorisée** : `src/application/online/heldGame.ts`.

#### Étape 3e — Un instantané passé par le réseau en dernière vague continue à l'identique — ✅
Écart relevé à l'audit F4 (H11, reportée de F2) : `Infinity` (`nextWaveIn` en dernière vague, `remaining` d'un rejeton) devient `null` en JSON. Décision H5 : garder `null`, prouvé sans effet par un test. Pas de production attendue : test de garantie, gardé vert s'il résiste à une mutation (comme H1).
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[RM-04] continue à l'identique après un passage par JSON quand la dernière vague est lancée` | `tests/domain/model/snapshot.test.ts` | RM-04 |
| 2 | `[RM-04] continue à l'identique après un passage par JSON quand un rejeton vient de naître` (audit F4) | idem | RM-04 |

**Production autorisée** : aucune.

#### Étape 4 — Vérification — ✅
Pas de nouveau test. `npx tsc --noEmit` + `npm test` + vérification manuelle de l'étape 3.

### Éléments de code
- `application/online/protocol.ts` — `export function readClientMessage(raw: string): ClientMessage | null` — JSON valide, `t` connu, champs présents et typés, sinon `null`
- `server/main.ts` — point d'entrée Node, pas de logique de jeu : lit le message, appelle `Referee`, renvoie le `ServerMessage`
- `presentation/ServerLink.ts` — `export class ServerLink` — `connect(): Promise<void>` ; `send(msg: ClientMessage): void` ; `onMessage(fn: (msg: ServerMessage) => void)` ; `onLost(fn: () => void)` ; `close(): void` (fermeture volontaire, gestionnaires retirés — `newGame` ferme la liaison précédente)

### Hypothèses
- H1 — `aucune couche n'importe server` non écrit : chaque couche de la boucle `n'importe que` exclut déjà `server` ; `[RM-04]` vert au premier passage, gardé après preuve par mutation (`Date.now`, `Math.random`) — à valider par Pierre
- H2 — `open.previous` non relayé par `server/main.ts` : `ClientMessage` le type `string`, `OpenRequest` attend `{ id, token }`. À aligner (type + `readClientMessage` + test) en F5, quand le jeu l'envoie — à valider par Pierre
- H3 (audit F4) — `open` mal formé : `readClientMessage` vérifie `difficulty` et la forme de `MapDef` ; `server/main.ts` ferme la socket si le traitement d'un message lève (carte bien formée mais invalide), le jeu affiche alors le refus CU-01. Écarté : `open` portant un identifiant de carte résolu dans `MAPS` (changement de protocole) — à valider par Pierre
- H4 (vérification F4, 2026-09-28) — Vérification manuelle de l'étape 3 faite par navigateur piloté (Playwright headless, trames WebSocket observées) : CU-01, RM-01, RM-03, RM-06 (empreinte faussée), RM-08 (défaite), RM-10 / D5, `npm run dev`. Non joué : mode infini après une victoire réelle (30 vagues), couvert par le test de l'étape 3b. Refaite après la correction 3d : 0 `drift` sur 8 ordres légitimes — à valider par Pierre
- H5 (audit F4, 2026-09-28, Pierre) — H11 tranchée : `Infinity` devient `null` dans l'instantané échangé par WebSocket, sans effet. `nextWaveIn` n'est lu que si `canLaunchNext`, qu'on ne retrouve que par `continueEndless` (remis à 20) ; `remaining` d'un rejeton est recalculé par `updateMovement` avant `updateCombat`. Garanti par les tests de l'étape 3e. Mutation jouée : `restore` remet `nextWaveIn` à 0 quand il vaut `null` : test 1 rouge (vague lancée, partie divergente) ; `loadCreep` restaure `bounty: 0` : test 2 rouge (or 166 contre 168). Le préalable du test 2 prouve qu'un rejeton à `remaining: Infinity` est bien dans l'instantané.

---

## Lot F5 — Coupure et reprise côté jeu — ✅

### Intention
Le jeu gèle à la coupure avec décompte, se reconnecte seul, et propose « Reprendre la partie » après rechargement dans le même navigateur. **RM** : RM-07, RM-09 · **CU** : CU-03, CU-04

### Conception
| Point | Décision |
|-------|----------|
| Règles appliquées | ARCH-01, ARCH-02, ARCH-03 (reprise = `restore`, pas d'écriture dans `World`), ARCH-08 (overlay existant `openOverlay`) |
| Données | `localStorage` : `{ id, token }` de la partie en cours, effacé à la fin |
| Calcul pur | aucun (règles de délai et de jeton portées par `Referee`, F3) |
| Ordre du joueur | aucun |
| Coût par tick | hors `step()` |

### Étapes et tests

#### Étape 0 — Le serveur lit l'ancienne partie `{ id, token }` d'une ouverture — ✅
Ajoutée par `/implement-tdd` (H6 et H7 de F3 jamais soldées en F4).
| # | Test (`it`) | Fichier de test | RM |
|---|-------------|-----------------|----|
| 1 | `[CU-04] lit l'ancienne partie à abandonner d'une ouverture` | `tests/application/online/protocol.test.ts` | CU-04 |
| 2 | `[CU-04] rejette une ouverture dont l'ancienne partie est mal formée` | idem | CU-04 |

**Production autorisée** : `src/application/online/protocol.ts` (`open.previous: { id, token }`), `src/server/main.ts` (relaie `previous` à `referee.open` ; sur `resume`, gèle d'abord la partie encore tenue par une autre socket avec le même jeton — H7).

#### Étape 1 — Page ouverte : la partie se gèle, décompte, puis reprend ou se termine — ✅
_Code livré par `/implement-tdd` le 2026-09-28 (couverture unitaire : `referee.test.ts`, F3). Vérification manuelle ci-dessous : étape 3, à faire par Pierre._
Logique couverte par F3 (`referee.test.ts`, RM-07, CU-03). Vérification manuelle (serveur coupé puis relancé) :
- « Connexion perdue — 30 s » avec décompte, ni temps ni ordre ; nouvelle tentative seule.
- Retour dans le délai : reprise dans l'état du serveur.
- Délai écoulé : « La partie est terminée. », écran de fin, défaite par abandon.

**Production autorisée** : `src/presentation/Game.ts`, `src/presentation/ServerLink.ts` (reconnexion).

#### Étape 2 — Page rechargée : « Reprendre la partie » au même navigateur — ✅
_Code livré par `/implement-tdd` le 2026-09-28 (couverture unitaire : `referee.test.ts`, F3). Vérification manuelle ci-dessous : étape 3, à faire par Pierre._
Logique couverte par F3 (`referee.test.ts`, RM-09, CU-04). Vérification manuelle :
- Recharger moins de 30 s après → bouton « Reprendre la partie » ; reprise avec pause et vitesse d'avant.
- Plus de 30 s, ou autre navigateur → écran titre habituel.
- Nouvelle partie au lieu de reprendre → l'ancienne est abandonnée.
- Serveur redémarré (H2) → « La partie est terminée. », ni verdict ni record.

**Production autorisée** : `src/presentation/Game.ts` (`showStart`, `newGame` avec `previous`).

#### Étape 3 — Vérification — ✅
_2026-09-28 : vérifications des étapes 1 et 2 et de H2 automatisées (Playwright + Chromium headless, serveur réel, relais TCP coupé à la demande), 22/22 OK. Script hors dépôt, non versionné._
Pas de nouveau test. `npx tsc --noEmit` + `npm test` + vérifications manuelles des étapes 1 et 2.

### Éléments de code
- `presentation/Game.ts` (noms livrés, remplacent `showLost` / `resume` prévus — voir H3)
  - clé `PENDING_KEY = 'dedale.pending.v1'` : `{ id, token }` ; `loadPending()`, `savePending()`, `clearPending()`
  - gel : `onLost()` (overlay `'lost'`), `updateLost(dt: number)` (décompte, tentative toutes les ~2 s), `tryReconnect(): Promise<void>`
  - reprise : `handleResumeReply(link, reply)` → `applyResumed` / `applyAbandon` / `applyEnded` ; `showEndedOverlay()`
  - écran titre : `offerResume()` (`resumable`, liaison fermée dès la réponse), `addResumeButton(pending)` ; `requestResume(id, token)` ouvre une liaison neuve et envoie `resume`, commun au bouton et à `tryReconnect`
  - `attachLink(link)` factorise le branchement de la liaison entre lancement et reprise

### Hypothèses
- H1 — Étape 2 trouvée cochée ✅ sans code dans `Game.ts` (ni clé `localStorage`, ni `resumable`/`resume`) : repassée à ⬜ — à valider par Pierre
- H2 — H6 et H7 de F3 soldées ici (étape 0) plutôt qu'en F4 : `main.ts` et `protocol.ts` ajoutés à la production autorisée — à valider par Pierre
- H3 — `showLost` / `resume` éclatés en méthodes plus fines (voir `### Éléments de code`) ; l'écran « La partie est terminée. » réutilise l'overlay `'end'` — à valider par Pierre
- H4 — Décompte écoulé sans réponse du serveur : dernière tentative, puis « La partie est terminée. » (sans verdict, comme `ended`) — à valider par Pierre
- H5 — Après victoire puis mode infini, la clé est réécrite à l'ordre `endless` : la reprise après rechargement reste possible — à valider par Pierre
- H6 — Page déchargée (`pagehide`) : pas de pause automatique D5, sinon la reprise après rechargement revenait en pause ; une reprise en pause affiche l'écran de pause (trouvé en vérification) — à valider par Pierre
