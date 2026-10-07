import type { Family } from '../../domain/model/types';

// Palette du monde : lande humide, pierre grise, bronze et or terni.
export const PAL = {
  grassA: '#3a4d2c',
  grassB: '#34462a',
  grassC: '#435733',
  tuft: '#51683b',
  dirt: '#6a5639',
  dirtDark: '#57462d',
  rock: '#77705f',
  rockDark: '#4b463c',
  rockLight: '#9c947f',
  cliff: '#2a2721',
  stone: '#8d8471',
  stoneDark: '#5b5446',
  stoneLight: '#b7ad95',
  bronze: '#b98d4c',
  gold: '#e9b949',
  parchment: '#efe3c4',
  ink: '#1b1712',
  danger: '#d8553f',
  good: '#8cc464',
  shadow: 'rgba(10, 8, 5, 0.35)',
  breakerAura: 'rgba(240, 154, 74, 0.4)',
};

export const FAMILY_COLOR: Record<Family, { main: string; dark: string; glow: string }> = {
  wall: { main: '#8d8471', dark: '#5b5446', glow: '#c9bfa6' },
  archer: { main: '#a8743f', dark: '#6b4524', glow: '#e3c07a' },
  cannon: { main: '#4a4a4f', dark: '#262629', glow: '#f09a4a' },
  frost: { main: '#8fd3f2', dark: '#3c7fa6', glow: '#d8f3ff' },
  storm: { main: '#a98cf0', dark: '#5a3fa8', glow: '#e7dcff' },
  venom: { main: '#98c94a', dark: '#4d7322', glow: '#d6f59a' },
};

export interface CreepStyle {
  body: string;
  dark: string;
  eye: string;
}

export const CREEP_STYLE: Record<string, CreepStyle> = {
  rat: { body: '#8c7b64', dark: '#5a4b3a', eye: '#f2d36b' },
  wolf: { body: '#9da3a8', dark: '#5f656b', eye: '#f7e27a' },
  raider: { body: '#b5713c', dark: '#6e3f1c', eye: '#ffd9a8' },
  troll: { body: '#6c9a5b', dark: '#3c5e31', eye: '#ffe066' },
  golem: { body: '#948b7b', dark: '#5c5548', eye: '#7fe0ff' },
  knight: { body: '#7888a0', dark: '#3f4a5c', eye: '#ff7a5a' },
  harpy: { body: '#c7829f', dark: '#7c4660', eye: '#fff0a0' },
  wyvern: { body: '#6f9a63', dark: '#3d5c35', eye: '#ffcf4a' },
  wraith: { body: '#b9d6e2', dark: '#6c8b99', eye: '#e8fbff' },
  ogre: { body: '#9a643c', dark: '#5a3620', eye: '#ffd24a' },
  hydra: { body: '#3f8a66', dark: '#1f4d38', eye: '#ffe36b' },
  ashlord: { body: '#b9492f', dark: '#5e1f14', eye: '#ffcf6b' },
  runeguard: { body: '#5a6b8a', dark: '#2e3a52', eye: '#a0e0ff' },
  dunerunner: { body: '#d4b06a', dark: '#8a6a35', eye: '#fff2c2' },
  shaman: { body: '#c9a3d4', dark: '#7a5c85', eye: '#fff4c2' },
  slime: { body: '#5fbf60', dark: '#2e7a34', eye: '#eaffb0' },
  slimelet: { body: '#8fe08f', dark: '#4a9a4f', eye: '#eaffb0' },
  sapper: { body: '#7a8f4a', dark: '#455a26', eye: '#ffe9a0' },
  hydrahead: { body: '#4fa878', dark: '#256b46', eye: '#ffe36b' },
};
