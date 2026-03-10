import { describe, it } from 'node:test';
import assert from 'node:assert';
import underTest from '../../../lib/embedders/index.js';

describe('Embedders autoloader', () => {
  it('will load a provider', async () => {
    const actual = await underTest('Ollama');

    assert.strictEqual(typeof actual, 'function');
  });

  it('will throw if module not found', async () => {
    await assert.rejects(
      () => underTest('foobar'),
      e => {
        assert.strictEqual(e.message, 'Unknown provider: foobar');
        return true;
      }
    )
  });
});
