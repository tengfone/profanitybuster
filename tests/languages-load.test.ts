import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from 'vitest';

import { ProfanityBuster } from '../src';

function listLanguageCodes(): string[] {
  const dir = path.resolve(__dirname, '../src/languages');
  return (
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => path.basename(f, '.ts'))
      // keep simple codes (avoid accidental non-packs)
      .filter((code) => /^[a-z]{2,3}$/i.test(code))
  );
}

describe('Language packs load and detect', () => {
  const codes = listLanguageCodes();

  it('loads each language and detects a sample word', async () => {
    const buster = new ProfanityBuster({
      languages: { enabled: ['en'], autoDetect: false, fallback: 'en' },
      detection: {
        levenshteinDistance: 0,
        caseSensitive: false,
        wholeWordsOnly: false,
        customWords: [],
        confusableMapping: true,
      },
    });

    for (const code of codes) {
      // Read the language module to get an example word via static map
      const mod = await import('../src/languages/index');
      const words = (mod as { languageWordMap: Record<string, string[]> }).languageWordMap[code];
      if (!Array.isArray(words) || words.length === 0) continue;

      await buster.loadLanguages([code]);
      const sample = words[0];
      const result = buster.detect(sample);
      expect(result.hasProfanity).toBe(true);
    }
  });
});
