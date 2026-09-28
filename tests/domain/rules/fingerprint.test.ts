import { describe, expect, it } from 'vitest';
import { dispatch } from '../../../src/application/dispatch';
import { fingerprint } from '../../../src/domain/rules/fingerprint';
import { newWorld, run } from '../../support/helpers';
import { CommandType } from '../../../src/domain/model/types';

describe('fingerprint', () => {
  it('[RM-05] donne la même empreinte quand deux parties ont même graine et mêmes ordres aux mêmes ticks', () => {
    const a = newWorld('normal', 42);
    const b = newWorld('normal', 42);

    dispatch(a, { c: CommandType.Build, def: 'archer', x: 8, y: 3 });
    dispatch(b, { c: CommandType.Build, def: 'archer', x: 8, y: 3 });
    run(a, 5);
    run(b, 5);

    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('[RM-05] change d’empreinte quand l’or diffère', () => {
    const a = newWorld('normal', 42);
    const b = newWorld('normal', 42);
    run(a, 5);
    run(b, 5);
    b.gold += 1;

    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });

  it('[RM-05] change d’empreinte quand un même ordre est appliqué à un autre tick', () => {
    const a = newWorld('normal', 42);
    const b = newWorld('normal', 42);

    run(a, 1);
    dispatch(a, { c: CommandType.Build, def: 'archer', x: 8, y: 3 });
    run(a, 5);

    dispatch(b, { c: CommandType.Build, def: 'archer', x: 8, y: 3 });
    run(b, 6);

    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });
});
