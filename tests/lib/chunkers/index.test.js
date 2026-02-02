import { afterEach, beforeEach, describe, it } from 'node:test';
import Chunker from '../../../lib/chunkers/Chunker.js';
import assert from 'node:assert';
import loadChunker from '../../../lib/chunkers/index.js';

describe('autoloader', () => {
  it('will default to Treesitter', async () => {
    const ChunkerClass = await loadChunker(); // no argument → default 'Transformers'
    const instance = new ChunkerClass();

    assert.strictEqual(instance.constructor.name, 'TreeSitter');
    assert.ok(instance.constructor.prototype instanceof Chunker);
  });

  it('will throw if no chunker found', async () => {
    const ChunkerClass = await loadChunker(); // no argument → default 'Transformers'

    await assert.rejects(
      loadChunker('foobar'),
      err => {
        assert.strictEqual(err.message, 'Cant load foobar');
        return true;
      }
    );
  });
});
