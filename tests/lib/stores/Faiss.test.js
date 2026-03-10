import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'assert';
import faiss from '../../../lib/stores/Faiss.js';

const mockAdd = mock.fn();
const mockConstructor = mock.fn();
let mockNtotal = mock.fn(() => 12);
let mockSearch = mock.fn(() => ({
  distances: [
    0.7204013466835022,
    0.6725705862045288,
    0.4816877245903015
  ],
  labels: [0, 1, 2]
}));
const mockWrite = mock.fn();
class MockIndexFlatIP{
  constructor() {
    mockConstructor(...arguments);
  }

  add = mockAdd;
  ntotal = mockNtotal;
  search = mockSearch;
  write = mockWrite;
}

describe('FAISS', () => {
  const configFixture = {
    cacheDir: 'test/dir',
    collection: 'test-collection',
    dimensions: 8
  };
  const dataFixture = {
    documents: ['one', 'two', 'three'],
    metadatas: [{a:1}, {b:2}, {c:3}],
    embeddings: [1, 2, 3]
  };
  let underTest;

  beforeEach(() => {
    underTest = new faiss(configFixture);
    underTest.initialize(MockIndexFlatIP);
  });

  afterEach(() => {
    mockAdd.mock.resetCalls();
    mockConstructor.mock.resetCalls();
    mockNtotal.mock.resetCalls();
    mockSearch.mock.resetCalls();
    mockWrite.mock.resetCalls();
    mock.restoreAll();
  });

  describe('constructor()', () => {
    it('will construct', () => {
      assert.deepStrictEqual(underTest.config, configFixture)
    });
  });

  describe('initialize()', () => {
    it('will initialize', () => {
      assert.strictEqual(mockConstructor.mock.calls[0].arguments[0], 8);
    });
  });

  describe('getAll()', () => {
    it('will return empty documents and metadatas', () => {
      const actual = underTest.getAll();

      assert.deepStrictEqual(actual, {
        documents: [],
        metadatas: []
      });
    });
  });

  describe('insert()', () => {
    it('will insert documents and metadatas', () => {
      underTest.insert(dataFixture);

      const actual = underTest.getAll();
      assert.deepStrictEqual(actual, {
        documents: [ 'one', 'two', 'three' ],
        metadatas: [ { a: 1 }, { b: 2 }, { c: 3 } ]
      });
      assert.strictEqual(mockWrite.mock.calls[0].arguments[0], 'test/dir/test-collection.faiss');
    });

    it('will log error and throw', () => {
        const errorMock = mock.fn();
        const originalError = console.error;
        console.error = errorMock;

        mockAdd.mock.mockImplementation(() => { throw new Error('foobar'); });

        try {
            assert.throws(() => underTest.insert(dataFixture), { message: 'foobar' });
            assert.strictEqual(mockAdd.mock.calls.length, 1);
        } finally {
            console.error = originalError;
        }
    });
  });

  describe('query()', () => {
    it('will return 10 results max', () => {
      underTest.insert(dataFixture);
      const actual = underTest.query('foobar');
      const expected = {
        documents: [ [ 'one', 'two', 'three' ] ],
        metadatas: [ [ {a:1}, {b:2}, {c:3} ] ],
        distances: [ [ 0.7204013466835022, 0.6725705862045288, 0.4816877245903015 ] ]
      }

      assert.deepStrictEqual(mockSearch.mock.calls[0].arguments, ['foobar', 10]);
      assert.deepStrictEqual(actual, expected);
    });

    it('will return less than 10', () => {
      mockNtotal.mock.mockImplementation(() => 3);
      underTest.insert(dataFixture);
      const actual = underTest.query('foobar');
      const expected = {
        documents: [ [ 'one', 'two', 'three' ] ],
        metadatas: [ [ {a:1}, {b:2}, {c:3} ] ],
        distances: [ [ 0.7204013466835022, 0.6725705862045288, 0.4816877245903015 ] ]
      }

      assert.deepStrictEqual(mockSearch.mock.calls[0].arguments, ['foobar', 3]);
      assert.deepStrictEqual(actual, expected);
    });

    it('will log error and throw', () => {
        const errorMock = mock.fn();
        const originalError = console.error;
        console.error = errorMock;

        mockSearch.mock.mockImplementation(() => { throw new Error('foobar'); });

        try {
            assert.throws(() => underTest.query('foobar'), { message: 'foobar' });
            assert.strictEqual(errorMock.mock.calls.length, 1);
        } finally {
            console.error = originalError;
        }
    });
  });
});
