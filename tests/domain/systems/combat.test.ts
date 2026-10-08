import { describe, expect, it } from 'vitest';
import { applyDamage, hitCreep, updateProjectiles } from '../../../src/domain/systems/combat';
import { updateStatuses, applyOnHit } from '../../../src/domain/systems/status';
import { creepHp, spawnCreep } from '../../../src/domain/systems/waves';
import { TOWERS } from '../../../src/domain/catalog/towers';
import { CREEPS, bountyFor } from '../../../src/domain/catalog/creeps';
import { CommandType, GameEventType, type AttackDef } from '../../../src/domain/model/types';
import { armorValueMultiplier, damageMultiplier } from '../../../src/domain/rules/Damage';
import { MAP_CRYSTAL } from '../../support/maps';
import { dispatch } from '../../../src/application/dispatch';
import { buildTowerChain, newWorld, run, spawnDummy } from '../../support/helpers';
import type { Creep, Tower } from '../../../src/domain/model/types';
import type { World } from '../../../src/domain/model/World';

/** Avance jusqu'au prochain tir de la tour (borne 5 s) et renvoie la recharge qui vient d'être posée. */
function cooldownAtNextShot(w: World, t: Tower): number {
  let prev = t.cooldown;
  for (let i = 0; i < 300; i++) {
    w.step();
    if (t.cooldown > prev) return t.cooldown;
    prev = t.cooldown;
  }
  return NaN;
}

const PLAIN_ATTACK: AttackDef = {
  type: 'normal',
  dmg: [10, 10],
  cooldown: 1,
  range: 1,
  projectileSpeed: 0,
  targets: 'ground',
};

const SLOW_POISON_ATTACK: AttackDef = {
  type: 'normal',
  dmg: [10, 10],
  cooldown: 1,
  range: 1,
  projectileSpeed: 0,
  targets: 'ground',
  slow: { pct: 0.3, duration: 2 },
  poison: { dps: 5, duration: 4, maxStacks: 1 },
};

