import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { newWorld } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';
import { refundValue, upgradeCost } from '../../../src/domain/rules/pricing';

describe('upgrade', () => {
  it('transforme un mur en tour pour la différence de prix', () => {
    const w = newWorld('normal', 42, undefined, 'forge');
    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 8 }) as { ok: true; id: number };
    const gold = w.gold;
    expect(dispatch(w, { c: CommandType.Upgrade, tower: r.id, def: 'cannon' }).ok).toBe(true);
    expect(gold - w.gold).toBe(17);
  });

  it('[RM-02] garde une seule entrée sous le nom amélioré quand la tour est améliorée', () => {
    const w = newWorld();
    const r = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };

    dispatch(w, { c: CommandType.Upgrade, tower: r.id, def: 'sniper' });

    expect(w.stats.towers.size).toBe(1);
    const entry = w.stats.towers.get(r.id)!;
    expect(entry.def.name).toBe('Tour de guet');
  });
});

describe('upgrade — Garde', () => {
  it('[RM-10] un mur devient une Garde pour la différence de prix et se revend à 50 %', () => {
    const w = newWorld();
    const r = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 8 }) as { ok: true; id: number };
    const gold = w.gold;

    expect(dispatch(w, { c: CommandType.Upgrade, tower: r.id, def: 'guard' }).ok).toBe(true);

    expect(gold - w.gold).toBe(12);
    const tower = w.towerById.get(r.id)!;
    expect(tower.def.id).toBe('guard');
    expect(refundValue(tower)).toBe(7);
    const apres = w.gold;
    dispatch(w, { c: CommandType.Sell, tower: r.id });
    expect(w.gold - apres).toBe(7);
  });
});

describe('upgrade — infusion', () => {
  it("[RM-05] propose le Dard corrosif depuis une tour acide", () => {
    const w = newWorld('normal', 42, undefined, 'sylve');
    w.gold = 1000;
    const acid = dispatch(w, { c: CommandType.Build, def: 'venom', x: 12, y: 8 }) as { ok: true; id: number };
    expect(acid.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'acid' }).ok).toBe(true);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'stinger' });

    expect(r.ok).toBe(true);
    const tower = w.towerById.get(acid.id)!;
    expect(tower.def.id).toBe('stinger');
    expect(gold - w.gold).toBe(70);
  });

  it("[RM-02] ajoute l'infusion au journal de rejeu", () => {
    const w = newWorld('normal', 42, undefined, 'sylve');
    w.gold = 1000;
    const acid = dispatch(w, { c: CommandType.Build, def: 'venom', x: 12, y: 8 }) as { ok: true; id: number };
    expect(acid.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'acid' }).ok).toBe(true);

    dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'stinger' });

    expect(w.log.some((e) => e.cmd.c === CommandType.Upgrade && (e.cmd as { def: string }).def === 'stinger')).toBe(true);
  });

  it('[RM-06] améliore un Dard corrosif en Aiguillon de rouille pour 150 or sans autre condition', () => {
    const w = newWorld('normal', 42, undefined, 'sylve');
    w.gold = 1000;
    const acid = dispatch(w, { c: CommandType.Build, def: 'venom', x: 12, y: 8 }) as { ok: true; id: number };
    expect(acid.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'acid' }).ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'stinger' }).ok).toBe(true);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'rustspike' });

    expect(r.ok).toBe(true);
    const tower = w.towerById.get(acid.id)!;
    expect(tower.def.id).toBe('rustspike');
    expect(gold - w.gold).toBe(150);
  });

  it('[RM-11] infuse un mortier en Obus cryogénique', () => {
    const w = newWorld('normal', 42, undefined, 'forge');
    w.gold = 1000;
    const cannon = dispatch(w, { c: CommandType.Build, def: 'cannon', x: 10, y: 8 }) as { ok: true; id: number };
    expect(cannon.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: cannon.id, def: 'mortar' }).ok).toBe(true);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: cannon.id, def: 'cryoshell' });

    expect(r.ok).toBe(true);
    const tower = w.towerById.get(cannon.id)!;
    expect(tower.def.id).toBe('cryoshell');
    expect(gold - w.gold).toBe(70);
  });

  it('[RM-12] infuse un glacier en Grêle', () => {
    const w = newWorld('normal', 42, undefined, 'sanctuary');
    w.gold = 1000;
    const frost = dispatch(w, { c: CommandType.Build, def: 'frost', x: 12, y: 8 }) as { ok: true; id: number };
    expect(frost.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: frost.id, def: 'glacier' }).ok).toBe(true);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: frost.id, def: 'hail' });

    expect(r.ok).toBe(true);
    const tower = w.towerById.get(frost.id)!;
    expect(tower.def.id).toBe('hail');
    expect(gold - w.gold).toBe(75);
  });
});

describe('upgrade — bâtisseur', () => {
  it("[RM-02] refuse qu'un joueur Forge fasse évoluer un mur en Tour d'archers", () => {
    const w = newWorld('normal', 42, undefined, 'forge');
    w.gold = 100000;
    const wall = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 8 }) as { ok: true; id: number };
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: wall.id, def: 'archer' });

    expect(r).toEqual({ ok: false, reason: 'Amélioration indisponible.' });
    expect(w.gold).toBe(gold);
    expect(w.towerById.get(wall.id)!.def.id).toBe('wall');
  });

  it('[RM-03] fait évoluer un niveau 2 en hybride de son bâtisseur dès la première vague', () => {
    const w = newWorld('normal', 42, undefined, 'forge');
    w.gold = 100000;
    const wall = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 8 }) as { ok: true; id: number };
    expect(dispatch(w, { c: CommandType.Upgrade, tower: wall.id, def: 'cannon' }).ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: wall.id, def: 'mortar' }).ok).toBe(true);
    const gold = w.gold;
    const from = w.towerById.get(wall.id)!.def;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: wall.id, def: 'cryoshell' });

    expect(r.ok).toBe(true);
    const tower = w.towerById.get(wall.id)!;
    expect(tower.def.id).toBe('cryoshell');
    expect(gold - w.gold).toBe(upgradeCost(from, tower.def));
  });

  it("[RM-03] refuse un hybride qui n'est pas celui de son bâtisseur", () => {
    const w = newWorld('normal', 42, undefined, 'forge');
    w.gold = 100000;
    const wall = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 8 }) as { ok: true; id: number };
    expect(dispatch(w, { c: CommandType.Upgrade, tower: wall.id, def: 'cannon' }).ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: wall.id, def: 'mortar' }).ok).toBe(true);
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: wall.id, def: 'ballista' });

    expect(r).toEqual({ ok: false, reason: 'Amélioration indisponible.' });
    expect(w.gold).toBe(gold);
    expect(w.towerById.get(wall.id)!.def.id).toBe('mortar');
  });

  it("[RM-02] n'inscrit pas au journal un ordre refusé hors du jeu du bâtisseur", () => {
    const w = newWorld('normal', 42, undefined, 'forge');
    w.gold = 100000;
    const wall = dispatch(w, { c: CommandType.Build, def: 'wall', x: 10, y: 8 }) as { ok: true; id: number };

    dispatch(w, { c: CommandType.Upgrade, tower: wall.id, def: 'archer' });

    expect(w.log.some((e) => e.cmd.c === CommandType.Upgrade)).toBe(false);
  });
});
