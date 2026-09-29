import { describe, expect, it } from 'vitest';
import type { AttackDef, Tower } from '../../src/domain/model/types';
import { applyOnHit } from '../../src/domain/systems/status';
import { spawnCreep } from '../../src/domain/systems/waves';
import type { TowerDef } from '../../src/domain/model/types';
import type { WaveBriefing } from '../../src/application/queries/waveBriefing';
import { CREEPS } from '../../src/domain/catalog/creeps';
import {
  briefingChip, briefingInfo,
  creepEffects, debriefBreakers, debriefFamilies, debriefTowers, debriefWaves,
  duelVerdictLabel, elementsLabel, FAMILY_LABEL, fmt0, fmt1, nextWaveInfo, towerInfo, towerSpecials,
} from '../../src/presentation/describe';
import { Verdict } from '../../src/application/online/protocol';
import { infusionBlocker } from '../../src/domain/rules/infusion';
import { TOWERS } from '../../src/domain/catalog/towers';
import { familyDamage, towerRanking, towerYield } from '../../src/domain/rules/debrief';
import { newWorld } from '../support/helpers';

const attack = (extra: Partial<AttackDef>): AttackDef => ({
  type: 'normal', dmg: [1, 1], cooldown: 1, range: 4, projectileSpeed: 10, targets: 'both', ...extra,
});

describe('effets subis par une créature', () => {
  it('ne liste rien quand la créature n’est affectée par aucun effet', () => {
    const c = spawnCreep(newWorld(), 'rat', 0);
    expect(creepEffects(c)).toEqual([]);
  });

  it('décrit le ralentissement avec son pourcentage et sa durée restante', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    applyOnHit(w, c, attack({ slow: { pct: 0.3, duration: 2 } }), 1, 'frost');
    expect(creepEffects(c)).toEqual(['Ralenti de 30 % · encore 2 s']);
  });

  it('décrit la corrosion avec l’armure retirée et sa durée restante', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    applyOnHit(w, c, attack({ armorShred: { amount: 3, duration: 4 } }), 1, 'venom');
    expect(creepEffects(c)).toEqual(['Armure corrodée de 3 · encore 4 s']);
  });

  it('cumule les doses de poison : dégâts totaux par seconde et plus longue durée restante', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    const a = attack({ poison: { dps: 6, duration: 4, maxStacks: 3 } });
    applyOnHit(w, c, a, 1, 'venom');
    applyOnHit(w, c, a, 1, 'venom');
    expect(creepEffects(c)).toEqual(['Empoisonné · 2 doses · 12 PV/s · encore 4 s']);
  });

  it('accorde « dose » au singulier pour un seul poison', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    applyOnHit(w, c, attack({ poison: { dps: 6, duration: 4, maxStacks: 3 } }), 1, 'venom');
    expect(creepEffects(c)).toEqual(['Empoisonné · 1 dose · 6 PV/s · encore 4 s']);
  });
});

const towerDef = (extra: Partial<TowerDef>): TowerDef => ({
  id: 'test', name: 'Test', family: 'cannon', tier: 1, cost: 10, desc: 'desc', upgrades: [], ...extra,
});

describe('fiche d’une tour hybride', () => {
  it('[RM-14] mentionne la chance, la durée et le répit du gel quand la tour gèle', () => {
    const def = towerDef({
      attack: attack({ freeze: { chance: 0.25, duration: 0.6, guard: 1.5 } }),
    });
    const specials = towerSpecials(def).join(' ');
    expect(specials).toContain('gèle');
    expect(specials).toContain('25 %');
    expect(specials).toContain(`${fmt1(0.6)} s`);
    expect(specials).toContain(`${fmt1(1.5)} s`);
  });

  it('[RM-14] nomme les deux éléments quand la tour est un hybride', () => {
    const def = towerDef({ elements: ['frost', 'storm'] });
    expect(elementsLabel(def)).toBe('Givre · Foudre');

    const noElements = towerDef({});
    expect(elementsLabel(noElements)).toBe('');
  });
});

const towerFixture = (extra: Partial<Tower>): Tower => ({
  id: 1, def: TOWERS.archer, x: 0, y: 0, cx: 0, cy: 0, cooldown: 0,
  targetMode: 'first', spent: 0, kills: 0, damage: 0, aim: 0, fate: 'standing', ...extra,
});

