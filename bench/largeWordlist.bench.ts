import { bench, describe } from 'vitest';

import { ProfanityBuster, type ProfanityBusterUserConfig } from '../src';

function generateText(repetitions: number): string {
  const base =
    'This is a long user-generated text. Sometimes people use sh1t or s*h-i t with separators. ' +
    'Occasionally they write f**k or foobar in between sentences. ';
  return base.repeat(repetitions);
}

function synthesizeWordlist(size: number): string[] {
  const words: string[] = [];
  for (let i = 0; i < size; i++) {
    // Deterministic pseudo-words; ensure varied lengths 4-10
    const len = 4 + (i % 7);
    let s = '';
    let x = i * 2654435761; // Knuth multiplicative hash
    for (let j = 0; j < len; j++) {
      x = (x ^ (x >>> 13)) * 0x5bd1e995;
      const ch = 'a'.charCodeAt(0) + (x % 26);
      s += String.fromCharCode(ch);
    }
    words.push(s);
  }
  // Ensure at least one known profanity exists to exercise positive path
  words[0] = 'shit';
  return words;
}

function makeConfig(algorithm: 'aho' | 'trie', customWords: string[]): ProfanityBusterUserConfig {
  return {
    languages: { enabled: ['en'], autoDetect: false, fallback: 'en' },
    detection: {
      algorithm,
      levenshteinDistance: 0,
      confusableMapping: true,
      ignoreSeparators: [' ', '.', '-', '_', '*'],
      caseSensitive: false,
      wholeWordsOnly: false,
      customWords,
      enableInflections: false,
    },
  };
}

describe('Large wordlist scaling (synthetic)', () => {
  const mediumText = generateText(100);

  const dict10k = synthesizeWordlist(10_000);
  const dict100k = synthesizeWordlist(100_000);

  const aho10k = new ProfanityBuster(makeConfig('aho', dict10k));
  const trie10k = new ProfanityBuster(makeConfig('trie', dict10k));
  const aho100k = new ProfanityBuster(makeConfig('aho', dict100k));
  const trie100k = new ProfanityBuster(makeConfig('trie', dict100k));

  bench('aho dict10k medium', () => {
    aho10k.detect(mediumText);
  });

  bench('trie dict10k medium', () => {
    trie10k.detect(mediumText);
  });

  bench('aho dict100k medium', () => {
    aho100k.detect(mediumText);
  });

  bench('trie dict100k medium', () => {
    trie100k.detect(mediumText);
  });
});
