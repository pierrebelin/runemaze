import { describe, expect, it } from 'vitest';
import { applyDamage, hitCreep, updateProjectiles } from '../../../src/domain/systems/combat';
import { updateStatuses, applyOnHit } from '../../../src/domain/systems/status';
import { creepHp, spawnCreep } from '../../../src/domain/systems/waves';
import { TOWERS } from '../../../src/domain/catalog/towers';
import { CREEPS, bountyFor } from '../../../src/domain/catalog/creeps';
import type { AttackDef } from '../../../src/domain/model/types';
import { damageMultiplier } from '../../../src/domain/rules/Damage';
import { buildTowerChain, newWorld, run, spawnDummy } from '../../support/helpers';
import type { Tower } from '../../../src/domain/model/types';
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
});
