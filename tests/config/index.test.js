import { describe, it } from 'node:test';
import assert from 'node:assert';
import defaultConfigFixture from '../fixtures/defaultConfig.json' with {type: "json"}

describe('config/index.js', () => {
  it('will export default config as module default', async () => {
    const underTest = await import('../../config/index.js');

    defaultConfigFixture.store.stopWords = new Set(defaultConfigFixture.store.stopWords);
    assert.deepStrictEqual(underTest.default, defaultConfigFixture);
  });
});
