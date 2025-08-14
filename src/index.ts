import { AhoCorasick } from './core/aho';
import { inferLikelyLanguageCodes } from './core/langAutoDetect';
import {
  normalizeForDetection,
  normalizeWord as normalizeWordWithOptions,
} from './core/normalization';
import { PhraseTrie } from './core/phraseTrie';
import { Trie } from './core/trie';
import { languageWordMap, allLanguageCodes } from './languages';
import { EN_WORDS } from './languages/en';

export interface MaskingConfig {
  enabled: boolean;
  pattern: string;
  preserveLength: boolean;
  preserveFirst: boolean;
  preserveLast: boolean;
}

export interface DetectionSettings {
  levenshteinDistance: number;
  caseSensitive: boolean;
  wholeWordsOnly: boolean;
  customWords: string[];
  confusableMapping?: boolean;
  ignoreSeparators?: string[]; // characters to skip during matching, e.g. [' ', '.', '-', '_', '*']
  stripDiacritics?: boolean;
  useNFKC?: boolean;
  enableInflections?: boolean;
  inflectionSuffixes?: string[];
  allowlist?: string[];
  tokenBoundedFuzzy?: boolean;
  phraseStopwords?: string[]; // stopwords allowed between phrase tokens
  phraseMaxSkips?: number; // how many stopwords/separators allowed between tokens
  algorithm?: 'trie' | 'aho'; // matching algorithm for exact phase
}

export interface LanguageConfig {
  enabled: string[];
  autoDetect: boolean;
  fallback: string;
}

export interface ProfanityBusterConfig {
  masking: MaskingConfig;
  detection: DetectionSettings;
  languages: LanguageConfig;
}

export type ProfanityBusterUserConfig = Partial<Omit<ProfanityBusterConfig, 'languages'>> & {
  languages?: LanguageConfig | string[];
};

export interface DetectionResult {
  hasProfanity: boolean;
  matches: Array<{ word: string; index: number; length: number; language: string }>;
}

const DEFAULT_CONFIG: ProfanityBusterConfig = {
  masking: {
    enabled: true,
    pattern: '*',
    preserveLength: true,
    preserveFirst: true,
    preserveLast: false,
  },
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
    inflectionSuffixes: ['s', 'es', 'ed', 'ing', 'er', 'ers'],
    allowlist: [],
    tokenBoundedFuzzy: true,
    phraseStopwords: ['of', 'the', 'a', 'an', 'and', 'to'],
    phraseMaxSkips: 2,
    algorithm: 'trie',
  },
  languages: {
    enabled: ['en'],
    autoDetect: false,
    fallback: 'en',
  },
};

// Freeze default config to avoid accidental mutations
Object.freeze(DEFAULT_CONFIG);
Object.freeze(DEFAULT_CONFIG.masking);
Object.freeze(DEFAULT_CONFIG.detection);
Object.freeze(DEFAULT_CONFIG.languages);

export class ProfanityBuster {
  private readonly config: ProfanityBusterConfig;
  private readonly languageWordlists: Map<string, Set<string>> = new Map();
  private readonly languageTries: Map<string, Trie> = new Map();
  private readonly languageAutomata: Map<string, AhoCorasick> = new Map();
  private readonly phraseTrie: PhraseTrie = new PhraseTrie();
  private readonly phraseList: Set<string[]> = new Set();

  constructor(userConfig?: ProfanityBusterUserConfig) {
    this.config = ProfanityBuster.mergeConfig(DEFAULT_CONFIG, userConfig);
    this.loadLanguagePacks(this.config.languages.enabled);
    this.addCustomWords(this.config.detection.customWords);
  }

  static mergeConfig(
    base: ProfanityBusterConfig,
    override?: ProfanityBusterUserConfig,
  ): ProfanityBusterConfig {
    // Always clone base to avoid returning shared mutable references
    const baseClone: ProfanityBusterConfig = {
      masking: { ...base.masking },
      detection: { ...base.detection },
      languages: { ...base.languages, enabled: [...base.languages.enabled] },
    };
    if (!override) return baseClone;
    const languages: LanguageConfig = Array.isArray(override.languages)
      ? {
          ...base.languages,
          enabled: [...override.languages],
        }
      : {
          ...base.languages,
          ...(override.languages ?? {}),
          enabled: (override.languages as LanguageConfig | undefined)?.enabled
            ? [...(override.languages as LanguageConfig).enabled]
            : [...base.languages.enabled],
        };

    return {
      masking: {
        ...baseClone.masking,
        ...(override.masking ?? {}),
      },
      detection: {
        ...baseClone.detection,
        ...(override.detection ?? {}),
        customWords: override.detection?.customWords
          ? [...override.detection.customWords]
          : [...baseClone.detection.customWords],
      },
      languages,
    };
  }

