import type { ProfanityBusterConfig } from './index';

export const lowLatencyPreset: Partial<ProfanityBusterConfig> = {
  detection: {
    levenshteinDistance: 0,
    caseSensitive: false,
    wholeWordsOnly: true,
    customWords: [],
    confusableMapping: true,
    ignoreSeparators: [' ', '.', '-', '_', '*'],
    stripDiacritics: true,
    useNFKC: false,
    enableInflections: false,
    algorithm: 'aho',
  },
};

export const highRecallPreset: Partial<ProfanityBusterConfig> = {
  detection: {
    levenshteinDistance: 1,
    caseSensitive: false,
    wholeWordsOnly: false,
    customWords: [],
    confusableMapping: true,
    ignoreSeparators: [' ', '.', '-', '_', '*'],
    stripDiacritics: true,
    useNFKC: false,
    enableInflections: true,
    algorithm: 'aho',
  },
};
