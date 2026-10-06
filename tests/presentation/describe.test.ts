import { describe, expect, it } from 'vitest';
import type { AttackDef, Tower } from '../../src/domain/model/types';
import { applyOnHit } from '../../src/domain/systems/status';
import { spawnCreep } from '../../src/domain/systems/waves';
import type { TowerDef } from '../../src/domain/model/types';
import type { WaveBriefing } from '../../src/application/queries/waveBriefing';
import { groupSends } from '../../src/application/queries/waveBriefing';
import { CREEPS } from '../../src/domain/catalog/creeps';
import {
  briefingChip, briefingInfo, builderCard,
  creepEffects, debriefBreakers, debriefFamilies, debriefTowers, debriefWaves,
  duelVerdictLabel, elementsLabel, FAMILY_LABEL, fmt0, fmt1, gatePanel, gleanerPanel, modeLabel, nextWaveInfo, pairingWord, partnerLabel, placedTowerInfo, reachedTitle, rivalDetail, rivalHeadline, sendPanel, sentMessage, towerSpecials, waveRecap,
} from '../../src/presentation/describe';
import { GLEANER } from '../../src/domain/catalog/ether';
import { Mode, Verdict } from '../../src/application/online/protocol';
import { TOWERS, tower } from '../../src/domain/catalog/towers';
import { builder } from '../../src/domain/catalog/builders';
import { familyDamage, towerRanking, towerYield } from '../../src/domain/rules/debrief';
import { dispatch } from '../../src/application/dispatch';
import { waveBriefing } from '../../src/application/queries/waveBriefing';
import { CommandType } from '../../src/domain/model/types';
import { newDuelWorld, newWorld } from '../support/helpers';

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
  targetMode: 'first', spent: 0, kills: 0, damage: 0, aim: 0, ramp: 0, fate: 'standing', ...extra,
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

  const withAndWithoutSends = () => {
    const without = newDuelWorld();
    const received = newDuelWorld();
    dispatch(received, { c: CommandType.Receive, creep: 'wolf' });
    dispatch(received, { c: CommandType.Receive, creep: 'wolf' });
    expect(received.sends.length).toBe(2);
    return { without: waveBriefing(without), received: waveBriefing(received) };
  };

  it('[RM-04] ne mentionne aucun envoi dans la fiche de la prochaine vague quand des envois sont reçus', () => {
    const { without, received } = withAndWithoutSends();

    expect(nextWaveInfo(received)).not.toContain('envoi');
    expect(nextWaveInfo(received)).toBe(nextWaveInfo(without));
  });

  it('[RM-04] ne mentionne aucun envoi dans le résumé du haut quand des envois sont reçus', () => {
    const { without, received } = withAndWithoutSends();

    expect(briefingChip(received)).not.toContain('envoi');
    expect(briefingChip(received)).toBe(briefingChip(without));
  });
});

describe('panneau d’envois', () => {
  const sendable = Object.values(CREEPS).filter((c) => c.send);
  const row = (html: string, id: string) =>
    html.split('data-send="').find((part) => part.startsWith(`${id}"`)) ?? '';

  it('[CU-02] liste chaque créature envoyable avec son prix en éther et son gain, et le revenu sans plafond', () => {
    const html = sendPanel(100, 6);

    expect(html).toContain('Revenu 6');
    expect(html).not.toContain('Revenu 6 /');
    for (const c of sendable) {
      expect(row(html, c.id)).toContain(c.name);
      expect(row(html, c.id)).toContain(`${c.send!.cost} éther`);
      expect(row(html, c.id)).not.toContain(' or ');
      expect(row(html, c.id)).toContain(`+${c.send!.income}`);
    }
    for (const c of Object.values(CREEPS).filter((c) => !c.send)) {
      expect(html).not.toContain(`data-send="${c.id}"`);
    }
  });

  it('[CU-02] grise une créature quand l’éther ne suffit pas à l’envoyer', () => {
    const html = sendPanel(20, 0);

    expect(row(html, 'raider')).toContain('disabled');
    expect(row(html, 'raider')).toContain('24 éther');
    expect(row(html, 'rat')).not.toContain('disabled');
    expect(row(html, 'rat')).toContain('10 éther');
  });
});

