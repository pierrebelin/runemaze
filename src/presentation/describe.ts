import type { World } from '../domain/model/World';
import type { SendGroup, WaveBriefing, WaveBriefingGroup } from '../application/queries/waveBriefing';
import { ARMOR_LABEL, ATTACK_LABEL, ATTACK_TABLE } from '../domain/rules/Damage';
import type { AuraKind, BuilderDef, ArmorType, AttackType, Creep, CreepDef, Result, TargetMode, Tower, TowerDef, TowerFate } from '../domain/model/types';
import type { breakerLosses, familyDamage, waveCurve } from '../domain/rules/debrief';
import { towerYield } from '../domain/rules/debrief';
import { towerRange } from '../domain/rules/crystal';
import { builderTowers } from '../domain/rules/builder';
import { CREEPS } from '../domain/catalog/creeps';
import { TOWERS, tower } from '../domain/catalog/towers';
import { GATE } from '../domain/catalog/ether';
import { gateLevelCost, gateLevelIncome, refundValue } from '../domain/rules/pricing';
import { creepSpeed } from '../domain/rules/speed';
import { Mode, Team, Verdict } from '../application/online/protocol';
import type { Biome, CellKind, MapDef } from '../domain/model/types';
import { Grid } from '../domain/model/Grid';
import { TERRAIN } from '../domain/catalog/map';
import { emptyLegs } from '../domain/rules/mapDraw';
import type { WaveReward } from '../domain/rules/waveReward';

const MODE_LABEL: Record<Mode, string> = {
  [Mode.Duel]: 'Duel',
  [Mode.Coop]: 'Coopération',
  [Mode.Teams]: '2 contre 2',
};

const BIOME_LABEL: Record<Biome, string> = { earth: 'Terre', snow: 'Neige', space: 'Espace' };

export function biomeLabel(biome: Biome): string {
  return BIOME_LABEL[biome];
}

const pct = (x: number) => Math.round(x * 100);

const BIOME_EFFECT: Record<Biome, string> = {
  earth: 'Des rochers barrent le terrain : ni passage, ni construction.',
  snow: `La glace accélère les créatures terrestres de ${pct(TERRAIN.ice.speed - 1)} % ; on n’y bâtit pas.`,
  space: `Une tour sur cristal gagne ${pct(TERRAIN.crystal.range)} % de portée ; les trous de ver relient deux points du terrain.`,
};

export function biomeEffect(biome: Biome): string {
  return BIOME_EFFECT[biome];
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
  const facts = [fact(route, 'case de trajet à vide', 'cases de trajet à vide'), fact(grid.checkpoints.length, 'pierre runique', 'pierres runiques')];
  if (cells('rock')) facts.push(fact(cells('rock'), 'case de rocher', 'cases de rocher'));
  if (cells('ice')) facts.push(fact(cells('ice'), 'case de glace', 'cases de glace'));
  if (cells('crystal')) facts.push(fact(cells('crystal'), 'cristal', 'cristaux'));
  if (grid.wormholes.length) facts.push(fact(grid.wormholes.length, 'trou de ver', 'trous de ver'));
  return facts;
}

export function modeLabel(mode: Mode): string {
  return MODE_LABEL[mode];
}

const MODE_HINT: Record<Mode, string> = {
  [Mode.Duel]: '1 contre 1',
  [Mode.Coop]: 'À deux, vies communes',
  [Mode.Teams]: '4 joueurs, 2 équipes',
};

/** Résumé d'un mode sous son nom, à l'accueil. */
export function modeHint(mode: Mode): string {
  return MODE_HINT[mode];
}

const DUEL_VERDICT_LABEL: Record<Verdict, string> = {
  [Verdict.Victory]: 'Victoire',
  [Verdict.Defeat]: 'Défaite',
  [Verdict.Draw]: 'Égalité',
  [Verdict.Forfeit]: 'Victoire par forfait',
  [Verdict.Abandon]: 'Défaite',
};

export function duelVerdictLabel(v: Verdict): string {
  return DUEL_VERDICT_LABEL[v];
}