describe('bilan de partie', () => {
  it('[RM-01] liste chaque tour avec nom, état, dégâts, éliminations, or investi et rendement', () => {
    const strong = towerFixture({ id: 1, def: TOWERS.archer, damage: 500, kills: 10, spent: 100, fate: 'standing' });
    const weak = towerFixture({ id: 2, def: TOWERS.cannon, damage: 200, kills: 5, spent: 50, fate: 'sold' });

    const html = debriefTowers(towerRanking([strong, weak]));

    expect(html).toContain(strong.def.name);
    expect(html).toContain('En place');
    expect(html).toContain(fmt0(strong.damage));
    expect(html).toContain(fmt0(strong.kills));
    expect(html).toContain(fmt0(strong.spent));
    expect(html).toContain(fmt1(towerYield(strong)));

    expect(html).toContain(weak.def.name);
    expect(html).toContain('Vendue');
    expect(html).toContain(fmt0(weak.damage));
    expect(html).toContain(fmt0(weak.kills));
    expect(html).toContain(fmt0(weak.spent));
    expect(html).toContain(fmt1(towerYield(weak)));

    expect(html.indexOf(strong.def.name)).toBeLessThan(html.indexOf(weak.def.name));
  });

  it('[RM-03] affiche chaque famille avec son libellé, ses dégâts et sa part en pourcentage, hybrides compris', () => {
    const hybrid = towerFixture({ id: 1, def: TOWERS.stinger, damage: 300 });
    const simple = towerFixture({ id: 2, def: TOWERS.frost, damage: 100 });

    const html = debriefFamilies(familyDamage([hybrid, simple]));

    expect(html).toContain('Hybrides');
    expect(html).toContain(FAMILY_LABEL.frost);
    expect(html).toContain(fmt0(300));
    expect(html).toContain(fmt0(100));
    expect(html).toContain(`${fmt0(75)} %`);
    expect(html).toContain(`${fmt0(25)} %`);
  });

  it('[RM-04] affiche chaque vague avec ses vies perdues et son or', () => {
    const html = debriefWaves([
      { wave: 0, livesLost: 2, gold: 120 },
      { wave: 1, livesLost: 3, gold: 95 },
    ]);

    const wave1 = html.indexOf('Vague 1');
    const lives1 = html.indexOf(fmt0(2));
    const gold1 = html.indexOf(fmt0(120));
    const wave2 = html.indexOf('Vague 2');
    const lives2 = html.indexOf(fmt0(3));
    const gold2 = html.indexOf(fmt0(95));

    expect(wave1).toBeGreaterThanOrEqual(0);
    expect(wave1).toBeLessThan(lives1);
    expect(lives1).toBeLessThan(gold1);
    expect(gold1).toBeLessThan(wave2);
    expect(wave2).toBeLessThan(lives2);
    expect(lives2).toBeLessThan(gold2);
  });

  it('[RM-05] affiche le nombre de tours détruites et l’or qu’elles représentaient', () => {
    const html = debriefBreakers({ count: 2, gold: 350 });

    expect(html).toContain('2 tours détruites');
    expect(html).toContain('350 or');
    expect(html).not.toContain('Aucune tour perdue');
  });

  it('[RM-05] affiche « Aucune tour perdue » quand aucune tour n’a été détruite', () => {
    const html = debriefBreakers({ count: 0, gold: 0 });

    expect(html).toContain('Aucune tour perdue');
  });

  it('[RM-05] accorde au singulier quand une seule tour a été détruite', () => {
    const html = debriefBreakers({ count: 1, gold: 120 });

    expect(html).toContain('1 tour détruite');
    expect(html).not.toContain('tours');
  });
});

describe('aperçu de la prochaine vague', () => {
  const mixed: WaveBriefing = {
    wave: 4,
    groups: [
      { creep: CREEPS.wolf, count: 3, hp: 437, bounty: 23 },
      { creep: CREEPS.rat, count: 2, hp: 128, bounty: 9 },
    ],
  };

  it('[RM-03] résume chaque groupe dans la barre du haut quand la vague est mixte', () => {
    const html = briefingChip(mixed);

    expect(html).toContain('3 Loups gris');
    expect(html).toContain('2 Rats des marais');
  });

  it('[RM-03] détaille les PV et la prime de chaque groupe au survol', () => {
    const html = briefingInfo(mixed);

    expect(html).toContain(fmt0(437));
    expect(html).toContain('23 or');
    expect(html).toContain(fmt0(128));
    expect(html).toContain('9 or');
  });

  it('[RM-03] liste chaque groupe dans la fiche de la prochaine vague quand la vague est mixte', () => {
    const html = nextWaveInfo(mixed);

    expect(html).toContain(CREEPS.wolf.plural);
    expect(html).toContain(CREEPS.rat.plural);
    expect(html).toContain(fmt0(437));
    expect(html).toContain(fmt0(128));
    expect(html).toContain('23 or');
    expect(html).toContain('9 or');
  });
});

describe('verdict de duel', () => {
  it('[RM-14] nomme « Victoire », « Défaite », « Égalité » et « Victoire par forfait » selon le verdict', () => {
    expect(duelVerdictLabel(Verdict.Victory)).toBe('Victoire');
    expect(duelVerdictLabel(Verdict.Defeat)).toBe('Défaite');
    expect(duelVerdictLabel(Verdict.Draw)).toBe('Égalité');
    expect(duelVerdictLabel(Verdict.Forfeit)).toBe('Victoire par forfait');
  });
});

describe('infusion verrouillée', () => {
  it('[RM-13] donne la raison du verrou dans l’infobulle quand l’infusion est refusée', () => {
    const def = TOWERS.cryoshell;
    const reason = infusionBlocker(TOWERS.cannon, def, 0, [])!;

    const html = towerInfo(def, def.cost, def.name, reason);
    expect(html).toContain(reason);

    const htmlSansVerrou = towerInfo(def, def.cost, def.name);
    expect(htmlSansVerrou).not.toContain(reason);
  });
});
