import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import VectorStore from '../../lib/VectorStore.js';
import _ from 'lodash';
import assert from 'node:assert';
import mockFs from 'mock-fs';

import ChromaGet200 from '../fixtures/Chroma.get.200.json' with { type: 'json' };
import ChromaQuery200 from '../fixtures/Chroma.query.200.json' with { type: 'json' };
import SemanticResultsFixture from '../fixtures/VectorStore.SemanticSearch.result.json' with { type: 'json' };
import KeywordResultsFixture from '../fixtures/VectorStore.KeywordSearch.result.json' with { type: 'json' };

describe('VectorStore', () => {
  let underTest;

  const mockCollectionGetResult = ChromaGet200;
  const mockCollectionQueryResult = ChromaQuery200;
  const mockVectorClientConstructor = mock.fn();
  const mockVectorCollection = {
    add: mock.fn(),
    get: mock.fn(() => mockCollectionGetResult),
    query: mock.fn(() => mockCollectionQueryResult)
  };
  class MockVectorClient{
    constructor() {
      mockVectorClientConstructor(...arguments);
    }

    getCollection = mock.fn(() => mockVectorCollection);
    createCollection = mock.fn();
  }
  const configFixture = {
    collection: 'test-collection',
    dimensions: 786,
    embedOptions: {
      provider: 'Ollama'
    }
  };

  beforeEach(async () => {
    underTest = await VectorStore.connect(configFixture, MockVectorClient);
    underTest.emit = mock.fn();
  });

  afterEach(async () => {
    await underTest.dispose();
    mock.restoreAll();
    mockFs.restore();
  });

  describe('connect()', () => {
    it('will return instance', async () => {
      assert.strictEqual(underTest.constructor.name, 'VectorStore');
    });

    it('will create a collection if none', async () => {
      const mockCreateCollection = mock.fn();
      class MockVectorClientNoCollection extends MockVectorClient {
        getCollection = () => {
          const err = new Error('ChromaNotFoundError');
          err.name = 'ChromaNotFoundError'
          throw err;
        }
        createCollection = (args) => {
          mockCreateCollection(args);
        }
      }

      const underTest = await VectorStore.connect(configFixture, MockVectorClientNoCollection);

      assert.deepEqual(mockCreateCollection.mock.calls[0].arguments[0], {name: 'test-collection', dimensions: configFixture.dimensions});
    });

    it('will throw if no collection name', async () => {

      await assert.rejects(
        () => VectorStore.connect({}),
        err => {
          assert.strictEqual(err.message, 'You must specify a collection name');
          return true;
        }
      );
    });

    it('will throw if no dimensions', async () => {

      await assert.rejects(
        () => VectorStore.connect({ collection: 'test-collection' }),
        err => {
          assert.strictEqual(err.message, 'You must specify the dimensions');
          return true;
        }
      );
    });

    it('will throw if chroma error is not ChromaNotFoundError', async () => {

      const mockGetCollection = mock.fn(() => { throw new Error('foobar') });
      class MockVectorDB extends MockVectorClient {
        getCollection = mockGetCollection;
      }

      await assert.rejects(
        () => VectorStore.connect(configFixture, MockVectorDB),
        err => {
          assert.strictEqual(err.message, 'foobar');
          return true;
        }
      );
    });
  });

  describe('ingest()', () => {
    beforeEach(() => {
      mockFs({
        '/workspace/foo/bar/embeddings_mock.json': '{"chunks":[{"id":"Y29uZmlnL2luZGV4Lmpz:0:1772396639617","text":"staticConfig = require(\'./agentic-ai.json\')","metadata":{"filePath":"config/index.js","language":"js","type":"variable","astNodeType":"variable_declarator","startRow":2,"startColumn":6,"endRow":2,"endColumn":49,"textLength":43,"variableName":"staticConfig"},"embedding":[-0.025579184,0.024237446,-0.12540329,-0.02682167],"file":"config/index.js","language":"js"},{"id":"Y29uZmlnL2luZGV4Lmpz:2:1772396639617","text":"static get(keyPath) {    return atom.config.get(`${this.NAMESPACE}.${keyPath}`);  }","metadata":{"filePath":"config/index.js","language":"js","type":"method","astNodeType":"method_definition","startRow":25,"startColumn":2,"endRow":27,"endColumn":3,"textLength":85,"methodName":"keyPath","isAsync":false},"embedding":[0.011845425,0.03150496,-0.129117,-0.048051752],"file":"config/index.js","language":"js"},{"id":"Y29uZmlnL2luZGV4Lmpz:3:1772396639618","text":"static set(keyPath, value) {    return atom.config.set(`${this.NAMESPACE}.${keyPath}`, value);  }","metadata":{"filePath":"config/index.js","language":"js","type":"method","astNodeType":"method_definition","startRow":29,"startColumn":2,"endRow":31,"endColumn":3,"textLength":99,"methodName":"keyPath","isAsync":false},"embedding":[0.011002577,0.041806478,-0.14281082,-0.072861485],"file":"config/index.js","language":"js"}],"model":"nomic-embed-text:latest","dimensions":768,"total":182,"timestamp":"2026-03-01T20:26:46.938Z"}'
      });
    });

    it('will ingest', async () => {

      const actual = await underTest.ingest({
        embedFile: '/workspace/foo/bar/embeddings_mock.json',
        dimensions: 786
      });

      assert.deepEqual(underTest.emit.mock.calls[0].arguments[0], 'start');
      assert.deepEqual(underTest.emit.mock.calls[1].arguments[0], 'progress');
      assert.deepEqual(underTest.emit.mock.calls[2].arguments[0], 'complete');
      assert.strictEqual(actual.collection, 'test-collection');
      assert.strictEqual(actual.inserted, 2);
      assert.deepEqual(Object.keys(actual), ['collection', 'inserted', 'rate', 'totalTime']);
    });

    it('will verify is indexResult', async () => {
      const mockIndexResult = {
        embedFiles: '/workspace/foo/bar/embeddings_mock.json',
        dumensusons: 'a string'
      }

      assert.rejects(
        () => underTest.ingest(mockIndexResult),
        err => {
          assert.strictEqual(err.message, 'Missing required field(s): embedFile, dimensions');
          return true;
        }
      );
    });

    it('will retry with smaller batch', async () => {
      const addCount = 0 ;
      const mockVectorCollectionThrow = {
        add() {
          throw new Error('foobar');
        }
      };
      class MockVectorClientThrow extends MockVectorClient {
        getCollection = mock.fn(() => mockVectorCollectionThrow);
      }

      const underTest = await VectorStore.connect(configFixture, MockVectorClientThrow);
      underTest.emit = mock.fn();

      const actual = await underTest.ingest({
        embedFile: '/workspace/foo/bar/embeddings_mock.json',
        dimensions: 786
      });

      assert.deepEqual(underTest.emit.mock.calls[1].arguments, ['error', {
        phase: 'ingest',
        message: 'Retrying with smaller batch: 100',
        error: new Error('foobar'),
        recoverable: true
      }]);
      assert.deepEqual(underTest.emit.mock.calls[2].arguments, ['error', {
        phase: 'ingest',
        message: 'Retrying with smaller batch: 50',
        error: new Error('foobar'),
        recoverable: true
      }]);
    });
  });

  describe('loadEmbedder', () => {
    it('will load bespoke class', async () => {
      const mockInitialize = mock.fn();
      const mockDimensions = mock.fn(() => 368);
      class MockEmbedderClass{
        initialize = mockInitialize;
        getDimensions = mockDimensions;
      }

      await underTest.loadEmbedder({}, MockEmbedderClass);

      assert.strictEqual(mockInitialize.mock.calls.length, 1);
      assert.strictEqual(mockDimensions.mock.calls.length, 1);
    });
  });

  describe('loadEmbeddings', () => {
    beforeEach(() => {
      mockFs({
        '/workspace/foo/bar/embeddings_mock.json': '{"chunks":[{"id":"Y29uZmlnL2luZGV4Lmpz:0:1772396639617","text":"staticConfig = require(\'./agentic-ai.json\')","metadata":{"filePath":"config/index.js","language":"js","type":"variable","astNodeType":"variable_declarator","startRow":2,"startColumn":6,"endRow":2,"endColumn":49,"textLength":43,"variableName":"staticConfig"},"embedding":[-0.025579184,0.024237446,-0.12540329,-0.02682167],"file":"config/index.js","language":"js"},{"id":"Y29uZmlnL2luZGV4Lmpz:2:1772396639617","text":"static get(keyPath) {    return atom.config.get(`${this.NAMESPACE}.${keyPath}`);  }","metadata":{"filePath":"config/index.js","language":"js","type":"method","astNodeType":"method_definition","startRow":25,"startColumn":2,"endRow":27,"endColumn":3,"textLength":85,"methodName":"keyPath","isAsync":false},"embedding":[0.011845425,0.03150496,-0.129117,-0.048051752],"file":"config/index.js","language":"js"},{"id":"Y29uZmlnL2luZGV4Lmpz:3:1772396639618","text":"static set(keyPath, value) {    return atom.config.set(`${this.NAMESPACE}.${keyPath}`, value);  }","metadata":{"filePath":"config/index.js","language":"js","type":"method","astNodeType":"method_definition","startRow":29,"startColumn":2,"endRow":31,"endColumn":3,"textLength":99,"methodName":"keyPath","isAsync":false},"embedding":[0.011002577,0.041806478,-0.14281082,-0.072861485],"file":"config/index.js","language":"js"}],"model":"nomic-embed-text:latest","dimensions":768,"total":182,"timestamp":"2026-03-01T20:26:46.938Z"}'
      });
    });

    it('will load embeddings file', async () => {
      const embedFile = '/workspace/foo/bar/embeddings_mock.json';

      const actual = await underTest.loadEmbeddings(embedFile);
      const expected = {
        ids: [
          'Y29uZmlnL2luZGV4Lmpz:2:1772396639617',
          'Y29uZmlnL2luZGV4Lmpz:3:1772396639618'
        ],
        embeddings: [
          [ 0.011845425, 0.03150496, -0.129117, -0.048051752 ],
          [ 0.011002577, 0.041806478, -0.14281082, -0.072861485 ]
        ],
        documents: [
          'static get(keyPath) {    return atom.config.get(`${this.NAMESPACE}.${keyPath}`);  }',
          'static set(keyPath, value) {    return atom.config.set(`${this.NAMESPACE}.${keyPath}`, value);  }'
        ],
        metadatas: [
          {
            filePath: 'config/index.js',
            language: 'js',
            type: 'method',
            astNodeType: 'method_definition',
            startRow: 25,
            startColumn: 2,
            endRow: 27,
            endColumn: 3,
            textLength: 85,
            methodName: 'keyPath',
            isAsync: false,
            text_length: 83,
            parser: 'standard',
            model: 'nomic-embed-text:latest'
          },
          {
            filePath: 'config/index.js',
            language: 'js',
            type: 'method',
            astNodeType: 'method_definition',
            startRow: 29,
            startColumn: 2,
            endRow: 31,
            endColumn: 3,
            textLength: 99,
            methodName: 'keyPath',
            isAsync: false,
            text_length: 97,
            parser: 'standard',
            model: 'nomic-embed-text:latest'
          }
        ],
        dimensions: 768
      }

      assert.deepEqual(actual, expected);
    });
  });

  describe('search()', () => {
    it('will search', async () => {
      const actual = await underTest.search('foobar');

      assert.deepEqual(underTest.emit.mock.calls[0].arguments, ['progress', {
        phase: 'search',
        status: 'start',
        current: 0,
        total: 3,
        message: 'Hybrid search: "foobar"'
      }]);
      assert.deepEqual(underTest.emit.mock.calls[1].arguments, ['progress', {
        current: 3,
        message: 'Candidates → exact: 0, semantic: 3, keyword: 0',
        phase: 'search',
        status: 'progress',
        total: 3
      }]);
      assert.deepEqual(underTest.emit.mock.calls[2].arguments, ['progress', {
        current: 3,
        message: 'Found 3 results from 2 files',
        phase: 'search',
        status: 'complete',
        total: 3
      }]);
    });

    it('will emit error and continue', async () => {
      const mockIdentifierResult = _.cloneDeep(ChromaGet200);
      delete mockIdentifierResult.metadatas

      const mockIdentifierCollection = _.cloneDeep(mockVectorCollection);
      mockIdentifierCollection.get = mock.fn(() => mockIdentifierResult);
      class MockVectorIdentifierClient extends MockVectorClient {
        getCollection = mock.fn(() => mockIdentifierCollection);
      }

      const underTest = await VectorStore.connect(configFixture, MockVectorIdentifierClient)
      underTest.emit = mock.fn();
      const actual = await underTest.search('foobar');

      assert.strictEqual(underTest.emit.mock.calls[1].arguments[0], 'error');
      assert.strictEqual(underTest.emit.mock.calls[1].arguments[1].phase, 'search:exact');
      assert.strictEqual(underTest.emit.mock.calls[1].arguments[1].message, 'Exact match search failed: Cannot read properties of undefined (reading \'0\')');
      assert.strictEqual(underTest.emit.mock.calls[1].arguments[1].error.message, 'Cannot read properties of undefined (reading \'0\')');
      assert.strictEqual(underTest.emit.mock.calls[2].arguments[0], 'error');
      assert.strictEqual(underTest.emit.mock.calls[2].arguments[1].phase, 'search:keyword');
      assert.strictEqual(underTest.emit.mock.calls[2].arguments[1].message, 'Keyword search failed: Cannot read properties of undefined (reading \'0\')');
      assert.strictEqual(underTest.emit.mock.calls[2].arguments[1].error.message, 'Cannot read properties of undefined (reading \'0\')');
    });

    it('search excludes results when numeric filter does not match (matchesFilters false)', async () => {
      const results = await underTest.search('config get set', {
        filters: { text_length: 999 },
        topK: 5,
      });

      for (const r of results.results) {
        assert.notEqual(r.metadata.text_length, 999);
      }
    });
  });

  describe('findExactMatches()', () => {
    ['functionName', 'methodName', 'className', 'variableName'].forEach(identifier => {
      it(`will score 1.0 if identifier ${identifier} match`, async () => {
        const mockIdentifierResult = _.cloneDeep(ChromaGet200);
        mockIdentifierResult.documents[1] = 'foobar';
        mockIdentifierResult.metadatas[1][identifier] = 'foobar';

        const actual = await underTest.findExactMatches('foobar', () => mockIdentifierResult);

        assert.strictEqual(actual[0].score, 1);
      });
    });

    it('will score 0.9 if inner function match', async () => {
      const mockIdentifierResult = _.cloneDeep(ChromaGet200);
      mockIdentifierResult.documents[1] = 'function bizBaz(){ function foobar }';
      mockIdentifierResult.metadatas[1].methodName = 'bizBaz';

      const actual = await underTest.findExactMatches('foobar', () => mockIdentifierResult);
      assert.strictEqual(actual[0].score, 0.9);
    });

    it('will score 0.9 if anon function match', async () => {
      const mockIdentifierResult = _.cloneDeep(ChromaGet200);
      mockIdentifierResult.documents[1] = 'foobar(';
      mockIdentifierResult.metadatas[1].methodName = 'bizBaz';

      const actual = await underTest.findExactMatches('foobar', () => mockIdentifierResult);
      assert.strictEqual(actual[0].score, 0.9);
    });

    it('will score 0.75 if text match in doc', async () => {
      const mockIdentifierResult = _.cloneDeep(ChromaGet200);
      mockIdentifierResult.documents[1] = 'some random foobar string';
      mockIdentifierResult.metadatas[1].methodName = 'bizBaz';

      const actual = await underTest.findExactMatches('foobar', () => mockIdentifierResult);

      assert.strictEqual(actual[0].score, 0.75);
    });
  });

  describe('semanticSearch()', () => {
    it('will return an empty array if no results', async () => {
      const mockSemanticSearchCollection = {
        query: mock.fn(() => ({ documents: [] }))
      };
      class MockSemanticSearchClient extends MockVectorClient{
        getCollection = mock.fn(() => mockSemanticSearchCollection);
      }

      const underTest = await VectorStore.connect(configFixture, MockSemanticSearchClient);
      const actual = await underTest.semanticSearch('foobar');

      assert.deepEqual(actual, []);
    });
  });

  describe('keywordSearch()', () => {
    it('will return empty array if tokeniseQuery returns \'\'', async () => {
      const actual = await underTest.keywordSearch('a an the and or');

      assert.deepEqual(actual, []);
    });
  });

  describe('cleanFilters()', () => {
    it('will clean filters', async () => {
      const mockCleanFiltersCollection = _.cloneDeep(mockVectorCollection);
      mockCleanFiltersCollection.query = mock.fn();
      class MockCleanFiltersClient extends MockVectorClient {
        getCollection = mock.fn(() => mockCleanFiltersCollection);
      }

      const underTest = await VectorStore.connect(configFixture, MockCleanFiltersClient)

      await assert.rejects(
        () => underTest.search('foobar', { filters: { filePath: 'src/auth/' } }),
        err => {
          assert.deepEqual(mockCleanFiltersCollection.query.mock.calls[0].arguments[0].where, { filePath: { '$eq': 'src/auth/' } });
          return true;
        }
      );

    });

    it('will clean operator filters', async () => {
      const mockCleanFiltersCollection = _.cloneDeep(mockVectorCollection);
      mockCleanFiltersCollection.query = mock.fn();
      class MockCleanFiltersClient extends MockVectorClient {
        getCollection = mock.fn(() => mockCleanFiltersCollection);
      }

      const underTest = await VectorStore.connect(configFixture, MockCleanFiltersClient)

      await assert.rejects(
        () => underTest.search('foobar', { filters: { filePath: { $contains: 'bizbaz' } } }),
        err => {
          assert.deepEqual(mockCleanFiltersCollection.query.mock.calls[0].arguments[0].where, { filePath: { $contains: 'bizbaz' } });
          return true;
        }
      );
    });
  });

  describe('fuseResults()', () => {
  });

  describe('getRanked()', () => {
    it('will surface class chunks before non-class chunks', async () => {
      const fused = new Map([
        ['fn_high', {
          document: 'function highScore() {}',
          metadata: { source_file: 'a.js', chunk_type: 'function', startRow: 0, endRow: 5 },
          fusedScore: 0.95,
          bestRawScore: 0.95,
          sources: new Set(['semantic']),
        }],
        ['class_low', {
          document: 'class LowScore {}',
          metadata: { source_file: 'b.js', chunk_type: 'class', startRow: 0, endRow: 10 },
          fusedScore: 0.30,
          bestRawScore: 0.30,
          sources: new Set(['exact']),
        }],
      ]);

      const ranked = VectorStore.getRanked(fused, 10, 0.1, 0.25);

      assert.equal(ranked[0].metadata.chunk_type, 'class',
        'class chunk should rank first despite lower fusedScore');
      assert.equal(ranked[1].metadata.chunk_type, 'function');
    });

    it('will surface non-class chunks before class chunks', async () => {
      const fused = new Map([
        ['class_low', {
          document: 'class LowScore {}',
          metadata: { source_file: 'b.js', chunk_type: 'class', startRow: 0, endRow: 10 },
          fusedScore: 0.30,
          bestRawScore: 0.30,
          sources: new Set(['exact']),
        }],
        ['fn_high', {
          document: 'function highScore() {}',
          metadata: { source_file: 'a.js', chunk_type: 'function', startRow: 0, endRow: 5 },
          fusedScore: 0.95,
          bestRawScore: 0.95,
          sources: new Set(['semantic']),
        }],
      ]);

      const ranked = VectorStore.getRanked(fused, 10, 0.1, 0.25);

      assert.equal(ranked[0].metadata.chunk_type, 'class',
        'class chunk should rank first despite lower fusedScore');
      assert.equal(ranked[1].metadata.chunk_type, 'function');
    });
  });

  describe('addResults()', () => {

    let fused;
    const makeResult = (overrides = {}) => {
      return {
        document: 'function foo() {}',
        metadata: {
          filePath: '/src/foo.mjs',
          lineStart: 1,
          lineEnd: 10,
        },
        distance: 0.3,
        score: 0.7,
        source: 'semantic',
        ...overrides,
      };
    }

    beforeEach(() => {
      fused = new Map();
    });

    it('will add a new entry to an empty map', () => {
      const result = makeResult();
      const weight = 0.4;

      VectorStore.addResults([result], weight, 'semantic', fused);

      assert.equal(fused.size, 1);

      const key = VectorStore.getResultKey(result.metadata);
      const entry = fused.get(key);

      assert.equal(entry.fusedScore, result.score * weight);
      assert.equal(entry.bestRawScore, result.score);
      assert.equal(entry.distance, result.distance);
      assert.equal(entry.document, result.document);
      assert.deepEqual(entry.sources, new Set(['semantic']));
    });

    it('will add multiple distinct results in one call', () => {
      const r1 = makeResult({ metadata: { source_file: '/a.mjs', lineStart: 1, lineEnd: 5 } });
      const r2 = makeResult({ metadata: { source_file: '/b.mjs', lineStart: 1, lineEnd: 5 } });

      VectorStore.addResults([r1, r2], 0.4, 'exact', fused);

      assert.equal(fused.size, 2);
    });

    it('will accumulate fusedScore and merges sources for a duplicate key', () => {
      const result = makeResult({ score: 0.8, distance: 0.2 });
      const weight = 0.4;

      // Seed the map with a first pass
      VectorStore.addResults([result], weight, 'exact', fused);

      // Second pass — same key, different source
      const secondResult = makeResult({ score: 0.6, distance: 0.5 });
      VectorStore.addResults([secondResult], 0.2, 'keyword', fused);

      const key = VectorStore.getResultKey(result.metadata);
      const entry = fused.get(key);

      assert.equal(fused.size, 1, 'should still be one entry');
      assert.equal(entry.fusedScore, 0.8 * 0.4 + 0.6 * 0.2);
      assert.deepEqual(entry.sources, new Set(['exact', 'keyword']));
    });

    it('will update bestRawScore when new score is higher', () => {
      const first  = makeResult({ score: 0.5, distance: 0.5 });
      const second = makeResult({ score: 0.9, distance: 0.5 });

      VectorStore.addResults([first],  0.4, 'semantic', fused);
      VectorStore.addResults([second], 0.4, 'exact',    fused);

      const key = VectorStore.getResultKey(first.metadata);
      assert.equal(fused.get(key).bestRawScore, 0.9);
    });

    it('will not update bestRawScore when new score is lower', () => {
      const first  = makeResult({ score: 0.9, distance: 0.1 });
      const second = makeResult({ score: 0.3, distance: 0.7 });

      VectorStore.addResults([first],  0.4, 'exact',    fused);
      VectorStore.addResults([second], 0.2, 'keyword',  fused);

      const key = VectorStore.getResultKey(first.metadata);
      assert.equal(fused.get(key).bestRawScore, 0.9);
    });

    it('will not update bestRawScore when scores are equal', () => {
      const first  = makeResult({ score: 0.7, distance: 0.3 });
      const second = makeResult({ score: 0.7, distance: 0.3 });

      VectorStore.addResults([first],  0.4, 'semantic', fused);
      VectorStore.addResults([second], 0.4, 'exact',    fused);

      const key = VectorStore.getResultKey(first.metadata);
      assert.equal(fused.get(key).bestRawScore, 0.7);
    });

    it('will update distance when new distance is lower (closer)', () => {
      const first  = makeResult({ score: 0.5, distance: 0.5 });
      const second = makeResult({ score: 0.5, distance: 0.1 });

      VectorStore.addResults([first],  0.4, 'semantic', fused);
      VectorStore.addResults([second], 0.4, 'exact',    fused);

      const key = VectorStore.getResultKey(first.metadata);
      assert.equal(fused.get(key).distance, 0.1);
    });

    it('will not update distance when new distance is higher', () => {
      const first  = makeResult({ score: 0.5, distance: 0.1 });
      const second = makeResult({ score: 0.5, distance: 0.8 });

      VectorStore.addResults([first],  0.4, 'semantic', fused);
      VectorStore.addResults([second], 0.2, 'keyword',  fused);

      const key = VectorStore.getResultKey(first.metadata);
      assert.equal(fused.get(key).distance, 0.1);
    });

    it('will not update distance when distances are equal', () => {
      const first  = makeResult({ score: 0.6, distance: 0.4 });
      const second = makeResult({ score: 0.5, distance: 0.4 });

      VectorStore.addResults([first],  0.4, 'exact',   fused);
      VectorStore.addResults([second], 0.2, 'keyword', fused);

      const key = VectorStore.getResultKey(first.metadata);
      assert.equal(fused.get(key).distance, 0.4);
    });

    it('will return the fused map (for chaining / reference identity)', () => {
      const returned = VectorStore.addResults([], 0.4, 'semantic', fused);
      assert.equal(returned, fused);
    });

    it('will handle an empty results array without error', () => {
      VectorStore.addResults([], 0.4, 'semantic', fused);
      assert.equal(fused.size, 0);
    });

    it('will spread all original result properties onto new entries', () => {
      const result = makeResult({ custom: 'extra-field' });

      VectorStore.addResults([result], 0.4, 'semantic', fused);

      const key = VectorStore.getResultKey(result.metadata);
      const entry = fused.get(key);

      assert.equal(entry.custom, 'extra-field');
      assert.equal(entry.document, result.document);
    });

    it('will handle weight of 0 (score contribution is zero)', () => {
      const result = makeResult({ score: 0.9 });

      VectorStore.addResults([result], 0, 'semantic', fused);

      const key = VectorStore.getResultKey(result.metadata);
      assert.equal(fused.get(key).fusedScore, 0);
    });

    it('will handle weight of 1 (full score contribution)', () => {
      const result = makeResult({ score: 0.6 });

      VectorStore.addResults([result], 1, 'exact', fused);

      const key = VectorStore.getResultKey(result.metadata);
      assert.equal(fused.get(key).fusedScore, 0.6);
    });

    it('will correctly accumulate across three strategies for the same key', () => {
      const base = { metadata: { filePath: '/x.mjs', lineStart: 1, lineEnd: 5 } };

      const exact    = makeResult({ ...base, score: 1.0, distance: 0.0 });
      const semantic = makeResult({ ...base, score: 0.8, distance: 0.2 });
      const keyword  = makeResult({ ...base, score: 0.5, distance: 0.5 });

      VectorStore.addResults([exact],    0.4, 'exact',    fused);
      VectorStore.addResults([semantic], 0.4, 'semantic', fused);
      VectorStore.addResults([keyword],  0.2, 'keyword',  fused);

      assert.equal(fused.size, 1);

      const key = VectorStore.getResultKey(base.metadata);
      const entry = fused.get(key);

      const expectedFused = (1.0 * 0.4) + (0.8 * 0.4) + (0.5 * 0.2);
      assert.equal(entry.fusedScore, expectedFused);
      assert.equal(entry.bestRawScore, 1.0);
      assert.equal(entry.distance, 0.0);
      assert.deepEqual(entry.sources, new Set(['exact', 'semantic', 'keyword']));
    });
  });

  describe('cleanFilters', () => {
    it('will skip null/undefined values and passes through operator objects unchanged', () => {
      const filters = {
        gone:      undefined,
        alsoGone:  null,
        withOp:    { $gte: 10 },
        withoutOp: { foo: 'bar' },
      };

      const cleaned = VectorStore.cleanFilters(filters);

      assert.equal(cleaned.gone, undefined, 'undefined values should be skipped');
      assert.equal(cleaned.alsoGone, undefined, 'null values should be skipped');
      assert.deepStrictEqual(cleaned.withOp, { $gte: 10 },
        'objects with a recognised operator should pass through unchanged');
      assert.deepStrictEqual(cleaned.withoutOp, { $eq: { foo: 'bar' } },
        'objects without a recognised operator should be wrapped in $eq');
    });
  });

  describe('matchesFilters', () => {
    it('search returns results when string filter matches metadata (matchesFilters true)', async () => {
      const results = await underTest.search('config get set', {
        filters: { filePath: 'config/index.js' },
        topK: 5,
      });

      assert.ok(results.results.length > 0);
      for (const r of results.results) {
        assert.ok(r.file.includes('config/index.js'));
      }
    });

    it('will skip null/undefined filter values but rejects missing metadata keys', () => {
      const metadata = { source_file: 'lib/foo.js' };

      const skipsNullish = VectorStore.matchesFilters(metadata, {
        a: undefined,
        b: null,
      });
      assert.equal(skipsNullish, true,
        'filters with only undefined/null values should be skipped (match everything)');

      const rejectsMissing = VectorStore.matchesFilters(metadata, {
        noSuchKey: 'something',
      });
      assert.equal(rejectsMissing, false,
        'should return false when metadata lacks the filtered key');
    });

    it('will reject $eq when metadata value differs', () => {
      const metadata = { language: 'js' };

      assert.equal(
        VectorStore.matchesFilters(metadata, { language: { $eq: 'ts' } }),
        false,
        '$eq should reject when metaValue does not equal the filter value'
      );
    });

    it('will reject $contains when substring is absent', () => {
      const metadata = { source_file: 'lib/chunker.js' };

      assert.equal(
        VectorStore.matchesFilters(metadata, { source_file: { $contains: 'embedder' } }),
        false,
        '$contains should reject when metaValue does not include the substring'
      );
    });

    it('will reject $ne when metadata value equals the filter', () => {
      const metadata = { chunk_type: 'variable' };

      assert.equal(
        VectorStore.matchesFilters(metadata, { chunk_type: { $ne: 'variable' } }),
        false,
        '$ne should reject when metaValue equals the filter value'
      );
    });
  });
});