describe('panneau des glaneurs', () => {
  it('[CU-01] affiche le nombre de glaneurs, l’éther et le prix d’un glaneur', () => {
    const html = gleanerPanel(1234, 7, { ok: true });

    expect(html).toContain(`Glaneurs : ${fmt0(7)}`);
    expect(html).toContain(`Éther : ${fmt0(1234)}`);
    expect(html).toContain(String(GLEANER.cost));
    expect(html).toContain('data-gleaner');
  });

  it('[CU-01] grise l’achat et donne la raison du refus quand l’achat est refusé', () => {
    const refused = gleanerPanel(0, 0, { ok: false, reason: 'Pas assez d’or.' });

    expect(refused).toContain('disabled');
    expect(refused).toContain('title="Pas assez d’or."');
    expect(gleanerPanel(0, 0, { ok: true })).not.toContain('disabled');
  });
});

describe('panneau de la Porte', () => {
  const tag = (html: string, kind: string) =>
    (html.split(`data-gate="${kind}"`)[1] ?? '').split('>')[0];

  it('[CU-03] affiche le niveau de Tir et de Remparts, le prix et le gain de revenu du niveau suivant', () => {
    const html = gatePanel(100, { shot: 2, ramparts: 0, cooldown: 0 });

    expect(html).toContain('Tir');
    expect(html).toContain('Niveau 2');
    expect(html).toContain('20 éther');
    expect(html).toContain('+5');
    expect(html).toContain('Remparts');
    expect(html).toContain('Niveau 0');
    expect(html).toContain('12 éther');
    expect(html).toContain('+3');
    expect(html).toContain('data-gate="shot"');
    expect(html).toContain('data-gate="ramparts"');
  });

  it('[CU-03] grise une amélioration quand l’éther manque et affiche « Niveau maximal atteint » au niveau max', () => {
    const poor = gatePanel(19, { shot: 2, ramparts: 0, cooldown: 0 });
    expect(tag(poor, 'shot')).toContain('disabled');
    expect(tag(poor, 'ramparts')).not.toContain('disabled');
    expect(poor).not.toContain('Niveau maximal atteint');

    const maxed = gatePanel(1000, { shot: 10, ramparts: 5, cooldown: 0 });
    expect(maxed).toContain('Niveau maximal atteint');
    expect(tag(maxed, 'shot')).toContain('disabled');
    expect(tag(maxed, 'ramparts')).toContain('disabled');
  });
});

describe('encart de l’économie adverse', () => {
  it('[RM-04] détaille bâtisseur, or, revenu, glaneurs, Tir et Remparts quand l’encart est déroulé', () => {
    const w = newDuelWorld();
    w.gold = 568;
    w.income = 37;
    w.gleaners = [0, 0, 0, 0];
    w.gate.shot = 2;
    w.gate.ramparts = 3;

    const text = rivalDetail(w);

    expect(text).toContain(w.builder.name);
    expect(text).toContain('568');
    expect(text).toMatch(/revenu\D*37/i);
    expect(text).toMatch(/glaneurs?\D*4/i);
    expect(text).toMatch(/Tir\D*2/);
    expect(text).toMatch(/Remparts\D*3/);
  });

  it('[RM-05] n’affiche ni revenu, ni glaneurs, ni Porte dans l’encart quand la carte est coopérative', () => {
    const w = newWorld();
    w.gold = 568;
    expect(w.duel).toBe(false);

    const text = rivalDetail(w);

    expect(text).toContain('Bâtisseur');
    expect(text).toContain('Or');
    expect(text).toContain('568');
    expect(text).not.toContain('Revenu');
    expect(text).not.toContain('Glaneurs');
    expect(text).not.toContain('Tir');
    expect(text).not.toContain('Remparts');
  });

  it('[CU-04] nomme l’autre joueur « Partenaire » en coopération et « Adversaire » en duel', () => {
    expect(partnerLabel(true)).toBe('Partenaire');
    expect(partnerLabel(false)).toBe('Adversaire');
  });

  it('[RM-04] ne mentionne jamais l’éther de l’adversaire quand l’encart est déroulé', () => {
    const w = newDuelWorld();
    w.gold = 568;
    w.ether = 777;

    const text = rivalDetail(w);

    expect(text).toContain('568');
    expect(text.toLowerCase()).not.toContain('éther');
    expect(text).not.toContain('777');
  });
});

