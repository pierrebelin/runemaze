import type { MapDef } from '../../src/domain/model/types';

// Couloir horizontal fermé de rochers, une seule rangée franchissable.
// De gauche à droite : porte (E), portail (S), pierre runique 2, pierre runique 1.
// Une créature terrestre doit toucher la pierre 1 avant la pierre 2 : elle va
// donc de S vers 1 (en traversant 2 sans que ça compte), revient toucher 2,
// puis ressort par E.
// Coordonnées utiles : E=(1,1) S=(2,1) pierre2=(3,1) pierre1=(4,1).
export const MAP_CORRIDOR: MapDef = {
  id: 'corridor',
  name: 'Couloir des Deux Pierres',
  width: 6,
  height: 3,
  rows: ['######', '#ES21#', '######'],
};

// Champ ouvert à deux pierres runiques, avec des cases constructibles entre
// chaque étape (S, pierre 1, pierre 2, E) pour permettre plus tard de fermer
// un tronçon précis avec une tour.
// Deux pierres et une porte non alignées : un volant ne peut pas confondre
// la ligne droite pierre1→porte avec le trajet pierre1→pierre2→porte.
// Centres : pierre1=(3.5,2.5) pierre2=(6.5,2.5) porte=(4.5,4.5).
export const MAP_BENT_STONES: MapDef = {
  id: 'bent-stones',
  name: 'Pierres Décalées',
  width: 9,
  height: 5,
  rows: [
    '#########',
    '#S......#',
    '#..1..2.#',
    '#.......#',
    '####E####',
  ],
};

// Carte à goulets : chaque tronçon (S→1, 1→2, 2→E) passe par un passage
// constructible d'une case de large (2 de large exactement, l'emprise
// d'une tour) qui lui est propre, pour qu'une seule construction ferme ce
// tronçon et rien d'autre. Une poche en cul-de-sac (lignes 3-4, colonnes
// 12-15) sous la salle de la pierre 2 sert à isoler l'enfermement d'une
// créature du blocage général du chemin : le col (colonnes 12-13) ferme
// l'accès à la poche sans jamais faire partie du trajet emprunté par les
// autres créatures.
// Goulets (coin haut-gauche de la tour 2×2 qui ferme le tronçon) :
//   GATE_S1     = (5, 1)  ferme S → pierre 1 (seul passage)
//   GATE_12     = (10, 1) ferme pierre 1 → pierre 2 (seul passage)
//   GATE_2E     = (15, 1) ferme pierre 2 → E (seul passage)
//   POCKET2_NECK = (12, 3) ferme l'accès à la poche de la pierre 2
//                  (colonnes 12-15, ligne 4 ; tx entre 12 et 15, ty 4)
//   WITNESS     = (1, 1)  emplacement témoin, ne ferme rien
export const MAP_GATED_STONES: MapDef = {
  id: 'gated-stones',
  name: 'Pierres Verrouillées',
  width: 21,
  height: 6,
  rows: [
    '#####################',
    '#..S....1....2....E.#',
    '#..S....1....2....E.#',
    '############..#######',
    '############....#####',
    '#####################',
  ],
};

export const MAP_TWO_STONES: MapDef = {
  id: 'two-stones',
  name: 'Champ des Deux Pierres',
  width: 13,
  height: 7,
  rows: [
    '#############',
    '#S..1..2...E#',
    '#...........#',
    '#...........#',
    '#...........#',
    '#...........#',
    '#############',
  ],
};

// Boucle à deux couloirs de 2 cases de large entre le portail (S) et la pierre 1 :
// le couloir du haut (lignes 1-2) est le plus court, celui du bas (lignes 5-6, par
// les colonnes 1-2 et 8-9) le contourne. Une tour posée en (6, 1) ferme le couloir
// du haut sans fermer le passage : une créature déjà engagée dedans devrait faire
// demi-tour pour prendre le couloir du bas.
export const MAP_LOOP: MapDef = {
  id: 'loop',
  name: 'Boucle',
  width: 11,
  height: 8,
  rows: [
    '###########',
    '#SS......1#',
    '#SS......1#',
    '#..#####..#',
    '#..#####..#',
    '#.........#',
    '#EE.......#',
    '###########',
  ],
};

// Champ ouvert avec une plaque de glace (*) 2×2 sur le plus court chemin
// portail → pierre 1 (ligne 3). Glace : praticable, non constructible.
// Coordonnées utiles : S=(1,3) pierre1=(9,3) plaque=(5..6, 3..4).
//   TOWER_ON_ICE = (4, 3)  tour 2×2 dont la colonne 5 recouvre la plaque
//   WALL_ON_ICE  = (6, 2)  mur dont la case (6,3) recouvre la plaque
//   TOWER_BESIDE = (3, 3)  tour 2×2 juste contre la plaque (colonnes 3-4), ne ferme rien
export const MAP_ICE: MapDef = {
  id: 'ice',
  name: 'Plaque de Glace',
  width: 11,
  height: 7,
  rows: [
    '###########',
    '#.........#',
    '#.........#',
    '#S...**..1#',
    '#....**...#',
    '#........E#',
    '###########',
  ],
};

