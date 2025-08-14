export interface AhoMatch {
  index: number;
  length: number;
}

interface AhoNode {
  children: Map<string, number>;
  fail: number;
  terminalLengths: number[]; // lengths of patterns that end at this node
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/**
 * Aho–Corasick automaton for multi-pattern exact matching with optional
 * whole-word boundary checks and separator skipping.
 *
 * Note: When separatorsToIgnore is provided, we map the input text to a
 * compacted version (with separators removed) and map match spans back to
 * original indices so the returned spans include separators within them.
 */
export class AhoCorasick {
  private readonly nodes: AhoNode[] = [];

  constructor() {
    this.nodes.push({ children: new Map(), fail: 0, terminalLengths: [] }); // root
  }

  insert(word: string): void {
    if (!word) return;
    let nodeIndex = 0;
    for (const ch of word) {
      const node = this.nodes[nodeIndex];
      let nextIndex = node.children.get(ch);
      if (nextIndex === undefined) {
        nextIndex = this.nodes.length;
        node.children.set(ch, nextIndex);
        this.nodes.push({ children: new Map(), fail: 0, terminalLengths: [] });
      }
      nodeIndex = nextIndex;
    }
    this.nodes[nodeIndex].terminalLengths.push(word.length);
  }

  insertAll(words: Iterable<string>): void {
    for (const w of words) this.insert(w);
  }

  build(): void {
    // Build failure links using BFS
    const queue: number[] = [];

    // Initialize depth-1 fail links to root
    for (const [, childIndex] of this.nodes[0].children) {
      this.nodes[childIndex].fail = 0;
      queue.push(childIndex);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const [ch, nextIndex] of this.nodes[current].children) {
        queue.push(nextIndex);

        // Find failure link for child
        let f = this.nodes[current].fail;
        while (f !== 0 && !this.nodes[f].children.has(ch)) {
          f = this.nodes[f].fail;
        }
        if (this.nodes[f].children.has(ch) && this.nodes[0].children.get(ch) !== nextIndex) {
          f = this.nodes[f].children.get(ch)!;
        }
        this.nodes[nextIndex].fail = f;
        // Inherit terminal outputs
        const inherited = this.nodes[f].terminalLengths;
        if (inherited.length > 0) {
          this.nodes[nextIndex].terminalLengths.push(...inherited);
        }
      }
    }
  }

  findAllMatches(
    text: string,
    wholeWordsOnly: boolean,
    separatorsToIgnore?: Set<string>,
  ): AhoMatch[] {
    const results: AhoMatch[] = [];
    const useIgnore = !!separatorsToIgnore && separatorsToIgnore.size > 0;

    let scanText: string;
    let toOriginalIndex: number[] | null = null;

    if (useIgnore) {
      const compactChars: string[] = [];
      const indexMap: number[] = [];
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (separatorsToIgnore!.has(ch)) continue;
        compactChars.push(ch);
        indexMap.push(i);
      }
      scanText = compactChars.join('');
      toOriginalIndex = indexMap;
    } else {
      scanText = text;
    }

    let state = 0;
    for (let i = 0; i < scanText.length; i++) {
      const ch = scanText[i];
      // Follow fail links until a transition exists or at root
      while (state !== 0 && !this.nodes[state].children.has(ch)) {
        state = this.nodes[state].fail;
      }
      const next = this.nodes[state].children.get(ch);
      if (next !== undefined) state = next;
      else state = state; // remain at current (root will be 0)

      const outputs = this.nodes[state].terminalLengths;
      if (outputs.length > 0) {
        for (const len of outputs) {
          const endCompact = i;
          const startCompact = endCompact - len + 1;
          if (startCompact < 0) continue;

          let startOriginal: number;
          let endOriginal: number;
          if (toOriginalIndex) {
            startOriginal = toOriginalIndex[startCompact];
            endOriginal = toOriginalIndex[endCompact];
          } else {
            startOriginal = startCompact;
            endOriginal = endCompact;
          }

          if (wholeWordsOnly) {
            const leftOk = startOriginal === 0 || !WORD_CHAR.test(text[startOriginal - 1]);
            const rightOk =
              endOriginal + 1 >= text.length || !WORD_CHAR.test(text[endOriginal + 1]);
            if (!leftOk || !rightOk) continue;
          }

          const spanLength = endOriginal - startOriginal + 1;
          results.push({ index: startOriginal, length: spanLength });
        }
      }
    }

    return results;
  }
}
