export interface TrieMatch {
  index: number;
  length: number;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  isTerminal: boolean;
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

export class Trie {
  private readonly root: TrieNode = { children: new Map(), isTerminal: false };

  insert(word: string): void {
    if (!word) return;
    let node = this.root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) {
        next = { children: new Map(), isTerminal: false };
        node.children.set(ch, next);
      }
      node = next;
    }
    node.isTerminal = true;
  }

  insertAll(words: Iterable<string>): void {
    for (const w of words) this.insert(w);
  }

  findAllMatches(
    text: string,
    wholeWordsOnly: boolean,
    separatorsToIgnore?: Set<string>,
  ): TrieMatch[] {
    const matches: TrieMatch[] = [];
    const length = text.length;
    const ignoreSeparators = separatorsToIgnore && separatorsToIgnore.size > 0;

    for (let startIndex = 0; startIndex < length; startIndex++) {
      let node = this.root;

      const startChar = text[startIndex];
      if (ignoreSeparators && separatorsToIgnore!.has(startChar)) continue;

      if (wholeWordsOnly && startIndex > 0 && WORD_CHAR.test(text[startIndex - 1])) {
        continue;
      }

      let lastTerminalEndIndex = -1;
      let j = startIndex;
      while (j < length) {
        const ch = text[j];
        if (ignoreSeparators && separatorsToIgnore!.has(ch)) {
          j += 1;
          continue;
        }
        const next = node.children.get(ch);
        if (!next) break;
        node = next;
        if (node.isTerminal) {
          // Boundaries based on last real character matched
          if (wholeWordsOnly) {
            const endIndex = j + 1;
            if (endIndex < length && WORD_CHAR.test(text[endIndex])) {
              // Not a word boundary; continue search
            } else {
              lastTerminalEndIndex = j;
            }
          } else {
            lastTerminalEndIndex = j;
          }
        }
        j += 1;
      }

      if (lastTerminalEndIndex !== -1) {
        // Include separators within span from startIndex to lastTerminalEndIndex
        const spanLength = lastTerminalEndIndex - startIndex + 1;
        matches.push({ index: startIndex, length: spanLength });
      }
    }

    return matches;
  }
}