// Champ ouvert avec deux cristaux (+) voisins sur le trajet portail → pierre 1 (ligne 4).
// Cristal : praticable, constructible ; une tour dont l'emprise le recouvre gagne en portée.
// Coordonnées utiles : S=(1,4) pierre1=(28,4) cristaux=(5,3) et (5,4).
// Tour sur cristal : (5, 3), 2×2, la colonne 5 recouvre les deux cristaux.
// Tour hors cristal : (5, 6), même colonne, aucun cristal sous l'emprise.
export const MAP_CRYSTAL: MapDef = {
  id: 'crystal',
  name: 'Veine de Cristal',
  width: 30,
  height: 10,
  rows: [
    '##############################',
    '#............................#',
    '#............................#',
    '#....+.......................#',
    '#S...+......................1#',
    '#............................#',
    '#............................#',
    '#............................#',
    '#...........................E#',
    '##############################',
  ],
};

// Portail (S) et pierre 1 séparés par une colonne de rochers : aucun passage entre eux.
export const MAP_WALLED: MapDef = {
  id: 'walled',
  name: 'Mur Infranchissable',
  width: 9,
  height: 3,
  rows: ['#########', '#S.#.1.E#', '#########'],
};

// Légende :
//   .  terrain constructible     #  rocher (infranchissable)
//   S  portail d'apparition      1…9  pierres runiques (passage obligatoire, dans l'ordre)
//   E  porte de sortie           ~  chemin (franchissable, non constructible)
//
// Les créatures terrestres vont de S à 1, puis de 1 à E : le même champ est
// traversé deux fois, ce qui récompense les labyrinthes pensés pour les deux
// trajets et les tours de zone placées au croisement.
export const MAP_CROSSING: MapDef = {
  id: 'crossing',
  name: 'Le Gué des Runes',
  width: 36,
  height: 24,
  rows: [
    '####################################',
    '#SSS~..............................#',
    '#SSS~..............................#',
    '#SSS~..............................#',
    '#SSS~.......................#......#',
    '#..................................#',
    '#................##................#',
    '#................#.................#',
    '#..................................#',
    '#..................................#',
    '#........#.....................~111#',
    '#..............................~111#',
    '#.....................#........~111#',
    '#..............................~111#',
    '#..................................#',
    '#..................................#',
    '#...........##.....................#',
    '#............#...........##........#',
    '#.........................#........#',
    '#EEE~..............................#',
    '#EEE~..............................#',
    '#EEE~..............................#',
    '#EEE~..............................#',
    '####################################',
  ],
};

// Portail au centre, pierre unique dans un coin, porte dans le coin opposé.
// Des rochers épars en arc autour du portail suggèrent une spirale sans
// jamais fermer le champ (une seule pierre : un aller simple S → 1 → E).
export const MAP_SPIRAL: MapDef = {
  id: 'spiral',
  name: 'La Spirale',
  width: 36,
  height: 24,
  rows: [
    '####################################',
    '#111...............................#',
    '#111............#..#...............#',
    '#111.........#........#............#',
    '#..................................#',
    '#..........#............#..........#',
    '#..............#..#.#..............#',
    '#........#....#......#....#........#',
    '#..................................#',
    '#...........#..........#...........#',
    '#.......#.......SSS....#...#.......#',
    '#...............SSS................#',
    '#...............SSS................#',
    '#......................#...#.......#',
    '#..................................#',
    '#......................#...........#',
    '#....................#....#........#',
    '#...................#..............#',
    '#.................#.....#..........#',
    '#..................................#',
    '#............#........#.........EEE#',
    '#...............#..#............EEE#',
    '#...............................EEE#',
    '####################################',
  ],
};

// Portail à gauche, pierre 1 en haut à droite, pierre 2 en bas au centre,
// porte en bas à gauche : le champ est traversé trois fois (S→1, 1→2, 2→E).
export const MAP_SEALS: MapDef = {
  id: 'seals',
  name: 'Les Deux Sceaux',
  width: 40,
  height: 24,
  rows: [
    '########################################',
    '#..................................111.#',
    '#..................................111.#',
    '#..................................111.#',
    '#...................#..................#',
    '#.........#............................#',
    '#.............#...........#............#',
    '#......................................#',
    '#.....................#.......#........#',
    '#......................................#',
    '#SSS............#......................#',
    '#SSS...................................#',
    '#SSS................#..................#',
    '#......................................#',
    '#.......#.................#............#',
    '#.............#........................#',
    '#...............................#......#',
    '#......................................#',
    '#.........#............................#',
    '#......................................#',
    '#EEE..............222..................#',
    '#EEE..............222..................#',
    '#EEE..............222..................#',
    '########################################',
  ],
};

