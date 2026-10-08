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
