export interface NormalizationOptions {
  caseSensitive: boolean;
  confusableMapping: boolean;
  stripDiacritics?: boolean;
  useNFKC?: boolean;
  lengthPreserving?: boolean;
  stripInvisible?: boolean;
}

const CONFUSABLE_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'i',
  '€': 'e',
  '£': 'l',
  '¢': 'c',
  '§': 's',
};

const COMBINING_MARKS_REGEX = /[\u0300-\u036f]/g;

export function normalizeForDetection(input: string, options: NormalizationOptions): string {
  const { caseSensitive, confusableMapping } = options;
  const stripDiacritics = options.stripDiacritics ?? true;
  const useNFKC = options.useNFKC ?? false;
  const lengthPreserving = options.lengthPreserving ?? true;
  const stripInvisible = options.stripInvisible ?? true;

  let text = caseSensitive ? input : input.toLowerCase();

  if (useNFKC && !lengthPreserving) {
    text = text.normalize('NFKC');
  }

  if (stripDiacritics || confusableMapping || (useNFKC && lengthPreserving) || stripInvisible) {
    let out = '';
    for (let i = 0; i < text.length; i++) {
      let ch = text[i];

      // Strip common invisible/zero-width characters
      if (stripInvisible) {
        // Zero-width space, joiner, non-joiner, BOM, soft hyphen
        if (
          ch === '\u200B' ||
          ch === '\u200C' ||
          ch === '\u200D' ||
          ch === '\uFEFF' ||
          ch === '\u00AD'
        ) {
          // Keep indices aligned when lengthPreserving by substituting a neutral separator
          if (lengthPreserving) {
            ch = ' ';
          } else {
            continue;
          }
        }
      }

      // Per-character compatibility and diacritics handling to keep length stable
      if (stripDiacritics) {
        const decomposed = ch.normalize('NFKD');
        // Remove combining marks; if multiple base chars appear (e.g., ﬁ -> f i),
        // keep only the first when lengthPreserving is true
        const base = decomposed.replace(COMBINING_MARKS_REGEX, '');
        if (lengthPreserving) {
          ch = base.length > 0 ? base[0] : ch;
        } else {
          ch = base;
        }
      }

      if (confusableMapping && ch.length === 1) {
        ch = CONFUSABLE_MAP[ch] ?? ch;
      }

      out += ch;
    }
    text = out;
  }

  return text;
}

export function normalizeWord(input: string, options: NormalizationOptions): string {
  return normalizeForDetection(input, options);
}
