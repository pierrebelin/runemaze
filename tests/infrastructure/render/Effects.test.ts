import { describe, expect, it } from 'vitest';
import { CREEPS } from '../../../src/domain/catalog/creeps';
import { GameEventType } from '../../../src/domain/model/types';
import type { GameEvent } from '../../../src/domain/model/types';
import { Effects } from '../../../src/infrastructure/render/Effects';

const creep = Object.keys(CREEPS)[0];
const kill: GameEvent = { t: GameEventType.Kill, x: 3, y: 4, bounty: 7, creepId: 1, boss: false };
const waveStart: GameEvent = { t: GameEventType.WaveStart, wave: 2, creep, boss: false };
const leak: GameEvent = { t: GameEventType.Leak, lives: 19, boss: false };

describe('Effects', () => {
  it('[RM-05] produit chiffres de prime et éclats quand une créature adverse meurt', () => {
    const fx = new Effects(false);

    fx.consume([kill]);

    expect(fx.own).toBe(false);
    expect(fx.floaters.map((f) => f.text)).toEqual(['+7']);
    expect(fx.particles.length).toBeGreaterThan(0);
  });

  it('[RM-05] ne pose pas la bannière de vague quand les effets sont ceux de la carte adverse', () => {
    const fx = new Effects(false);

    fx.consume([waveStart]);

    expect(fx.banner).toBeNull();
  });

  it('[RM-05] ne déclenche pas le voile de fuite quand la fuite est sur la carte adverse', () => {
    const fx = new Effects(false);

    fx.consume([leak]);

    expect(fx.leakFlash).toBe(0);
  });

  it('[RM-05] pose la bannière de vague quand les effets sont ceux de sa carte', () => {
    const fx = new Effects();

    fx.consume([waveStart, leak]);

    expect(fx.own).toBe(true);
    expect(fx.banner?.title).toBe('Vague 3');
    expect(fx.leakFlash).toBeGreaterThan(0);
  });
});
