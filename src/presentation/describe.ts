import type { World } from '../domain/model/World';
import type { WaveBriefing, WaveBriefingGroup } from '../application/queries/waveBriefing';
import { ARMOR_LABEL, ATTACK_LABEL, ATTACK_TABLE } from '../domain/rules/Damage';
import type { AuraKind, BuilderDef, ArmorType, AttackType, Creep, CreepDef, Result, TargetMode, Tower, TowerDef, TowerFate } from '../domain/model/types';
import type { breakerLosses, familyDamage, waveCurve } from '../domain/rules/debrief';
import { towerYield } from '../domain/rules/debrief';
import { CREEPS } from '../domain/catalog/creeps';
import { tower } from '../domain/catalog/towers';
import { GATE, GLEANER } from '../domain/catalog/ether';
import { gateLevelCost, gateLevelIncome } from '../domain/rules/pricing';
import { creepSpeed } from '../domain/rules/speed';
import { Verdict } from '../application/online/protocol';

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
  wall: 'Maçonnerie', archer: 'Archers', cannon: 'Artillerie', frost: 'Givre', storm: 'Foudre', venom: 'Venin',
  hybrid: 'Hybrides',
};

function stat(label: string, value: string): string {
  return `<span><em>${label}</em>${value}</span>`;
}

export function matchupTags(type: AttackType): string {
  const row = ATTACK_TABLE[type];
  const good: string[] = [];
  const bad: string[] = [];
  for (const k of Object.keys(row) as ArmorType[]) {
    if (row[k] >= 1.25) good.push(`${ARMOR_LABEL[k]} ×${fmtM(row[k])}`);
    if (row[k] <= 0.75) bad.push(`${ARMOR_LABEL[k]} ×${fmtM(row[k])}`);
  }
  if (type === 'magic') bad.push('Immunisés ×0');
  return [...good.map((g) => `<span class="tag good">${g}</span>`), ...bad.map((b) => `<span class="tag bad">${b}</span>`)].join('');
}

const AURA_LABEL: Record<AuraKind, string> = { damage: 'de dégâts', attackSpeed: 'de cadence' };

export function towerSpecials(def: TowerDef): string[] {
  const a = def.attack;
  const s: string[] = [];
  if (def.aura) s.push(`aura ${AURA_LABEL[def.aura.kind]} +${Math.round(def.aura.pct * 100)} % à ${fmt1(def.aura.radius)} cases`);
  if (!a) return s;
  if (a.area) s.push(a.range === 1.5 && a.targets === 'ground' ? 'corps à corps' : 'frappe toute la zone');
  if (a.stun) s.push(`étourdit ${fmt1(a.stun.duration)} s`);
  if (a.rampUp) s.push(`montée en puissance jusqu’à +${Math.round(a.rampUp.max * 100)} %`);
  if (a.splash) s.push(`zone ${fmt1(a.splash.radius)} cases`);
  if (a.slow) s.push(`ralentit de ${Math.round(a.slow.pct * 100)} % pendant ${fmt1(a.slow.duration)} s`);
  if (a.poison) s.push(`poison ${a.poison.dps}/s pendant ${a.poison.duration} s (×${a.poison.maxStacks})`);
  if (a.chain) s.push(`rebondit sur ${a.chain.bounces} cibles`);
  if (a.multishot) s.push(`${a.multishot} cibles par salve`);
  if (a.crit) s.push(`${Math.round(a.crit.chance * 100)} % de critiques ×${fmt1(a.crit.mult)}`);
  if (a.armorShred) s.push(`−${a.armorShred.amount} armure`);
  if (a.freeze) s.push(`gèle ${Math.round(a.freeze.chance * 100)} % des touches pendant ${fmt1(a.freeze.duration)} s (répit ${fmt1(a.freeze.guard)} s)`);
  return s;
}

export function elementsLabel(def: TowerDef): string {
  return def.elements ? def.elements.map((f) => FAMILY_LABEL[f]).join(' · ') : '';
}

