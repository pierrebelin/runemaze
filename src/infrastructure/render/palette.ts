import type { Biome, Family } from '../../domain/model/types';

// Palette du monde : lande humide, pierre grise neutre ; or et bronze en touches seulement.
export const PAL = {
  grassA: '#3a4d2c',
  grassB: '#34462a',
  grassC: '#435733',
  tuft: '#51683b',
  dirt: '#6a5639',
  dirtDark: '#57462d',
  rock: '#74726d',
  rockDark: '#494845',
  rockLight: '#99968f',
  cliff: '#262629',
  stone: '#888680',
  stoneDark: '#585651',
  stoneLight: '#b3b0a9',
  bronze: '#b98d4c',
  gold: '#e9b949',
  parchment: '#e7e8ea',
  ink: '#151619',
  danger: '#d8553f',
  good: '#8cc464',
  shadow: 'rgba(7, 8, 10, 0.35)',
  breakerAura: 'rgba(240, 154, 74, 0.4)',
};

export interface TerrainPalette {
  ground: string;
  groundSpots: [string, string];
  tuft: string;
  tuftDark: string;
  dirt: string;
  dirtDark: string;
  rock: string;
  rockDark: string;
  rockLight: string;
  cliff: string;
  stone: string;
  stoneDark: string;
  stoneLight: string;
}

export const BIOME_PALETTE: Record<Biome, TerrainPalette> = {
  earth: {
    ground: PAL.grassB,
    groundSpots: ['rgba(78, 100, 56, 0.22)', 'rgba(34, 46, 26, 0.25)'],
    tuft: PAL.tuft,
    tuftDark: '#2f3f25',
    dirt: PAL.dirt,
    dirtDark: PAL.dirtDark,
    rock: PAL.rock,
    rockDark: PAL.rockDark,
    rockLight: PAL.rockLight,
    cliff: PAL.cliff,
    stone: PAL.stone,
    stoneDark: PAL.stoneDark,
    stoneLight: PAL.stoneLight,
  },
  // Neige : sol gris-bleu froid désaturé, rochers ardoise ; le contraste passe par la luminosité.
  snow: {
    ground: '#7d8896',
    groundSpots: ['rgba(214, 224, 234, 0.25)', 'rgba(70, 82, 98, 0.25)'],
    tuft: '#b4bfcb',
    tuftDark: '#586577',
    dirt: '#5e6672',
    dirtDark: '#4a515c',
    rock: '#4a5361',
    rockDark: '#2c323c',
    rockLight: '#707b8b',
    cliff: '#171a20',
    stone: '#9aa3ae',
    stoneDark: '#505864',
    stoneLight: '#d0d6de',
  },
  // Espace : sol violet-noir, rochers basalte bleu-gris.
  space: {
    ground: '#1c1826',
    groundSpots: ['rgba(96, 82, 128, 0.22)', 'rgba(6, 4, 12, 0.3)'],
    tuft: '#5c5478',
    tuftDark: '#2a2338',
    dirt: '#3a3550',
    dirtDark: '#2c2840',
    rock: '#56606e',
    rockDark: '#333a45',
    rockLight: '#85909f',
    cliff: '#08070c',
    stone: '#8c94a3',
    stoneDark: '#4a505c',
    stoneLight: '#c4cad4',
  },
};

export const FAMILY_COLOR: Record<Family, { main: string; dark: string; glow: string }> = {
  wall: { main: '#888680', dark: '#585651', glow: '#c6c4be' },
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
