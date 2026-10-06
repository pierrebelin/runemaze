import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { newWorld } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('callWave', () => {
  it('[RM-01] appelle la vague 31 quand la vague 30 est lancée', () => {
    const w = newWorld();
    w.wave = 29;

    const r = dispatch(w, { c: CommandType.CallWave });

    expect(r.ok).toBe(true);
    expect(w.wave).toBe(30);
  });
});
