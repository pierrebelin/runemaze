import { afterEach, describe, expect, it } from 'vitest';
import { TOWERS } from '../../src/domain/catalog/towers';
import { CREEPS, DIFFICULTY } from '../../src/domain/catalog/creeps';
import { BUILDERS, builder } from '../../src/domain/catalog/builders';
import { ARMOR_LABEL, ATTACK_LABEL } from '../../src/domain/rules/Damage';
import type { ArmorType, AttackType, Difficulty } from '../../src/domain/model/types';
import { ARMOR_EN, ATTACK_EN, BUILDERS_EN, CREEPS_EN, DIFFICULTY_EN, REASONS_EN, TOWERS_EN } from '../../src/presentation/english';
import { builderName, creepPlural, difficultyLabel, lang, reasonText, setLang, towerDesc, towerName, tr } from '../../src/presentation/i18n';
import { biomeLabel, fmt1, modeLabel, nextWaveInfo, nextWaveLabel, resignPrompt, sendPanel, towerInfo } from '../../src/presentation/describe';
import { Mode } from '../../src/application/online/protocol';

// Sources de l'application, pour retrouver chaque refus écrit en français.
const APPLICATION = import.meta.glob<string>('../../src/application/**/*.ts', { query: '?raw', import: 'default', eager: true });

/** Textes des refus : `fail('…')`, `reason: '…'` et constantes `…_MSG = '…'`. */
function refusals(): string[] {
  const found = new Set<string>();
  const literal = String.raw`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"`;
  const patterns = [new RegExp(String.raw`fail\(\s*(?:${literal})`, 'g'), new RegExp(String.raw`reason:\s*(?:${literal})`, 'g'), new RegExp(String.raw`_MSG\s*=\s*(?:${literal})`, 'g')];
  for (const code of Object.values(APPLICATION)) {
    for (const re of patterns) for (const m of code.matchAll(re)) found.add((m[1] ?? m[2]).replace(/\\'/g, "'"));
  }
  return [...found];
}

afterEach(() => setLang('fr'));

describe('langue de l’interface', () => {
  it('est le français par défaut', () => {
    expect(lang()).toBe('fr');
    expect(tr('Vague', 'Wave')).toBe('Vague');
    expect(towerName(TOWERS.archer)).toBe(TOWERS.archer.name);
  });

  it('donne le texte anglais quand l’anglais est choisi', () => {
    setLang('en');

    expect(tr('Vague', 'Wave')).toBe('Wave');
    expect(towerName(TOWERS.archer)).toBe('Archer Tower');
    expect(creepPlural(CREEPS.wolf)).toBe('Grey Wolves');
    expect(builderName(builder('guild'))).toBe('Merchant Guild');
    expect(difficultyLabel('hard')).toBe('Legend');
  });

  it('retombe sur le français pour une donnée sans traduction', () => {
    setLang('en');
    const unknown = { ...TOWERS.archer, id: 'inconnue', name: 'Inconnue', desc: 'Sans traduction.' };

    expect(towerName(unknown)).toBe('Inconnue');
    expect(towerDesc(unknown)).toBe('Sans traduction.');
  });
});

describe('traduction anglaise des données du jeu', () => {
  it('nomme et décrit chaque tour', () => {
    for (const id of Object.keys(TOWERS)) {
      expect(TOWERS_EN[id]?.name, id).toBeTruthy();
      expect(TOWERS_EN[id]?.desc, id).toBeTruthy();
    }
  });

  it('nomme chaque créature au singulier et au pluriel', () => {
    for (const id of Object.keys(CREEPS)) {
      expect(CREEPS_EN[id]?.name, id).toBeTruthy();
      expect(CREEPS_EN[id]?.plural, id).toBeTruthy();
    }
  });

  it('décrit chaque bâtisseur', () => {
    for (const id of Object.keys(BUILDERS)) {
      expect(BUILDERS_EN[id]?.name, id).toBeTruthy();
      expect(BUILDERS_EN[id]?.style, id).toBeTruthy();
      expect(BUILDERS_EN[id]?.weakness, id).toBeTruthy();
    }
  });

  it('nomme chaque difficulté, type d’attaque et type d’armure', () => {
    for (const d of Object.keys(DIFFICULTY) as Difficulty[]) expect(DIFFICULTY_EN[d], d).toBeTruthy();
    for (const t of Object.keys(ATTACK_LABEL) as AttackType[]) expect(ATTACK_EN[t], t).toBeTruthy();
    for (const a of Object.keys(ARMOR_LABEL) as ArmorType[]) expect(ARMOR_EN[a], a).toBeTruthy();
  });

  it('traduit chaque refus de l’application et du serveur', () => {
    const list = refusals();
    expect(list.length).toBeGreaterThan(20);
    for (const r of list.filter((r) => !r.includes('${'))) expect(REASONS_EN[r], r).toBeTruthy();
  });

  it('traduit le refus faute d’or avec son montant, et laisse le français tel quel', () => {
    expect(reasonText("Il faut 20 pièces d'or.")).toBe("Il faut 20 pièces d'or.");
    setLang('en');
    expect(reasonText("Il faut 20 pièces d'or.")).toBe('You need 20 gold.');
    expect(reasonText('Impossible de bloquer le chemin.')).toBe('You cannot block the path.');
    expect(reasonText('Refus inconnu.')).toBe('Refus inconnu.');
  });
});

describe('textes de l’interface en anglais', () => {
  it('écrit les nombres et les libellés à l’anglaise', () => {
    setLang('en');

    expect(fmt1(1.5)).toBe('1.5');
    expect(nextWaveLabel(0, 34)).toBe('Wave 2 in 34 s');
    expect(modeLabel(Mode.Coop)).toBe('Co-op');
    expect(biomeLabel('snow')).toBe('Snow');
    expect(resignPrompt().confirm).toBe('Quit');
  });

  it('garde la virgule décimale en français', () => {
    expect(fmt1(1.5)).toBe('1,5');
    expect(nextWaveLabel(0, 34)).toBe('Vague 2 dans 34 s');
  });

  it('décrit une tour avec son nom, sa description et ses statistiques en anglais', () => {
    setLang('en');
    const html = towerInfo(TOWERS.archer, TOWERS.archer.cost);

    expect(html).toContain('Archer Tower · 10 gold');
    expect(html).toContain('Fast, piercing shots.');
    expect(html).toContain('Pierce');
    expect(html).toContain('Damage');
    expect(html).not.toContain('Dégâts');
  });

  it('présente la prochaine vague et les envois en anglais', () => {
    setLang('en');
    const wave = nextWaveInfo({ wave: 0, groups: [{ creep: CREEPS.wolf, count: 3, hp: 40, bounty: 2 }] }, builder('bastion'));
    const sends = sendPanel(100, 6);

    expect(wave).toContain('Next wave 1');
    expect(wave).toContain('Grey Wolves');
    expect(wave).toContain('2 gold');
    expect(sends).toContain('Income 6');
    expect(sends).toContain('10 ether');
    expect(sends).toContain('Marsh Rat');
  });
});
