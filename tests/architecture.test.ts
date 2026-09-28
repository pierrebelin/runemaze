import { describe, expect, it } from 'vitest';

const LAYERS = ['domain', 'application', 'infrastructure', 'presentation', 'server'] as const;
type Layer = (typeof LAYERS)[number];

// Couches qu'une couche a le droit d'importer, en plus d'elle-même.
const ALLOWED: Record<Layer, Layer[]> = {
  domain: [],
  application: ['domain'],
  infrastructure: ['domain'],
  presentation: ['domain', 'application', 'infrastructure'],
  server: ['domain', 'application'],
};

// Clés de la forme '../src/domain/model/World.ts'.
const SOURCES = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });

function resolvePath(from: string, spec: string): string {
  const parts = from.split('/').slice(0, -1);
  for (const p of spec.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  }
  return parts.join('/');
}

function layerOf(path: string): Layer | undefined {
  return LAYERS.find((l) => path.startsWith(`../src/${l}/`));
}

function filesOf(layer: Layer): [string, string][] {
  return Object.entries(SOURCES).filter(([path]) => layerOf(path) === layer);
}

function forbiddenImports(layer: Layer): string[] {
  const found: string[] = [];
  for (const [path, code] of filesOf(layer)) {
    for (const [, spec] of code.matchAll(/(?:from|import)\s*'(\.[^']+)'/g)) {
      const target = layerOf(resolvePath(path, spec));
      if (target && target !== layer && !ALLOWED[layer].includes(target)) found.push(`${path} -> ${spec}`);
    }
  }
  return found;
}

describe('architecture', () => {
  for (const layer of LAYERS) {
    it(`${layer} n'importe que ${ALLOWED[layer].join(', ') || 'lui-même'}`, () => {
      expect(filesOf(layer).length).toBeGreaterThan(0);
      expect(forbiddenImports(layer)).toEqual([]);
    });
  }

  it('domain et application ne touchent ni au DOM ni au navigateur', () => {
    const leaks = [...filesOf('domain'), ...filesOf('application')]
      .filter(([, code]) => /\b(document|window|requestAnimationFrame|AudioContext|HTMLCanvasElement)\b/.test(code))
      .map(([path]) => path);
    expect(leaks).toEqual([]);
  });

  it('[RM-04] domain et application ne lisent ni l\'heure ni l\'aléatoire du système', () => {
    const leaks = [...filesOf('domain'), ...filesOf('application')]
      .filter(([, code]) => /\b(Date\.now|new Date|performance\.now|Math\.random|crypto)\b/.test(code))
      .map(([path]) => path);
    expect(filesOf('domain').length + filesOf('application').length).toBeGreaterThan(0);
    expect(leaks).toEqual([]);
  });
});