describe('encart adverse replié', () => {
  it('[RM-03] montre le pseudo et les vies de l’adversaire quand l’encart est replié', () => {
    const text = rivalHeadline('Paul', 17);

    expect(text).toContain('Paul');
    expect(text).toContain('17');
  });

  it('[RM-03] ne montre ni or, ni revenu, ni bâtisseur quand l’encart est replié', () => {
    const text = rivalHeadline('Paul', 17);

    expect(text).toContain('Paul');
    expect(text).not.toMatch(/\bor\b/i);
    expect(text).not.toMatch(/revenu/i);
    expect(text).not.toMatch(/bâtisseur/i);
    expect(text).not.toMatch(/glaneur/i);
  });

  it('[RM-03] échappe le pseudo quand il contient du HTML', () => {
    const text = rivalHeadline('<b>x</b>', 3);

    expect(text).not.toContain('<b>');
    expect(text).toContain('&lt;b&gt;');
  });
});

describe('fiche d’un bâtisseur', () => {
  it('[CU-01] présente le nom, le style, la faiblesse et les deux tours de base d’un bâtisseur', () => {
    const b = builder('forge');
    const html = builderCard(b);

    expect(html).toContain(b.name);
    expect(html).toContain(b.style);
    expect(html).toContain(b.weakness);
    for (const id of b.roots) expect(html).toContain(tower(id).name);
  });
});

describe('effets des tours signature', () => {
  it('[RM-05] annonce « corps à corps » pour une attaque de zone au sol de portée 1,5', () => {
    const def = tower('guard');
    expect(def.attack!.range).toBe(1.5);
    expect(towerSpecials(def).join(' · ')).toContain('corps à corps');
  });

  it('[RM-07] annonce une frappe de toute la zone pour une attaque de zone hors corps à corps', () => {
    for (const id of ['bramble', 'gong']) {
      expect(towerSpecials(tower(id)).join(' · ')).toContain('toute la zone');
    }
    expect(towerSpecials(tower('guard')).join(' · ')).not.toContain('toute la zone');
  });

  it('[RM-06] annonce l’aura, son bonus et son rayon', () => {
    for (const id of ['anvil', 'standard']) {
      const def = tower(id);
      const specials = towerSpecials(def).join(' · ');
      expect(specials).toContain('aura');
      expect(specials).toContain(`${Math.round(def.aura!.pct * 100)} %`);
      expect(specials).toContain(`${fmt1(def.aura!.radius)} cases`);
    }
  });

  it('[RM-08] annonce la durée d’étourdissement', () => {
    const specials = towerSpecials(tower('gong')).join(' · ');
    expect(specials).toContain('étourdi');
    expect(specials).toContain('0,5 s');
  });

  it('[RM-09] annonce le maximum de montée en puissance', () => {
    // `max` est une fraction : 1 = +100 %.
    const def = tower('pylon');
    const specials = towerSpecials(def).join(' · ');
    expect(specials).toContain('montée en puissance');
    expect(specials).toContain(`${Math.round(def.attack!.rampUp!.max * 100)} %`);
  });
});

