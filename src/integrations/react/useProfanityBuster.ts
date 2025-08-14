import { useEffect, useMemo, useState } from 'react';

import type { ProfanityBusterConfig } from '../../index';
import ProfanityBuster from '../../index';

export interface UseProfanityBusterOptions {
  config?: Partial<ProfanityBusterConfig>;
  preloadLanguages?: string[];
}

export interface UseProfanityBusterResult {
  buster: ProfanityBuster;
  ready: boolean;
  detect: (text: string) => ReturnType<ProfanityBuster['detect']>;
  sanitize: (text: string) => string;
}

export function useProfanityBuster(options?: UseProfanityBusterOptions): UseProfanityBusterResult {
  const { config, preloadLanguages } = options ?? {};

  const buster = useMemo(() => new ProfanityBuster(config), [JSON.stringify(config ?? {})]);
  const [ready, setReady] = useState<boolean>(false);

  useEffect((): (() => void) => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        if (preloadLanguages && preloadLanguages.length > 0) {
          await buster.loadLanguages(preloadLanguages);
        }
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setReady(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [buster, JSON.stringify(preloadLanguages ?? [])]);

  return {
    buster,
    ready,
    detect: (text: string) => buster.detect(text),
    sanitize: (text: string) => buster.sanitize(text),
  };
}

export default useProfanityBuster;
