import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { newWorld } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('upgrade', () => {
  it('transforme un mur en tour pour la différence de prix', () => {
    const w = newWorld();
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

describe('upgrade — infusion', () => {
  it("[RM-02] transforme une tour de guet en Dard corrosif et débite 70 or quand la vague 8 est lancée et qu'une tour acide existe", () => {
    const w = newWorld();
    w.gold = 1000;
    const sniper = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    expect(sniper.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: sniper.id, def: 'sniper' }).ok).toBe(true);
    const acid = dispatch(w, { c: CommandType.Build, def: 'venom', x: 12, y: 8 }) as { ok: true; id: number };
    expect(acid.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'acid' }).ok).toBe(true);
    w.wave = 7;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: sniper.id, def: 'stinger' });

    expect(r.ok).toBe(true);
    const tower = w.towerById.get(sniper.id)!;
    expect(tower.def.id).toBe('stinger');
    expect(gold - w.gold).toBe(70);
  });

  it("[RM-05] propose le même Dard corrosif depuis une tour acide quand une tour de guet existe", () => {
    const w = newWorld();
    w.gold = 1000;
    const sniper = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    expect(sniper.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: sniper.id, def: 'sniper' }).ok).toBe(true);
    const acid = dispatch(w, { c: CommandType.Build, def: 'venom', x: 12, y: 8 }) as { ok: true; id: number };
    expect(acid.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'acid' }).ok).toBe(true);
    w.wave = 7;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'stinger' });

    expect(r.ok).toBe(true);
    const tower = w.towerById.get(acid.id)!;
    expect(tower.def.id).toBe('stinger');
    expect(gold - w.gold).toBe(70);
  });

  it("[RM-02] ajoute l'infusion au journal de rejeu quand elle réussit", () => {
    const w = newWorld();
    w.gold = 1000;
    const sniper = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    expect(sniper.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: sniper.id, def: 'sniper' }).ok).toBe(true);
    const acid = dispatch(w, { c: CommandType.Build, def: 'venom', x: 12, y: 8 }) as { ok: true; id: number };
    expect(acid.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'acid' }).ok).toBe(true);
    w.wave = 7;

    dispatch(w, { c: CommandType.Upgrade, tower: sniper.id, def: 'stinger' });

    expect(w.log.some((e) => e.cmd.c === CommandType.Upgrade && (e.cmd as { def: string }).def === 'stinger')).toBe(true);
  });

  it("[RM-03] laisse l'or et la tour inchangés quand l'infusion est refusée pour la vague", () => {
    const w = newWorld();
    w.gold = 1000;
    const sniper = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    expect(sniper.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: sniper.id, def: 'sniper' }).ok).toBe(true);
    const acid = dispatch(w, { c: CommandType.Build, def: 'venom', x: 12, y: 8 }) as { ok: true; id: number };
    expect(acid.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'acid' }).ok).toBe(true);
    w.wave = 6;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: sniper.id, def: 'stinger' });

    expect(r).toEqual({ ok: false, reason: 'Infusion possible à partir de la vague 8.' });
    expect(w.gold).toBe(gold);
    expect(w.towerById.get(sniper.id)!.def.id).toBe('sniper');
  });

  it('[RM-06] améliore un Dard corrosif en Aiguillon de rouille pour 150 or sans autre condition', () => {
    const w = newWorld();
    w.gold = 1000;
    const sniper = dispatch(w, { c: CommandType.Build, def: 'archer', x: 10, y: 8 }) as { ok: true; id: number };
    expect(sniper.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: sniper.id, def: 'sniper' }).ok).toBe(true);
    const acid = dispatch(w, { c: CommandType.Build, def: 'venom', x: 12, y: 8 }) as { ok: true; id: number };
    expect(acid.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: acid.id, def: 'acid' }).ok).toBe(true);
    w.wave = 7;
    expect(dispatch(w, { c: CommandType.Upgrade, tower: sniper.id, def: 'stinger' }).ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Sell, tower: acid.id }).ok).toBe(true);
    w.wave = 2;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: sniper.id, def: 'rustspike' });

    expect(r.ok).toBe(true);
    const tower = w.towerById.get(sniper.id)!;
    expect(tower.def.id).toBe('rustspike');
    expect(gold - w.gold).toBe(150);
  });

  it("[RM-11] infuse un mortier en Obus cryogénique quand la vague 8 est lancée et qu'un glacier existe", () => {
    const w = newWorld();
    w.gold = 1000;
    const cannon = dispatch(w, { c: CommandType.Build, def: 'cannon', x: 10, y: 8 }) as { ok: true; id: number };
    expect(cannon.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: cannon.id, def: 'mortar' }).ok).toBe(true);
    const frost = dispatch(w, { c: CommandType.Build, def: 'frost', x: 12, y: 8 }) as { ok: true; id: number };
    expect(frost.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: frost.id, def: 'glacier' }).ok).toBe(true);
    w.wave = 7;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: cannon.id, def: 'cryoshell' });

    expect(r.ok).toBe(true);
    const tower = w.towerById.get(cannon.id)!;
    expect(tower.def.id).toBe('cryoshell');
    expect(gold - w.gold).toBe(70);
  });

  it("[RM-12] infuse une tour d'orage en Grêle quand la vague 8 est lancée et qu'un glacier existe", () => {
    const w = newWorld();
    w.gold = 1000;
    const storm = dispatch(w, { c: CommandType.Build, def: 'storm', x: 10, y: 8 }) as { ok: true; id: number };
    expect(storm.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: storm.id, def: 'tempest' }).ok).toBe(true);
    const frost = dispatch(w, { c: CommandType.Build, def: 'frost', x: 12, y: 8 }) as { ok: true; id: number };
    expect(frost.ok).toBe(true);
    expect(dispatch(w, { c: CommandType.Upgrade, tower: frost.id, def: 'glacier' }).ok).toBe(true);
    w.wave = 7;
    const gold = w.gold;

    const r = dispatch(w, { c: CommandType.Upgrade, tower: storm.id, def: 'hail' });

    expect(r.ok).toBe(true);
    const tower = w.towerById.get(storm.id)!;
    expect(tower.def.id).toBe('hail');
    expect(gold - w.gold).toBe(75);
  });
});
