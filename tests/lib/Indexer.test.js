import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import Indexer from '../../lib/Indexer.js';
import assert from 'assert/strict';
import chunkFixtures from '../fixtures/Treesitter.buildChunk.expected.js';
import fs from 'fs/promises';
import mockFs from 'mock-fs';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configFixture = {
  model: 'nomic-embed-text:latest',
  projectName: 'foobar',
  provider: 'Ollama'
};
const optionsFixture = {
  projectPath: '/foobar/bizbaz',
  cacheDir: '/foobar',
  include: ['foobar', 'bizbaz'],
  exclude: ['biz', 'baz', '*.ccp'],
  maxFileSize: 15,
  batchSize: 10,
  embedderOpts: {
    concurrency: 5
  }
}

describe('Indexer', () => {
  let embeddingsFixture;
  let filesFixture;
  let underTest;

  beforeEach(async () => {
    filesFixture = ['foo/index.js', 'foo/bar.py', 'biz/baz.go'];
    embeddingsFixture = {
      embeddings: [-1.2, 2.4, -0.6],
      failedIndices: [3, 7]
    };

    underTest = await Indexer.create(configFixture);
    underTest.emit = mock.fn();

    mock.method(Date.prototype, 'toISOString', () => '2026-02-26T15:32:48.789Z');

    mockFs({
      '/workspace/foo/bar': {
        'test-file-1.js': 'console.log("testing mock fs")',
        'test-file-2.js': '',
        'ignore-this-file.foobar': 'foobar',
        'inner-folder': {
          'test-file-3.js': 'console.log("testing mock fs")',
          'test-file-4.js': '',
          'ignore-this-file.foobar': 'foobar'
        }
      }
    });
  });

  afterEach(() => {
    mock.restoreAll();
    mockFs.restore();
  });

  describe('create()', () => {
    it('will create an indexer instance', async () => {
      const actual = await Indexer.create(configFixture);

      assert.equal(actual.constructor.name, 'Indexer');
    });

    it('will default project name', async () => {
      const config = Object.assign({}, configFixture);
      delete config.projectName
      const actual = await Indexer.create(config);

      assert.equal(actual.projectName, 'rag-codebase-indexer');
    });
  });

  describe('chunkFile()', () => {
    beforeEach(() => {
      mockFs.restore();
    });

    it('will chunk a file', async () => {
      const actual = await underTest.chunkFile('../fixtures/codebases/javascriptFixture.js', __dirname);

      assert.strictEqual(actual.language, 'js');
      assert.strictEqual(actual.chunks.length, 11);
    });

    it('will use a bespoke chunker', async () => {
      const getLanguageFromPathMock = mock.fn();
      const parseCodeFileMock = mock.fn();
      class MockChunker {
        getLanguageFromPath() {
          getLanguageFromPathMock(...arguments)
        };
        parseCodeFile() {
          parseCodeFileMock(...arguments)
        };
      }

      const underTest = await Indexer.create({
        chunker: MockChunker,
        ...configFixture
      });

      const actual = await underTest.chunkFile('../fixtures/codebases/javascriptFixture.js', __dirname);

      assert.match(getLanguageFromPathMock.mock.calls[0].arguments[0], /fixtures\/codebases\/javascriptFixture\.js$/);
      assert.strictEqual(parseCodeFileMock.mock.calls[0].arguments[0], '../fixtures/codebases/javascriptFixture.js');
    });
  });

  describe('findFiles()', () => {
    beforeEach(async () => {
      underTest.maxFileSize = 2 * 1024 * 1024;
    });

    it('will find files', async () => {
      const actual = await underTest.findFiles(
        '/workspace/foo/bar',
        {
          exclude: [ '**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.git/**', '**/vendor/**', '**/*.test.js', '**/*.spec.js', '**/*.d.ts'],
          include: ['**/*.js', '**/*.js', '**/*.ts', '**/*.py', '**/*.jsx', '**/*.tsx'],
        }
      );
      const expected = [
        'test-file-1.js',
        'test-file-2.js',
        'inner-folder/test-file-3.js',
        'inner-folder/test-file-4.js'
      ];

      assert.deepEqual(actual, expected);
    });

    it('will emit error for large files', async () => {
      mock.method(fs, 'stat', async file => {
        if (file=='/workspace/foo/bar/test-file-1.js') {
          return { size: underTest.maxFileSize + 1 }
        }
        return {
          size: 1024
        }
      });
      await underTest.findFiles(
        '/workspace/foo/bar',
        {
          exclude: [ '**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.git/**', '**/vendor/**', '**/*.test.js', '**/*.spec.js', '**/*.d.ts'],
          include: ['**/*.js', '**/*.js', '**/*.ts', '**/*.py', '**/*.jsx', '**/*.tsx'],
        }
      );

      assert.deepEqual(underTest.emit.mock.calls[0].arguments, ['error', {
        phase: 'scan',
        status: 'progress',
        current: 0,
        total: 0,
        message: 'Skipping large file: test-file-1.js (2048KB)'
      }]);
    });
  });

  describe('generateEmbeddings()', () => {
    const textsFixture = [
      'class FixtureClass {\n' +
      "  property1 = 'this is property1';\n" +
      "  property2 = 'this is property2';\n" +
      '\n' +
      '  method1(param1, param2){\n' +
      '    return param1 - param2;\n' +
      '  }\n' +
      '\n' +
      '  async method2(param1, param2){\n' +
      '    return await new Promise.resolve(param1 + param2);\n' +
      '  }\n' +
      '}',
      'method1(param1, param2){\n    return param1 - param2;\n  }',
      'async method2(param1, param2){\n' +
      '    return await new Promise.resolve(param1 + param2);\n' +
      '  }',
      "function fixtureFunction(param1='', param2={}){\n" +
      '  return {\n' +
      '    ...param2,\n' +
      '    res: param1\n' +
      '  };\n' +
      '}',
      'async function* async_generator() {\n' +
      '  for (let i = 0; i < 10; i++) {\n' +
      '    yield await new Promise(r => setTimeout(_ => r("hello world"), 100));\n' +
      '  };\n' +
      '}',
      "fooBar = 'bizBaz'",
      "(param1='') => {\n  return param1 + ' addition string stuff';\n}",
      'r => setTimeout(_ => r("hello world"), 100)'
    ];
    const modelResult = [[0.028810633,  0.011672219,    -0.1916539, -0.0089678345,   0.06296682]];
    class MockEmbedderClass {
      embed = mock.fn(() => modelResult);
      initialize = mock.fn();
      getDimensions = mock.fn();
    }
    class MockEmbedderClassError {
      count = 0;
      embed = mock.fn(() => {
        this.count++;
        if (this.count==3) {
          throw new Error('foobar');
        } else {
          return modelResult
        }
      });
      initialize = mock.fn();
      getDimensions = mock.fn();
    }

    it('will generate embeddings', async () => {
      const underTest = await Indexer.create({
        embedder: MockEmbedderClass,
        ...configFixture
      });
      const cb = mock.fn();

      const actual = await underTest.generateEmbeddings(textsFixture, cb);

      assert.strictEqual(actual.embeddings.length, 8);
      for (let x=0; x<8; x++) {
        assert.strictEqual(actual.embeddings[x], modelResult);
      }
      assert.strictEqual(actual.failedIndices.length, 0);
    });

    it('will emit error and continue', async () => {
      const underTest = await Indexer.create({
        embedder: MockEmbedderClassError,
        ...configFixture
      });
      underTest.emit = mock.fn();
      const cb = mock.fn();

      const actual = await underTest.generateEmbeddings(textsFixture, cb);

      assert.strictEqual(actual.embeddings.length, 8);
      assert.strictEqual(actual.failedIndices.length, 1);
      assert.deepEqual(cb.mock.calls[2].arguments, [2, 'failure', new Error('foobar')]);
    });
  });

  describe('index()', () => {
    beforeEach(() => {
      underTest.findFiles = mock.fn(() => filesFixture);
      underTest.generateEmbeddings = mock.fn((texts, cb) => {
        let res = [];
        for(let i=0; i<texts.length; i++) {
          cb(i, 'ok', null);
          res.push(embeddingsFixture)
        }

        return { embeddings: res, failedIndices: [3, 7] };
      });
      underTest.writeToCache = mock.fn((validChunks, cacheDir) => `${optionsFixture.cacheDir}/embeddings_${configFixture.projectName}.json`);
      underTest.chunkFile = mock.fn(() => ({ text: 'const foobar = "bizbaz"', chunks: ['foobar'], language: 'js'}));
    });

    it('will emit progress', async () => {
      await underTest.index(optionsFixture);

      /**
       * scaning
       */
      assert.deepEqual(underTest.emit.mock.calls[0].arguments, ['progress', {
        phase: 'scan',
        status: 'start',
        current: 0,
        total: 0
      }]);
      assert.deepEqual(underTest.emit.mock.calls[1].arguments, ['progress', {
        phase: 'scan',
        status: 'complete',
        current: 3,
        total: 3,
        message: `Found 3 files`,
      }]);

      /**
       * Chunking
       */
      assert.deepEqual(underTest.emit.mock.calls[2].arguments, ['progress', {
        phase: 'chunk',
        status: 'start',
        current: 0,
        total: 3
      }]);

      for(let i=0; i<3; i++) {
        assert.deepEqual(underTest.emit.mock.calls[3+i].arguments, ['progress', {
          phase: 'chunk',
          status: 'progress',
          current: i+1,
          total: 3,
          message: `${filesFixture[i]} → 1 chunks`,
          detail: { file: filesFixture[i], chunks: 1, language: 'js' }
        }]);
      }

      assert.deepEqual(underTest.emit.mock.calls[6].arguments, ['progress', {
        phase: 'chunk',
        status: 'complete',
        current: 3,
        total: 3,
        message: `3 total chunks from 3 files`
      }]);

      /**
       * embedding
       */
      assert.deepEqual(underTest.emit.mock.calls[7].arguments, ['progress', {
        phase: 'embed',
        status: 'start',
        current: 0,
        total: 3
      }]);

      for(let i=0; i<3; i++) {
        assert.deepEqual(underTest.emit.mock.calls[8+i].arguments, ['progress', {
          phase: 'embed',
          status: 'progress',
          current: i+1,
          total: 3,
          message: `Embedding ${i+1}/3`,
          detail: { index: i, status: 'ok', error: null }
        }]);
      }

      assert.deepEqual(underTest.emit.mock.calls[11].arguments, ['progress', {
        phase: 'embed',
        status: 'complete',
        current: 3,
        total: 3,
        message: `Embedded 3 chunks (2 failed)`,
      }]);

      /**
       * caching
       */
       assert.deepEqual(underTest.emit.mock.calls[12].arguments, ['progress', {
         phase: 'cache',
         status: 'start',
         current: 0,
         total: 1
       }]);

       assert.deepEqual(underTest.emit.mock.calls[13].arguments, ['progress', {
         phase: 'cache',
         status: 'complete',
         current: 1,
         total: 1,
         message: `Saved to /foobar/embeddings_foobar.json`,
         detail: { embedFile: '/foobar/embeddings_foobar.json' },
       }]);

       /**
        * done
        */

        assert.deepEqual(underTest.emit.mock.calls[14].arguments, ['done', {
          embedFile: '/foobar/embeddings_foobar.json',
          provider: 'Ollama',
          model: 'nomic-embed-text:latest',
          dimensions: 768,
          timestamp: '2026-02-26T15:32:48.789Z'
        }]);
    });

    it('will emit error when chunking', async () => {
      underTest.chunkFile = mock.fn(() => {throw new Error('foobar')});
      await underTest.index(optionsFixture);

      assert.deepEqual(underTest.emit.mock.calls[3].arguments[0], 'error');
      assert.deepEqual(underTest.emit.mock.calls[3].arguments[1].message, 'Failed to chunk foo/index.js: foobar');
      assert.deepEqual(underTest.emit.mock.calls[4].arguments[0], 'error');
      assert.deepEqual(underTest.emit.mock.calls[4].arguments[1].message, 'Failed to chunk foo/bar.py: foobar');
      assert.deepEqual(underTest.emit.mock.calls[5].arguments[0], 'error');
      assert.deepEqual(underTest.emit.mock.calls[5].arguments[1].message, 'Failed to chunk biz/baz.go: foobar');
    });

    it('will emit error if embedding status is failure', async () => {
      underTest.generateEmbeddings = (text, cb) => {
        cb(0, 'failure', 'foobar');
        return embeddingsFixture;
      }
      await underTest.index(optionsFixture);

      assert.deepEqual(underTest.emit.mock.calls[9].arguments, ['error', {
        phase: 'embed',
        message: `Embedding failed for chunk 0: foobar`,
        error: new Error('foobar'),
        recoverable: true
      }]);
    });
  });

  describe('getters', () => {
    it('will get getters', () => {
      assert.equal(underTest.modelName, 'nomic-embed-text:latest');
      assert.equal(underTest.dimensions, 768);
      assert.equal(underTest.provider, 'Ollama');
      assert.equal(underTest.projectName, 'foobar');
    });
  });

  describe('writeToCache()', () => {
    it('will write to cache', async () => {
      const validChunksFixture = [
        {
          chunk: { id: 'chunk_0', text: 'const foo = 1', metadata: { filePath: 'foo.js', type: 'variable' }, file: 'foo.js', language: 'js' },
          embedding: [ -1.2, 2.4, -0.6 ],
        },
        {
          chunk: { id: 'chunk_1', text: 'function bar() {}', metadata: { filePath: 'bar.js', type: 'function' }, file: 'bar.js', language: 'js' },
          embedding: [ 0.5, -0.3, 1.1 ],
        },
        {
          chunk: { id: 'chunk_2', text: 'class Baz {}', metadata: { filePath: 'baz.js', type: 'class' }, file: 'baz.js', language: 'js' },
          embedding: [ 0.1, 0.2, 0.3 ],
        },
      ];
      const cacheDirFixture = '/foobar';

      const actual = await underTest.writeToCache(validChunksFixture, cacheDirFixture);

      assert.strictEqual(actual, path.resolve('/foobar/embeddings_foobar.json'));

      const written = JSON.parse(await fs.readFile(actual, 'utf-8'));
      assert.strictEqual(written.chunks.length, 3);
      assert.strictEqual(written.model, 'nomic-embed-text:latest');
      assert.strictEqual(written.total, 3);
      assert.deepEqual(written.chunks[0].embedding, [ -1.2, 2.4, -0.6 ]);
      assert.strictEqual(written.chunks[0].id, 'chunk_0');
      assert.strictEqual(written.chunks[0].text, 'const foo = 1');
      assert.deepEqual(written.chunks[0].metadata, { filePath: 'foo.js', type: 'variable' });
    });
  });

  describe('dispose()', () => {
    it('will dispose', async () => {
      const cleanupMock = mock.fn();
      class MockEmbedderClass{
        cleanup = cleanupMock;
        initialize(){}
        getDimensions(){}
      }
      const underTest = await Indexer.create({
        embedder: MockEmbedderClass,
        ...configFixture
      });
      underTest.removeAllListeners = mock.fn();

      await underTest.dispose();

      assert.strictEqual(cleanupMock.mock.calls.length, 1);
      assert.strictEqual(underTest.removeAllListeners.mock.calls.length, 1);
    });
  });
});