// Mur de rochers (colonne 10) coupant le champ en deux, ouvert seulement par la
// ligne 10 (en bas). Un trou de ver relie les deux faces du mur : bout `a` à
// l'ouest, bout `A` à l'est, chacun un carré 2×2 plaqué contre le mur.
// Le portail (ouest) et la pierre 1 (est) sont séparés par le mur : le trou de
// ver raccourcit nettement le tronçon portail → pierre 1 (détour par le bas sinon).
// Coordonnées utiles : S=(1..2,1..2) a=(8..9,4..5) A=(11..12,4..5) pierre1=(17..18,4..5)
//   E=(17..18,9..10) passage du mur=(10,10)
export const MAP_WORMHOLE: MapDef = {
  id: 'wormhole',
  name: 'Trou de Ver',
  width: 20,
  height: 12,
  rows: [
    '####################',
    '#SS.......#........#',
    '#SS.......#........#',
    '#.........#........#',
    '#.......aa#AA....11#',
    '#.......aa#AA....11#',
    '#.........#........#',
    '#.........#........#',
    '#.........#........#',
    '#.........#......EE#',
    '#................EE#',
    '####################',
  ],
};

// Même mur et même trou de ver, mais la porte est à l'ouest : le tronçon
// portail → pierre 1 traverse de `a` vers `A`, le tronçon pierre 1 → porte de `A` vers `a`.
// Coordonnées utiles : S=(1..2,1..2) a=(8..9,4..5) A=(11..12,4..5) pierre1=(17..18,4..5) E=(1..2,9..10)
export const MAP_WORMHOLE_BOTH: MapDef = {
  id: 'wormhole-both',
  name: 'Trou de Ver à Double Sens',
  width: 20,
  height: 12,
  rows: [
    '####################',
    '#SS.......#........#',
    '#SS.......#........#',
    '#.........#........#',
    '#.......aa#AA....11#',
    '#.......aa#AA....11#',
    '#.........#........#',
    '#.........#........#',
    '#.........#........#',
    '#EE.......#........#',
    '#EE................#',
    '####################',
  ],
};

// Champ ouvert sans mur : le bout `a` barre la ligne droite portail → pierre 1,
// l'autre bout `A` est collé au bord gauche, loin derrière le portail.
// Vérification à la main (8 directions, diagonale √2) : le contournement de `a`
// ne coûte qu'une petite diagonale en plus. Passer par le trou de ver imposerait
// de marcher du portail (x=10) jusqu'à `A` (x=3), soit ≥ 7 pas, puis de ressortir
// en x=13 ou 16 : bien plus cher. Tronçon pierre 1 → porte (côté est, sans rapport
// avec `A`) : entrer par `a` puis ressortir à l'ouest éloigne de la porte, rien gagné.
// Coordonnées utiles : S=(10..11,3..4) a=(14..15,3..4) A=(1..2,3..4) pierre1=(21..22,3..4) E=(21..22,6..7)
export const MAP_WORMHOLE_USELESS: MapDef = {
  id: 'wormhole-useless',
  name: 'Trou de Ver Inutile',
  width: 24,
  height: 9,
  rows: [
    '########################',
    '#......................#',
    '#......................#',
    '#AA.......SS..aa.....11#',
    '#AA.......SS..aa.....11#',
    '#......................#',
    '#....................EE#',
    '#....................EE#',
    '########################',
  ],
};

// Mur de rochers (colonne 10) ouvert par un passage de 2 cases (lignes 9-10) que
// la pose d'une tour en (10, 9) referme : seul le trou de ver relie alors
// l'ouest (`a`) à l'est (`A`). Une alcôve sans issue (colonnes 15-18, lignes 9-10)
// est fermable par une tour en (15, 9) ; la porte est en haut à droite.
// Coordonnées utiles : S=(1..2,1..2) a=(8..9,4..5) A=(11..12,4..5) pierre1=(17..18,4..5) E=(17..18,1..2)
export const MAP_WORMHOLE_GAP: MapDef = {
  id: 'wormhole-gap',
  name: 'Trou de Ver et Passage',
  width: 20,
  height: 12,
  rows: [
    '####################',
    '#SS.......#......EE#',
    '#SS.......#......EE#',
    '#.........#........#',
    '#.......aa#AA....11#',
    '#.......aa#AA....11#',
    '#.........#........#',
    '#.........#........#',
    '#.........#....#####',
    '#..................#',
    '#..................#',
    '####################',
  ],
};