  detect(text: string): DetectionResult {
    const textNormalized = normalizeForDetection(text, {
      caseSensitive: this.config.detection.caseSensitive,
      confusableMapping: this.config.detection.confusableMapping ?? true,
      stripDiacritics: this.config.detection.stripDiacritics ?? true,
      useNFKC: this.config.detection.useNFKC ?? false,
      lengthPreserving: true,
      stripInvisible: true,
    });

    const matches: DetectionResult['matches'] = [];
    const candidateCodes = this.config.languages.autoDetect
      ? this.selectAutoDetectLanguages(textNormalized)
      : [...this.config.languages.enabled];
    const wordlists = this.collectWordlistsForCodes(candidateCodes);

    for (const [languageCode] of wordlists) {
      const separators = new Set(this.config.detection.ignoreSeparators ?? []);
      const whole = this.config.detection.wholeWordsOnly;
      const algo = this.config.detection.algorithm ?? 'trie';
      if (algo === 'aho') {
        const automaton = this.languageAutomata.get(languageCode);
        if (!automaton) continue;
        const acMatches = automaton.findAllMatches(textNormalized, whole, separators);
        for (const m of acMatches) {
          const word = textNormalized.slice(m.index, m.index + m.length);
          matches.push({ word, index: m.index, length: m.length, language: languageCode });
        }
      } else {
        const trie = this.languageTries.get(languageCode);
        if (!trie) continue;
        const trieMatches = trie.findAllMatches(textNormalized, whole, separators);
        for (const m of trieMatches) {
          const word = textNormalized.slice(m.index, m.index + m.length);
          matches.push({ word, index: m.index, length: m.length, language: languageCode });
        }
      }
      if (matches.length > 0) break; // fast exit on first match
    }

    // Backup: inflection-aware regex scan to catch edge cases not covered by trie
    if (this.config.detection.enableInflections ?? true) {
      const covered = new Set(matches.map((m) => `${m.index}:${m.length}`));
      for (const [languageCode, words] of wordlists) {
        for (const word of words) {
          const occ = this.findWordOccurrencesWithInflections(
            textNormalized,
            word,
            this.config.detection.inflectionSuffixes ?? [],
            this.config.detection.wholeWordsOnly,
          );
          for (const index of occ) {
            const key = `${index}:${word.length}`;
            if (!covered.has(key)) {
              matches.push({ word, index, length: word.length, language: languageCode });
              covered.add(key);
            }
          }
        }
      }
    }

    // Phrase-level matches (tokenized)
    if (matches.length === 0 && this.phraseList.size > 0) {
      const tokens = this.tokenizeWithOffsets(textNormalized);
      const tokenValues = tokens.map((t) => t.value);
      const spans = this.phraseTrie.findAllMatchesForTokens(
        tokenValues,
        new Set(this.config.detection.phraseStopwords ?? []),
        this.config.detection.phraseMaxSkips ?? 0,
      );
      for (const span of spans) {
        const start = tokens[span.startTokenIndex]?.start ?? 0;
        const endExclusive = tokens[span.endTokenIndex]?.endExclusive ?? start;
        const index = start;
        const length = Math.max(0, endExclusive - start);
        const phrase = tokenValues.slice(span.startTokenIndex, span.endTokenIndex + 1).join(' ');
        matches.push({ word: phrase, index, length, language: this.config.languages.fallback });
        break;
      }
    }

    // Fallback to fuzzy search if allowed and no exact matches
    if (matches.length === 0 && this.config.detection.levenshteinDistance > 0) {
      for (const [languageCode, words] of wordlists) {
        for (const word of words) {
          const index = this.findApproximateOccurrence(
            textNormalized,
            word,
            this.scaledMaxDistance(word),
            this.config.detection.wholeWordsOnly,
          );
          if (index !== -1) {
            matches.push({ word, index, length: word.length, language: languageCode });
            break;
          }
        }
        if (matches.length > 0) break;
      }
    }

    return { hasProfanity: matches.length > 0, matches };
  }

