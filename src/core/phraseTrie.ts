export interface PhraseMatchTokenSpan {
  startTokenIndex: number;
  endTokenIndex: number; // inclusive
}

interface PhraseTrieNode {
  children: Map<string, PhraseTrieNode>;
  isTerminal: boolean;
}

export class PhraseTrie {
  private readonly root: PhraseTrieNode = { children: new Map(), isTerminal: false };

  insert(tokens: string[]): void {
    if (tokens.length === 0) return;
    let node = this.root;
    for (const token of tokens) {
      let next = node.children.get(token);
      if (!next) {
        next = { children: new Map(), isTerminal: false };
        node.children.set(token, next);
      }
      node = next;
    }
    node.isTerminal = true;
  }

  insertAll(phrases: string[][]): void {
    for (const p of phrases) this.insert(p);
  }

  findAllMatchesForTokens(
    tokens: string[],
    stopwords?: Set<string>,
    maxSkipsBetweenTokens: number = 0,
  ): PhraseMatchTokenSpan[] {
    const results: PhraseMatchTokenSpan[] = [];
    const n = tokens.length;
    const hasStop = !!stopwords && stopwords.size > 0;

    for (let start = 0; start < n; start++) {
      let node = this.root;
      let skipsUsed = 0;
      let end = start - 1;
      for (let i = start; i < n; i++) {
        const t = tokens[i];
        const next = node.children.get(t);
        if (next) {
          node = next;
          end = i;
          if (node.isTerminal) {
            results.push({ startTokenIndex: start, endTokenIndex: end });
            break; // earliest terminal match from this start
          }
        } else if (hasStop && stopwords!.has(t) && skipsUsed < maxSkipsBetweenTokens) {
          skipsUsed += 1;
          continue; // allow skipwords between phrase tokens
        } else {
          break;
        }
      }
    }

    return results;
  }
}
