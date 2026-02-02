import { describe, it } from 'node:test';
import Transformers from '../../../lib/embedders/Transformers.js';
import Embedder from '../../../lib/embedders/Embedder.js';
import assert from 'node:assert';

describe('Transformers', () => {
  it('will construct', () => {
    const underTest = new Transformers();

    assert.ok(underTest.constructor.prototype instanceof Embedder);
  });
});