// Textes du panneau d'information. Tout est échappé : les seules données
// injectées viennent des fichiers de données du jeu.

const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
export const fmt1 = (n: number) => nf1.format(n);
export const fmt0 = (n: number) => nf0.format(n);
const nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
/** Multiplicateurs de dégâts : ×0,75 et ×0,35 doivent rester exacts. */
export const fmtM = (n: number) => nf2.format(n);

export const TARGET_LABEL: Record<TargetMode, string> = {
  first: 'Premier', last: 'Dernier', strong: 'Plus robuste', weak: 'Plus faible', close: 'Plus proche',
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const LAYER: Record<string, string> = { ground: 'Sol', air: 'Air', both: 'Sol et air' };

export const FAMILY_LABEL: Record<string, string> = {
  wall: 'Maçonnerie', archer: 'Archers', cannon: 'Artillerie', frost: 'Givre', storm: 'Foudre', venom: 'Venin', fire: 'Feu', chaos: 'Chaos', gold: 'Or',
  hybrid: 'Hybrides',
};

function stat(label: string, value: string): string {
  return `<span><em>${label}</em>${value}</span>`;
}

export function matchupTags(type: AttackType, dispel = 0): string {
  const row = ATTACK_TABLE[type];
  const good: string[] = [];
  const bad: string[] = [];
  for (const k of Object.keys(row) as ArmorType[]) {
    if (row[k] >= 1.25) good.push(`${ARMOR_LABEL[k]} ×${fmtM(row[k])}`);
    if (row[k] <= 0.75) bad.push(`${ARMOR_LABEL[k]} ×${fmtM(row[k])}`);
  }
  if (type === 'magic') bad.push(`Immunisés ×${fmtM(dispel)}`);
  return [...good.map((g) => `<span class="tag good">${g}</span>`), ...bad.map((b) => `<span class="tag bad">${b}</span>`)].join('');
}

const AURA_LABEL: Record<AuraKind, string> = { damage: 'de dégâts', attackSpeed: 'de cadence' };

export function towerSpecials(def: TowerDef): string[] {
  const a = def.attack;
  const s: string[] = [];
  if (def.altar) s.push(`+${Math.round(def.altar.pct * 100)} % de dégâts par cadavre pendant ${fmt1(def.altar.duration)} s, jusqu’à ${def.altar.maxStacks} cumuls`);
  if (def.aura) {
    const bonus = def.aura.share !== undefined ? `${Math.round(def.aura.share * 100)} % du bonus de l’Autel` : `+${Math.round((def.aura.pct ?? 0) * 100)} %`;
    s.push(`aura ${AURA_LABEL[def.aura.kind]} ${bonus} à ${fmt1(def.aura.radius)} cases`);
  }
  if (def.trade) s.push(`revenu ${def.trade} or / vague`);
  if (def.bounty) s.push(`prime ×${fmtM(def.bounty)}`);
  if (!a) return s;
  if (a.area) s.push(a.range === 1.5 && a.targets === 'ground' ? 'corps à corps' : 'frappe toute la zone');
  if (a.stun) s.push(`étourdit ${fmt1(a.stun.duration)} s`);
  if (a.rampUp) s.push(`montée en puissance jusqu’à +${Math.round(a.rampUp.max * 100)} %`);
  if (a.relentless) s.push(`acharnement +${Math.round(a.relentless.step * 100)} % par coup, jusqu’à +${Math.round(a.relentless.max * 100)} %`);
  if (a.splash) s.push(`zone ${fmt1(a.splash.radius)} cases`);
  if (a.slow) s.push(`ralentit de ${Math.round(a.slow.pct * 100)} % pendant ${fmt1(a.slow.duration)} s`);
  if (def.raise) s.push(`relève un squelette toutes les ${fmt1(def.raise.every)} s, explosion ${def.raise.damage} sur ${fmt1(def.raise.radius)} ${def.raise.radius < 2 ? 'case' : 'cases'}`);
  if (a.poison) {
    const spread = a.poison.spread ? `, contagion à ${fmt1(a.poison.spread)} ${a.poison.spread < 2 ? 'case' : 'cases'}` : '';
    s.push(`poison ${a.poison.dps}/s pendant ${a.poison.duration} s (×${a.poison.maxStacks})${spread}`);
  }
  if (a.chain) s.push(`rebondit sur ${a.chain.bounces} cibles`);
  if (a.multishot) s.push(`${a.multishot} cibles par salve`);
  if (a.crit) s.push(`${Math.round(a.crit.chance * 100)} % de critiques ×${fmt1(a.crit.mult)}`);
  if (a.armorShred) s.push(`−${a.armorShred.amount} armure`);
  if (a.dispel) s.push(`${Math.round(a.dispel * 100)} % des dégâts contre les immunisés à la magie`);
  if (a.freeze) s.push(`gèle ${Math.round(a.freeze.chance * 100)} % des touches pendant ${fmt1(a.freeze.duration)} s (répit ${fmt1(a.freeze.guard)} s)`);
  if (a.ember) {
    const slow = a.ember.slow ? `, ralentit de ${Math.round(a.ember.slow.pct * 100)} %` : '';
    s.push(`flaque de braise ${fmt1(a.ember.radius)} ${a.ember.radius < 2 ? 'case' : 'cases'}, ${fmt1(a.ember.duration)} s, ${a.ember.dps}/s${slow}`);
  }
  return s;
}

export function elementsLabel(def: TowerDef): string {
  return def.elements ? def.elements.map((f) => FAMILY_LABEL[f]).join(' · ') : '';
}

export function towerInfo(def: TowerDef, cost: number | null, heading = def.name, range = def.attack?.range ?? 0): string {
  const a = def.attack;
  const costLine = cost !== null ? ` · ${cost} or` : '';
  if (!a) return `<h3>${esc(heading)}${costLine}</h3><p>${esc(def.desc)}</p>`;
  const dps = ((a.dmg[0] + a.dmg[1]) / 2 / a.cooldown) * (a.multishot ?? 1);
  const specials = towerSpecials(def);
  return `<h3>${esc(heading)}${costLine}</h3>
    <div class="stats">
      ${stat('Attaque', ATTACK_LABEL[a.type])}
      ${stat('Dégâts', `${a.dmg[0]}–${a.dmg[1]}`)}
      ${stat('Cadence', `${fmt1(1 / a.cooldown)}/s`)}
      ${stat('Portée', fmt1(range))}
      ${stat('Cibles', LAYER[a.targets])}
      ${stat('DPS', `≈ ${fmt0(dps)}`)}
    </div>
    <p>${esc(def.desc)}${specials.length ? ' ' + esc(cap(specials.join(' · '))) + '.' : ''}</p>
    <div>${matchupTags(a.type, a.dispel)}</div>`;
}

/** Fiche d'une tour posée ; l'invitation à transformer n'a de sens que pour ses propres murs. */
export function placedTowerInfo(t: Tower, own: boolean): string {
  const extra = t.def.attack
    ? `<p>${fmt0(t.kills)} éliminations · ${fmt0(t.damage)} dégâts infligés · ciblage ${TARGET_LABEL[t.targetMode].toLowerCase()} · revente ${refundValue(t)} or</p>`
    : `<p>Revente ${refundValue(t)} or.${own ? ' Sélectionnez une tour à transformer.' : ''}</p>`;
  const crystal = t.def.attack && t.rangeBonus > 0 ? `<p>+${Math.round(t.rangeBonus * 100)} % de portée (cristal)</p>` : '';
  return towerInfo(t.def, null, t.def.name, towerRange(t)) + crystal + extra;
}

export function creepTags(def: CreepDef): string {
  const tags = [`<span class="tag">Armure ${ARMOR_LABEL[def.armorType].toLowerCase()} ${def.armor}</span>`];
  if (def.air) tags.push('<span class="tag air">Volant</span>');
  if (def.magicImmune) tags.push('<span class="tag bad">Immunisé à la magie</span>');
  if (def.regen) tags.push(`<span class="tag">Régénère ${fmt1(def.regen * 100)} %/s</span>`);
  if (def.boss) tags.push(`<span class="tag bad">Chef · coûte ${def.leak} vies</span>`);
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

/** Types d'attaque les plus efficaces contre une armure donnée. */
export function counters(def: CreepDef, b: BuilderDef): string {
  const types = (Object.keys(ATTACK_TABLE) as AttackType[])
    .filter((t) => t !== 'chaos' && !(t === 'magic' && def.magicImmune))
    .map((t) => [t, ATTACK_TABLE[t][def.armorType]] as const)
    .sort((a, b) => b[1] - a[1]);
  const best = types.filter(([, m]) => m >= 1.25);
  const pick = best.length ? best : types.slice(0, 1);
  const list = pick.map(([t, m]) => `${ATTACK_LABEL[t]} ×${fmtM(m)}`).join(', ');
  const dispeller = def.magicImmune && dispellerOf(b);
  return dispeller ? `${list} ou ${dispeller.name}` : list;
}

function waveHint(def: CreepDef, b: BuilderDef): string {
  let hint = `Le plus efficace : ${counters(def, b)}.`;
  if (def.air) hint += ' Ils survolent le labyrinthe en ligne droite : seules les tours qui visent l’air les touchent.';
  if (def.magicImmune) {
    const dispeller = dispellerOf(b);
    const chaos = chaosTowerOf(b);
    const except = chaos ? `, sauf le ${chaos.name}` : '';
    const part = dispeller ? ` ; le ${dispeller.name} les entame à ${Math.round(dispeller.attack!.dispel! * 100)} %` : '';
    hint += ` Givre et foudre ne leur font rien${except}${part}.`;
  }
  return hint;
}

const waveName = (g: WaveBriefingGroup) => (g.creep.boss ? g.creep.name : g.creep.plural);

function nextWaveGroup(g: WaveBriefingGroup): string {
  const count = g.count > 1 ? ` ×${g.count}` : '';
  return `<div>${esc(waveName(g))}${count}</div>
      <div class="stats">${stat('PV', fmt0(g.hp))}${stat('Vitesse', fmt1(g.creep.speed))}${stat('Butin', `${g.bounty} or`)}</div>
      <div>${creepTags(g.creep)}</div>`;
}

export function nextWaveInfo(b: WaveBriefing, builder: BuilderDef): string {
  return `<h3>Prochaine vague ${b.wave + 1}</h3>
      ${b.groups.map(nextWaveGroup).join('')}
      <p>${esc(waveHint(b.groups[0].creep, builder))}</p>`;
}

function briefingEntry(g: WaveBriefingGroup): string {
  const traits = [g.creep.air && 'volants', g.creep.magicImmune && 'immunisés', g.creep.boss && 'chef'].filter(Boolean);
  const who = g.count > 1 ? `${g.count} ${g.creep.plural}` : g.creep.name;
  return `<b>${esc(who)}</b>${traits.length ? ` · ${traits.join(' · ')}` : ''}`;
}

/** Résumé d'une ligne dans la barre du haut : « 12 Harpies · volants ». Un groupe par entrée. */
export function briefingChip(b: WaveBriefing): string {
  return b.groups.map(briefingEntry).join(' · ');
}

function briefingGroupInfo(g: WaveBriefingGroup, builder: BuilderDef): string {
  const who = g.creep.boss ? `Chef : ${g.creep.name}` : g.count > 1 ? `${g.count} ${g.creep.plural}` : g.creep.name;
  const hp = g.count > 1 ? `${fmt0(g.hp)} PV chacun · ${fmt0(g.hp * g.count)} au total` : `${fmt0(g.hp)} PV`;
  return `<h3>${esc(who)}</h3>
    <div>${creepTags(g.creep)}</div>
    <p class="facts">${hp} · vitesse ${fmt1(g.creep.speed)} · butin ${g.bounty} or</p>
    <p>${esc(waveHint(g.creep, builder))}</p>`;
}

/** Détail de la prochaine vague, déroulé au survol du résumé. Une section par groupe. */
export function briefingInfo(b: WaveBriefing, builder: BuilderDef): string {
  return `<div class="when">Vague ${b.wave + 1}</div>${b.groups.map((g) => briefingGroupInfo(g, builder)).join('')}`;
}

/** Effets en cours sur une créature (ralentissement, corrosion, poison). */
export function creepEffects(c: Creep): string[] {
  const s: string[] = [];
  if (c.slowPct > 0) s.push(`Ralenti de ${Math.round(c.slowPct * 100)} % · encore ${fmt1(c.slowTimer)} s`);
  if (c.shred > 0) s.push(`Armure corrodée de ${c.shred} · encore ${fmt1(c.shredTimer)} s`);
  if (c.poisons.length) {
    const dps = c.poisons.reduce((sum, p) => sum + p.dps, 0);
    const t = Math.max(...c.poisons.map((p) => p.t));
    const doses = `${c.poisons.length} dose${c.poisons.length > 1 ? 's' : ''}`;
    s.push(`Empoisonné · ${doses} · ${fmt0(dps)} PV/s · encore ${fmt1(t)} s`);
  }
  return s;
}

export const FATE_LABEL: Record<TowerFate, string> = { standing: 'En place', sold: 'Vendue', destroyed: 'Détruite' };

export function debriefTowers(towers: Tower[]): string {
  const rows = towers.map((t) => `<tr class="debrief-tower">
      <td>${esc(t.def.name)}</td>
      <td>${FATE_LABEL[t.fate]}</td>
      <td>${fmt0(t.damage)}</td>
      <td>${fmt0(t.kills)}</td>
      <td>${fmt0(t.spent)}</td>
      <td>${fmt1(towerYield(t))}</td>
    </tr>`).join('');
  const head = `<thead><tr><th>Tour</th><th>État</th><th>Dégâts</th><th>Éliminations</th><th>Or investi</th><th>Rendement</th></tr></thead>`;
  return `<table class="debrief-towers">${head}${rows}</table>`;
}

export function debriefFamilies(rows: ReturnType<typeof familyDamage>): string {
  return rows.map((r) => `<div class="debrief-family">
      <span>${FAMILY_LABEL[r.family]}</span>
      <div class="debrief-bar" style="width: ${fmt0(r.share * 100)}%"></div>
      <span>${fmt0(r.damage)}</span>
      <span>${fmt0(r.share * 100)} %</span>
    </div>`).join('');
}

export function debriefWaves(rows: ReturnType<typeof waveCurve>): string {
  const lines = rows.map((r) => `<tr class="debrief-wave">
      <td>Vague ${r.wave + 1}</td>
      <td>${fmt0(r.livesLost)}</td>
      <td>${fmt0(r.gold)}</td>
    </tr>`).join('');
  const head = `<thead><tr><th>Vague</th><th>Vies perdues</th><th>Or</th></tr></thead>`;
  return `<table class="debrief-waves">${head}${lines}</table>`;
}

export function debriefBreakers(losses: ReturnType<typeof breakerLosses>): string {
  if (losses.count === 0) return '<p class="debrief-breakers">Aucune tour perdue</p>';
  const noun = losses.count > 1 ? 'tours détruites' : 'tour détruite';
  return `<p class="debrief-breakers">${fmt0(losses.count)} ${noun} · ${fmt0(losses.gold)} or</p>`;
}

export function sendPanel(ether: number, income: number): string {
  const rows = Object.values(CREEPS)
    .filter((c) => c.send)
    .map((c) => `<button type="button" data-send="${c.id}"${ether < c.send!.cost ? ' disabled' : ''}>${esc(c.name)}<span class="cost">${c.send!.cost} éther</span><span class="gain">+${c.send!.income}</span></button>`)
    .join('');
  return `<h3>Revenu ${fmt0(income)}</h3><div class="sends">${rows}</div>`;
}

export function gleanerPanel(ether: number, gleaners: number, buy: Result, cost: number): string {
  const attrs = buy.ok ? '' : ` disabled title="${esc(buy.reason)}"`;
  return `<h3>Glaneurs : ${fmt0(gleaners)}</h3><p>Éther : ${fmt0(ether)}</p><div class="sends"><button type="button" data-gleaner${attrs}>Glaneur<span class="cost">${cost} or</span></button></div>`;
}

export function gatePanel(ether: number, gate: World['gate']): string {
  const rows = (['shot', 'ramparts'] as const).map((k) => {
    const level = gate[k];
    const name = k === 'shot' ? 'Tir' : 'Remparts';
    if (level >= GATE[k].maxLevel) return `<p>${name} · Niveau ${level}</p><p>Niveau maximal atteint</p><button type="button" data-gate="${k}" disabled>${name}</button>`;
    const cost = gateLevelCost(level + 1);
    return `<p>${name} · Niveau ${level}</p><button type="button" data-gate="${k}"${ether < cost ? ' disabled' : ''}>${name}<span class="cost">${cost} éther</span><span class="gain">+${gateLevelIncome(level + 1)}</span></button>`;
  });
  return `<h3>Porte</h3><div class="sends">${rows.join('')}</div>`;
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
  return `Vague ${wave + 1} atteinte`;
}

export function partnerLabel(coop: boolean): string {
  return coop ? 'Partenaire' : 'Adversaire';
}

/** Détail de l'encart adverse déroulé. Jamais l'éther : il reste caché. */
export function rivalDetail(rival: World): string {
  const duelStats = rival.duel
    ? `${rivalStat(RIVAL_ICON.income, 'Revenu', `+${fmt0(rival.income)}`)}
      ${rivalStat(RIVAL_ICON.gleaners, 'Glaneurs', fmt0(rival.gleaners.length))}
      ${rivalStat(RIVAL_ICON.shot, 'Tir', `niv. ${rival.gate.shot}`)}
      ${rivalStat(RIVAL_ICON.ramparts, 'Remparts', `niv. ${rival.gate.ramparts}`)}`
    : '';
  return `<p class="rv-builder"><span>Bâtisseur</span> ${esc(rival.builder.name)}</p>
    <div class="rv-stats">
      ${rivalStat(RIVAL_ICON.gold, 'Or', fmt0(rival.gold))}
      ${duelStats}
    </div>`;
}

export function creepInfo(c: Creep, builder: BuilderDef): string {
  const effects = creepEffects(c).map((e) => `<span class="tag good">${esc(e)}</span>`).join('');
  return `<h3>${esc(c.def.name)} · vague ${c.wave + 1}</h3>
    <div class="stats">${stat('PV', `${fmt0(c.hp)} / ${fmt0(c.maxHp)}`)}${stat('Vitesse', fmt1(creepSpeed(c)))}${stat('Armure', fmt0(c.def.armor - c.shred))}</div>
    <div>${creepTags(c.def)}</div>
    ${effects ? `<div>${effects}</div>` : ''}
    <p>${esc(`Le plus efficace : ${counters(c.def, builder)}.`)}</p>`;
}

/** Annonce à l'envoyeur : « Vos 3 Harpies et 2 Loups gris attaquent Paul ». */
export function sentMessage(groups: SendGroup[], nick: string): string {
  const total = groups.reduce((n, g) => n + g.count, 0);
  const names = groups.map((g) => `${g.count} ${g.count > 1 ? g.creep.plural : g.creep.name}`);
  const who = total === 1 ? groups[0].creep.name : `${names.slice(0, -1).join(', ')}${names.length > 1 ? ' et ' : ''}${names[names.length - 1]}`;
  return total === 1 ? `Votre ${who} attaque ${nick}` : `Vos ${who} attaquent ${nick}`;
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

/** Carte d'un bâtisseur : blason et nom ; le style, la faiblesse et les tours de base s'affichent au survol. */
export function builderCard(b: BuilderDef): string {
  const roots = b.roots.map((id) => esc(tower(id).name)).join(' · ');
  return `${crest(b.id)}<h3>${esc(b.name)}</h3>
    <div class="builder-info" role="tooltip">
      <p>${esc(b.style)}</p>
      <p class="weakness"><em>Faiblesse</em> ${esc(b.weakness)}</p>
      <p class="roots"><em>Tours de base</em> ${roots}</p>
    </div>`;
}

const recapLine = (g: SendGroup, extra = '') =>
  `${g.count} ${g.count > 1 ? g.creep.plural : g.creep.name} · ${g.creep.air ? 'air' : 'sol'}${extra}`;

/** Lignes affichées sous la bannière de vague : ses groupes, puis les envois reçus, par envoyeur (texte brut, dessiné sur le canvas). */
export function waveRecap(b: WaveBriefing, received: { nick: string; groups: SendGroup[] }[]): string[] {
  const lines = b.groups.map((g) => recapLine(g, g.creep.boss ? ' · chef' : ''));
  for (const r of received) {
    if (r.groups.length) lines.push(`Envoyés par ${r.nick}`, ...r.groups.map((g) => recapLine(g)));
  }
  return lines;
}

export function rivalHeadline(nick: string, lives: number): string {
  return `<span class="rv-nick">${esc(nick)}</span><span class="rv-lives" title="${lives > 1 ? 'Vies' : 'Vie'}">${RIVAL_ICON.lives}<strong>${fmt0(lives)}</strong></span>`;
}

const TEAM_LABEL: Record<Team, string> = { [Team.A]: 'Équipe A', [Team.B]: 'Équipe B' };
const TEAM_SIZE = 2;

/** Les deux équipes du salon 2 contre 2 ; chaque colonne est un bouton `data-team` pour la rejoindre. */
export function teamRoster(teams: Record<Team, { nick: string; picked: boolean }[]>, waiting: string[]): string {
  const column = (team: Team) => {
    const players = teams[team].map((p) => `<li>${esc(p.nick)} · ${p.picked ? 'prêt' : 'choisit…'}</li>`);
    const free = Array.from({ length: Math.max(0, TEAM_SIZE - players.length) }, () => '<li>place libre</li>');
    return `<button type="button" class="diff" data-team="${team}"><strong>${TEAM_LABEL[team]}</strong><ul>${[...players, ...free].join('')}</ul></button>`;
  };
  const wait = waiting.length ? `<p>En attente : ${waiting.map(esc).join(', ')}</p>` : '';
  return `<div class="modes">${column(Team.A)}${column(Team.B)}</div>${wait}`;
}

/** Les deux joueurs du salon duel ou coop, en cartes côte à côte comme les équipes du 2 contre 2 ; l'invité absent est « en attente… ». */
export function pairRoster(host: { nick: string; picked: boolean }, guest: { nick: string | null; picked: boolean }): string {
  const card = (p: { nick: string | null; picked: boolean }) => p.nick === null
    ? '<div class="diff"><strong>en attente…</strong><span>place libre</span></div>'
    : `<div class="diff"><strong>${esc(p.nick)}</strong><span>${p.picked ? 'a choisi' : 'choisit…'}</span></div>`;
  return `<div class="modes roster">${card(host)}${card(guest)}</div>`;
}

export function goldForecastChip(gold: number, r: WaveReward): string {
  return `<b>${fmt0(gold)}</b> or · +${fmt0(r.bonus + r.interest + r.income)}`;
}

export function goldForecastInfo(r: WaveReward, duel: boolean): string {
  const line = (label: string, n: number) => `<p class="facts">${label} : +${fmt0(n)}</p>`;
  const rest = duel ? line('Revenu', r.income) : line('Intérêts', r.interest) + (r.capped ? '<p>plafond atteint</p>' : '');
  return `<h3>Gain en fin de vague</h3>${line('Prime', r.bonus)}${rest}`;
}

export function etherChip(ether: number, perMinute: number): string {
  return `<b>${fmt0(ether)}</b> éther · +${fmt0(perMinute)}/min`;
}

export function resignPrompt(): { question: string; confirm: string; cancel: string } {
  return { question: 'Quitter la partie ? Elle sera perdue.', confirm: 'Quitter', cancel: 'Annuler' };
}
