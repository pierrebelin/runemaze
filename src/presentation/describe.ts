import type { Stats, World } from '../domain/model/World';
import type { SendGroup, WaveBriefing, WaveBriefingGroup } from '../application/queries/waveBriefing';
import { ATTACK_TABLE } from '../domain/rules/Damage';
import type { AuraKind, BuilderDef, ArmorType, AttackType, Creep, CreepDef, Result, TargetMode, Tower, TowerDef, TowerFate } from '../domain/model/types';
import { breakerLosses } from '../domain/rules/debrief';
import type { familyDamage, waveCurve } from '../domain/rules/debrief';
import { towerRange } from '../domain/rules/crystal';
import { builderTowers, upgradeOptions } from '../domain/rules/builder';
import { CREEPS } from '../domain/catalog/creeps';
import { TOWERS, tower } from '../domain/catalog/towers';
import { GATE } from '../domain/catalog/ether';
import { gateLevelCost, gateLevelIncome, refundValue, upgradeCost } from '../domain/rules/pricing';
import { creepSpeed } from '../domain/rules/speed';
import { Mode, Team, Verdict } from '../application/online/protocol';
import type { Biome, CellKind, MapDef } from '../domain/model/types';
import { Grid } from '../domain/model/Grid';
import { TERRAIN } from '../domain/catalog/map';
import { emptyLegs } from '../domain/rules/mapDraw';
import type { WaveReward } from '../domain/rules/waveReward';
import { armorLabel, attackLabel, builderName, builderStyle, builderWeakness, creepName, creepPlural, lang, reasonText, towerDesc, towerName, tr } from './i18n';

const MODE_LABEL = (): Record<Mode, string> => ({
  [Mode.Duel]: 'Duel',
  [Mode.Coop]: tr('Coopération', 'Co-op'),
  [Mode.Teams]: tr('2 contre 2', '2 vs 2'),
});

const BIOME_LABEL = (): Record<Biome, string> => ({ earth: tr('Terre', 'Earth'), snow: tr('Neige', 'Snow'), space: tr('Espace', 'Space') });

export function biomeLabel(biome: Biome): string {
  return BIOME_LABEL()[biome];
}

const pct = (x: number) => Math.round(x * 100);

/** « 30 % » en français, « 30% » en anglais. */
const percent = (n: number | string) => tr(`${n} %`, `${n}%`);

const BIOME_EFFECT = (): Record<Biome, string> => ({
  earth: tr('Des rochers barrent le terrain : ni passage, ni construction.', 'Rocks block the field: no passage, no building.'),
  snow: tr(`La glace accélère les créatures terrestres de ${pct(TERRAIN.ice.speed - 1)} % ; on n’y bâtit pas.`, `Ice speeds up ground creatures by ${pct(TERRAIN.ice.speed - 1)}%; you cannot build on it.`),
  space: tr(`Une tour sur cristal gagne ${pct(TERRAIN.crystal.range)} % de portée ; les trous de ver relient deux points du terrain.`, `A tower on crystal gains ${pct(TERRAIN.crystal.range)}% range; wormholes link two points of the field.`),
});

export function biomeEffect(biome: Biome): string {
  return BIOME_EFFECT()[biome];
}

export interface MapFact {
  value: number;
  label: string;
}

const fact = (value: number, one: string, many: string): MapFact => ({ value, label: value > 1 ? many : one });

/** Chiffres d'une carte pour la choisir : trajet sans aucune tour, pierres runiques à toucher, éléments du biome hors bordure. */
export function mapFacts(map: MapDef): MapFact[] {
  const grid = new Grid(map);
  // La bordure de rochers est commune à toutes les cartes : seul l'intérieur distingue une carte.
  const inside = (i: number) => i % grid.w > 0 && i % grid.w < grid.w - 1 && i >= grid.w && i < grid.w * (grid.h - 1);
  const cells = (k: CellKind) => grid.kind.filter((c, i) => c === k && inside(i)).length;
  const route = Math.round(emptyLegs(map).reduce((a, b) => a + b, 0));
  const facts = [
    fact(route, tr('case de trajet à vide', 'route cell, empty map'), tr('cases de trajet à vide', 'route cells, empty map')),
    fact(grid.checkpoints.length, tr('pierre runique', 'runestone'), tr('pierres runiques', 'runestones')),
  ];
  if (cells('rock')) facts.push(fact(cells('rock'), tr('case de rocher', 'rock cell'), tr('cases de rocher', 'rock cells')));
  if (cells('ice')) facts.push(fact(cells('ice'), tr('case de glace', 'ice cell'), tr('cases de glace', 'ice cells')));
  if (cells('crystal')) facts.push(fact(cells('crystal'), tr('cristal', 'crystal'), tr('cristaux', 'crystals')));
  if (grid.wormholes.length) facts.push(fact(grid.wormholes.length, tr('trou de ver', 'wormhole'), tr('trous de ver', 'wormholes')));
  return facts;
}

export function modeLabel(mode: Mode): string {
  return MODE_LABEL()[mode];
}

const MODE_HINT = (): Record<Mode, string> => ({
  [Mode.Duel]: tr('1 contre 1', '1 vs 1'),
  [Mode.Coop]: tr('À deux, vies communes', 'Two players, shared lives'),
  [Mode.Teams]: tr('4 joueurs, 2 équipes', '4 players, 2 teams'),
});

/** Résumé d'un mode sous son nom, à l'accueil. */
export function modeHint(mode: Mode): string {
  return MODE_HINT()[mode];
}

const DUEL_VERDICT_LABEL = (): Record<Verdict, string> => ({
  [Verdict.Victory]: tr('Victoire', 'Victory'),
  [Verdict.Defeat]: tr('Défaite', 'Defeat'),
  [Verdict.Draw]: tr('Égalité', 'Draw'),
  [Verdict.Forfeit]: tr('Victoire par forfait', 'Victory by forfeit'),
  [Verdict.Abandon]: tr('Défaite', 'Defeat'),
});

export function duelVerdictLabel(v: Verdict): string {
  return DUEL_VERDICT_LABEL()[v];
}

