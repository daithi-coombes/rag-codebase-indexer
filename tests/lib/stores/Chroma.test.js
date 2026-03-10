import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import Chroma from '../../../lib/stores/Chroma.js';
import assert from 'assert';

const mockCollectionAdd = mock.fn();
const mockCollectionGet = mock.fn();
const mockCollectionQuery = mock.fn();
const mockCollection = {
  add: mockCollectionAdd,
  get: mockCollectionGet,
  query: mockCollectionQuery
};

const mockConstructor = mock.fn();
const mockCreateCollection = mock.fn(() => mockCollection);
const mockDeleteCollection = mock.fn();
const mockGetAll = mock.fn();
class MockClient {
  constructor() {
    mockConstructor(...arguments);
  }
  createCollection = mockCreateCollection;
  deleteCollection = mockDeleteCollection;
  get = mockGetAll;
}

describe('Chroma', () => {
  let underTest;

  beforeEach(async () => {
    underTest = new Chroma({
      dimensions: 385,
      drop: true,
      name: 'test-collection',
      storeOptions: {
        ssl: false,
        host: "localhost",
        port: 9000,
        headers: {
          'test-api-key': '123-foobar'
        }
      }
    });

    await underTest.initialize(MockClient);
  });

  afterEach(() => {
    mock.restoreAll();
    mockCollectionAdd.mock.resetCalls();
    mockCollectionGet.mock.resetCalls();
    mockCollectionQuery.mock.resetCalls();
    mockConstructor.mock.resetCalls();
    mockCreateCollection.mock.resetCalls();
    mockDeleteCollection.mock.resetCalls();
    mockGetAll.mock.resetCalls();
  });

  describe('constructor()', () => {
    it('will construct', () => {
      assert.strictEqual(underTest.constructor.name, 'Chroma');
    });
  });

  describe('initialize()', () => {
    it('will initialize with config', async () => {

      assert.deepStrictEqual(mockDeleteCollection.mock.calls[0].arguments[0], { name: 'test-collection' });
      assert.deepStrictEqual(mockCreateCollection.mock.calls[0].arguments, [{
        name: 'test-collection',
        dimensions: 385
      }]);
      assert.deepStrictEqual(mockConstructor.mock.calls[0].arguments, [{
        ssl: false,
        host: 'localhost',
        port: 9000,
        headers: { 'test-api-key': '123-foobar' }
      }]);
    });

    it('will throw if chroma error is not ChromaNotFoundError', async () => {

      const mockDeleteCollection = mock.fn(() => { throw new Error('foobar') });
      class MockClient{
        deleteCollection = mockDeleteCollection;
      }

      await assert.rejects(
        () => underTest.initialize(MockClient),
        err => {
          assert.strictEqual(err.message, 'foobar');
          return true;
        }
      );
    });
  });

  describe('getAll()', () => {
    it('will return all', async () => {
      await underTest.getAll();

      assert.deepStrictEqual(mockCollectionGet.mock.calls[0].arguments[0], {});
    });
  });

  describe('insert()', () => {
    it('will insert data', async () => {
      await underTest.insert({foo: 'bar'});

      assert.deepStrictEqual(mockCollectionAdd.mock.calls[0].arguments[0], {foo: 'bar'});
    });
  });

  describe('query()', () => {
    it('will query without filters', async () => {
      await underTest.query({foo: 'bar'});

      assert.deepStrictEqual(mockCollectionQuery.mock.calls[0].arguments[0], {
        queryEmbeddings: [ { foo: 'bar' } ],
        nResults: 50,
        include: [ 'documents', 'metadatas', 'distances' ]
      });
    });

    it('will query with filters', async () => {
      await underTest.query({foo: 'bar'}, {filename: 'baz'});

      assert.deepStrictEqual(mockCollectionQuery.mock.calls[0].arguments[0], {
        queryEmbeddings: [ { foo: 'bar' } ],
        nResults: 50,
        include: [ 'documents', 'metadatas', 'distances' ],
        where: { filename: { '$eq': 'baz' } }
      });
    });
  });

  describe('cleanFilters()', () => {
    it('handles a mix of types, nulls, and operators in one call', () => {
      const result = underTest.cleanFilters({
        skip1: null,
        skip2: undefined,
        name: 'bob',
        count: 42,
        flag: false,
        range: { $gte: 1 },
        plain: { nested: true },
      });

      assert.deepStrictEqual(result, {
        name: { $eq: 'bob' },
        count: { $eq: 42 },
        flag: { $eq: false },
        range: { $gte: 1 },
        plain: { $eq: { nested: true } },
      });
    });
  });
});