  sanitize(text: string): string {
    const detection = this.detect(text);
    if (!detection.hasProfanity || !this.config.masking.enabled) return text;

    const output = text.split('');
    for (const match of detection.matches) {
      const original = output.slice(match.index, match.index + match.length).join('');
      const masked = this.maskWord(original);
      output.splice(match.index, match.length, ...masked.split(''));
    }
    return output.join('');
  }

  private maskWord(word: string): string {
    const { pattern, preserveLength, preserveFirst, preserveLast } = this.config.masking;
    if (!preserveLength) return pattern.repeat(Math.max(1, word.length));

    const chars = word.split('');
    return chars
      .map((char, index) => {
        if ((preserveFirst && index === 0) || (preserveLast && index === chars.length - 1)) {
          return char;
        }
        return pattern;
      })
      .join('');
  }

  private collectActiveWordlists(): Map<string, Set<string>> {
    const active = new Map<string, Set<string>>();
    for (const code of this.config.languages.enabled) {
      const list = this.languageWordlists.get(code);
      if (list && list.size > 0) active.set(code, list);
    }
    return active;
  }

  private collectWordlistsForCodes(codes: string[]): Map<string, Set<string>> {
    const active = new Map<string, Set<string>>();
    for (const code of codes) {
      const list = this.languageWordlists.get(code);
      if (list && list.size > 0) active.set(code, list);
    }
    return active;
  }

  private selectAutoDetectLanguages(text: string): string[] {
    // Heuristic 1: script-based detection
    const likely = inferLikelyLanguageCodes(text);
    const loaded = Array.from(this.languageWordlists.keys()).filter(
      (c) => (this.languageWordlists.get(c)?.size ?? 0) > 0,
    );

    const candidates = likely.filter((c) => loaded.includes(c));
    if (candidates.length > 0) return candidates;

    // Fallback A: scan all loaded languages (best-effort) if any
    if (loaded.length > 0) return loaded;

    // Fallback B: if autoDetect is enabled and nothing is loaded,
    // load and scan all known languages (slow, but explicit trade-off)
    if (this.config.languages.autoDetect) {
      this.ensureLoadedForCodes(allLanguageCodes);
      return [...allLanguageCodes];
    }

    // Last resort: enabled list
    return [...this.config.languages.enabled];
  }

  // moved to core/langAutoDetect.ts

  private ensureLoadedForCodes(codes: string[]): void {
    for (const code of codes) {
      const existingSet = this.languageWordlists.get(code);
      if (
        existingSet &&
        existingSet.size > 0 &&
        (this.languageTries.has(code) || this.languageAutomata.has(code))
      ) {
        continue;
      }
      let words: string[] | undefined;
      if (code === 'en') {
        words = EN_WORDS;
      } else {
        words = languageWordMap[code];
      }
      if (!Array.isArray(words) || words.length === 0) {
        continue;
      }
      const normalized = new Set(words.map((w) => this.normalizeWord(w)));
      this.languageWordlists.set(code, normalized);
      this.rebuildMatcherForLanguage(code);
    }
  }

  private loadLanguagePacks(codes: string[]): void {
    for (const code of codes) {
      if (code === 'en') {
        this.languageWordlists.set('en', new Set(EN_WORDS.map((w) => this.normalizeWord(w))));
      } else {
        this.languageWordlists.set(code, new Set());
      }
      this.rebuildMatcherForLanguage(code);
    }
  }

  async loadLanguages(codes: string[]): Promise<void> {
    for (const code of codes) {
      // If already loaded with a populated wordlist, just ensure it's enabled
      const existingSet = this.languageWordlists.get(code);
      if (
        existingSet &&
        existingSet.size > 0 &&
        (this.languageTries.has(code) || this.languageAutomata.has(code))
      ) {
        if (!this.config.languages.enabled.includes(code)) {
          this.config.languages.enabled = [...this.config.languages.enabled, code];
        }
        continue;
      }
      let words: string[] | undefined;
      if (code === 'en') {
        words = EN_WORDS;
      } else {
        words = languageWordMap[code];
        if (!Array.isArray(words)) {
          // Unknown pack, initialize empty to avoid repeated attempts
          this.languageWordlists.set(code, new Set());
          this.rebuildMatcherForLanguage(code);
          continue;
        }
      }
      const normalized = new Set((words ?? []).map((w) => this.normalizeWord(w)));
      this.languageWordlists.set(code, normalized);
      this.rebuildMatcherForLanguage(code);
      if (!this.config.languages.enabled.includes(code)) {
        this.config.languages.enabled = [...this.config.languages.enabled, code];
      }
    }
  }