// Même mur et même trou de ver, mais la porte est dans l'alcôve du bas à droite
// (colonnes 15-18, lignes 9-10), qu'une tour en (15, 9) isole de tout trajet.
// Coordonnées utiles : S=(1..2,1..2) a=(8..9,4..5) A=(11..12,4..5) pierre1=(17..18,4..5) E=(17..18,9..10)
export const MAP_WORMHOLE_SEALABLE_GATE: MapDef = {
  id: 'wormhole-sealable-gate',
  name: 'Trou de Ver et Porte Isolable',
  width: 20,
  height: 12,
  rows: [
    '####################',
    '#SS.......#........#',
    '#SS.......#........#',
    '#.........#........#',
    '#.......aa#AA....11#',
    '#.......aa#AA....11#',
    '#.........#........#',
    '#.........#........#',
    '#.........#....#####',
    '#................EE#',
    '#................EE#',
    '####################',
  ],
};

// Comme `MAP_WORMHOLE`, mais le mur (colonne 10) est plein : le bout `A` et tout
// le côté est sont une poche que seul le trou de ver relie au portail.
// Coordonnées utiles : S=(1..2,1..2) a=(8..9,4..5) A=(11..12,4..5)
export const MAP_WORMHOLE_POCKET: MapDef = {
  id: 'wormhole-pocket',
  name: 'Trou de Ver et Poche',
  width: 20,
  height: 12,
  rows: [
    '####################',
    '#SS.......#........#',
    '#SS.......#........#',
    '#.........#........#',
    '#.......aa#AA....11#',
    '#.......aa#AA....11#',
    '#.........#........#',
    '#.........#........#',
    '#.........#........#',
    '#.........#......EE#',
    '#.........#......EE#',
    '####################',
  ],
};

// Le bout `A` est dans une alcôve de roc (colonnes 12-13, lignes 1-2) dont seul le
// côté sud est libre : une tour en (12, 3) en ferme les deux cases. Le trajet à pied
// reste ouvert par le bas du mur (lignes 9-10).
// Coordonnées utiles : S=(1..2,1..2) a=(8..9,4..5) A=(12..13,1..2) pierre1=(17..18,4..5) E=(17..18,9..10)
export const MAP_WORMHOLE_NOOK: MapDef = {
  id: 'wormhole-nook',
  name: 'Trou de Ver en Alcôve',
  width: 20,
  height: 12,
  rows: [
    '####################',
    '#SS.......##AA#....#',
    '#SS.......##AA#....#',
    '#.........#........#',
    '#.......aa#......11#',
    '#.......aa#......11#',
    '#.........#........#',
    '#.........#........#',
    '#.........#........#',
    '#................EE#',
    '#................EE#',
    '####################',
  ],
};

// Le bout `A` est dans une poche de roc (colonnes 12-15, lignes 1-5) ouverte au sud
// sur 4 cases : deux tours, en (12, 5) puis (14, 5), la ferment sans fermer le trajet.
// Coordonnées utiles : S=(1..2,1..2) a=(8..9,4..5) A=(12..13,1..2) pierre1=(17..18,4..5) E=(17..18,9..10)
export const MAP_WORMHOLE_RING: MapDef = {
  id: 'wormhole-ring',
  name: 'Trou de Ver en Poche',
  width: 20,
  height: 12,
  rows: [
    '####################',
    '#SS.......##AA..#..#',
    '#SS.......##AA..#..#',
    '#.........##....#..#',
    '#.......aa##....#11#',
    '#.......aa##....#11#',
    '#.........#........#',
    '#.........#........#',
    '#.........#........#',
    '#................EE#',
    '#................EE#',
    '####################',
  ],
};

// Le bout `A` est dans une salle de roc close (colonnes 11-14, lignes 1-6) sans aucun
// repère : portail, pierre et porte sont tous ailleurs. Seul le trou de ver y mène.
// Coordonnées utiles : S=(1..2,1..2) a=(8..9,4..5) A=(11..12,1..2) pierre1=(17..18,1..2) E=(17..18,9..10)
export const MAP_WORMHOLE_ISLAND: MapDef = {
  id: 'wormhole-island',
  name: 'Trou de Ver en Salle Close',
  width: 20,
  height: 12,
  rows: [
    '####################',
    '#SS.......#AA..#.11#',
    '#SS.......#AA..#.11#',
    '#.........#....#...#',
    '#.......aa#....#...#',
    '#.......aa#....#...#',
    '#.........#....#...#',
    '#.........######...#',
    '#.........#........#',
    '#.........#......EE#',
    '#.........#......EE#',
    '####################',
  ],
};
