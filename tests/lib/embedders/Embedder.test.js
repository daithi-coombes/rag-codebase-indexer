import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import Embedder from '../../../lib/embedders/Embedder.js';

describe('Embedder', () => {
  describe('initialize()', () => {
    it('will throw', async () => {
      const underTest = new Embedder();

      await assert.rejects(
        () => underTest.initialize(),
        err => {
          assert.strictEqual(err.message, 'initialize() must be implemented by subclass');
          return true;
        }
      )
    });
  });

  describe('embed()', () => {
    it('will throw', async () => {
      const underTest = new Embedder();

      await assert.rejects(
        () => underTest.embed(),
        err => {
          assert.strictEqual(err.message, 'embed() must be implemented by subclass');
          return true;
        }
      )
    });
  });

  describe('embedBatch()', () => {
    it('will throw', async () => {
      const underTest = new Embedder();
      underTest.embed = mock.fn();

      await underTest.embedBatch(['foo', 'bar', 'biz', 'baz'])

      assert.strictEqual(underTest.embed.mock.calls.length, 4);
    });
  });

  describe('getDimensions()', () => {
    it('will throw', async () => {
      const underTest = new Embedder();

      try {
        underTest.getDimensions();
      } catch(err) {
        assert.strictEqual(err.message, 'getDimensions() must be implemented by subclass');
      }
    });
  });

  describe('getModelName()', () => {
    it('will throw', async () => {
      const underTest = new Embedder();

      try {
        underTest.getModelName();
      } catch(err) {
        assert.strictEqual(err.message, 'getModelName() must be implemented by subclass');
      }
    });
  });
});
