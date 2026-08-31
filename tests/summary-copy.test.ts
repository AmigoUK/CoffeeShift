import { describe, expect, it } from 'vitest';
import { summarySentence } from '../src/ui/copy';

/**
 * Phrasing lives in the UI layer, so it is tested there. The domain test asserts which
 * faults were found; this one asserts how they are read out.
 */
describe('summarySentence', () => {
  it('returns the opener alone when nothing went wrong', () => {
    expect(summarySentence({ opener: 'perfect', clauses: [] }, 'Latte')).toBe('Perfect!');
  });

  it('joins two faults with "and", capitalises the first and appends a hint', () => {
    expect(summarySentence({ opener: 'correctRecipe', clauses: ['MILK_TOO_HOT', 'FOAM_TOO_THICK'] }, 'Latte')).toBe(
      'Correct recipe. The milk was overheated and the foam was too thick for a latte. Practise milk temperature control.',
    );
  });

  it('uses an Oxford comma from three faults up', () => {
    const sentence = summarySentence(
      { opener: 'correctRecipe', clauses: ['WRONG_MILK', 'DOSE_LOW', 'WRONG_SIZE'] },
      'Latte',
    );
    expect(sentence).toContain(', and the size was wrong.');
  });

  it('substitutes the drink name into clauses that need it', () => {
    expect(summarySentence({ opener: 'correctRecipe', clauses: ['FOAM_TOO_THIN'] }, 'Flat White')).toContain(
      'too thin for a flat white',
    );
  });

  it('opens differently when the wrong drink was made', () => {
    expect(summarySentence({ opener: 'wrongDrink', clauses: [] }, 'Latte')).toBe('Not quite the drink ordered.');
  });
});