describe('combat', () => {
  it('[RM-10] n\'inflige aucun dégât aux 4 premiers coups puis blesse au 5e quand la créature a un bouclier de 4', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    c.shield = 4;
    const hp0 = c.hp;

    for (let i = 0; i < 4; i++) hitCreep(w, 1, 'archer', PLAIN_ATTACK, c, 10);
    expect(c.hp).toBe(hp0);

    hitCreep(w, 1, 'archer', PLAIN_ATTACK, c, 10);
    expect(c.hp).toBeLessThan(hp0);
  });

  it('[RM-10] n\'applique ni ralentissement ni poison quand le coup est absorbé', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    c.shield = 4;

    hitCreep(w, 1, 'archer', SLOW_POISON_ATTACK, c, 10);

    expect(c.slowPct).toBe(0);
    expect(c.poisons).toHaveLength(0);
  });

  it('[RM-10] consomme une charge par créature touchée quand un éclat de zone les atteint', () => {
    const w = newWorld();
    const a = TOWERS.cannon.attack!;
    const c1 = spawnCreep(w, 'rat', 0);
    const c2 = spawnCreep(w, 'rat', 0);
    c1.shield = 4;
    c2.shield = 4;
    c1.x = 5; c1.y = 5;
    c2.x = 5 + a.splash!.radius * 0.5; c2.y = 5;

    w.projectiles.push({
      id: w.id(), towerId: 1, attack: a, defId: 'cannon', family: 'cannon',
      x: 5, y: 5, sx: 5, sy: 5, targetId: c1.id, tx: c1.x, ty: c1.y,
      dmgRoll: 10, crit: false, alive: true,
    });

    updateProjectiles(w, 1);

    expect(c1.shield).toBe(3);
    expect(c2.shield).toBe(3);
  });

  it('[RM-10] laisse passer le poison déjà appliqué sans consommer de charge', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    c.shield = 4;
    applyOnHit(w, c, SLOW_POISON_ATTACK, 1, 'archer');
    const doseAvant = c.poisons[0].t;

    hitCreep(w, 1, 'archer', SLOW_POISON_ATTACK, c, 10);

    expect(c.shield).toBe(3);
    expect(c.poisons).toHaveLength(1);
    expect(c.poisons[0].t).toBe(doseAvant);

    const hp0 = c.hp;
    updateStatuses(w, 1);

    expect(c.hp).toBeLessThan(hp0);
    expect(c.shield).toBe(3);
  });

  it('[RM-10] fait apparaître la Garde runique avec un bouclier qui absorbe 4 coups', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'runeguard', 0);
    const hp0 = c.hp;

    for (let i = 0; i < 4; i++) hitCreep(w, 1, 'archer', PLAIN_ATTACK, c, 10);
    expect(c.hp).toBe(hp0);

    hitCreep(w, 1, 'archer', PLAIN_ATTACK, c, 10);
    expect(c.hp).toBeLessThan(hp0);
  });

  it('[RM-12] lance un sprint d\'1 s quand le Coureur est touché et que son sprint est disponible', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'rat', 0);
    c.def = { ...c.def, sprint: { mult: 2, duration: 1, cooldown: 4 } };

    hitCreep(w, 1, 'archer', PLAIN_ATTACK, c, 10);

    expect(c.sprint).toBe(1);
  });

  it('[RM-11] fait naître 2 petits Limons à la position et sur le tronçon du Limon tué', () => {
    const w = newWorld();
    const parent = spawnCreep(w, 'slime', 0);
    parent.leg = 1;
    parent.tx = 5;
    parent.ty = 7;
    parent.x = 5.5;
    parent.y = 7.5;

    applyDamage(w, parent, parent.hp, 'normal', 1, false);

    expect(w.offspring).toHaveLength(2);
    for (const child of w.offspring) {
      expect(child.def.id).toBe('slimelet');
      expect(child.x).toBe(parent.x);
      expect(child.y).toBe(parent.y);
      expect(child.leg).toBe(parent.leg);
      expect(child.tx).toBe(parent.tx);
      expect(child.ty).toBe(parent.ty);
      expect(child.wave).toBe(parent.wave);
    }
  });

  it('[RM-11] verse la prime de chaque petit Limon tué', () => {
    const w = newWorld();
    const parent = spawnCreep(w, 'slime', 0);
    applyDamage(w, parent, parent.hp, 'normal', 1, false);

    expect(w.offspring).toHaveLength(2);
    const children = [...w.offspring];
    for (const child of children) expect(child.bounty).toBeGreaterThan(0);

    for (const child of children) {
      const goldBefore = w.gold;
      applyDamage(w, child, child.hp, 'normal', 1, false);
      expect(w.gold - goldBefore).toBe(child.bounty);
    }
  });

  it('[RM-11] ne scinde pas un petit Limon tué', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'slimelet', 0);

    applyDamage(w, c, c.hp, 'normal', 1, false);

    expect(w.offspring).toHaveLength(0);
  });

  it('[RM-03] un coup de 20 du Dissipateur inflige environ 4 dégâts à un Spectre', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'wraith', 0);
    const hp0 = c.hp;

    hitCreep(w, 1, 'dispeller', TOWERS.dispeller.attack!, c, 20);

    expect(hp0 - c.hp).toBeCloseTo(20 * 0.3 * damageMultiplier('magic', { ...c.def, magicImmune: false }), 6);
    expect(hp0 - c.hp).toBeGreaterThan(3.9);
    expect(hp0 - c.hp).toBeLessThan(4.1);
  });

  it('[RM-04] une Tour de foudre ne retire aucun PV à un Spectre quand elle tire sur lui', () => {
    const w = newWorld();
    const c = spawnCreep(w, 'wraith', 0);
    const hp0 = c.hp;

    hitCreep(w, 1, 'storm', TOWERS.storm.attack!, c, 20);

    expect(c.hp).toBe(hp0);
  });

  it('[RM-14] fait naître 2 têtes quand l\'Hydre passe sous 75 % de ses PV max', () => {
    const w = newWorld();
    const hydra = spawnCreep(w, 'hydra', 0);
    const dmg = hydra.maxHp * 0.3;

    applyDamage(w, hydra, dmg, 'chaos', 1, true);

    expect(w.offspring).toHaveLength(2);
    for (const child of w.offspring) {
      expect(child.def.id).toBe('hydrahead');
      expect(child.x).toBe(hydra.x);
      expect(child.y).toBe(hydra.y);
    }
  });

  it('[RM-14] fait naître 6 têtes au total quand l\'Hydre passe les trois seuils', () => {
    const w = newWorld();
    const hydra = spawnCreep(w, 'hydra', 0);

    applyDamage(w, hydra, hydra.maxHp * 0.3, 'chaos', 1, true);
    applyDamage(w, hydra, hydra.maxHp * 0.3, 'chaos', 1, true);
    applyDamage(w, hydra, hydra.maxHp * 0.3, 'chaos', 1, true);

    expect(w.offspring).toHaveLength(6);
    expect(w.offspring.every((c) => c.def.id === 'hydrahead')).toBe(true);
  });

  it('[RM-14] ne refait pas naître de têtes quand l\'Hydre régénérée repasse un seuil déjà franchi', () => {
    const w = newWorld();
    const hydra = spawnCreep(w, 'hydra', 0);

    applyDamage(w, hydra, hydra.maxHp * 0.3, 'chaos', 1, true);
    expect(w.offspring).toHaveLength(2);

    hydra.hp = hydra.maxHp;
    applyDamage(w, hydra, hydra.maxHp * 0.3, 'chaos', 1, true);

    expect(w.offspring).toHaveLength(2);
  });

  it('[RM-14] fait naître les têtes de chaque seuil quand un seul coup en franchit plusieurs', () => {
    const w = newWorld();
    const hydra = spawnCreep(w, 'hydra', 0);

    applyDamage(w, hydra, hydra.maxHp * 0.6, 'chaos', 1, true);

    expect(w.offspring).toHaveLength(4);
    expect(w.offspring.every((c) => c.def.id === 'hydrahead')).toBe(true);
  });

  it('[RM-14] fait naître des têtes aux PV et à la prime de la table, indépendants de ceux de l\'Hydre', () => {
    const w = newWorld();
    const hydra = spawnCreep(w, 'hydra', 0);

    applyDamage(w, hydra, hydra.maxHp * 0.3, 'chaos', 1, true);

    expect(w.offspring).toHaveLength(2);
    const expectedHp = creepHp(w, { ...CREEPS.hydrahead, hpFactor: 1.5 }, 0);
    const expectedBounty = bountyFor(0, { ...CREEPS.hydrahead, bountyFactor: 0.5 });
    for (const child of w.offspring) {
      expect(child.maxHp).toBe(expectedHp);
      expect(child.bounty).toBe(expectedBounty);
      expect(child.maxHp).toBeLessThan(hydra.maxHp);
    }
  });

  it('[RM-11] épargne les petits Limons quand l\'éclat de zone qui tue leur parent les atteindrait', () => {
    const w = newWorld();
    const a = TOWERS.cannon.attack!;
    const parent = spawnCreep(w, 'slime', 0);
    parent.hp = 1;
    parent.x = 5;
    parent.y = 5;

    w.projectiles.push({
      id: w.id(), towerId: 1, attack: a, defId: 'cannon', family: 'cannon',
      x: 5, y: 5, sx: 5, sy: 5, targetId: parent.id, tx: parent.x, ty: parent.y,
      dmgRoll: 999, crit: false, alive: true,
    });

    updateProjectiles(w, 1);

    expect(w.offspring).toHaveLength(2);
    expect(w.offspring.every((c) => c.hp === c.maxHp)).toBe(true);
  });

  it('[RM-05] la Garde blesse à chaque coup toutes les créatures au sol à sa portée', () => {
    const w = newWorld();
    const t = buildTowerChain(w, ['guard']);
    const a = spawnDummy(w, t.cx + 1, t.cy);
    const b = spawnDummy(w, t.cx, t.cy + 1);

    run(w, 0.5);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);

    const [a1, b1] = [a.hp, b.hp];
    run(w, 1);
    expect(a.hp).toBeLessThan(a1);
    expect(b.hp).toBeLessThan(b1);
  });

  it('[RM-05] la Garde ignore les volants', () => {
    const w = newWorld();
    const t = buildTowerChain(w, ['guard']);
    const flyer = spawnDummy(w, t.cx + 1, t.cy, true);
    const walker = spawnDummy(w, t.cx, t.cy + 1);

    run(w, 2);

    expect(walker.hp).toBeLessThan(walker.maxHp);
    expect(flyer.hp).toBe(flyer.maxHp);
  });

  it('[RM-05] une créature au contact d\'une Garde poursuit son trajet sans s\'arrêter', () => {
    const w = newWorld();
    const t = buildTowerChain(w, ['guard']);
    const c = spawnDummy(w, t.cx + 1, t.cy);
    c.frozen = 0;
    const ref = newWorld();
    const r = spawnDummy(ref, t.cx + 1, t.cy);
    r.frozen = 0;

    run(w, 0.5);
    run(ref, 0.5);

    expect(c.hp).toBeLessThan(c.maxHp);
    expect(c.x !== t.cx + 1 || c.y !== t.cy).toBe(true);
    expect(c.x).toBe(r.x);
    expect(c.y).toBe(r.y);
  });

  it('[RM-07] les Ronces infligent 6 dégâts par seconde à chaque créature au sol à une case de leur bord', () => {
    const w = newWorld('normal', 42, undefined, 'sylve');
    const t = buildTowerChain(w, ['bramble']);
    const a = spawnDummy(w, t.cx + 2, t.cy);
    const b = spawnDummy(w, t.cx, t.cy - 2);
    const expected = 6 * damageMultiplier('normal', a.def, 0, false);

    run(w, 0.5);

    expect(a.maxHp - a.hp).toBeCloseTo(expected);
    expect(b.maxHp - b.hp).toBeCloseTo(expected);

    run(w, 0.7); // t = 1,2 s, soit 0,9 s après le premier coup (t = 0,3 s) : pas de second coup
    expect(a.maxHp - a.hp).toBeCloseTo(expected);
    expect(b.maxHp - b.hp).toBeCloseTo(expected);

    run(w, 0.2); // t = 1,4 s, soit 1,1 s après le premier coup : second coup
    expect(a.maxHp - a.hp).toBeCloseTo(2 * expected);
    expect(b.maxHp - b.hp).toBeCloseTo(2 * expected);
  });

  it('[RM-07] les Ronces épargnent une créature au sol à plus d\'une case de leur bord', () => {
    const w = newWorld('normal', 42, undefined, 'sylve');
    const t = buildTowerChain(w, ['bramble']);
    const far = spawnDummy(w, t.cx + 2 + CREEPS.rat.radius + 0.5, t.cy);
    const near = spawnDummy(w, t.cx + 2, t.cy);

    run(w, 3);

    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);
  });

  it('[RM-07] le Roncier empoisonne au plus trois fois une créature qui reste à son contact', () => {
    const w = newWorld('normal', 42, undefined, 'sylve');
    const t = buildTowerChain(w, ['bramble', 'briar']);
    const c = spawnDummy(w, t.cx + 1, t.cy);

    run(w, 5);

    expect(c.poisons).toHaveLength(3);
  });

  it('[RM-08] le Gong immobilise 0,5 s toutes les créatures, au sol et en vol, à 2,5 cases', () => {
    const w = newWorld('normal', 42, undefined, 'sanctuary');
    const t = buildTowerChain(w, ['gong']);
    const ground = spawnDummy(w, t.cx + 2, t.cy);
    const flyer = spawnDummy(w, t.cx, t.cy + 2, true);
    const far = spawnDummy(w, t.cx + 3.2, t.cy);
    for (const c of [ground, flyer, far]) c.frozen = 0;

    // La tour garde un court délai avant son premier tir : on avance jusqu'à la touche (borne 1 s).
    for (let i = 0; i < 60 && ground.frozen <= 0; i++) w.step();

    for (const c of [ground, flyer]) {
      expect(c.frozen).toBeGreaterThan(0.4);
      expect(c.frozen).toBeLessThanOrEqual(0.5);
    }
    expect(far.frozen).toBe(0);
  });

  it('[RM-05] le Foyer blesse à chaque salve toutes les créatures au sol à 2,5 cases', () => {
    const w = newWorld('normal', 42, undefined, 'pyromancers');
    const t = buildTowerChain(w, ['hearth']);
    const r = CREEPS.rat.radius;
    const near = spawnDummy(w, t.cx + 1, t.cy);
    const edge = spawnDummy(w, t.cx, t.cy + 2.4);
    const rim = spawnDummy(w, t.cx - (2.5 + r - 0.05), t.cy);
    const far = spawnDummy(w, t.cx, t.cy - (2.5 + r + 0.2));

    // La tour garde un court délai avant sa première salve : on avance jusqu'à la touche (borne 3 s).
    for (let i = 0; i < 180 && near.hp === near.maxHp; i++) w.step();

    for (const c of [near, edge, rim]) expect(c.hp).toBeLessThan(c.maxHp);
    expect(far.hp).toBe(far.maxHp);
    expect(w.projectiles).toHaveLength(0);

    const [n1, e1, r1] = [near.hp, edge.hp, rim.hp];
    run(w, 2.1);
    expect(near.hp).toBeLessThan(n1);
    expect(edge.hp).toBeLessThan(e1);
    expect(rim.hp).toBeLessThan(r1);
    expect(far.hp).toBe(far.maxHp);
    expect(w.projectiles).toHaveLength(0);
  });

  it('[RM-05] le Foyer ignore les volants', () => {
    const w = newWorld('normal', 42, undefined, 'pyromancers');
    const t = buildTowerChain(w, ['hearth']);
    const flyer = spawnDummy(w, t.cx + 1, t.cy, true);
    const walker = spawnDummy(w, t.cx, t.cy + 1);

    run(w, 3);

    expect(walker.hp).toBeLessThan(walker.maxHp);
    expect(flyer.hp).toBe(flyer.maxHp);
  });

  it('[RM-05] le Champ de cendres ralentit de 25 % les créatures touchées par sa salve', () => {
    const w = newWorld('normal', 42, undefined, 'pyromancers');
    const t = buildTowerChain(w, ['hearth', 'ashfield']);
    const a = spawnDummy(w, t.cx + 2, t.cy);
    const b = spawnDummy(w, t.cx, t.cy + 2.4);
    const far = spawnDummy(w, t.cx, t.cy - (2.5 + CREEPS.rat.radius + 0.2));

    for (let i = 0; i < 180 && a.hp === a.maxHp; i++) w.step();

    expect(a.slowPct).toBe(0.25);
    expect(b.slowPct).toBe(0.25);
    expect(far.slowPct).toBe(0);
    expect(far.hp).toBe(far.maxHp);
  });

  it('[RM-06] une tour à côté d\'une Enclume tire plus souvent que seule', () => {
    const shots = (withAnvil: boolean): number => {
      const w = newWorld('normal', 42, undefined, 'forge');
      const t = buildTowerChain(w, ['cannon']);
      if (withAnvil) buildTowerChain(w, ['anvil'], 12, 8);
      spawnDummy(w, t.cx + 1, t.cy);
      let n = 0;
      let prev = t.cooldown;
      for (let i = 0; i < 600; i++) {
        w.step();
        if (t.cooldown > prev) n++;
        prev = t.cooldown;
      }
      return n;
    };

    expect(shots(true)).toBeGreaterThan(shots(false));
  });

  it('[RM-06] une Garde à côté d\'un Porte-étendard inflige plus de dégâts que seule', () => {
    // Garde 14-18 : moyenne 16 seule, 19,2 avec +20 % ; seuil 17,5 sur une dizaine de coups (graine fixe).
    const meanHit = (withStandard: boolean): number => {
      const w = newWorld('normal', 42);
      const t = buildTowerChain(w, ['guard']);
      if (withStandard) buildTowerChain(w, ['guard', 'standard'], 12, 8);
      const c = spawnDummy(w, t.cx - 1, t.cy);
      let hits = 0;
      let prev = t.cooldown;
      for (let i = 0; i < 600; i++) {
        w.step();
        if (t.cooldown > prev) hits++;
        prev = t.cooldown;
      }
      return (c.maxHp - c.hp) / damageMultiplier('normal', c.def, 0, false) / hits;
    };

    expect(meanHit(false)).toBeLessThan(17.5);
    expect(meanHit(true)).toBeGreaterThan(17.5);
  });

  it('[RM-09] le Pylône tire plus souvent après 30 s avec une cible qu\'au premier tir', () => {
    const w = newWorld('normal', 42, undefined, 'arcanists');
    const t = buildTowerChain(w, ['pylon']);
    spawnDummy(w, t.cx + 1, t.cy);

    const first = cooldownAtNextShot(w, t);
    run(w, 30);
    const later = cooldownAtNextShot(w, t);

    expect(t.ramp).toBeGreaterThanOrEqual(30);
    expect(later).toBeLessThan(first);
    expect(later).toBeCloseTo(0.8 / 1.3, 1);
  });

  it('[RM-09] la montée n\'avance pas tant qu\'aucune créature n\'est à portée', () => {
    const w = newWorld('normal', 42, undefined, 'arcanists');
    const t = buildTowerChain(w, ['pylon']);
    const c = spawnDummy(w, t.cx + 9, t.cy);

    run(w, 5);
    expect(t.ramp).toBe(0);

    // Témoin : la même créature ramenée à portée fait avancer la montée.
    c.x = t.cx + 1;
    run(w, 1);
    expect(t.ramp).toBeGreaterThan(0.9);
  });

  it('[RM-09] la montée retombe à zéro quand plus aucune créature n\'est sur la carte', () => {
    const w = newWorld('normal', 42, undefined, 'arcanists');
    const t = buildTowerChain(w, ['pylon']);
    spawnDummy(w, t.cx + 1, t.cy);

    run(w, 3);
    expect(t.ramp).toBeGreaterThan(2.5);

    // Carte vidée sans passer par `creepGone` : aucune vague n'a été lancée, pas de fin de vague à solder.
    w.creeps = [];
    run(w, 0.1);

    expect(t.ramp).toBe(0);
  });

  /** Avance jusqu'à `n` coups reçus par `c` (borne 20 s) et renvoie les PV perdus à chaque coup. */
  function hitDamages(w: World, c: Creep, n: number): number[] {
    const out: number[] = [];
    let prev = c.hp;
    for (let i = 0; i < 1200 && out.length < n; i++) {
      w.step();
      if (c.hp < prev) out.push(prev - c.hp);
      prev = c.hp;
    }
    return out;
  }

  /** Lance-flammes aux dégâts fixes (10-10) : la variance de `world.rng` disparaît. */
  function fixedFlamethrower(w: World): Tower {
    const t = buildTowerChain(w, ['brazier', 'flamethrower'], 10, 8);
    t.def = { ...t.def, attack: { ...t.def.attack!, dmg: [10, 10] } };
    return t;
  }

  it('[RM-04] le 6e coup du Lance-flammes sur la même créature fait 50 % de plus que le premier', () => {
    const w = newWorld('normal', 42, undefined, 'pyromancers');
    const t = fixedFlamethrower(w);
    const c = spawnDummy(w, t.cx + 1, t.cy);

    const d = hitDamages(w, c, 6);

    expect(d).toHaveLength(6);
    expect(d[5] / d[0]).toBeCloseTo(1.5, 6);
  });

  it('[RM-04] l\'acharnement retombe à zéro quand le Lance-flammes change de cible', () => {
    const w = newWorld('normal', 42, undefined, 'pyromancers');
    const t = fixedFlamethrower(w);
    const a = spawnDummy(w, t.cx + 1, t.cy);
    const b = spawnDummy(w, t.cx + 20, t.cy);

    const da = hitDamages(w, a, 4);
    expect(da[3]).toBeGreaterThan(da[0]);

    // A sort de portée, B y entre : la tour change de cible.
    a.x = t.cx + 20;
    b.x = t.cx + 1;
    const db = hitDamages(w, b, 1);

    expect(db[0]).toBeCloseTo(da[0], 6);
  });

  it('[RM-07] un Autel avec 5 cumuls inflige 50 % de dégâts en plus', () => {
    const firstHit = (cumuls: number): number => {
      const w = newWorld('normal', 42, undefined, 'necromancers');
      const t = buildTowerChain(w, ['altar']);
      t.def = { ...t.def, attack: { ...t.def.attack!, dmg: [10, 10] } };
      t.offerings = Array.from({ length: cumuls }, () => w.tick + 100000);
      const c = spawnDummy(w, t.cx + 1, t.cy);
      return hitDamages(w, c, 1)[0];
    };

    const sans = firstHit(0);
    const avec = firstHit(5);

    expect(sans).toBeGreaterThan(0);
    expect(avec / sans).toBeCloseTo(1.5, 6);
  });

  it('[RM-11] le Comptoir ne tire jamais, même avec une créature à portée', () => {
    const w = newWorld('normal', 42, undefined, 'guild');
    const t = buildTowerChain(w, ['counter']);
    const c = spawnDummy(w, t.cx + 1, t.cy);

    run(w, 3);

    expect(t.def.id).toBe('counter');
    expect(c.hp).toBe(c.maxHp);
    expect(w.projectiles).toHaveLength(0);
  });

  it('[RM-08] le Carillon étourdit 0,4 s et ralentit de 30 %', () => {
    const w = newWorld('normal', 42, undefined, 'sanctuary');
    const t = buildTowerChain(w, ['gong', 'chime']);
    const c = spawnDummy(w, t.cx + 2, t.cy);
    c.frozen = 0;

    for (let i = 0; i < 60 && c.frozen <= 0; i++) w.step();

    expect(c.frozen).toBeGreaterThan(0.3);
    expect(c.frozen).toBeLessThanOrEqual(0.4);
    expect(c.slowPct).toBe(0.3);
  });

  it('[RM-01] l\'Ossuaire inflige les mêmes dégâts à toutes les armures', () => {
    const a = TOWERS.ossuary.attack!;
    for (const id of Object.keys(CREEPS)) {
      const w = newWorld();
      const c = spawnCreep(w, id, 0);
      c.shield = 0;
      c.hp = c.maxHp = 1e6;

      hitCreep(w, 1, 'ossuary', a, c, 10);

      expect(1e6 - c.hp, id).toBeCloseTo(10 * armorValueMultiplier(c.def.armor), 6);
    }
  });

  it('[RM-10] verse deux fois la prime quand le Percepteur achève la créature', () => {
    const w = newWorld('normal', 42, undefined, 'guild');
    const t = buildTowerChain(w, ['crossbow', 'taxman']);
    const c = spawnCreep(w, 'rat', 0);
    const gold = w.gold;

    applyDamage(w, c, c.hp, 'normal', t.id, false);

    expect(c.bounty).toBeGreaterThan(0);
    expect(w.gold - gold).toBe(2 * c.bounty);
  });

  it('[RM-10] verse la prime normale quand une autre tour achève une créature touchée par le Percepteur', () => {
    const w = newWorld('normal', 42, undefined, 'guild');
    const taxman = buildTowerChain(w, ['crossbow', 'taxman']);
    const other = buildTowerChain(w, ['crossbow'], 12, 8);
    const a = spawnCreep(w, 'rat', 0);
    const b = spawnCreep(w, 'rat', 0);
    const start = w.gold;

    hitCreep(w, taxman.id, 'taxman', TOWERS.taxman.attack!, a, 1);
    const g0 = w.gold;
    applyDamage(w, a, a.hp, 'normal', other.id, false);
    expect(w.gold - g0).toBe(a.bounty);

    const g1 = w.gold;
    applyDamage(w, b, b.hp, 'normal', taxman.id, false);
    expect(w.gold - g1).toBe(2 * b.bounty);

    expect(w.gold - start).toBe(a.bounty + 2 * b.bounty);
  });

  it('[RM-10] annonce la prime majorée dans l\'événement de mort', () => {
    const w = newWorld('normal', 42, undefined, 'guild');
    const t = buildTowerChain(w, ['crossbow', 'taxman']);
    const c = spawnCreep(w, 'rat', 0);

    applyDamage(w, c, c.hp, 'normal', t.id, false);

    const kill = w.events.find((e) => e.t === GameEventType.Kill) as { bounty: number } | undefined;
    expect(kill?.bounty).toBe(2 * c.bounty);
  });

  it('[CU-02] touche une créature à 1,15 × la portée quand la tour est sur un cristal', () => {
    const range = TOWERS.archer.attack!.range;
    const hit = (x: number, y: number): boolean => {
      const w = newWorld('normal', 42, MAP_CRYSTAL);
      w.gold = 100000;
      const built = dispatch(w, { c: CommandType.Build, def: 'archer', x, y }) as { ok: true; id: number };
      expect(built.ok).toBe(true);
      const t = w.towerById.get(built.id)!;
      const c = spawnDummy(w, t.cx + 1.15 * range, t.cy);
      run(w, 3);
      return c.hp < c.maxHp;
    };

    expect(hit(5, 6)).toBe(false);
    expect(hit(5, 3)).toBe(true);
  });
});
