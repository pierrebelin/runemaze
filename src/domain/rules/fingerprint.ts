import type { World } from '../model/World';
import { snapshot } from '../model/snapshot';

export function fingerprint(world: World): string {
  const s = JSON.stringify(snapshot(world));
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}