describe('placedTowerInfo', () => {
  it('[RM-07] montre éliminations, dégâts, ciblage et revente quand la tour est adverse', () => {
    const t = towerFixture({ def: TOWERS.archer, kills: 12, damage: 3456, targetMode: 'strong', spent: 100 });

    const html = placedTowerInfo(t, false);

    expect(html).toContain(`${fmt0(12)} éliminations`);
    expect(html).toContain(`${fmt0(3456)} dégâts infligés`);
    expect(html).toContain('ciblage plus robuste');
    expect(html).toMatch(/revente \d+ or/);
  });

  it('[RM-07] omet l’invitation à transformer quand le mur est adverse', () => {
    const t = towerFixture({ def: TOWERS.wall, spent: 10 });

    const html = placedTowerInfo(t, false);

    expect(html).toMatch(/Revente \d+ or/);
    expect(html).not.toContain('transformer');
  });

  it('[RM-07] invite à transformer quand le mur est à soi', () => {
    const t = towerFixture({ def: TOWERS.wall, spent: 10 });

    expect(placedTowerInfo(t, true)).toContain('Sélectionnez une tour à transformer');
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

describe('mode de partie', () => {
  it('[RM-01] nomme les modes « Duel » et « Coopération »', () => {
    expect(modeLabel(Mode.Duel)).toBe('Duel');
    expect(modeLabel(Mode.Coop)).toBe('Coopération');
  });

  it('[RM-01] relie les joueurs du salon par « contre » en duel et « et » en coopération', () => {
    expect(pairingWord(Mode.Duel)).toBe('contre');
    expect(pairingWord(Mode.Coop)).toBe('et');
  });
});

describe('titre de fin coopérative', () => {
  it('[RM-07] titre la fin coopérative « Vague 12 atteinte »', () => {
    expect(reachedTitle(11)).toBe('Vague 12 atteinte');
  });
});

describe('message d’envoi', () => {
  it('[RM-05] annonce « Vos 3 Harpies et 2 Loups gris attaquent Paul » quand deux créatures sont envoyées', () => {
    const groups = groupSends(['harpy', 'harpy', 'harpy', 'wolf', 'wolf']);

    expect(sentMessage(groups, 'Paul')).toBe('Vos 3 Harpies et 2 Loups gris attaquent Paul');
  });

  it('[RM-05] annonce « Votre Harpie attaque Paul » quand un seul envoi part', () => {
    expect(sentMessage(groupSends(['harpy']), 'Paul')).toBe('Votre Harpie attaque Paul');
  });
});

describe('récapitulatif de vague', () => {
  it('[RM-07] liste « 12 Vouivres · air » et « 12 Maraudeurs · sol » pour la vague 12, sans répéter le titre de la bannière', () => {
    const lines = waveRecap(waveBriefing(newWorld(), 11), [], 'Paul');

    expect(lines).toContain('12 Vouivres · air');
    expect(lines).toContain('12 Maraudeurs · sol');
    expect(lines.join(' ')).not.toContain('Vague');
  });

  it('[RM-07] place le chef en premier avec la mention « chef »', () => {
    const lines = waveRecap(waveBriefing(newWorld(), 9), [], 'Paul');

    expect(lines[0]).toBe('1 Ogre chef de guerre · sol · chef');
    expect(lines.findIndex((l) => l.includes('Maraudeurs'))).toBeGreaterThan(0);
  });

  it('[RM-07] accorde au singulier un groupe d’une seule créature', () => {
    const single: WaveBriefing = { wave: 4, groups: [{ creep: CREEPS.wolf, count: 1, hp: 437, bounty: 23 }] };

    expect(waveRecap(single, [], 'Paul')).toEqual(['1 Loup gris · sol']);
  });

  it('[RM-08] liste « Envoyés par Paul » avec chaque créature reçue, son nombre et sol ou air', () => {
    const lines = waveRecap(waveBriefing(newWorld(), 11), groupSends(['harpy', 'harpy', 'harpy', 'wolf']), 'Paul');

    const sent = lines.slice(lines.indexOf('Envoyés par Paul'));
    expect(sent).toEqual(['Envoyés par Paul', '3 Harpies · air', '1 Loup gris · sol']);
  });

  it('[RM-08] omet la partie des envois quand aucun envoi n’est reçu', () => {
    const lines = waveRecap(waveBriefing(newWorld(), 11), [], 'Paul');

    expect(lines).toContain('12 Vouivres · air');
    expect(lines.join(' ')).not.toContain('Envoyés par');
  });
});
