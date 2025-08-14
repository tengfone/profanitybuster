import { bench, describe } from 'vitest';

import { ProfanityBuster } from '../src';

describe('detect benchmark', () => {
  const buster = new ProfanityBuster();
  const text = 'This is a fairly long sentence with shit hidden somewhere.';

  bench('detect', () => {
    buster.detect(text);
  });
});
