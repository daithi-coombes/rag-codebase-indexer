import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getEmbed } from '../../config/index.js';
import defaultConfigFixture from '../fixtures/defaultConfig.json' with {type: "json"}
import fs from 'fs';

describe('config/index.js', () => {
  it('will export default config as module default', async () => {
    const underTest = await import('../../config/index.js');

    assert.deepStrictEqual(underTest.default, defaultConfigFixture);
  });

  describe('getEmbed()', () => {
    it('will overwrite with defaults', () => {
      const fixture = {
        "codebase": {
          cacheDir: './embeddings_cache',
          exclude: [ 'foobar'],
          include: ['**/*.js', '**/*.js', '**/*.ts', '**/*.py', '**/*.jsx', '**/*.tsx']
        },
        "model": {
          "name": "mxbai-embed-large",
          "provider": "Ollama"
        },
        "chunker": {
          "chunkSize": 1500,
          "chunkOverlap": 200
        }
      };

      const actual = getEmbed(fixture);
      const expected = {
        codebase: {
          batchSize: 50,
          cacheDir: './embeddings_cache',
          exclude: [
            'foobar'
          ],
          include: [
            '**/*.js',
            '**/*.js',
            '**/*.ts',
            '**/*.py',
            '**/*.jsx',
            '**/*.tsx'
          ],
          maxFileSize: 2097152,
          projectName: 'rag-codebase-indexer'
        },
        model: {
          name: "mxbai-embed-large",
          provider: "Ollama",
          options: {
            type: 'embed',
            dimensions: 1024,
            maxTokens: 512
          }
        },
        chunker: { chunkSize: 1500, chunkOverlap: 200 }
      };

      assert.deepStrictEqual(actual, expected);
    });

    it('will throw error if no name or provider', () => {
      const configFixture = {
        ...defaultConfigFixture.embed
      };
      delete configFixture.model.name;
      delete configFixture.model.provider;

      assert.throws(
        () => getEmbed(configFixture),
        err => {
          assert.ok(err instanceof Error);
          assert.strictEqual(err.message, "Embed config missing 'name' or 'provider'");

          return true;
        }
      )
    });
  });
});
