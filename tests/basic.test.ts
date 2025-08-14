import { describe, expect, it } from 'vitest';

import { ProfanityBuster } from '../src';

describe('ProfanityBuster - basic', () => {
  it('detects direct profanity', () => {
    const buster = new ProfanityBuster();
    const result = buster.detect('you are a bitch');
    expect(result.hasProfanity).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it('sanitizes with default masking', () => {
    const buster = new ProfanityBuster();
    const out = buster.sanitize('shit happens');
    expect(out).toBe('s*** happens');
  });

  it('detects simple inflections (e.g., fuck -> fucking)', () => {
    const buster = new ProfanityBuster();
    const result = buster.detect('this is fucking rude');
    expect(result.hasProfanity).toBe(true);
  });

  it('strips zero-width/invisible characters to defeat obfuscation', () => {
    const buster = new ProfanityBuster();
    const text = 's\u200Bh\u2001i\u200Dt';
    const result = buster.detect(text);
    expect(result.hasProfanity).toBe(true);
  });

  it('detects phrase-level profanities with stopwords between tokens', () => {
    const buster = new ProfanityBuster();
    buster.addPhrase('son of a bitch');
    const result = buster.detect('you are a son of the a   bitch indeed');
    expect(result.hasProfanity).toBe(true);
  });

  it('respects case-insensitive by default', () => {
    const buster = new ProfanityBuster();
    const result = buster.detect('ShIt happens');
    expect(result.hasProfanity).toBe(true);
  });

  it('maps simple confusables (leet speak) when enabled', () => {
    const buster = new ProfanityBuster();
    const result = buster.detect('sh1t happens');
    expect(result.hasProfanity).toBe(true);
  });

  it('skips common separators between letters when configured', () => {
    const buster = new ProfanityBuster({
      detection: {
        ignoreSeparators: [' ', '.', '-', '_', '*'],
        levenshteinDistance: 0,
        caseSensitive: false,
        wholeWordsOnly: false,
        customWords: [],
        confusableMapping: true,
      },
    });
    const result = buster.detect('s*h-i t happens');
    expect(result.hasProfanity).toBe(true);
  });

  it('supports management APIs to add/remove words and set languages', () => {
    const buster = new ProfanityBuster({
      languages: ['en'],
      detection: {
        customWords: [],
        levenshteinDistance: 0,
        caseSensitive: false,
        wholeWordsOnly: true,
      },
    });
    buster.addWord('foobaz');
    expect(buster.detect('well foobaz ok').hasProfanity).toBe(true);
    buster.removeWord('foobaz');
    expect(buster.detect('well foobaz ok').hasProfanity).toBe(false);
    buster.setLanguages(['en']);
    expect(buster.detect('shit happens').hasProfanity).toBe(true);
  });

  it('supports dynamic language loading (es, fr)', async () => {
    const buster = new ProfanityBuster({ languages: ['en'] });
    await buster.loadLanguages(['es']);
    expect(buster.detect('esto es una mierda').hasProfanity).toBe(true);
    await buster.loadLanguages(['fr']);
    expect(buster.detect("c'est de la merde").hasProfanity).toBe(true);
  });

  it('supports dynamic language loading (de, it, pt)', async () => {
    const buster = new ProfanityBuster({ languages: ['en'] });
    await buster.loadLanguages(['de']);
    expect(buster.detect('das ist scheisse').hasProfanity).toBe(true);
    await buster.loadLanguages(['it']);
    expect(buster.detect('che stronzo').hasProfanity).toBe(true);
    await buster.loadLanguages(['pt']);
    expect(buster.detect('isso é merda').hasProfanity).toBe(true);
  });

  it('autoDetect selects likely language by script', async () => {
    const buster = new ProfanityBuster({
      languages: { enabled: ['en'], autoDetect: true, fallback: 'en' },
      detection: {
        customWords: [],
        levenshteinDistance: 0,
        caseSensitive: false,
        wholeWordsOnly: false,
      },
    });
    await buster.loadLanguages(['zh']);
    const zhText = '你吃屎';
    expect(buster.detect(zhText).hasProfanity).toBe(true);
  });

  it('supports custom words', () => {
    const buster = new ProfanityBuster({
      detection: {
        customWords: ['foobar'],
        levenshteinDistance: 0,
        caseSensitive: false,
        wholeWordsOnly: true,
      },
    });
    const result = buster.detect('well foobar indeed');
    expect(result.hasProfanity).toBe(true);
  });
});
