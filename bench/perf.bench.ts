import { bench, describe } from 'vitest';

import { ProfanityBuster } from '../src';

function generateText(repetitions: number): string {
  const base =
    'This is a long user-generated text. Sometimes people use sh1t or s*h-i t with separators. ' +
    'Occasionally they write f**k or foobar in between sentences. ';
  return base.repeat(repetitions);
}

describe('Performance benchmarks', () => {
  const buster = new ProfanityBuster({
    detection: {
      levenshteinDistance: 0,
      confusableMapping: true,
      ignoreSeparators: [' ', '.', '-', '_', '*'],
      caseSensitive: false,
      wholeWordsOnly: false,
      customWords: [],
    },
  });

  const small = generateText(10); // ~1-2KB
  const medium = generateText(100); // ~10-20KB
  const large = generateText(500); // ~50-100KB

  bench('detect small', () => {
    buster.detect(small);
  });

  bench('detect medium', () => {
    buster.detect(medium);
  });

  bench('detect large', () => {
    buster.detect(large);
  });
});
