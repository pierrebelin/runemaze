import { describe, expect, it } from 'vitest';
import { withRecord,type RecordBook } from '../../../src/domain/rules/records';

describe('records', () => {
  it('[RM-06] garde le meilleur résultat séparément pour chaque carte et difficulté', () => {
    const book: RecordBook = {};
    const b1 = withRecord(book, 'foret', 'normal', 5);
    const b2 = withRecord(b1, 'foret', 'hard', 3);
    const b3 = withRecord(b2, 'desert', 'normal', 7);

    expect(b3).toEqual({
      foret: { normal: 5, hard: 3 },
      desert: { normal: 7 },
    });
  });

  it('[RM-06] ne remplace pas un record par un résultat moins bon', () => {
    const book: RecordBook = { foret: { normal: 8 } };

    const r = withRecord(book, 'foret', 'normal', 4);

    expect(r).toEqual({ foret: { normal: 8 } });
    expect(book).toEqual({ foret: { normal: 8 } });
  });

});
