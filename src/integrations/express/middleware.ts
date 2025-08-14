import ProfanityBuster, { type ProfanityBusterConfig } from '../../index';

import type { ExpressRequest, ExpressResponse, ExpressNextFunction } from './types';

export interface ProfanityMiddlewareOptions {
  config?: Partial<ProfanityBusterConfig>;
  sanitizeFields?: string[]; // e.g., ['body.comment', 'body.title']
  preloadLanguages?: string[];
}

export function createProfanityMiddleware(options?: ProfanityMiddlewareOptions) {
  const { config, sanitizeFields, preloadLanguages } = options ?? {};
  const buster = new ProfanityBuster(config);

  let preloadPromise: Promise<void> | undefined;
  if (preloadLanguages && preloadLanguages.length > 0) {
    preloadPromise = buster.loadLanguages(preloadLanguages);
  }

  return async (req: ExpressRequest, _res: ExpressResponse, next: ExpressNextFunction) => {
    if (preloadPromise) {
      try {
        await preloadPromise;
      } catch {
        // ignore preload errors; continue
      }
    }

    if (sanitizeFields && sanitizeFields.length > 0) {
      for (const path of sanitizeFields) {
        // Very small path walker (no external deps)
        if (!/^[a-zA-Z0-9_.]+$/.test(path)) continue; // reject suspicious keys
        const parts = path.split('.');
        let current: any = req as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        for (let i = 0; i < parts.length - 1; i++) {
          if (current == null) break;
          const key = parts[i];
          // prevent prototype pollution
          if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
            current = null;
            break;
          }
          const nextVal = current[key];
          if (typeof nextVal !== 'object' || nextVal === null) {
            current = null;
            break;
          }
          current = nextVal;
        }
        const last = parts[parts.length - 1];
        if (current && typeof current[last] === 'string') {
          current[last] = buster.sanitize(current[last]);
        }
      }
    }

    (req as any).profanitybuster = buster; // eslint-disable-line @typescript-eslint/no-explicit-any
    next();
  };
}

export default createProfanityMiddleware;
