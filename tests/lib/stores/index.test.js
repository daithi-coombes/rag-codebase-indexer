import { describe, it } from 'node:test';
import assert from 'node:assert';
import underTest from '../../../lib/stores/index.js';

describe('Stores autoloader', () => {
  it('will load a store', async () => {
    const actual = await underTest('Chroma');

    assert.strictEqual(typeof actual, 'function');
  });

  it('will throw if module not found', async () => {
    await assert.rejects(
      () => underTest('foobar'),
      e => {
        assert.strictEqual(e.message, 'Unknown store: foobar');
        return true;
      }
    )
  });
});
