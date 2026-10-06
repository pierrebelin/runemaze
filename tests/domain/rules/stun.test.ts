import { describe, expect, it } from 'vitest';
import { stunDuration } from '../../../src/domain/rules/stun';
import { CREEPS } from '../../../src/domain/catalog/creeps';

describe('stun', () => {
  it('[RM-08] divise par deux la durée d\'étourdissement d\'un chef', () => {
    expect(stunDuration(0.8, CREEPS.ogre)).toBeCloseTo(0.4);
    expect(stunDuration(0.8, CREEPS.rat)).toBeCloseTo(0.8);
  });

  it('[RM-08] n\'étourdit pas un immunisé à la magie', () => {
    expect(stunDuration(0.8, CREEPS.wraith)).toBe(0);
  });
});