// Textes du panneau d'information. Tout est échappé : les seules données
// injectées viennent des fichiers de données du jeu.

const formats = (locale: string) => [0, 1, 2].map((d) => new Intl.NumberFormat(locale, { maximumFractionDigits: d }));
const NF = { fr: formats('fr-FR'), en: formats('en-US') };
export const fmt1 = (n: number) => NF[lang()][1].format(n);
export const fmt0 = (n: number) => NF[lang()][0].format(n);
/** Multiplicateurs de dégâts : ×0,75 et ×0,35 doivent rester exacts. */
export const fmtM = (n: number) => NF[lang()][2].format(n);

export function targetLabel(mode: TargetMode): string {
  const labels: Record<TargetMode, string> = {
    first: tr('Premier', 'First'), last: tr('Dernier', 'Last'), strong: tr('Plus robuste', 'Strongest'), weak: tr('Plus faible', 'Weakest'), close: tr('Plus proche', 'Closest'),
  };
  return labels[mode];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « 12 or », « 12 gold ». */
export const gold = (n: number | string) => `${n} ${tr('or', 'gold')}`;

/** « 12 éther », « 12 ether ». */
const etherOf = (n: number | string) => `${n} ${tr('éther', 'ether')}`;

const LAYER = (): Record<string, string> => ({ ground: tr('Sol', 'Ground'), air: tr('Air', 'Air'), both: tr('Sol et air', 'Ground and air') });

const FAMILY_FR: Record<string, string> = {
  wall: 'Maçonnerie', archer: 'Archers', cannon: 'Artillerie', frost: 'Givre', storm: 'Foudre', venom: 'Venin', fire: 'Feu', chaos: 'Chaos', gold: 'Or',
  hybrid: 'Hybrides',
};

const FAMILY_EN: Record<string, string> = {
  wall: 'Masonry', archer: 'Archers', cannon: 'Artillery', frost: 'Frost', storm: 'Lightning', venom: 'Venom', fire: 'Fire', chaos: 'Chaos', gold: 'Gold',
  hybrid: 'Hybrids',
};

export function familyLabel(family: string): string {
  return (lang() === 'en' ? FAMILY_EN : FAMILY_FR)[family];
}

function stat(label: string, value: string): string {
  return `<span><em>${label}</em>${value}</span>`;
}

export function matchupTags(type: AttackType, dispel = 0): string {
  const row = ATTACK_TABLE[type];
  const good: string[] = [];
  const bad: string[] = [];
  for (const k of Object.keys(row) as ArmorType[]) {
    if (row[k] >= 1.25) good.push(`${armorLabel(k)} ×${fmtM(row[k])}`);
    if (row[k] <= 0.75) bad.push(`${armorLabel(k)} ×${fmtM(row[k])}`);
  }
  if (type === 'magic') bad.push(`${tr('Immunisés', 'Immune')} ×${fmtM(dispel)}`);
  return [...good.map((g) => `<span class="tag good">${g}</span>`), ...bad.map((b) => `<span class="tag bad">${b}</span>`)].join('');
}

const AURA_LABEL = (): Record<AuraKind, string> => ({ damage: tr('de dégâts', 'damage'), attackSpeed: tr('de cadence', 'attack speed') });

/** « 1,5 case », « 2 cases » ; « 1.5 cells » en anglais. */
const cellsOf = (n: number) => `${fmt1(n)} ${n < 2 ? tr('case', n === 1 ? 'cell' : 'cells') : tr('cases', 'cells')}`;

export function towerSpecials(def: TowerDef): string[] {
  const a = def.attack;
  const s: string[] = [];
  const r = (x: number) => Math.round(x * 100);
  if (def.altar) s.push(tr(`+${r(def.altar.pct)} % de dégâts par cadavre pendant ${fmt1(def.altar.duration)} s, jusqu’à ${def.altar.maxStacks} cumuls`, `+${r(def.altar.pct)}% damage per corpse for ${fmt1(def.altar.duration)} s, up to ${def.altar.maxStacks} stacks`));
  if (def.aura) {
    const bonus = def.aura.share !== undefined ? tr(`${r(def.aura.share)} % du bonus de l’Autel`, `${r(def.aura.share)}% of the Altar bonus`) : `+${percent(r(def.aura.pct ?? 0))}`;
    s.push(tr(`aura ${AURA_LABEL()[def.aura.kind]} ${bonus} à ${fmt1(def.aura.radius)} cases`, `${AURA_LABEL()[def.aura.kind]} aura ${bonus} within ${fmt1(def.aura.radius)} cells`));
  }
  if (def.trade) s.push(tr(`revenu ${def.trade} or / vague`, `income ${def.trade} gold / wave`));
  if (def.bounty) s.push(tr(`prime ×${fmtM(def.bounty)}`, `bounty ×${fmtM(def.bounty)}`));
  if (!a) return s;
  if (a.area) s.push(a.range === 1.5 && a.targets === 'ground' ? tr('corps à corps', 'melee') : tr('frappe toute la zone', 'strikes the whole area'));
  if (a.stun) s.push(tr(`étourdit ${fmt1(a.stun.duration)} s`, `stuns ${fmt1(a.stun.duration)} s`));
  if (a.rampUp) s.push(tr(`montée en puissance jusqu’à +${r(a.rampUp.max)} %`, `ramps up to +${r(a.rampUp.max)}%`));
  if (a.relentless) s.push(tr(`acharnement +${r(a.relentless.step)} % par coup, jusqu’à +${r(a.relentless.max)} %`, `relentless +${r(a.relentless.step)}% per hit, up to +${r(a.relentless.max)}%`));
  if (a.splash) s.push(tr(`zone ${fmt1(a.splash.radius)} cases`, `area ${fmt1(a.splash.radius)} cells`));
  if (a.slow) s.push(tr(`ralentit de ${r(a.slow.pct)} % pendant ${fmt1(a.slow.duration)} s`, `slows by ${r(a.slow.pct)}% for ${fmt1(a.slow.duration)} s`));
  if (def.raise) s.push(tr(`relève un squelette toutes les ${fmt1(def.raise.every)} s, explosion ${def.raise.damage} sur ${cellsOf(def.raise.radius)}`, `raises a skeleton every ${fmt1(def.raise.every)} s, explosion ${def.raise.damage} over ${cellsOf(def.raise.radius)}`));
  if (a.poison) {
    const spread = a.poison.spread ? tr(`, contagion à ${cellsOf(a.poison.spread)}`, `, spreads within ${cellsOf(a.poison.spread)}`) : '';
    s.push(tr(`poison ${a.poison.dps}/s pendant ${a.poison.duration} s (×${a.poison.maxStacks})${spread}`, `poison ${a.poison.dps}/s for ${a.poison.duration} s (×${a.poison.maxStacks})${spread}`));
  }
  if (a.chain) s.push(tr(`rebondit sur ${a.chain.bounces} cibles`, `bounces between ${a.chain.bounces} targets`));
  if (a.multishot) s.push(tr(`${a.multishot} cibles par salve`, `${a.multishot} targets per volley`));
  if (a.crit) s.push(tr(`${r(a.crit.chance)} % de critiques ×${fmt1(a.crit.mult)}`, `${r(a.crit.chance)}% critical hits ×${fmt1(a.crit.mult)}`));
  if (a.armorShred) s.push(tr(`−${a.armorShred.amount} armure`, `−${a.armorShred.amount} armor`));
  if (a.dispel) s.push(tr(`${r(a.dispel)} % des dégâts contre les immunisés à la magie`, `${r(a.dispel)}% damage against magic-immune creatures`));
  if (a.freeze) s.push(tr(`gèle ${r(a.freeze.chance)} % des touches pendant ${fmt1(a.freeze.duration)} s (répit ${fmt1(a.freeze.guard)} s)`, `freezes ${r(a.freeze.chance)}% of hits for ${fmt1(a.freeze.duration)} s (respite ${fmt1(a.freeze.guard)} s)`));
  if (a.ember) {
    const slow = a.ember.slow ? tr(`, ralentit de ${r(a.ember.slow.pct)} %`, `, slows by ${r(a.ember.slow.pct)}%`) : '';
    s.push(tr(`flaque de braise ${cellsOf(a.ember.radius)}, ${fmt1(a.ember.duration)} s, ${a.ember.dps}/s${slow}`, `ember pool ${cellsOf(a.ember.radius)}, ${fmt1(a.ember.duration)} s, ${a.ember.dps}/s${slow}`));
  }
  return s;
}

export function elementsLabel(def: TowerDef): string {
  return def.elements ? def.elements.map(familyLabel).join(' · ') : '';
}

export function towerInfo(def: TowerDef, cost: number | null, heading = towerName(def), range = def.attack?.range ?? 0): string {
  const a = def.attack;
  const costLine = cost !== null ? ` · ${gold(cost)}` : '';
  if (!a) return `<h3>${esc(heading)}${costLine}</h3><p>${esc(towerDesc(def))}</p>`;
  const dps = ((a.dmg[0] + a.dmg[1]) / 2 / a.cooldown) * (a.multishot ?? 1);
  const specials = towerSpecials(def);
  return `<h3>${esc(heading)}${costLine}</h3>
    <div class="stats">
      ${stat(tr('Attaque', 'Attack'), attackLabel(a.type))}
      ${stat(tr('Dégâts', 'Damage'), `${a.dmg[0]}–${a.dmg[1]}`)}
      ${stat(tr('Cadence', 'Rate'), `${fmt1(1 / a.cooldown)}/s`)}
      ${stat(tr('Portée', 'Range'), fmt1(range))}
      ${stat(tr('Cibles', 'Targets'), LAYER()[a.targets])}
      ${stat('DPS', `≈ ${fmt0(dps)}`)}
    </div>
    <p>${esc(towerDesc(def))}${specials.length ? ' ' + esc(cap(specials.join(' · '))) + '.' : ''}</p>
    <div>${matchupTags(a.type, a.dispel)}</div>`;
}

/** Choix de transformation d'un mur : « Tour d'archers (7 or), Garde (12 or) ». */
function transforms(t: Tower, b: BuilderDef): string {
  const list = upgradeOptions(t.def, builderTowers(b, TOWERS)).map((id) => `${esc(towerName(TOWERS[id]))} (${gold(upgradeCost(t.def, TOWERS[id]))})`);
  return list.length ? ` ${tr('Transformer en :', 'Turn into:')} ${list.join(', ')}.` : '';
}

/** Fiche d'une tour posée ; `own` est le bâtisseur du joueur quand la tour est à lui (null sinon) : ses murs listent leurs transformations. */
export function placedTowerInfo(t: Tower, own: BuilderDef | null): string {
  const extra = t.def.attack
    ? `<p>${tr(`${fmt0(t.kills)} éliminations · ${fmt0(t.damage)} dégâts infligés · ciblage ${targetLabel(t.targetMode).toLowerCase()} · revente ${gold(refundValue(t))}`, `${fmt0(t.kills)} kills · ${fmt0(t.damage)} damage dealt · targeting ${targetLabel(t.targetMode).toLowerCase()} · sells for ${gold(refundValue(t))}`)}</p>`
    : `<p>${tr('Revente', 'Sells for')} ${gold(refundValue(t))}.${own ? transforms(t, own) : ''}</p>`;
  const crystal = t.def.attack && t.rangeBonus > 0 ? `<p>${tr(`+${Math.round(t.rangeBonus * 100)} % de portée (cristal)`, `+${Math.round(t.rangeBonus * 100)}% range (crystal)`)}</p>` : '';
  return towerInfo(t.def, null, towerName(t.def), towerRange(t)) + crystal + extra;
}

/** « Sans armure », « Armure légère »… */
export function armorName(type: ArmorType): string {
  if (type === 'unarmored') return armorLabel(type);
  return tr(`Armure ${armorLabel(type).toLowerCase()}`, `${armorLabel(type)} armor`);
}

export function creepTags(def: CreepDef): string {
  const tags = [`<span class="tag">${armorName(def.armorType)}${def.armor ? ` ${def.armor}` : ''}</span>`];
  if (def.air) tags.push(`<span class="tag air">${tr('Volant', 'Flying')}</span>`);
  if (def.magicImmune) tags.push(`<span class="tag bad">${tr('Immunisé à la magie', 'Magic immune')}</span>`);
  if (def.regen) tags.push(`<span class="tag">${tr(`Régénère ${fmt1(def.regen * 100)} %/s`, `Regenerates ${fmt1(def.regen * 100)}%/s`)}</span>`);
  if (def.boss) tags.push(`<span class="tag bad">${tr(`Chef · coûte ${def.leak} vies`, `Boss · costs ${def.leak} lives`)}</span>`);
  return tags.join('');
}

function builderTowerWhere(b: BuilderDef, match: (t: TowerDef) => unknown): TowerDef | undefined {
  const own = builderTowers(b, TOWERS);
  return Object.values(TOWERS).find((t) => own.has(t.id) && match(t));
}

/** Tour dissipante accessible au bâtisseur, s'il en a une. */
const dispellerOf = (b: BuilderDef) => builderTowerWhere(b, (t) => t.attack?.dispel);

/** Tour de chaos (seule à toucher les immunisés de plein fouet) accessible au bâtisseur, s'il en a une. */
const chaosTowerOf = (b: BuilderDef) => builderTowerWhere(b, (t) => t.attack?.type === 'chaos');

/**
 * Tours du bâtisseur les plus efficaces contre une créature, groupées par type d'attaque :
 * « Canon, Enclume (Siège ×1,5) ». Les efficaces du plus bas niveau, sinon la meilleure tour de base.
 */
export function counters(def: CreepDef, b: BuilderDef): string {
  const own = builderTowers(b, TOWERS);
  const usable = (t: TowerDef) => t.attack && !t.elements && !(t.attack.type === 'magic' && def.magicImmune);
  const mult = (t: TowerDef) => ATTACK_TABLE[t.attack!.type][def.armorType];
  const strong = Object.values(TOWERS).filter((t) => own.has(t.id) && usable(t) && mult(t) >= 1.25);
  const low = Math.min(...strong.map((t) => t.tier));
  let pick = strong.filter((t) => t.tier === low);
  if (!pick.length) {
    const roots = b.roots.map(tower).filter(usable);
    const best = Math.max(...roots.map(mult));
    pick = roots.filter((t) => mult(t) === best);
  }
  // Ordre du menu de construction : tours de base d'abord.
  const rank = (t: TowerDef) => (b.roots.includes(t.id) ? b.roots.indexOf(t.id) : b.roots.length);
  pick.sort((x, y) => rank(x) - rank(y));
  const types = [...new Set(pick.map((t) => t.attack!.type))];
  const list = types.map((type) => {
    const names = pick.filter((t) => t.attack!.type === type).map(towerName).join(', ');
    return `${names} (${attackLabel(type)} ×${fmtM(ATTACK_TABLE[type][def.armorType])})`;
  }).join(', ');
  const dispeller = def.magicImmune && dispellerOf(b);
  if (!dispeller) return list || tr('aucune de vos tours', 'none of your towers');
  return list ? `${list} ${tr('ou', 'or')} ${towerName(dispeller)}` : towerName(dispeller);
}

const bestLine = (def: CreepDef, b: BuilderDef) => `${tr('Le plus efficace :', 'Most effective:')} ${counters(def, b)}.`;

function waveHint(def: CreepDef, b: BuilderDef): string {
  let hint = bestLine(def, b);
  if (def.air) hint += tr(' Ils survolent le labyrinthe en ligne droite : seules les tours qui visent l’air les touchent.', ' They fly straight over the maze: only towers that target air can hit them.');
  if (def.magicImmune) {
    const dispeller = dispellerOf(b);
    const chaos = chaosTowerOf(b);
    const except = chaos ? tr(`, sauf le ${towerName(chaos)}`, `, except the ${towerName(chaos)}`) : '';
    const share = dispeller ? Math.round(dispeller.attack!.dispel! * 100) : 0;
    const part = dispeller ? tr(` ; le ${towerName(dispeller)} les entame à ${share} %`, `; the ${towerName(dispeller)} deals ${share}% to them`) : '';
    hint += tr(` Givre et foudre ne leur font rien${except}${part}.`, ` Frost and lightning do nothing to them${except}${part}.`);
  }
  return hint;
}

const waveName = (g: WaveBriefingGroup) => (g.creep.boss ? creepName(g.creep) : creepPlural(g.creep));

function nextWaveGroup(g: WaveBriefingGroup): string {
  const count = g.count > 1 ? ` ×${g.count}` : '';
  return `<div>${esc(waveName(g))}${count}</div>
      <div class="stats">${stat(tr('PV', 'HP'), fmt0(g.hp))}${stat(tr('Vitesse', 'Speed'), fmt1(g.creep.speed))}${stat(tr('Butin', 'Bounty'), gold(g.bounty))}</div>
      <div>${creepTags(g.creep)}</div>`;
}

export function nextWaveInfo(b: WaveBriefing, builder: BuilderDef): string {
  return `<h3>${tr('Prochaine vague', 'Next wave')} ${b.wave + 1}</h3>
      ${b.groups.map(nextWaveGroup).join('')}
      <p>${esc(waveHint(b.groups[0].creep, builder))}</p>`;
}

/** Effets en cours sur une créature (ralentissement, corrosion, poison). */
export function creepEffects(c: Creep): string[] {
  const s: string[] = [];
  if (c.slowPct > 0) s.push(tr(`Ralenti de ${Math.round(c.slowPct * 100)} % · encore ${fmt1(c.slowTimer)} s`, `Slowed by ${Math.round(c.slowPct * 100)}% · ${fmt1(c.slowTimer)} s left`));
  if (c.shred > 0) s.push(tr(`Armure corrodée de ${c.shred} · encore ${fmt1(c.shredTimer)} s`, `Armor corroded by ${c.shred} · ${fmt1(c.shredTimer)} s left`));
  if (c.poisons.length) {
    const dps = c.poisons.reduce((sum, p) => sum + p.dps, 0);
    const t = Math.max(...c.poisons.map((p) => p.t));
    const doses = `${c.poisons.length} dose${c.poisons.length > 1 ? 's' : ''}`;
    s.push(tr(`Empoisonné · ${doses} · ${fmt0(dps)} PV/s · encore ${fmt1(t)} s`, `Poisoned · ${doses} · ${fmt0(dps)} HP/s · ${fmt1(t)} s left`));
  }
  return s;
}

export function fateLabel(fate: TowerFate): string {
  return { standing: tr('En place', 'Standing'), sold: tr('Vendue', 'Sold'), destroyed: tr('Détruite', 'Destroyed') }[fate];
}

/** « 3 éliminations » ; `en` est le mot anglais au singulier, pluriel en « s ». */
const plural = (n: number, word: string, en: string) => `${fmt0(n)} ${tr(word, en)}${n > 1 ? 's' : ''}`;

/** Les cinq tours qui ont fait le plus de dégâts, chacune avec une barre relative à la meilleure. */
export function debriefTowers(towers: Tower[], icon: (defId: string) => string): string {
  if (!towers.length) return `<p class="debrief-note">${tr('Aucune tour n’a tiré.', 'No tower fired.')}</p>`;
  const top = Math.max(1, towers[0].damage);
  const rows = towers.slice(0, 5).map((t) => `<li class="debrief-tower">
      ${icon(t.def.id)}
      <div>
        <p><b>${esc(towerName(t.def))}</b>${t.fate === 'standing' ? '' : ` <span class="debrief-fate">${fateLabel(t.fate)}</span>`}</p>
        <div class="debrief-track"><div class="debrief-bar" style="width: ${fmt0((t.damage / top) * 100)}%"></div></div>
        <p class="debrief-note">${fmt0(t.damage)} ${tr('dégâts', 'damage')} · ${plural(t.kills, 'élimination', 'kill')}</p>
      </div>
    </li>`).join('');
  const rest = towers.length - 5;
  const s = rest > 1 ? 's' : '';
  const more = rest > 0 ? `<p class="debrief-note">${tr(`+ ${rest} autre${s} tour${s}`, `+ ${rest} other tower${s}`)}</p>` : '';
  return `<ol class="debrief-towers">${rows}</ol>${more}`;
}

export function debriefFamilies(rows: ReturnType<typeof familyDamage>): string {
  return `<p class="debrief-note">${tr('Dégâts par famille :', 'Damage by family:')} ${rows.map((r) => `${familyLabel(r.family)} ${percent(fmt0(r.share * 100))}`).join(' · ')}</p>`;
}

/** Une colonne par vague, haute en proportion des vies perdues. */
export function debriefWaves(rows: ReturnType<typeof waveCurve>): string {
  const top = Math.max(1, ...rows.map((r) => r.livesLost));
  const cols = rows.map((r) => {
    const tip = tr(`Vague ${r.wave + 1} : ${plural(r.livesLost, 'vie', 'life')} perdue${r.livesLost > 1 ? 's' : ''}`, `Wave ${r.wave + 1}: ${fmt0(r.livesLost)} ${r.livesLost > 1 ? 'lives' : 'life'} lost`);
    return `<div class="debrief-col" title="${tip}" aria-label="${tip}"><div style="height: ${fmt0((r.livesLost / top) * 100)}%"></div></div>`;
  }).join('');
  const last = rows.length ? rows[rows.length - 1].wave + 1 : 1;
  return `<div class="debrief-chart">${cols}</div><div class="debrief-axis"><span>${tr('Vague', 'Wave')} 1</span><span>${tr('Vague', 'Wave')} ${last}</span></div>`;
}

export function debriefBreakers(losses: ReturnType<typeof breakerLosses>): string {
  if (losses.count === 0) return `<p class="debrief-breakers">${tr('Aucune tour perdue', 'No tower lost')}</p>`;
  const noun = losses.count > 1 ? tr('tours détruites', 'towers destroyed') : tr('tour détruite', 'tower destroyed');
  return `<p class="debrief-breakers">${fmt0(losses.count)} ${noun} ${tr('par les briseurs', 'by breakers')} · ${gold(fmt0(losses.gold))} ${tr('perdus', 'lost')}</p>`;
}

export interface ScoreboardPlayer {
  name: string;
  wave: number;
  lives: number;
  stats: Stats;
}

/** Critères de fin de partie multijoueur : `low` quand le plus petit chiffre est le meilleur. */
const CRITERIA = (): { label: string; value: (p: ScoreboardPlayer) => number; low?: boolean }[] => [
  { label: tr('Vague atteinte', 'Wave reached'), value: (p) => p.wave + 1 },
  { label: tr('Vies restantes', 'Lives left'), value: (p) => p.lives },
  { label: tr('Éliminations', 'Kills'), value: (p) => p.stats.kills },
  { label: tr('Évasions', 'Leaks'), value: (p) => p.stats.leaked, low: true },
  { label: tr('Dégâts', 'Damage'), value: (p) => [...p.stats.towers.values()].reduce((sum, t) => sum + t.damage, 0) },
  { label: tr('Or gagné', 'Gold earned'), value: (p) => p.stats.goldEarned },
  { label: tr('Plus long trajet', 'Longest route'), value: (p) => p.stats.longestMaze },
  { label: tr('Tours détruites', 'Towers destroyed'), value: (p) => breakerLosses(p.stats.towers.values()).count, low: true },
];

/** Tableau comparatif : une ligne par critère, une colonne par joueur, le meilleur de chaque ligne marqué (personne en cas d'égalité générale). */
export function scoreboard(players: ScoreboardPlayer[]): string {
  const head = players.map((p) => `<th scope="col">${esc(p.name)}</th>`).join('');
  const rows = CRITERIA().map((c) => {
    const values = players.map(c.value);
    const best = c.low ? Math.min(...values) : Math.max(...values);
    const tied = values.every((v) => v === best);
    const cells = values.map((v) => `<td${!tied && v === best ? ' class="best"' : ''}>${fmt0(v)}</td>`).join('');
    return `<tr><th scope="row">${c.label}</th>${cells}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="scoreboard"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function sendPanel(ether: number, income: number): string {
  const rows = Object.values(CREEPS)
    .filter((c) => c.send)
    .map((c) => `<button type="button" data-send="${c.id}"${ether < c.send!.cost ? ' disabled' : ''}>${esc(creepName(c))}<span class="cost">${etherOf(c.send!.cost)}</span><span class="gain">+${c.send!.income}</span></button>`)
    .join('');
  return `<h3>${tr('Revenu', 'Income')} ${fmt0(income)}</h3><div class="sends">${rows}</div>`;
}

export function gleanerPanel(ether: number, gleaners: number, buy: Result, cost: number): string {
  const attrs = buy.ok ? '' : ` disabled title="${esc(reasonText(buy.reason))}"`;
  return `<h3>${tr('Glaneurs :', 'Gleaners:')} ${fmt0(gleaners)}</h3><p>${tr('Éther :', 'Ether:')} ${fmt0(ether)}</p><div class="sends"><button type="button" data-gleaner${attrs}>${tr('Glaneur', 'Gleaner')}<span class="cost">${gold(cost)}</span></button></div>`;
}

export function gatePanel(ether: number, gate: World['gate']): string {
  const rows = (['shot', 'ramparts'] as const).map((k) => {
    const level = gate[k];
    const name = k === 'shot' ? tr('Tir', 'Shot') : tr('Remparts', 'Ramparts');
    const head = `<p>${name} · ${tr('Niveau', 'Level')} ${level}</p>`;
    if (level >= GATE[k].maxLevel) return `${head}<p>${tr('Niveau maximal atteint', 'Maximum level reached')}</p><button type="button" data-gate="${k}" disabled>${name}</button>`;
    const cost = gateLevelCost(level + 1);
    return `${head}<button type="button" data-gate="${k}"${ether < cost ? ' disabled' : ''}>${name}<span class="cost">${etherOf(cost)}</span><span class="gain">+${gateLevelIncome(level + 1)}</span></button>`;
  });
  return `<h3>${tr('Porte', 'Gate')}</h3><div class="sends">${rows.join('')}</div>`;
}

const svg = (body: string) => `<svg viewBox="0 0 20 20" aria-hidden="true">${body}</svg>`;

/** Icônes de l'encart adverse ; l'or et les vies reprennent celles de la barre du haut. */
const RIVAL_ICON = {
  lives: svg('<path d="M10 17s-7-4.3-7-9.2A3.8 3.8 0 0110 5.6a3.8 3.8 0 017 2.2C17 12.7 10 17 10 17z" fill="#d8553f" stroke="#6e2419" stroke-width="1.2"/>'),
  gold: svg('<circle cx="10" cy="10" r="8" fill="#e9b949" stroke="#8a6320" stroke-width="1.5"/><path d="M10 5.5v9M7.5 7.5h4a1.6 1.6 0 010 3.2h-3a1.6 1.6 0 000 3.2h4" fill="none" stroke="#8a6320" stroke-width="1.4"/>'),
  income: svg('<path d="M10 3l6.5 7H12.5v7h-5v-7H3.5z" fill="#7cc47f" stroke="#2f6131" stroke-width="1.3" stroke-linejoin="round"/>'),
  gleaners: svg('<path d="M4 17.5l6.5-7.5" stroke="#9a6b3a" stroke-width="2.2" stroke-linecap="round"/><path d="M9.5 11C8 5.5 12.5 2 17.5 3.5 13 4.5 11.5 7.5 12 11.5z" fill="#cfd6dc" stroke="#55606b" stroke-width="1.2" stroke-linejoin="round"/>'),
  shot: svg('<circle cx="10" cy="10" r="6.5" fill="none" stroke="#e58a4e" stroke-width="1.8"/><circle cx="10" cy="10" r="2" fill="#e58a4e"/><path d="M10 1.5v4M10 14.5v4M1.5 10h4M14.5 10h4" stroke="#e58a4e" stroke-width="1.8" stroke-linecap="round"/>'),
  ramparts: svg('<path d="M10 2l7 3v5c0 4-3 6.5-7 8-4-1.5-7-4-7-8V5z" fill="#6f8fb8" stroke="#2c3e57" stroke-width="1.3" stroke-linejoin="round"/>'),
};

const rivalStat = (icon: string, label: string, value: string) =>
  `<div class="rv-stat">${icon}<span>${label}</span><strong>${value}</strong></div>`;

export function reachedTitle(wave: number): string {
  return tr(`Vague ${wave + 1} atteinte`, `Wave ${wave + 1} reached`);
}

export function partnerLabel(coop: boolean): string {
  return coop ? tr('Partenaire', 'Partner') : tr('Adversaire', 'Opponent');
}

/** Détail de l'encart adverse déroulé. Jamais l'éther : il reste caché. */
export function rivalDetail(rival: World): string {
  const duelStats = rival.duel
    ? `${rivalStat(RIVAL_ICON.income, tr('Revenu', 'Income'), `+${fmt0(rival.income)}`)}
      ${rivalStat(RIVAL_ICON.gleaners, tr('Glaneurs', 'Gleaners'), fmt0(rival.gleaners.length))}
      ${rivalStat(RIVAL_ICON.shot, tr('Tir', 'Shot'), `${tr('niv.', 'lvl')} ${rival.gate.shot}`)}
      ${rivalStat(RIVAL_ICON.ramparts, tr('Remparts', 'Ramparts'), `${tr('niv.', 'lvl')} ${rival.gate.ramparts}`)}`
    : '';
  return `<p class="rv-builder"><span>${tr('Bâtisseur', 'Builder')}</span> ${esc(builderName(rival.builder))}</p>
    <div class="rv-stats">
      ${rivalStat(RIVAL_ICON.gold, tr('Or', 'Gold'), fmt0(rival.gold))}
      ${duelStats}
    </div>`;
}

export function creepInfo(c: Creep, builder: BuilderDef): string {
  const effects = creepEffects(c).map((e) => `<span class="tag good">${esc(e)}</span>`).join('');
  return `<h3>${esc(creepName(c.def))} · ${tr('vague', 'wave')} ${c.wave + 1}</h3>
    <div class="stats">${stat(tr('PV', 'HP'), `${fmt0(c.hp)} / ${fmt0(c.maxHp)}`)}${stat(tr('Vitesse', 'Speed'), fmt1(creepSpeed(c)))}${stat(tr('Armure', 'Armor'), fmt0(c.def.armor - c.shred))}</div>
    <div>${creepTags(c.def)}</div>
    ${effects ? `<div>${effects}</div>` : ''}
    <p>${esc(bestLine(c.def, builder))}</p>`;
}

/** Annonce à l'envoyeur : « Vos 3 Harpies et 2 Loups gris attaquent Paul ». */
export function sentMessage(groups: SendGroup[], nick: string): string {
  const total = groups.reduce((n, g) => n + g.count, 0);
  const names = groups.map((g) => `${g.count} ${g.count > 1 ? creepPlural(g.creep) : creepName(g.creep)}`);
  const who = total === 1 ? creepName(groups[0].creep) : `${names.slice(0, -1).join(', ')}${names.length > 1 ? tr(' et ', ' and ') : ''}${names[names.length - 1]}`;
  if (total === 1) return tr(`Votre ${who} attaque ${nick}`, `Your ${who} attacks ${nick}`);
  return tr(`Vos ${who} attaquent ${nick}`, `Your ${who} attack ${nick}`);
}

/** Meuble du blason de chaque bâtisseur, dessiné dans l'écu (0 0 48 56) ; `.ink` reprend le fond de la fiche. */
const CREST_CHARGE: Record<string, string> = {
  bastion: '<path d="M14 40V18h4v4h4v-4h4v4h4v-4h4v22z"/><path class="ink" d="M21 40v-6a3 3 0 016 0v6z"/>',
  forge: '<path d="M12 22h24c0 4-3 6-8 6v3l4 7H16l4-7v-3c-5 0-8-2-8-6z"/><path d="M24 11v5M17 13l2 4M31 13l-2 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  sylve: '<path d="M24 11C13 19 13 34 24 43C35 34 35 19 24 11z"/><path class="ink" d="M24 16v24M24 26l-5-4M24 32l5-4" stroke-width="1.6" stroke-linecap="round"/>',
  pyromancers: '<path d="M25 10c1 7 9 10 9 19a10 10 0 01-20 0c0-5 3-8 4-11 1 3 2 5 4 5 0-5 0-9 3-13z"/><path class="ink" d="M24 41a4 4 0 01-4-4c0-3 2-4 3-7 2 3 5 4 5 7a4 4 0 01-4 4z"/>',
  necromancers: '<path d="M14 27a10 10 0 0120 0v5l-3 2v5H17v-5l-3-2z"/><circle class="ink" cx="20" cy="28" r="2.6"/><circle class="ink" cx="28" cy="28" r="2.6"/><path class="ink" d="M21 39v-3M24 39v-3M27 39v-3" stroke-width="1.4"/>',
  guild: '<circle cx="24" cy="27" r="11"/><circle class="ink" cx="24" cy="27" r="8.6"/><circle cx="24" cy="27" r="7"/><path class="ink" d="M24 21.5l3.6 5.5-3.6 5.5-3.6-5.5z"/>',
  sanctuary: '<path d="M24 13v28M12 20l24 14M36 20L12 34M20 15l4 4 4-4M20 39l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  arcanists: '<path d="M28 10L15 30h8l-3 14 14-21h-8z"/>',
};

export function crest(id: string): string {
  return `<svg class="crest" viewBox="0 0 48 56" aria-hidden="true"><path d="M4 4h40v22c0 14-10 22-20 26C14 48 4 40 4 26z" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="2"/><g fill="currentColor">${CREST_CHARGE[id] ?? ''}</g></svg>`;
}

/** Logo du jeu : sceau runique où le sentier tracé entre les murs mène au cristal. */
export function logo(): string {
  const rune = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path transform="rotate(${a} 60 60)" d="M60 7v6M57 9l3 2 3-2"/>`).join('');
  return `<svg class="logo" viewBox="0 0 120 120" aria-hidden="true">
    <defs>
      <filter id="logoGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="logoIn"><circle cx="60" cy="60" r="46"/></clipPath>
    </defs>
    <circle cx="60" cy="60" r="56" fill="#151b24" stroke="#557a9e" stroke-width="2"/>
    <circle cx="60" cy="60" r="46" fill="#0a0d12" stroke="#334052" stroke-width="1.5"/>
    <g stroke="#6fa8dc" stroke-opacity="0.7" stroke-width="1.6" stroke-linecap="round" fill="none">${rune}</g>
    <g clip-path="url(#logoIn)" fill="#2a3546" stroke="#4a5a70" stroke-width="1">
      <rect x="47" y="41" width="60" height="10" rx="2"/><rect x="13" y="69" width="60" height="10" rx="2"/>
      <rect x="10" y="10" width="64" height="16" rx="2"/><rect x="56" y="94" width="54" height="16" rx="2"/>
    </g>
    <path d="M86 4V32H34V60H86V88H44V96" fill="none" stroke="#6fa8dc" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" filter="url(#logoGlow)"/>
    <path d="M44 90l7 9-7 9-7-9z" fill="#e9b949" stroke="#0a0d12" stroke-width="1.5"/>
  </svg>`;
}

/** Carte d'un bâtisseur : blason et nom ; le style, la faiblesse et les tours de base s'affichent au survol. */
export function builderCard(b: BuilderDef): string {
  const roots = b.roots.map((id) => esc(towerName(tower(id)))).join(' · ');
  return `${crest(b.id)}<h3>${esc(builderName(b))}</h3>
    <div class="builder-info" role="tooltip">
      <p>${esc(builderStyle(b))}</p>
      <p class="weakness"><em>${tr('Faiblesse', 'Weakness')}</em> ${esc(builderWeakness(b))}</p>
      <p class="roots"><em>${tr('Tours de base', 'Base towers')}</em> ${roots}</p>
    </div>`;
}

const recapLine = (g: SendGroup, extra = '') =>
  `${g.count} ${g.count > 1 ? creepPlural(g.creep) : creepName(g.creep)} · ${g.creep.air ? 'air' : tr('sol', 'ground')}${extra}`;

/** Lignes affichées sous la bannière de vague : ses groupes, puis les envois reçus, par envoyeur (texte brut, dessiné sur le canvas). */
export function waveRecap(b: WaveBriefing, received: { nick: string; groups: SendGroup[] }[]): string[] {
  const lines = b.groups.map((g) => recapLine(g, g.creep.boss ? ` · ${tr('chef', 'boss')}` : ''));
  for (const r of received) {
    if (r.groups.length) lines.push(`${tr('Envoyés par', 'Sent by')} ${r.nick}`, ...r.groups.map((g) => recapLine(g)));
  }
  return lines;
}

export function rivalHeadline(nick: string, lives: number): string {
  return `<span class="rv-nick">${esc(nick)}</span><span class="rv-lives" title="${lives > 1 ? tr('Vies', 'Lives') : tr('Vie', 'Life')}">${RIVAL_ICON.lives}<strong>${fmt0(lives)}</strong></span>`;
}

const teamLabel = (team: Team) => `${tr('Équipe', 'Team')} ${team === Team.A ? 'A' : 'B'}`;
const TEAM_SIZE = 2;

/** Les deux équipes du salon 2 contre 2 ; chaque colonne est un bouton `data-team` pour la rejoindre. */
export function teamRoster(teams: Record<Team, { nick: string; picked: boolean }[]>, waiting: string[]): string {
  const column = (team: Team) => {
    const players = teams[team].map((p) => `<li>${esc(p.nick)} · ${p.picked ? tr('prêt', 'ready') : tr('choisit…', 'choosing…')}</li>`);
    const free = Array.from({ length: Math.max(0, TEAM_SIZE - players.length) }, () => `<li>${tr('place libre', 'open seat')}</li>`);
    return `<button type="button" class="diff" data-team="${team}"><strong>${teamLabel(team)}</strong><ul>${[...players, ...free].join('')}</ul></button>`;
  };
  const wait = waiting.length ? `<p>${tr('En attente :', 'Waiting:')} ${waiting.map(esc).join(', ')}</p>` : '';
  return `<div class="modes">${column(Team.A)}${column(Team.B)}</div>${wait}`;
}

/** Les deux joueurs du salon duel ou coop, en cartes côte à côte comme les équipes du 2 contre 2 ; l'invité absent est « en attente… ». */
export function pairRoster(host: { nick: string; picked: boolean }, guest: { nick: string | null; picked: boolean }): string {
  const card = (p: { nick: string | null; picked: boolean }) => p.nick === null
    ? `<div class="diff"><strong>${tr('en attente…', 'waiting…')}</strong><span>${tr('place libre', 'open seat')}</span></div>`
    : `<div class="diff"><strong>${esc(p.nick)}</strong><span>${p.picked ? tr('a choisi', 'has chosen') : tr('choisit…', 'choosing…')}</span></div>`;
  return `<div class="modes roster">${card(host)}${card(guest)}</div>`;
}

export function goldForecastChip(gold: number, r: WaveReward): string {
  return `<b>${fmt0(gold)}</b> ${tr('or', 'gold')} <small>${tr(`+${fmt0(r.bonus + r.interest + r.income)} en fin de vague`, `+${fmt0(r.bonus + r.interest + r.income)} at wave end`)}</small>`;
}

/** Ligne d'une tour trop chère : l'or qui manque. */
export function missingGold(cost: number, gold: number): string {
  return gold < cost ? `<p class="bad">${tr(`Il manque ${fmt0(cost - gold)} or.`, `${fmt0(cost - gold)} gold short.`)}</p>` : '';
}

/** Barre du haut : « Vague 1 dans 34 s » avant la première vague, puis la suivante. */
export function nextWaveLabel(wave: number, secs: number): string {
  return tr(`Vague ${wave + 2} dans ${secs} s`, `Wave ${wave + 2} in ${secs} s`);
}

/** Effet d'une construction sur le trajet, calculé sur les longueurs arrondies affichées. */
export function routeChange(now: number, delta: number): string {
  const before = Math.round(now);
  const after = Math.round(now + delta);
  return after > before
    ? `<p class="route">${tr('Trajet :', 'Route:')} ${fmt0(before)} → ${fmt0(after)} ${tr('cases', 'cells')} (+${fmt0(after - before)})</p>`
    : `<p>${tr(`Trajet inchangé : ${fmt0(before)} cases.`, `Route unchanged: ${fmt0(before)} cells.`)}</p>`;
}

export function goldForecastInfo(r: WaveReward, duel: boolean): string {
  const line = (label: string, n: number) => `<p class="facts">${label}${tr(' :', ':')} +${fmt0(n)}</p>`;
  const rest = duel ? line(tr('Revenu', 'Income'), r.income) : line(tr('Intérêts', 'Interest'), r.interest) + (r.capped ? `<p>${tr('plafond atteint', 'cap reached')}</p>` : '');
  return `<h3>${tr('Gain en fin de vague', 'End-of-wave gain')}</h3>${line(tr('Prime', 'Bonus'), r.bonus)}${rest}`;
}

export function etherChip(ether: number, perMinute: number): string {
  return `<b>${fmt0(ether)}</b> ${tr('éther', 'ether')} · +${fmt0(perMinute)}/min`;
}

export function resignPrompt(): { question: string; confirm: string; cancel: string } {
  return { question: tr('Quitter la partie ? Elle sera perdue.', 'Quit the game? It will be lost.'), confirm: tr('Quitter', 'Quit'), cancel: tr('Annuler', 'Cancel') };
}
