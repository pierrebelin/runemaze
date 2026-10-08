import type { TowerDef } from '../model/types';

// Arbre technologique. Chaque tour de base (niveau 1) se divise en deux
// branches au niveau 2, chacune avec une évolution finale au niveau 3.
// Le mur de pierre sert à bâtir le labyrinthe à bas prix et peut être
// transformé plus tard en n'importe quelle tour de niveau 1.

const T: TowerDef[] = [
  {
    id: 'wall', name: 'Mur de pierre', family: 'wall', tier: 0, cost: 3,
    desc: "Bloc de labyrinthe bon marché. N'attaque pas, mais peut devenir n'importe quelle tour de base.",
    upgrades: ['archer', 'cannon', 'frost', 'storm', 'venom', 'pylon', 'guard', 'bramble', 'gong', 'anvil', 'dispeller', 'brazier', 'hearth', 'ossuary', 'altar', 'crossbow', 'counter'],
  },

  // Garde et Ronces : attaque de zone instantanée, frappe tout le sol à portée.
  {
    id: 'guard', name: 'Garde', family: 'archer', tier: 1, cost: 15,
    desc: 'Frappe toutes les créatures au sol à sa portée, sans les arrêter.',
    attack: { type: 'normal', dmg: [14, 18], cooldown: 0.9, range: 1.5, projectileSpeed: 0, targets: 'ground', area: true },
    upgrades: ['champion', 'standard'],
  },
  {
    id: 'champion', name: 'Champion', family: 'archer', tier: 3, cost: 45,
    desc: 'Frappe toutes les créatures au sol à sa portée, bien plus fort.',
    attack: { type: 'normal', dmg: [45, 55], cooldown: 0.9, range: 1.5, projectileSpeed: 0, targets: 'ground', area: true },
    upgrades: [],
  },
  {
    id: 'standard', name: 'Porte-étendard', family: 'archer', tier: 3, cost: 45,
    desc: 'Frappe toutes les créatures au sol à sa portée. Les tours à 3 cases infligent 20 % de dégâts en plus (les auras ne se cumulent pas).',
    attack: { type: 'normal', dmg: [20, 24], cooldown: 0.9, range: 1.5, projectileSpeed: 0, targets: 'ground', area: true },
    aura: { kind: 'damage', pct: 0.2, radius: 3 },
    upgrades: [],
  },
  {
    id: 'bramble', name: 'Ronces', family: 'venom', tier: 1, cost: 8,
    desc: 'Blesse toutes les créatures au sol à sa portée, sans les arrêter.',
    attack: { type: 'normal', dmg: [6, 6], cooldown: 1, range: 2, projectileSpeed: 0, targets: 'ground', area: true },
    upgrades: ['briar', 'mothertorn'],
  },
  {
    id: 'briar', name: 'Roncier', family: 'venom', tier: 3, cost: 30,
    desc: 'Empoisonne : 8 dégâts par seconde pendant 4 s, cumulable 3 fois, sur tout le sol à portée.',
    attack: { type: 'normal', dmg: [20, 20], cooldown: 1, range: 2, projectileSpeed: 0, targets: 'ground', area: true, poison: { dps: 8, duration: 4, maxStacks: 3 } },
    upgrades: [],
  },
  {
    id: 'mothertorn', name: 'Épine-mère', family: 'venom', tier: 3, cost: 30,
    desc: 'Ralentit de 20 % tout le sol à portée.',
    attack: { type: 'normal', dmg: [14, 14], cooldown: 1, range: 2, projectileSpeed: 0, targets: 'ground', area: true, slow: { pct: 0.2, duration: 2 } },
    upgrades: [],
  },

  // Gong : étourdit tout ce qui est à portée, sol et air.
  {
    id: 'gong', name: 'Gong', family: 'frost', tier: 1, cost: 20,
    desc: 'Onde de choc magique : étourdit 0,5 s toutes les créatures à portée, sol et air.',
    attack: { type: 'magic', dmg: [10, 10], cooldown: 4, range: 2.5, projectileSpeed: 0, targets: 'both', area: true, stun: { duration: 0.5 } },
    upgrades: ['greatgong', 'chime'],
  },
  {
    id: 'greatgong', name: 'Grand gong', family: 'frost', tier: 3, cost: 50,
    desc: 'Onde de choc magique : étourdit 0,8 s toutes les créatures à portée, sol et air.',
    attack: { type: 'magic', dmg: [30, 30], cooldown: 3.5, range: 3, projectileSpeed: 0, targets: 'both', area: true, stun: { duration: 0.8 } },
    upgrades: [],
  },
  {
    id: 'chime', name: 'Carillon', family: 'frost', tier: 3, cost: 50,
    desc: 'Étourdit 0,4 s et ralentit de 30 % toutes les créatures à portée, sol et air.',
    attack: { type: 'magic', dmg: [20, 20], cooldown: 4, range: 2.5, projectileSpeed: 0, targets: 'both', area: true, stun: { duration: 0.4 }, slow: { pct: 0.3, duration: 2 } },
    upgrades: [],
  },

  // Enclume : aura de cadence, les tours voisines tirent plus vite.
  {
    id: 'anvil', name: 'Enclume', family: 'cannon', tier: 1, cost: 20,
    desc: 'Les tours à 3 cases tirent 10 % plus vite (les auras ne se cumulent pas). Sol uniquement.',
    attack: { type: 'siege', dmg: [16, 20], cooldown: 1.2, range: 3.5, projectileSpeed: 9, targets: 'ground' },
    aura: { kind: 'attackSpeed', pct: 0.1, radius: 3 },
    upgrades: ['furnace', 'triphammer'],
  },
  {
    id: 'furnace', name: 'Haut fourneau', family: 'cannon', tier: 3, cost: 50,
    desc: 'Les tours à 3 cases tirent 25 % plus vite (les auras ne se cumulent pas). Sol uniquement.',
    attack: { type: 'siege', dmg: [30, 36], cooldown: 1.2, range: 3.5, projectileSpeed: 9, targets: 'ground' },
    aura: { kind: 'attackSpeed', pct: 0.25, radius: 3 },
    upgrades: [],
  },
  {
    id: 'triphammer', name: 'Marteau-pilon', family: 'cannon', tier: 3, cost: 50,
    desc: 'Coups de siège lourds avec dégâts de zone. Sol uniquement.',
    attack: { type: 'siege', dmg: [70, 85], cooldown: 1.2, range: 3, projectileSpeed: 9, targets: 'ground', splash: { radius: 1.5, falloff: 0.5 } },
    upgrades: [],
  },

  // Archers : perçant, touche le sol et l'air.
  {
    id: 'archer', name: "Tour d'archers", family: 'archer', tier: 1, cost: 10,
    desc: 'Tirs rapides et perçants. Touche les volants. Efficace contre les armures légères.',
    attack: { type: 'pierce', dmg: [7, 9], cooldown: 0.8, range: 4.5, projectileSpeed: 16, targets: 'both' },
    upgrades: ['sniper', 'volley'],
  },
  {
    id: 'sniper', name: 'Tour de guet', family: 'archer', tier: 2, cost: 40,
    desc: 'Longue portée, tirs lourds et coups critiques.',
    attack: { type: 'pierce', dmg: [40, 50], cooldown: 1.5, range: 7.5, projectileSpeed: 26, targets: 'both', crit: { chance: 0.2, mult: 2.5 } },
    upgrades: ['hawkeye', 'ballista', 'frostarrow', 'thunderarrow', 'stinger', 'darkarrows', 'bountyhunter'],
  },
  {
    id: 'hawkeye', name: 'Œil du faucon', family: 'archer', tier: 3, cost: 120,
    desc: 'Portée immense. Un quart des tirs infligent le triple de dégâts.',
    attack: { type: 'pierce', dmg: [150, 180], cooldown: 1.5, range: 9.5, projectileSpeed: 32, targets: 'both', crit: { chance: 0.25, mult: 3 } },
    upgrades: [],
  },
  {
    id: 'volley', name: 'Tour à volées', family: 'archer', tier: 2, cost: 35,
    desc: 'Tire sur trois cibles à la fois.',
    attack: { type: 'pierce', dmg: [12, 15], cooldown: 0.7, range: 5, projectileSpeed: 18, targets: 'both', multishot: 3 },
    upgrades: ['arrowstorm', 'ballista', 'frostarrow', 'thunderarrow', 'stinger', 'darkarrows', 'bountyhunter'],
  },
  {
    id: 'arrowstorm', name: 'Pluie de flèches', family: 'archer', tier: 3, cost: 110,
    desc: 'Cinq flèches par salve, cadence élevée.',
    attack: { type: 'pierce', dmg: [30, 36], cooldown: 0.5, range: 5.5, projectileSpeed: 20, targets: 'both', multishot: 5 },
    upgrades: [],
  },

  // Canons : siège, zone, sol uniquement (sauf la branche anti-aérienne).
  {
    id: 'cannon', name: 'Canon', family: 'cannon', tier: 1, cost: 20,
    desc: 'Boulets à dégâts de zone. Sol uniquement. Redoutable contre les golems fortifiés.',
    attack: { type: 'siege', dmg: [18, 24], cooldown: 1.5, range: 4, projectileSpeed: 9, targets: 'ground', splash: { radius: 1.3, falloff: 0.5 } },
    upgrades: ['mortar', 'flak'],
  },
  {
    id: 'mortar', name: 'Mortier', family: 'cannon', tier: 2, cost: 50,
    desc: 'Grande portée et large zone d’impact.',
    attack: { type: 'siege', dmg: [55, 70], cooldown: 2.2, range: 6.5, projectileSpeed: 8, targets: 'ground', splash: { radius: 2, falloff: 0.5 } },
    upgrades: ['bombard', 'ballista', 'cryoshell', 'teslacannon', 'plagueshell', 'firebomb', 'coincannon'],
  },
  {
    id: 'bombard', name: 'Bombarde', family: 'cannon', tier: 3, cost: 140,
    desc: 'Chaque obus ravage un groupe entier.',
    attack: { type: 'siege', dmg: [170, 210], cooldown: 2.3, range: 7, projectileSpeed: 9, targets: 'ground', splash: { radius: 2.5, falloff: 0.45 } },
    upgrades: [],
  },
  {
    id: 'flak', name: 'Canon anti-aérien', family: 'cannon', tier: 2, cost: 45,
    desc: 'Éclats perçants contre les volants uniquement.',
    attack: { type: 'pierce', dmg: [45, 55], cooldown: 1, range: 6, projectileSpeed: 18, targets: 'air', splash: { radius: 1.5, falloff: 0.5 } },
    upgrades: ['skybattery', 'ballista', 'cryoshell', 'teslacannon', 'plagueshell', 'firebomb', 'coincannon'],
  },
  {
    id: 'skybattery', name: 'Batterie céleste', family: 'cannon', tier: 3, cost: 130,
    desc: 'Rien ne vole longtemps à sa portée.',
    attack: { type: 'pierce', dmg: [150, 180], cooldown: 0.9, range: 7.5, projectileSpeed: 22, targets: 'air', splash: { radius: 2, falloff: 0.5 } },
    upgrades: [],
  },

  // Givre : magique, ralentit. Sans effet sur les immunisés à la magie.
  {
    id: 'frost', name: 'Tour de givre', family: 'frost', tier: 1, cost: 16,
    desc: 'Ralentit sa cible de 30 %. Magique : inefficace contre les spectres.',
    attack: { type: 'magic', dmg: [6, 8], cooldown: 1, range: 4, projectileSpeed: 12, targets: 'both', slow: { pct: 0.3, duration: 2 } },
    upgrades: ['glacier', 'iceshard'],
  },
  {
    id: 'glacier', name: 'Glacier', family: 'frost', tier: 2, cost: 45,
    desc: 'Ralentissement de zone de 40 %.',
    attack: { type: 'magic', dmg: [16, 20], cooldown: 1.2, range: 4.5, projectileSpeed: 11, targets: 'both', splash: { radius: 1.6, falloff: 0.2 }, slow: { pct: 0.4, duration: 2.5 } },
    upgrades: ['winterheart', 'frostarrow', 'cryoshell', 'hail', 'blightfrost', 'steam', 'lich'],
  },
  {
    id: 'winterheart', name: "Cœur de l'hiver", family: 'frost', tier: 3, cost: 120,
    desc: 'Fige des vagues entières à 55 %.',
    attack: { type: 'magic', dmg: [45, 55], cooldown: 1.1, range: 5, projectileSpeed: 12, targets: 'both', splash: { radius: 2.3, falloff: 0.2 }, slow: { pct: 0.55, duration: 2.5 } },
    upgrades: [],
  },
  {
    id: 'iceshard', name: 'Éclat de glace', family: 'frost', tier: 2, cost: 45,
    desc: 'Pointes de glace lourdes, ralentissement de 35 %.',
    attack: { type: 'magic', dmg: [40, 50], cooldown: 1.1, range: 5, projectileSpeed: 16, targets: 'both', slow: { pct: 0.35, duration: 2 } },
    upgrades: ['frostlance', 'frostarrow', 'cryoshell', 'hail', 'blightfrost', 'steam', 'lich'],
  },
  {
    id: 'frostlance', name: 'Lance de givre', family: 'frost', tier: 3, cost: 130,
    desc: 'Transperce les armures lourdes et ralentit de 45 %.',
    attack: { type: 'magic', dmg: [160, 190], cooldown: 1.1, range: 6, projectileSpeed: 20, targets: 'both', slow: { pct: 0.45, duration: 2.2 } },
    upgrades: [],
  },

  // Foudre : magique, instantané, rebondit.
  {
    id: 'storm', name: 'Tour de foudre', family: 'storm', tier: 1, cost: 22,
    desc: 'Éclair instantané qui rebondit sur 3 cibles.',
    attack: { type: 'magic', dmg: [14, 18], cooldown: 1.3, range: 4, projectileSpeed: 0, targets: 'both', chain: { bounces: 3, range: 2.5, decay: 0.8 } },
    upgrades: ['tempest', 'obelisk'],
  },
  {
    id: 'tempest', name: "Tour d'orage", family: 'storm', tier: 2, cost: 55,
    desc: 'Chaîne d’éclairs sur 5 cibles.',
    attack: { type: 'magic', dmg: [36, 44], cooldown: 1.3, range: 4.5, projectileSpeed: 0, targets: 'both', chain: { bounces: 5, range: 2.8, decay: 0.85 } },
    upgrades: ['maelstrom', 'thunderarrow', 'teslacannon', 'hail', 'acidarc', 'plasma'],
  },
  {
    id: 'maelstrom', name: 'Maelström', family: 'storm', tier: 3, cost: 150,
    desc: 'Huit rebonds, presque sans perte.',
    attack: { type: 'magic', dmg: [95, 115], cooldown: 1.2, range: 5, projectileSpeed: 0, targets: 'both', chain: { bounces: 8, range: 3, decay: 0.9 } },
    upgrades: [],
  },
  {
    id: 'obelisk', name: 'Obélisque arcanique', family: 'storm', tier: 2, cost: 55,
    desc: 'Frappe unique et massive. Double dégâts contre les armures lourdes.',
    attack: { type: 'magic', dmg: [75, 95], cooldown: 1.4, range: 5.5, projectileSpeed: 0, targets: 'both' },
    upgrades: ['voidprism', 'thunderarrow', 'teslacannon', 'hail', 'acidarc', 'plasma'],
  },
  {
    id: 'voidprism', name: 'Prisme du néant', family: 'storm', tier: 3, cost: 160,
    desc: 'Dégâts chaotiques : ignorent les types d’armure et touchent les immunisés.',
    attack: { type: 'chaos', dmg: [260, 300], cooldown: 1.4, range: 6.5, projectileSpeed: 0, targets: 'both' },
    upgrades: [],
  },

  // Pylône : la cadence monte tant qu'une cible reste à portée.
  {
    id: 'pylon', name: 'Pylône', family: 'storm', tier: 1, cost: 20,
    desc: "Tire plus vite tant qu'une cible reste à portée : +1 % de cadence par seconde, jusqu'à +100 %.",
    attack: { type: 'magic', dmg: [8, 10], cooldown: 0.8, range: 4.5, projectileSpeed: 0, targets: 'both', rampUp: { max: 1 } },
    upgrades: ['capacitor', 'volatileprism'],
  },
  {
    id: 'capacitor', name: 'Condensateur', family: 'storm', tier: 3, cost: 55,
    desc: "Tire plus vite tant qu'une cible reste à portée : +1 % de cadence par seconde, jusqu'à +150 %.",
    attack: { type: 'magic', dmg: [25, 30], cooldown: 0.8, range: 4.5, projectileSpeed: 0, targets: 'both', rampUp: { max: 1.5 } },
    upgrades: [],
  },
  {
    id: 'volatileprism', name: 'Prisme volatil', family: 'storm', tier: 3, cost: 55,
    desc: "Éclair qui rebondit sur 3 cibles ; tire plus vite tant qu'une cible reste à portée, jusqu'à +100 %.",
    attack: { type: 'magic', dmg: [20, 24], cooldown: 0.8, range: 4.5, projectileSpeed: 0, targets: 'both', chain: { bounces: 3, range: 2.5, decay: 0.8 }, rampUp: { max: 1 } },
    upgrades: [],
  },

  // Dissipateur : magie qui blesse un peu les immunisés à la magie.
  {
    id: 'dispeller', name: 'Dissipateur', family: 'storm', tier: 1, cost: 25,
    desc: 'Décharge magique instantanée. Blesse un peu les immunisés à la magie.',
    attack: { type: 'magic', dmg: [20, 24], cooldown: 1, range: 5, projectileSpeed: 0, targets: 'both', dispel: 0.3 },
    upgrades: ['greatdispeller'],
  },
  {
    id: 'greatdispeller', name: 'Grand dissipateur', family: 'storm', tier: 2, cost: 70,
    desc: 'Décharge magique instantanée, bien plus forte. Blesse un peu les immunisés à la magie.',
    attack: { type: 'magic', dmg: [70, 80], cooldown: 1, range: 5, projectileSpeed: 0, targets: 'both', dispel: 0.3 },
    upgrades: [],
  },

  // Venin : poison cumulable, sol et air.
  {
    id: 'venom', name: 'Tour venimeuse', family: 'venom', tier: 1, cost: 14,
    desc: 'Empoisonne : 6 dégâts par seconde pendant 4 s, cumulable 3 fois. Le poison ignore la valeur d’armure.',
    attack: { type: 'normal', dmg: [3, 4], cooldown: 0.9, range: 4, projectileSpeed: 11, targets: 'both', poison: { dps: 6, duration: 4, maxStacks: 3 } },
    upgrades: ['acid', 'plague'],
  },
  {
    id: 'acid', name: 'Tour acide', family: 'venom', tier: 2, cost: 45,
    desc: 'Poison puissant qui ronge 3 points d’armure.',
    attack: { type: 'normal', dmg: [6, 8], cooldown: 0.9, range: 4.5, projectileSpeed: 12, targets: 'both', poison: { dps: 15, duration: 4, maxStacks: 3 }, armorShred: { amount: 3, duration: 4 } },
    upgrades: ['corrosion', 'stinger', 'plagueshell', 'blightfrost', 'acidarc', 'naphtha', 'blackplague'],
  },
  {
    id: 'corrosion', name: 'Corrosion', family: 'venom', tier: 3, cost: 130,
    desc: 'Dissout 6 points d’armure : toutes les tours voisines en profitent.',
    attack: { type: 'normal', dmg: [12, 16], cooldown: 0.8, range: 5, projectileSpeed: 13, targets: 'both', poison: { dps: 42, duration: 4, maxStacks: 3 }, armorShred: { amount: 6, duration: 4 } },
    upgrades: [],
  },
  {
    id: 'plague', name: 'Nid de peste', family: 'venom', tier: 2, cost: 45,
    desc: 'Nuage toxique de zone. Sol uniquement.',
    attack: { type: 'normal', dmg: [5, 7], cooldown: 1.1, range: 4.5, projectileSpeed: 9, targets: 'ground', splash: { radius: 1.6, falloff: 0 }, poison: { dps: 11, duration: 5, maxStacks: 2 } },
    upgrades: ['blight', 'stinger', 'plagueshell', 'blightfrost', 'acidarc', 'naphtha', 'blackplague'],
  },
  {
    id: 'blight', name: 'Fléau', family: 'venom', tier: 3, cost: 130,
    desc: 'Contamine des groupes entiers.',
    attack: { type: 'normal', dmg: [10, 14], cooldown: 1, range: 5, projectileSpeed: 10, targets: 'ground', splash: { radius: 2.3, falloff: 0 }, poison: { dps: 32, duration: 6, maxStacks: 2 } },
    upgrades: [],
  },

  // Pyromanciens : braise et salves de feu au sol.
  {
    id: 'brazier', name: 'Brasero', family: 'fire', tier: 1, cost: 18,
    desc: 'Projette des braises lourdes. Sol uniquement.',
    attack: { type: 'siege', dmg: [10, 12], cooldown: 1.4, range: 4, projectileSpeed: 9, targets: 'ground' , ember: { radius: 1, duration: 3, dps: 6 } },
    upgrades: ['blaze', 'flamethrower'],
  },
  {
    id: 'blaze', name: 'Fournaise', family: 'fire', tier: 2, cost: 48,
    desc: 'Braises plus lourdes et plus lointaines. Sol uniquement.',
    attack: { type: 'siege', dmg: [24, 30], cooldown: 1.4, range: 4.5, projectileSpeed: 9, targets: 'ground' , ember: { radius: 1.5, duration: 4, dps: 16 } },
    upgrades: ['volcano', 'steam', 'plasma', 'firebomb', 'naphtha'],
  },
  {
    id: 'volcano', name: 'Volcan', family: 'fire', tier: 3, cost: 135,
    desc: 'Crache une roche en fusion. Sol uniquement.',
    attack: { type: 'siege', dmg: [70, 85], cooldown: 1.5, range: 5, projectileSpeed: 9, targets: 'ground' , ember: { radius: 2, duration: 5, dps: 45 } },
    upgrades: [],
  },
  {
    id: 'flamethrower', name: 'Lance-flammes', family: 'fire', tier: 2, cost: 45,
    desc: 'Jet de flammes rapide à courte portée. Sol uniquement.',
    attack: { type: 'normal', dmg: [14, 18], cooldown: 0.5, range: 2.5, projectileSpeed: 14, targets: 'ground', splash: { radius: 1, falloff: 0.5 }, relentless: { step: 0.1, max: 1.5 } },
    upgrades: ['dragonbreath', 'steam', 'plasma', 'firebomb', 'naphtha'],
  },
  {
    id: 'dragonbreath', name: 'Souffle du dragon', family: 'fire', tier: 3, cost: 130,
    desc: 'Un torrent de flammes qui balaie le groupe. Sol uniquement.',
    attack: { type: 'normal', dmg: [40, 48], cooldown: 0.5, range: 3, projectileSpeed: 14, targets: 'ground', splash: { radius: 1.2, falloff: 0.5 }, relentless: { step: 0.1, max: 2.5 } },
    upgrades: [],
  },
  {
    id: 'hearth', name: 'Foyer', family: 'fire', tier: 1, cost: 20,
    desc: 'Salve de feu magique qui frappe tout le sol à portée.',
    attack: { type: 'magic', dmg: [16, 20], cooldown: 2, range: 2.5, projectileSpeed: 0, targets: 'ground', area: true },
    upgrades: ['conflagration', 'ashfield'],
  },
  {
    id: 'conflagration', name: 'Embrasement', family: 'fire', tier: 3, cost: 50,
    desc: 'Salve de feu magique plus large et bien plus forte.',
    attack: { type: 'magic', dmg: [45, 55], cooldown: 2, range: 3, projectileSpeed: 0, targets: 'ground', area: true },
    upgrades: [],
  },
  {
    id: 'ashfield', name: 'Champ de cendres', family: 'fire', tier: 3, cost: 50,
    desc: 'Salve de feu magique qui ralentit de 25 % tout le sol à portée.',
    attack: { type: 'magic', dmg: [30, 36], cooldown: 2, range: 2.5, projectileSpeed: 0, targets: 'ground', area: true, slow: { pct: 0.25, duration: 2 } },
    upgrades: [],
  },

  // Nécromanciens : chaos qui ignore le type d'armure, sol et air.
  {
    id: 'ossuary', name: 'Ossuaire', family: 'chaos', tier: 1, cost: 18,
    desc: 'Dégâts chaotiques : les types d’armure ne comptent pas. Touche les volants.',
    attack: { type: 'chaos', dmg: [8, 10], cooldown: 1, range: 4, projectileSpeed: 12, targets: 'both' },
    upgrades: ['crypt', 'charnel'],
  },
  {
    id: 'crypt', name: 'Crypte', family: 'chaos', tier: 2, cost: 50,
    desc: 'Dégâts chaotiques bien plus forts, à plus longue portée.',
    attack: { type: 'chaos', dmg: [30, 36], cooldown: 1, range: 4.5, projectileSpeed: 12, targets: 'both' },
    upgrades: ['necropolis', 'blackplague', 'lich', 'darkarrows'],
  },
  {
    id: 'necropolis', name: 'Nécropole', family: 'chaos', tier: 3, cost: 140,
    desc: 'Les morts eux-mêmes frappent : dégâts chaotiques dévastateurs.',
    attack: { type: 'chaos', dmg: [95, 110], cooldown: 1, range: 5, projectileSpeed: 14, targets: 'both' },
    upgrades: [],
  },
  {
    id: 'charnel', name: 'Charnier', family: 'chaos', tier: 2, cost: 50,
    desc: 'Relève les morts en squelettes qui explosent. Dégâts chaotiques.',
    attack: { type: 'chaos', dmg: [14, 18], cooldown: 1.2, range: 4, projectileSpeed: 12, targets: 'both' },
    raise: { every: 4, damage: 60, radius: 1 },
    upgrades: ['legion', 'blackplague', 'lich', 'darkarrows'],
  },
  {
    id: 'legion', name: 'Légion des morts', family: 'chaos', tier: 3, cost: 135,
    desc: 'Relève les morts en squelettes qui explosent plus fort et plus souvent. Dégâts chaotiques lourds.',
    attack: { type: 'chaos', dmg: [35, 42], cooldown: 1.2, range: 4.5, projectileSpeed: 14, targets: 'both' },
    raise: { every: 2.5, damage: 180, radius: 1.5 },
    upgrades: [],
  },
  {
    id: 'altar', name: 'Autel', family: 'chaos', tier: 1, cost: 20,
    desc: 'Dégâts chaotiques : les types d’armure ne comptent pas. Touche les volants.',
    attack: { type: 'chaos', dmg: [10, 12], cooldown: 1, range: 4, projectileSpeed: 12, targets: 'both' },
    altar: { pct: 0.1, maxStacks: 10, duration: 8 },
    upgrades: ['bloodaltar', 'reliquary'],
  },
  {
    id: 'bloodaltar', name: 'Autel de sang', family: 'chaos', tier: 3, cost: 55,
    desc: 'Dégâts chaotiques nourris de sang, à plus longue portée.',
    attack: { type: 'chaos', dmg: [28, 34], cooldown: 1, range: 4.5, projectileSpeed: 12, targets: 'both' },
    altar: { pct: 0.1, maxStacks: 20, duration: 8 },
    upgrades: [],
  },
  {
    id: 'reliquary', name: 'Reliquaire', family: 'chaos', tier: 3, cost: 55,
    desc: 'Dégâts chaotiques réguliers.',
    attack: { type: 'chaos', dmg: [20, 24], cooldown: 1, range: 4, projectileSpeed: 12, targets: 'both' },
    altar: { pct: 0.1, maxStacks: 10, duration: 8 },
    aura: { kind: 'damage', share: 0.5, radius: 3 },
    upgrades: [],
  },

  // Peste noire : infusion hybride chaos/venin.
  {
    id: 'blackplague', name: 'Peste noire', family: 'chaos', tier: 1, cost: 70,
    desc: 'Dégâts chaotiques qui empoisonnent ; le poison ignore la valeur d’armure.',
    elements: ['chaos', 'venom'],
    attack: { type: 'chaos', dmg: [20, 24], cooldown: 1, range: 4.5, projectileSpeed: 12, targets: 'both', poison: { dps: 15, duration: 4, maxStacks: 3, spread: 1.5 } },
    upgrades: ['pandemic'],
  },
  {
    id: 'pandemic', name: 'Pandémie', family: 'chaos', tier: 2, cost: 155,
    desc: 'Dégâts chaotiques qui empoisonnent, en plus dévastateur.',
    elements: ['chaos', 'venom'],
    attack: { type: 'chaos', dmg: [60, 70], cooldown: 1, range: 5, projectileSpeed: 14, targets: 'both', poison: { dps: 40, duration: 4, maxStacks: 3, spread: 2 } },
    upgrades: [],
  },

  // Liche : infusion hybride chaos/givre.
  {
    id: 'lich', name: 'Liche', family: 'chaos', tier: 1, cost: 70,
    desc: 'Dégâts chaotiques lourds qui ralentissent de 30 %.',
    elements: ['chaos', 'frost'],
    attack: { type: 'chaos', dmg: [45, 55], cooldown: 1.2, range: 5, projectileSpeed: 12, targets: 'both', slow: { pct: 0.3, duration: 2 } },
    upgrades: ['lichking'],
  },
  {
    id: 'lichking', name: 'Roi-liche', family: 'chaos', tier: 2, cost: 155,
    desc: 'Dégâts chaotiques lourds qui ralentissent de 40 %, en plus dévastateur.',
    elements: ['chaos', 'frost'],
    attack: { type: 'chaos', dmg: [130, 150], cooldown: 1.2, range: 5.5, projectileSpeed: 14, targets: 'both', slow: { pct: 0.4, duration: 2.5 } },
    upgrades: [],
  },

  // Dard corrosif : infusion hybride archer/venin.
  {
    id: 'stinger', name: 'Dard corrosif', family: 'archer', tier: 1, cost: 70,
    desc: "Trait perçant empoisonné qui ronge l'armure.",
    elements: ['archer', 'venom'],
    attack: { type: 'pierce', dmg: [28, 34], cooldown: 0.7, range: 5.5, projectileSpeed: 18, targets: 'both', poison: { dps: 18, duration: 4, maxStacks: 3 }, armorShred: { amount: 4, duration: 4 } },
    upgrades: ['rustspike'],
  },
  {
    id: 'rustspike', name: 'Aiguillon de rouille', family: 'archer', tier: 2, cost: 150,
    desc: "Trait perçant empoisonné qui ronge l'armure, en plus dévastateur.",
    elements: ['archer', 'venom'],
    attack: { type: 'pierce', dmg: [85, 100], cooldown: 0.6, range: 6, projectileSpeed: 20, targets: 'both', poison: { dps: 45, duration: 4, maxStacks: 3 }, armorShred: { amount: 7, duration: 4 } },
    upgrades: [],
  },

  // Obus cryogénique : infusion hybride canon/givre.
  {
    id: 'cryoshell', name: 'Obus cryogénique', family: 'cannon', tier: 1, cost: 70,
    desc: 'Obus de zone qui ralentit et peut geler sa cible.',
    elements: ['cannon', 'frost'],
    attack: { type: 'siege', dmg: [55, 70], cooldown: 2, range: 5, projectileSpeed: 9, targets: 'ground', splash: { radius: 1.6, falloff: 0.4 }, slow: { pct: 0.35, duration: 2 }, freeze: { chance: 0.25, duration: 0.6, guard: 1.5 } },
    upgrades: ['permafrost'],
  },
  {
    id: 'permafrost', name: 'Obus du permafrost', family: 'cannon', tier: 2, cost: 160,
    desc: 'Obus de zone qui ralentit et peut geler sa cible, en plus dévastateur.',
    elements: ['cannon', 'frost'],
    attack: { type: 'siege', dmg: [170, 210], cooldown: 2, range: 6, projectileSpeed: 10, targets: 'ground', splash: { radius: 2.1, falloff: 0.4 }, slow: { pct: 0.45, duration: 2.5 }, freeze: { chance: 0.25, duration: 0.6, guard: 1.5 } },
    upgrades: [],
  },

  // Grêle : infusion hybride givre/foudre.
  {
    id: 'hail', name: 'Grêle', family: 'frost', tier: 1, cost: 75,
    desc: 'Chaîne d’éclairs glacés : chaque rebond ralentit sa cible.',
    elements: ['frost', 'storm'],
    attack: { type: 'magic', dmg: [34, 42], cooldown: 1.2, range: 4.5, projectileSpeed: 0, targets: 'both', chain: { bounces: 4, range: 2.6, decay: 0.85 }, slow: { pct: 0.3, duration: 1.5 } },
    upgrades: ['hailstorm'],
  },
  {
    id: 'hailstorm', name: 'Tempête de grêle', family: 'frost', tier: 2, cost: 165,
    desc: 'Chaîne d’éclairs glacés : chaque rebond ralentit sa cible, en plus dévastateur.',
    elements: ['frost', 'storm'],
    attack: { type: 'magic', dmg: [100, 120], cooldown: 1.2, range: 5, projectileSpeed: 0, targets: 'both', chain: { bounces: 6, range: 2.8, decay: 0.88 }, slow: { pct: 0.4, duration: 2 } },
    upgrades: [],
  },

  // Baliste : infusion hybride archer/canon.
  {
    id: 'ballista', name: 'Baliste', family: 'archer', tier: 1, cost: 70,
    desc: 'Carreaux lourds et perçants qui éclatent en zone. Touche les volants.',
    elements: ['archer', 'cannon'],
    attack: { type: 'pierce', dmg: [60, 75], cooldown: 1.4, range: 6.5, projectileSpeed: 20, targets: 'both', splash: { radius: 1.2, falloff: 0.5 }, crit: { chance: 0.15, mult: 2 } },
    upgrades: ['siegebow'],
  },
  {
    id: 'siegebow', name: 'Baliste de siège', family: 'archer', tier: 2, cost: 155,
    desc: 'Carreaux lourds et perçants qui éclatent en zone, en plus dévastateur.',
    elements: ['archer', 'cannon'],
    attack: { type: 'pierce', dmg: [180, 220], cooldown: 1.3, range: 7.5, projectileSpeed: 24, targets: 'both', splash: { radius: 1.6, falloff: 0.5 }, crit: { chance: 0.2, mult: 2.5 } },
    upgrades: [],
  },

  // Flèches de givre : infusion hybride archer/givre.
  {
    id: 'frostarrow', name: 'Flèches de givre', family: 'archer', tier: 1, cost: 70,
    desc: 'Trois flèches glacées par salve, chacune ralentit sa cible.',
    elements: ['archer', 'frost'],
    attack: { type: 'pierce', dmg: [18, 22], cooldown: 0.8, range: 5, projectileSpeed: 18, targets: 'both', multishot: 3, slow: { pct: 0.3, duration: 1.5 } },
    upgrades: ['rimevolley'],
  },
  {
    id: 'rimevolley', name: 'Salve boréale', family: 'archer', tier: 2, cost: 155,
    desc: 'Quatre flèches glacées par salve, chacune ralentit sa cible, en plus dévastateur.',
    elements: ['archer', 'frost'],
    attack: { type: 'pierce', dmg: [55, 65], cooldown: 0.7, range: 5.5, projectileSpeed: 20, targets: 'both', multishot: 4, slow: { pct: 0.4, duration: 2 } },
    upgrades: [],
  },

  // Flèches noires : infusion hybride archer/chaos.
  {
    id: 'darkarrows', name: 'Flèches noires', family: 'archer', tier: 1, cost: 70,
    desc: 'Deux flèches chaotiques par salve : les types d’armure ne comptent pas.',
    elements: ['archer', 'chaos'],
    attack: { type: 'chaos', dmg: [30, 36], cooldown: 0.8, range: 5, projectileSpeed: 18, targets: 'both', multishot: 2 },
    upgrades: ['doomvolley'],
  },
  {
    id: 'doomvolley', name: 'Volée funeste', family: 'archer', tier: 2, cost: 155,
    desc: 'Trois flèches chaotiques par salve, en plus dévastateur.',
    elements: ['archer', 'chaos'],
    attack: { type: 'chaos', dmg: [90, 105], cooldown: 0.7, range: 5.5, projectileSpeed: 20, targets: 'both', multishot: 3 },
    upgrades: [],
  },

  // Flèche foudroyante : infusion hybride archer/foudre.
  {
    id: 'thunderarrow', name: 'Flèche foudroyante', family: 'archer', tier: 1, cost: 70,
    desc: 'Trait perçant instantané qui rebondit sur 3 cibles, parfois critique.',
    elements: ['archer', 'storm'],
    attack: { type: 'pierce', dmg: [36, 44], cooldown: 1, range: 6, projectileSpeed: 0, targets: 'both', chain: { bounces: 3, range: 2.5, decay: 0.75 }, crit: { chance: 0.2, mult: 2 } },
    upgrades: ['skypiercer'],
  },
  {
    id: 'skypiercer', name: 'Perce-ciel', family: 'archer', tier: 2, cost: 155,
    desc: 'Trait perçant instantané qui rebondit sur 4 cibles, parfois critique, en plus dévastateur.',
    elements: ['archer', 'storm'],
    attack: { type: 'pierce', dmg: [110, 130], cooldown: 0.9, range: 7, projectileSpeed: 0, targets: 'both', chain: { bounces: 4, range: 2.8, decay: 0.8 }, crit: { chance: 0.25, mult: 2.5 } },
    upgrades: [],
  },

  // Canon à foudre : infusion hybride canon/foudre.
  {
    id: 'teslacannon', name: 'Canon à foudre', family: 'cannon', tier: 1, cost: 75,
    desc: 'Décharge de siège instantanée qui rebondit sur 3 cibles. Sol uniquement.',
    elements: ['cannon', 'storm'],
    attack: { type: 'siege', dmg: [60, 75], cooldown: 1.8, range: 5, projectileSpeed: 0, targets: 'ground', chain: { bounces: 3, range: 2.2, decay: 0.75 } },
    upgrades: ['thundergun'],
  },
  {
    id: 'thundergun', name: 'Canon tonnerre', family: 'cannon', tier: 2, cost: 160,
    desc: 'Décharge de siège instantanée qui rebondit sur 4 cibles, en plus dévastateur. Sol uniquement.',
    elements: ['cannon', 'storm'],
    attack: { type: 'siege', dmg: [180, 220], cooldown: 1.7, range: 6, projectileSpeed: 0, targets: 'ground', chain: { bounces: 4, range: 2.5, decay: 0.8 } },
    upgrades: [],
  },

  // Obus toxique : infusion hybride canon/venin.
  {
    id: 'plagueshell', name: 'Obus toxique', family: 'cannon', tier: 1, cost: 70,
    desc: 'Obus de zone qui empoisonne tout le groupe. Sol uniquement.',
    elements: ['cannon', 'venom'],
    attack: { type: 'siege', dmg: [40, 50], cooldown: 1.8, range: 5, projectileSpeed: 9, targets: 'ground', splash: { radius: 1.6, falloff: 0.4 }, poison: { dps: 14, duration: 4, maxStacks: 2 } },
    upgrades: ['miasma'],
  },
  {
    id: 'miasma', name: 'Bombe à miasmes', family: 'cannon', tier: 2, cost: 155,
    desc: 'Obus de zone qui empoisonne tout le groupe, en plus dévastateur. Sol uniquement.',
    elements: ['cannon', 'venom'],
    attack: { type: 'siege', dmg: [120, 150], cooldown: 1.8, range: 6, projectileSpeed: 10, targets: 'ground', splash: { radius: 2.1, falloff: 0.4 }, poison: { dps: 36, duration: 5, maxStacks: 2 } },
    upgrades: [],
  },

  // Givre nécrotique : infusion hybride givre/venin.
  {
    id: 'blightfrost', name: 'Givre nécrotique', family: 'frost', tier: 1, cost: 70,
    desc: 'Ralentit de 35 % et empoisonne. Le poison touche aussi les spectres.',
    elements: ['frost', 'venom'],
    attack: { type: 'magic', dmg: [14, 18], cooldown: 0.9, range: 4.5, projectileSpeed: 12, targets: 'both', slow: { pct: 0.35, duration: 2 }, poison: { dps: 16, duration: 4, maxStacks: 3 } },
    upgrades: ['deathfrost'],
  },
  {
    id: 'deathfrost', name: 'Hiver mortel', family: 'frost', tier: 2, cost: 155,
    desc: 'Ralentit de 45 % et empoisonne, en plus dévastateur. Le poison touche aussi les spectres.',
    elements: ['frost', 'venom'],
    attack: { type: 'magic', dmg: [40, 50], cooldown: 0.8, range: 5, projectileSpeed: 14, targets: 'both', slow: { pct: 0.45, duration: 2.5 }, poison: { dps: 42, duration: 4, maxStacks: 3 } },
    upgrades: [],
  },

  // Arc acide : infusion hybride foudre/venin.
  {
    id: 'acidarc', name: 'Arc acide', family: 'storm', tier: 1, cost: 75,
    desc: 'Éclair qui rebondit sur 4 cibles, les empoisonne et ronge leur armure.',
    elements: ['storm', 'venom'],
    attack: { type: 'magic', dmg: [20, 26], cooldown: 1.3, range: 4.5, projectileSpeed: 0, targets: 'both', chain: { bounces: 4, range: 2.5, decay: 0.8 }, poison: { dps: 10, duration: 3, maxStacks: 2 }, armorShred: { amount: 3, duration: 4 } },
    upgrades: ['toxicstorm'],
  },
  {
    id: 'toxicstorm', name: 'Orage toxique', family: 'storm', tier: 2, cost: 160,
    desc: 'Éclair qui rebondit sur 6 cibles, les empoisonne et ronge leur armure, en plus dévastateur.',
    elements: ['storm', 'venom'],
    attack: { type: 'magic', dmg: [60, 75], cooldown: 1.2, range: 5, projectileSpeed: 0, targets: 'both', chain: { bounces: 6, range: 2.8, decay: 0.85 }, poison: { dps: 26, duration: 3, maxStacks: 2 }, armorShred: { amount: 5, duration: 4 } },
    upgrades: [],
  },
  // Obus incendiaire : infusion hybride canon/feu.
  {
    id: 'firebomb', name: 'Obus incendiaire', family: 'cannon', tier: 1, cost: 70,
    desc: 'Obus de zone qui laisse une flaque de feu à l’impact. Sol uniquement.',
    elements: ['cannon', 'fire'],
    attack: { type: 'siege', dmg: [50, 60], cooldown: 1.8, range: 5, projectileSpeed: 9, targets: 'ground', splash: { radius: 1.5, falloff: 0.4 }, ember: { radius: 1.5, duration: 3, dps: 15 } },
    upgrades: ['napalm'],
  },
  {
    id: 'napalm', name: 'Bombe au napalm', family: 'cannon', tier: 2, cost: 155,
    desc: 'Obus de zone qui laisse une large flaque de feu, en plus dévastateur. Sol uniquement.',
    elements: ['cannon', 'fire'],
    attack: { type: 'siege', dmg: [150, 180], cooldown: 1.8, range: 5.5, projectileSpeed: 10, targets: 'ground', splash: { radius: 2, falloff: 0.4 }, ember: { radius: 2, duration: 3, dps: 40 } },
    upgrades: [],
  },

  // Naphte : infusion hybride venin/feu.
  {
    id: 'naphtha', name: 'Naphte', family: 'venom', tier: 1, cost: 70,
    desc: 'Éclat de zone qui empoisonne et laisse une flaque de feu. Sol uniquement.',
    elements: ['venom', 'fire'],
    attack: { type: 'normal', dmg: [10, 12], cooldown: 1, range: 4.5, projectileSpeed: 9, targets: 'ground', splash: { radius: 1.5, falloff: 0.4 }, poison: { dps: 14, duration: 4, maxStacks: 3 }, ember: { radius: 1.5, duration: 4, dps: 8 } },
    upgrades: ['naphthatide'],
  },
  {
    id: 'naphthatide', name: 'Marée de naphte', family: 'venom', tier: 2, cost: 155,
    desc: 'Éclat de zone qui empoisonne et laisse une large flaque de feu, en plus dévastateur. Sol uniquement.',
    elements: ['venom', 'fire'],
    attack: { type: 'normal', dmg: [30, 36], cooldown: 1, range: 5, projectileSpeed: 10, targets: 'ground', splash: { radius: 2, falloff: 0.4 }, poison: { dps: 35, duration: 4, maxStacks: 3 }, ember: { radius: 2, duration: 4, dps: 20 } },
    upgrades: [],
  },

  // Vapeur : infusion hybride feu/givre.
  {
    id: 'steam', name: 'Vapeur', family: 'fire', tier: 1, cost: 70,
    desc: 'Jet de vapeur brûlante, sol et air.',
    elements: ['fire', 'frost'],
    attack: { type: 'magic', dmg: [30, 36], cooldown: 1.2, range: 4.5, projectileSpeed: 12, targets: 'both' , ember: { radius: 1.5, duration: 3, dps: 12, slow: { pct: 0.35, duration: 0.5 } } },
    upgrades: ['scorchmist'],
  },
  {
    id: 'scorchmist', name: 'Brume ardente', family: 'fire', tier: 2, cost: 155,
    desc: 'Jet de vapeur brûlante, sol et air, en plus dévastateur.',
    elements: ['fire', 'frost'],
    attack: { type: 'magic', dmg: [90, 105], cooldown: 1.2, range: 5, projectileSpeed: 12, targets: 'both' , ember: { radius: 1.8, duration: 3, dps: 30, slow: { pct: 0.45, duration: 0.5 } } },
    upgrades: [],
  },

  // Plasma : infusion hybride feu/foudre.
  {
    id: 'plasma', name: 'Plasma', family: 'fire', tier: 1, cost: 70,
    desc: 'Arc de plasma instantané qui rebondit sur 3 cibles.',
    elements: ['fire', 'storm'],
    attack: { type: 'magic', dmg: [40, 48], cooldown: 1.3, range: 5, projectileSpeed: 0, targets: 'both', chain: { bounces: 3, range: 2.5, decay: 0.8 } , ember: { radius: 1, duration: 2, dps: 10 } },
    upgrades: ['solararc'],
  },
  {
    id: 'solararc', name: 'Arc solaire', family: 'fire', tier: 2, cost: 155,
    desc: 'Arc de plasma instantané qui rebondit sur 5 cibles, en plus dévastateur.',
    elements: ['fire', 'storm'],
    attack: { type: 'magic', dmg: [120, 140], cooldown: 1.3, range: 5.5, projectileSpeed: 0, targets: 'both', chain: { bounces: 5, range: 2.8, decay: 0.85 } , ember: { radius: 1, duration: 2, dps: 25 } },
    upgrades: [],
  },

  // Guilde marchande : arbalétriers et comptoirs. Les primes et revenus viennent aux cycles suivants.
  {
    id: 'crossbow', name: 'Arbalétrier', family: 'gold', tier: 1, cost: 15,
    desc: 'Carreaux réguliers. Touche les volants.',
    attack: { type: 'normal', dmg: [10, 12], cooldown: 1, range: 4.5, projectileSpeed: 16, targets: 'both' },
    upgrades: ['taxman', 'mercenary'],
  },
  {
    id: 'taxman', name: 'Percepteur', family: 'gold', tier: 2, cost: 45,
    desc: 'Carreaux lourds. Touche les volants.',
    attack: { type: 'normal', dmg: [26, 32], cooldown: 1, range: 5, projectileSpeed: 16, targets: 'both' },
    bounty: 2,
    upgrades: ['collector', 'bountyhunter', 'coincannon'],
  },
  {
    id: 'collector', name: "Collecteur d'impôts", family: 'gold', tier: 3, cost: 125,
    desc: 'Carreaux très lourds. Touche les volants.',
    attack: { type: 'normal', dmg: [70, 85], cooldown: 1, range: 5.5, projectileSpeed: 18, targets: 'both' },
    bounty: 3,
    upgrades: [],
  },
  {
    id: 'mercenary', name: "Mercenaire d'élite", family: 'gold', tier: 2, cost: 45,
    desc: 'Tirs perçants. Touche les volants.',
    attack: { type: 'pierce', dmg: [32, 38], cooldown: 0.9, range: 5.5, projectileSpeed: 18, targets: 'both' },
    upgrades: ['captain', 'bountyhunter', 'coincannon'],
  },
  {
    id: 'captain', name: 'Capitaine mercenaire', family: 'gold', tier: 3, cost: 125,
    desc: 'Tirs perçants et coups critiques. Touche les volants.',
    attack: { type: 'pierce', dmg: [95, 110], cooldown: 0.9, range: 6, projectileSpeed: 20, targets: 'both', crit: { chance: 0.2, mult: 2 } },
    upgrades: [],
  },
  {
    id: 'counter', name: 'Comptoir', family: 'gold', tier: 1, cost: 30,
    desc: "N'attaque pas.",
    trade: 6,
    upgrades: ['bank', 'caravan'],
  },
  {
    id: 'bank', name: 'Banque', family: 'gold', tier: 3, cost: 60,
    desc: "N'attaque pas.",
    trade: 18,
    upgrades: [],
  },
  {
    id: 'caravan', name: 'Caravane', family: 'gold', tier: 3, cost: 50,
    desc: 'Carreaux réguliers. Touche les volants.',
    attack: { type: 'normal', dmg: [20, 24], cooldown: 1, range: 4, projectileSpeed: 16, targets: 'both' },
    trade: 10,
    upgrades: [],
  },

  // Chasseur de primes : infusion hybride or/archers.
  {
    id: 'bountyhunter', name: 'Chasseur de primes', family: 'gold', tier: 1, cost: 70,
    desc: 'Tirs perçants lourds, parfois critiques. Touche les volants.',
    elements: ['gold', 'archer'],
    attack: { type: 'pierce', dmg: [45, 55], cooldown: 1.1, range: 6.5, projectileSpeed: 20, targets: 'both', crit: { chance: 0.2, mult: 2 } },
    bounty: 2,
    upgrades: ['hitman'],
  },
  {
    id: 'hitman', name: 'Tueur à gages', family: 'gold', tier: 2, cost: 155,
    desc: 'Tirs perçants lourds, souvent critiques, en plus dévastateur. Touche les volants.',
    elements: ['gold', 'archer'],
    attack: { type: 'pierce', dmg: [140, 165], cooldown: 1.1, range: 7, projectileSpeed: 24, targets: 'both', crit: { chance: 0.25, mult: 2.5 } },
    bounty: 2,
    upgrades: [],
  },

  // Canon à pièces : infusion hybride or/canons.
  {
    id: 'coincannon', name: 'Canon à pièces', family: 'gold', tier: 1, cost: 70,
    desc: 'Obus de zone. Sol uniquement.',
    elements: ['gold', 'cannon'],
    attack: { type: 'siege', dmg: [45, 55], cooldown: 1.8, range: 5, projectileSpeed: 9, targets: 'ground', splash: { radius: 1.5, falloff: 0.4 } },
    bounty: 1.5,
    upgrades: ['goldbombard'],
  },
  {
    id: 'goldbombard', name: "Bombarde d'or", family: 'gold', tier: 2, cost: 155,
    desc: 'Obus de zone, en plus dévastateur. Sol uniquement.',
    elements: ['gold', 'cannon'],
    attack: { type: 'siege', dmg: [140, 165], cooldown: 1.8, range: 5.5, projectileSpeed: 10, targets: 'ground', splash: { radius: 2, falloff: 0.4 } },
    bounty: 2,
    upgrades: [],
  },
];

export const TOWERS: Record<string, TowerDef> = Object.fromEntries(T.map((t) => [t.id, t]));

export function tower(id: string): TowerDef {
  const d = TOWERS[id];
  if (!d) throw new Error(`Tour inconnue : ${id}`);
  return d;
}

/** Coût total cumulé pour atteindre cette tour depuis la racine (utile à l’affichage). */
export function totalCost(id: string): number {
  for (const d of T) if (d.upgrades.includes(id) && d.id !== 'wall') return totalCost(d.id) + tower(id).cost;
  return tower(id).cost;
}
