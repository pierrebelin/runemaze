# Éther, glaneurs et Porte

> En duel, une seconde ressource, l'éther, produite par des glaneurs achetés en or, paie les envois et les améliorations de la Porte. Chaque dépense d'éther augmente le revenu. L'or défend, l'éther attaque ou investit : chaque pièce d'or devient un choix entre tenir la vague et préparer les suivantes.

## 1. Contexte

L'envoi de créatures (`todo/envoi-de-creatures/SPEC.md`) se paie en or, la même monnaie que la défense, et un plafond de revenu freine l'avance précoce. Les cartes *Legion TD* de Warcraft III ont montré qu'une seconde ressource, produite par des travailleurs, crée un dilemme plus riche : investir maintenant ou défendre maintenant. Cette spec remplace la monnaie et le plafond des envois, et ajoute la Porte comme seconde dépense d'éther, sans rien donner à l'adversaire.

## 2. Vocabulaire

| Terme | Définition |
|---|---|
| Éther | Seconde ressource du duel. Paie les envois et les améliorations de la Porte. |
| Glaneur | Producteur d'éther acheté en or. N'apparaît pas sur la carte, seulement comme compteur. |
| Porte | Porte de sortie de la carte, améliorable avec de l'éther. Chaque joueur a la sienne. |
| Tir | Amélioration de la Porte : elle tire sur les créatures proches de la sortie. |
| Remparts | Amélioration de la Porte : le joueur regagne des vies à chaque fin de vague. |

## 3. Vue d'ensemble

```mermaid
flowchart LR
  Or -->|achat (CU-01)| Glaneurs
  Glaneurs -->|production continue (RM-03)| Ether[Éther]
  Ether -->|envoi (CU-02)| Revenu
  Ether -->|amélioration (CU-03)| Revenu
  Ether -->|envoi| Adversaire[Vague adverse]
  Revenu -->|fin de vague (RM-05)| Or
  Or -->|tours| Defense[Défense]
```

## 4. Cas d'usage

### CU-01 — Acheter un glaneur
**Acteur** joueur en duel · **Intention** produire de l'éther pour les vagues suivantes.
**Scénario nominal :**
1. Voit son nombre de glaneurs, son éther et le prix d'un glaneur.
2. Achète un glaneur : l'or est débité, le compteur augmente de 1.
3. Le glaneur produit de l'éther dès l'achat (RM-03).

**Refus :** état inchangé, message « Pas assez d'or. »

### CU-02 — Envoyer une créature contre de l'éther
**Acteur** joueur en duel · **Intention** affaiblir l'adversaire et augmenter son revenu.
**Scénario nominal :** celui de CU-01 de l'envoi de créatures, avec le prix en éther (RM-04) et sans plafond de revenu (RM-06).
**Refus :** état inchangé, message :
- éther insuffisant : « Pas assez d'éther. »
- aucune vague à venir : « Plus aucune vague à venir. » (inchangé)

### CU-03 — Améliorer la Porte
**Acteur** joueur en duel · **Intention** sécuriser sa défense et augmenter son revenu sans nourrir l'adversaire.
**Scénario nominal :**
1. Ouvre la Porte : voit le niveau actuel de Tir et de Remparts, le prix et le gain de revenu du niveau suivant.
2. Achète un niveau de Tir ou de Remparts.
3. L'éther est débité, le revenu augmente (RM-08), l'effet du nouveau niveau s'applique aussitôt (RM-09, RM-10).

**Refus :** état inchangé, message :
- éther insuffisant : « Pas assez d'éther. »
- niveau maximal atteint : « Niveau maximal atteint. »

### CU-04 — Observer l'économie adverse
**Acteur** joueur en duel · **Intention** lire la stratégie de l'adversaire.
**Scénario nominal :** l'encart adverse affiche son revenu, son nombre de glaneurs et ses niveaux de Tir et de Remparts, mis à jour en direct (RM-11).

## 5. Règles métier

### RM-01 — Duel seulement
- Éther, glaneurs et améliorations de la Porte n'existent qu'en duel. Le solo est inchangé : pas d'éther, Porte sans amélioration, intérêts à 4 %. · **Origine** choix de design · **Concerne** transverse

### RM-02 — Départ à zéro
- Chaque joueur commence le duel avec 0 glaneur, 0 éther, 0 revenu, Tir et Remparts au niveau 0. · **Origine** choix de design · **Concerne** CU-01

### RM-03 — Production continue
- Chaque glaneur produit 1 éther toutes les 5 s de jeu, à partir de son achat, pendant la préparation comme pendant les vagues. La production suit la vitesse de jeu et s'arrête en pause. · **Origine** *Legion TD* (1 toutes les 10 s, rythme ramené à des vagues deux fois plus courtes) · **Concerne** CU-01
- Le nombre de glaneurs n'est pas limité. Un glaneur ne se revend pas.

### RM-04 — Envois payés en éther
- Un envoi se paie en éther seulement, au prix de la section 6. L'or n'est plus accepté. · **Origine** *Legion TD* · **Concerne** CU-02
- Remplace la règle de prix en or de l'envoi de créatures (section 6 de sa spec).

