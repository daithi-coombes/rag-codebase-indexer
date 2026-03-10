import { describe, it } from 'node:test';
import Store from '../../../lib/stores/Store.js';
import assert from 'node:assert';

describe('Store', () => {
  const underTest = new Store();

  describe('will throw error for each method', () => {
    ['initialize', 'getAll', 'insert', 'query'].forEach(method => {
      it(`will throw ${method}`, async () => {
        assert.rejects(
          () => underTest[method](),
          e => {
            assert.strictEqual(e.message, `${method}() must be implemented by subclass`);

            return true;
          }
        )
      });
    });
  });
});