  private rebuildMatcherForLanguage(code: string): void {
    const words = this.languageWordlists.get(code);
    const algorithm = this.config.detection.algorithm ?? 'trie';
    if (algorithm === 'aho') {
      // Clear trie for this language to save memory
      this.languageTries.delete(code);
      const ac = new AhoCorasick();
      if (words) {
        for (const w of words) {
          const variants = this.expandWordVariants(w);
          ac.insertAll(variants);
        }
      }
      ac.build();
      this.languageAutomata.set(code, ac);
    } else {
      // Clear automaton for this language to save memory
      this.languageAutomata.delete(code);
      const trie = new Trie();
      if (words) {
        for (const w of words) {
          const variants = this.expandWordVariants(w);
          trie.insertAll(variants);
        }
      }
      this.languageTries.set(code, trie);
    }
  }

  private rebuildPhraseTrie(): void {
    const phrases = Array.from(this.phraseList.values());
    this.phraseTrie.insertAll(phrases);
  }

  // Phase 3: Management APIs
  addWord(word: string, language?: string): void {
    const lang = language ?? this.config.languages.fallback;
    const set = this.languageWordlists.get(lang) ?? new Set<string>();
    set.add(this.normalizeWord(word));
    this.languageWordlists.set(lang, set);
    this.rebuildMatcherForLanguage(lang);
  }

  addPhrase(phrase: string): void {
    const tokens = this.tokenizeWithOffsets(this.normalizeWord(phrase)).map((t) => t.value);
    if (tokens.length === 0) return;
    this.phraseList.add(tokens);
    this.rebuildPhraseTrie();
  }

  removePhrase(phrase: string): void {
    const tokens = this.tokenizeWithOffsets(this.normalizeWord(phrase)).map((t) => t.value);
    if (tokens.length === 0) return;
    for (const existing of Array.from(this.phraseList.values())) {
      if (existing.length === tokens.length && existing.every((t, i) => t === tokens[i])) {
        this.phraseList.delete(existing);
        break;
      }
    }
    this.rebuildPhraseTrie();
  }

  removeWord(word: string, language?: string): void {
    const lang = language ?? this.config.languages.fallback;
    const set = this.languageWordlists.get(lang);
    if (!set) return;
    set.delete(this.normalizeWord(word));
    this.languageWordlists.set(lang, set);
    this.rebuildMatcherForLanguage(lang);
  }

  setLanguages(enabled: string[], fallback?: string): void {
    this.config.languages.enabled = [...enabled];
    if (fallback) this.config.languages.fallback = fallback;
    this.loadLanguagePacks(this.config.languages.enabled);
  }

  setAlgorithm(algorithm: 'trie' | 'aho'): void {
    this.config.detection.algorithm = algorithm;
    // Rebuild all active languages with the new matcher
    for (const code of this.config.languages.enabled) {
      this.rebuildMatcherForLanguage(code);
    }
  }

  private addCustomWords(words: string[]): void {
    if (!words || words.length === 0) return;
    const targetCode = this.config.languages.fallback;
    const target = this.languageWordlists.get(targetCode) ?? new Set<string>();
    for (const word of words) {
      for (const variant of this.expandWordVariants(word)) {
        target.add(variant);
      }
    }
    this.languageWordlists.set(targetCode, target);
    this.rebuildMatcherForLanguage(targetCode);
  }

  private normalizeWord(word: string): string {
    return normalizeWordWithOptions(word, {
      caseSensitive: this.config.detection.caseSensitive,
      confusableMapping: this.config.detection.confusableMapping ?? true,
      stripDiacritics: this.config.detection.stripDiacritics ?? true,
      useNFKC: this.config.detection.useNFKC ?? false,
      lengthPreserving: true,
      stripInvisible: true,
    });
  }