### RM-05 — Revenu en fin de vague
- Inchangé : en duel, chaque fin de vague verse prime + revenu en or, sans intérêts. · **Origine** comportement existant (envoi de créatures, RM-02) · **Concerne** transverse

### RM-06 — Revenu sans plafond
- Après une dépense d'éther, revenu = revenu + gain de la dépense. Aucun plafond. Le revenu ne baisse jamais. · **Origine** choix de design (le débit d'éther freine déjà l'avance) · **Concerne** CU-02, CU-03
- Remplace RM-03 de l'envoi de créatures.

### RM-07 — Fuite d'un envoi
- Inchangé : un envoi qui fuit coûte des vies au défenseur et ne rapporte rien à l'envoyeur. · **Origine** choix de design · **Concerne** CU-02

### RM-08 — Prix croissant de la Porte
- Le niveau N de Tir ou de Remparts coûte `12 + 4 × (N − 1)` éther et augmente le revenu d'un quart de ce prix. Les deux améliorations ont chacune leur propre niveau. · **Origine** *Legion TD* (le roi rapporte autant qu'un envoi), prix croissant par choix de design · **Concerne** CU-03
- **Exemple :** Tir au niveau 2, achat du niveau 3 : 20 éther, revenu +5.

### RM-09 — Tir
- Au niveau N ≥ 1, la Porte tire une fois par seconde sur la créature la plus proche, au sol ou volante, à 4 cases au plus du centre de la porte. Dégâts Chaos : `15 × N`. Une créature tuée par la Porte rapporte sa prime au défenseur. Au niveau 0, la Porte ne tire pas. · **Origine** *Legion TD* (le roi frappe les créatures qui fuient) · **Concerne** CU-03

### RM-10 — Remparts
- À chaque fin de vague sur sa carte, le joueur regagne autant de vies que le niveau de Remparts, sans dépasser ses vies de départ. · **Origine** *Legion TD* (régénération du roi) · **Concerne** CU-03
- **Exemple :** Vétéran (21 vies de départ), Remparts 3, 19 vies en fin de vague : 21 vies, pas 22.

### RM-11 — Économie adverse visible, sauf l'éther
- Revenu, nombre de glaneurs, niveaux de Tir et de Remparts de l'adversaire sont visibles. Son éther en réserve ne l'est jamais. · **Origine** choix de design (lecture de l'adversaire, gros envoi surprise possible) · **Concerne** CU-04

### RM-12 — Partie rejouable
- Même graine + mêmes ordres des deux joueurs, achats de glaneurs et de niveaux compris = même duel. · **Origine** comportement existant · **Concerne** transverse

## 6. Chiffres

| Élément | Valeur | Remarque |
|---|---|---|
| Glaneur | 50 or | *Legion TD* : 50 or |
| Production | 1 éther / 5 s par glaneur | ≈ 5,5 éther par vague ; un glaneur se rembourse en ≈ 8 vagues |
| Revenu, éther et glaneurs de départ | 0 | |
| Plafond de revenu | aucun | supprimé |

| Envoi | Éther | Revenu | Ratio | Rôle |
|---|---|---|---|---|
| Rat des marais | 10 | +3 | 30 % | revenu |
| Loup gris | 16 | +4 | 25 % | revenu |
| Maraudeur | 24 | +6 | 25 % | revenu |
| Harpie (volante) | 30 | +6 | 20 % | puissance |
| Golem de pierre | 50 | +10 | 20 % | puissance |
| Spectre (immunisé à la magie) | 60 | +12 | 20 % | puissance |

| Niveau de Porte | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Prix (éther) | 12 | 16 | 20 | 24 | 28 | 32 | 36 | 40 | 44 | 48 |
| Revenu | +3 | +4 | +5 | +6 | +7 | +8 | +9 | +10 | +11 | +12 |

| Amélioration | Niveau max | Effet au niveau N | Coût total au max |
|---|---|---|---|
| Tir | 10 | 15 × N dégâts Chaos, 1 tir/s, portée 4 cases | 300 éther |
| Remparts | 5 | +N vies par fin de vague, plafonné aux vies de départ | 100 éther |

## 8. Hors périmètre

| Exclusion | Raison |
|---|---|
| Jeu en équipe, Porte et vies partagées | plus tard, d'abord en coopération à 2 contre le jeu |
| Bâtisseurs | spec séparée |
| Prime d'un envoi qui fuit reversée à l'envoyeur | choix de design : les vies perdues suffisent |
| Revente de glaneurs, nombre maximal de glaneurs | simple d'abord ; à revoir si l'équilibrage l'exige |
| Glaneurs visibles sur la carte | simple compteur |
| Sort actif de la Porte | deux améliorations suffisent |

## 9. Hypothèses

| # | Hypothèse | À valider par |
|---|---|---|
| H1 | Le panneau d'envois (touche `T`) accueille aussi l'achat de glaneurs et les améliorations de la Porte, en deux onglets de plus. | Pierre |
| H2 | Le Tir de la Porte ne gêne pas la construction : la porte reste une case non constructible, comme aujourd'hui. | Pierre |
| H3 | Le joueur qui envoie gagne le duel en Recrue sur trois graines et en Vétéran sur au moins deux, avec ces chiffres (même critère que l'hypothèse H4 de l'envoi de créatures). | test d'équilibrage |
