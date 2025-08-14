import { bench, describe } from 'vitest';

import { ProfanityBuster, type ProfanityBusterUserConfig } from '../src';

function generateText(repetitions: number): string {
  const base =
    'This is a long user-generated text. Sometimes people use sh1t or s*h-i t with separators. ' +
    'Occasionally they write f**k or foobar in between sentences. ';
  return base.repeat(repetitions);
}

function makeConfig(algorithm: 'aho' | 'trie'): ProfanityBusterUserConfig {
  return {
    languages: { enabled: ['en'], autoDetect: false, fallback: 'en' },
    detection: {
      algorithm,
      levenshteinDistance: 0,
      confusableMapping: true,
      ignoreSeparators: [' ', '.', '-', '_', '*'],
      caseSensitive: false,
      wholeWordsOnly: false,
      customWords: [],
      enableInflections: false,
    },
  };
}

describe('Algorithm comparison: Aho–Corasick vs Trie', () => {
  const small = generateText(10); // ~1-2KB
  const medium = generateText(100); // ~10-20KB
  const large = generateText(500); // ~50-100KB

  const busterAho = new ProfanityBuster(makeConfig('aho'));
  const busterTrie = new ProfanityBuster(makeConfig('trie'));

  bench('aho small', () => {
    busterAho.detect(small);
  });

  bench('trie small', () => {
    busterTrie.detect(small);
  });

  bench('aho medium', () => {
    busterAho.detect(medium);
  });

  bench('trie medium', () => {
    busterTrie.detect(medium);
  });

  bench('aho large', () => {
    busterAho.detect(large);
  });

  bench('trie large', () => {
    busterTrie.detect(large);
  });
});