  private expandWordVariants(word: string): string[] {
    const normalized = this.normalizeWord(word);
    const variants: Set<string> = new Set([normalized]);
    if (this.config.detection.enableInflections) {
      const suffixes = this.config.detection.inflectionSuffixes ?? [];
      for (const suffix of suffixes) {
        variants.add(`${normalized}${suffix}`);
      }
    }
    return Array.from(variants);
  }

  private tokenizeWithOffsets(
    text: string,
  ): Array<{ value: string; start: number; endExclusive: number }> {
    const tokens: Array<{ value: string; start: number; endExclusive: number }> = [];
    const re = /[\p{L}\p{N}_]+/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const value = m[0] ?? '';
      const start = m.index;
      const endExclusive = start + value.length;
      if (value.length > 0) tokens.push({ value, start, endExclusive });
    }
    return tokens;
  }

  private findWordOccurrences(text: string, word: string, wholeWordsOnly: boolean): number[] {
    const indices: number[] = [];
    if (!word) return indices;
    const WORD_CHAR = /[\p{L}\p{N}_]/u;
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedWord, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = start + word.length;
      if (wholeWordsOnly) {
        const leftOk = start === 0 || !WORD_CHAR.test(text[start - 1]);
        const rightOk = end >= text.length || !WORD_CHAR.test(text[end]);
        if (!leftOk || !rightOk) continue;
      }
      indices.push(start);
    }
    return indices;
  }

  private findWordOccurrencesWithInflections(
    text: string,
    base: string,
    suffixes: string[],
    wholeWordsOnly: boolean,
  ): number[] {
    const indices: number[] = [];
    const WORD_CHAR = /[\p{L}\p{N}_]/u;
    const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedSuffixes = suffixes.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const group = escapedSuffixes.length > 0 ? `(?:${escapedSuffixes.join('|')})?` : '';
    const regex = new RegExp(`${escapedBase}${group}`, 'g');
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const start = m.index;
      const end = start + (m[0]?.length ?? base.length);
      if (wholeWordsOnly) {
        const leftOk = start === 0 || !WORD_CHAR.test(text[start - 1]);
        const rightOk = end >= text.length || !WORD_CHAR.test(text[end]);
        if (!leftOk || !rightOk) continue;
      }
      indices.push(start);
    }
    return indices;
  }

  private findApproximateOccurrence(
    text: string,
    word: string,
    maxDistance: number,
    wholeWordsOnly: boolean,
  ): number {
    const length = text.length;
    const tokenBounded = this.config.detection.tokenBoundedFuzzy ?? true;
    const WORD_CHAR = /[\p{L}\p{N}_]/u;
    const windowSize = word.length + maxDistance;

    for (let i = 0; i <= length - word.length; i++) {
      if (tokenBounded && i > 0 && WORD_CHAR.test(text[i - 1])) continue;
      const window = text.slice(i, Math.min(length, i + windowSize));
      const { index, distance } = this.findMinDistanceInWindow(window, word);
      if (distance <= maxDistance) {
        const start = i + index;
        if (wholeWordsOnly) {
          const leftOk = start === 0 || !WORD_CHAR.test(text[start - 1]);
          const rightOk =
            start + word.length >= length || !WORD_CHAR.test(text[start + word.length]);
          if (!leftOk || !rightOk) continue;
        }
        return start;
      }
    }
    return -1;
  }

  private findMinDistanceInWindow(
    window: string,
    target: string,
  ): { index: number; distance: number } {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= window.length - target.length; i++) {
      const candidate = window.slice(i, i + target.length);
      const d = this.levenshtein(candidate, target);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = i;
        if (bestDistance === 0) break;
      }
    }
    return { index: bestIndex === -1 ? 0 : bestIndex, distance: bestDistance };
  }

  private scaledMaxDistance(word: string): number {
    const base = this.config.detection.levenshteinDistance;
    const scaled = Math.max(0, Math.min(base, Math.floor(word.length / 5)));
    return scaled;
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + cost, // substitution
        );
      }
    }
    return dp[m][n];
  }
}

export default ProfanityBuster;
export { lowLatencyPreset, highRecallPreset } from './presets';
export * as integrations from './integrations';