export function towerInfo(def: TowerDef, cost: number | null, heading = def.name): string {
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
      ${stat('Portée', fmt1(a.range))}
      ${stat('Cibles', LAYER[a.targets])}
      ${stat('DPS', `≈ ${fmt0(dps)}`)}
    </div>
    <p>${esc(def.desc)}${specials.length ? ' ' + esc(cap(specials.join(' · '))) + '.' : ''}</p>
    <div>${matchupTags(a.type)}</div>`;
}

export function creepTags(def: CreepDef): string {
  const tags = [`<span class="tag">Armure ${ARMOR_LABEL[def.armorType].toLowerCase()} ${def.armor}</span>`];
  if (def.air) tags.push('<span class="tag air">Volant</span>');
  if (def.magicImmune) tags.push('<span class="tag bad">Immunisé à la magie</span>');
  if (def.regen) tags.push(`<span class="tag">Régénère ${fmt1(def.regen * 100)} %/s</span>`);
  if (def.boss) tags.push(`<span class="tag bad">Chef · coûte ${def.leak} vies</span>`);
  return tags.join('');
}

/** Types d'attaque les plus efficaces contre une armure donnée. */
export function counters(def: CreepDef): string {
  const types = (Object.keys(ATTACK_TABLE) as AttackType[])
    .filter((t) => t !== 'chaos' && !(t === 'magic' && def.magicImmune))
    .map((t) => [t, ATTACK_TABLE[t][def.armorType]] as const)
    .sort((a, b) => b[1] - a[1]);
  const best = types.filter(([, m]) => m >= 1.25);
  const pick = best.length ? best : types.slice(0, 1);
  return pick.map(([t, m]) => `${ATTACK_LABEL[t]} ×${fmtM(m)}`).join(', ');
}

function waveHint(def: CreepDef): string {
  let hint = `Le plus efficace : ${counters(def)}.`;
  if (def.air) hint += ' Ils survolent le labyrinthe en ligne droite : seules les tours qui visent l’air les touchent.';
  if (def.magicImmune) hint += ' Givre et foudre ne leur font rien, sauf le Prisme du néant.';
  return hint;
}

const waveName = (g: WaveBriefingGroup) => (g.creep.boss ? g.creep.name : g.creep.plural);

function nextWaveGroup(g: WaveBriefingGroup): string {
  const count = g.count > 1 ? ` ×${g.count}` : '';
  return `<div>${esc(waveName(g))}${count}</div>
      <div class="stats">${stat('PV', fmt0(g.hp))}${stat('Vitesse', fmt1(g.creep.speed))}${stat('Butin', `${g.bounty} or`)}</div>
      <div>${creepTags(g.creep)}</div>`;
}

const incomingLabel = (n: number) => `${n} envoi${n > 1 ? 's' : ''} en approche`;

export function nextWaveInfo(b: WaveBriefing): string {
  return `<h3>Prochaine vague ${b.wave + 1}</h3>
      ${b.groups.map(nextWaveGroup).join('')}
      ${b.incoming > 0 ? `<div>${incomingLabel(b.incoming)}</div>` : ''}
      <p>${esc(waveHint(b.groups[0].creep))}</p>`;
}

function briefingEntry(g: WaveBriefingGroup): string {
  const traits = [g.creep.air && 'volants', g.creep.magicImmune && 'immunisés', g.creep.boss && 'chef'].filter(Boolean);
  const who = g.count > 1 ? `${g.count} ${g.creep.plural}` : g.creep.name;
  return `<b>${esc(who)}</b>${traits.length ? ` · ${traits.join(' · ')}` : ''}`;
}

/** Résumé d'une ligne dans la barre du haut : « 12 Harpies · volants ». Un groupe par entrée. */
export function briefingChip(b: WaveBriefing): string {
  const entries = b.groups.map(briefingEntry);
  if (b.incoming > 0) entries.push(incomingLabel(b.incoming));
  return entries.join(' · ');
}

function briefingGroupInfo(g: WaveBriefingGroup): string {
  const who = g.creep.boss ? `Chef : ${g.creep.name}` : g.count > 1 ? `${g.count} ${g.creep.plural}` : g.creep.name;
  const hp = g.count > 1 ? `${fmt0(g.hp)} PV chacun · ${fmt0(g.hp * g.count)} au total` : `${fmt0(g.hp)} PV`;
  return `<h3>${esc(who)}</h3>
    <div>${creepTags(g.creep)}</div>
    <p class="facts">${hp} · vitesse ${fmt1(g.creep.speed)} · butin ${g.bounty} or</p>
    <p>${esc(waveHint(g.creep))}</p>`;
}

/** Détail de la prochaine vague, déroulé au survol du résumé. Une section par groupe. */
export function briefingInfo(b: WaveBriefing): string {
  return `<div class="when">Vague ${b.wave + 1}</div>${b.groups.map(briefingGroupInfo).join('')}`;
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

export function gleanerPanel(ether: number, gleaners: number, buy: Result): string {
  const attrs = buy.ok ? '' : ` disabled title="${esc(buy.reason)}"`;
  return `<h3>Glaneurs : ${fmt0(gleaners)}</h3><p>Éther : ${fmt0(ether)}</p><div class="sends"><button type="button" data-gleaner${attrs}>Glaneur<span class="cost">${GLEANER.cost} or</span></button></div>`;
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

export function rivalEconomy(income: number, gleaners: number, gate: World['gate']): string {
  return `revenu ${fmt0(income)} · glaneurs ${gleaners} · Tir ${gate.shot} · Remparts ${gate.ramparts}`;
}

export function creepInfo(c: Creep): string {
  const effects = creepEffects(c).map((e) => `<span class="tag good">${esc(e)}</span>`).join('');
  return `<h3>${esc(c.def.name)} · vague ${c.wave + 1}</h3>
    <div class="stats">${stat('PV', `${fmt0(c.hp)} / ${fmt0(c.maxHp)}`)}${stat('Vitesse', fmt1(creepSpeed(c)))}${stat('Armure', fmt0(c.def.armor - c.shred))}</div>
    <div>${creepTags(c.def)}</div>
    ${effects ? `<div>${effects}</div>` : ''}
    <p>${esc(`Le plus efficace : ${counters(c.def)}.`)}</p>`;
}

export function builderCard(b: BuilderDef): string {
  const roots = b.roots.map((id) => esc(tower(id).name)).join(' · ');
  return `<h3>${esc(b.name)}</h3>
    <p>${esc(b.style)}</p>
    <p class="weakness"><em>Faiblesse</em> ${esc(b.weakness)}</p>
    <p class="roots"><em>Tours de base</em> ${roots}</p>`;
}
