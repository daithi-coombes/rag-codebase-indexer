import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { Readable } from 'node:stream';
import Ollama from '../../../lib/embedders/Ollama.js';
import assert from 'node:assert';
import nock from 'nock';

const baseHost = 'http://localhost:11434';
const defaultModel = 'foobar';
const optionsFixture = {
  model: defaultModel,
  host: baseHost,
  timeout: 60000,
  keepAlive: '5m',
  headers: {
    'Authorization': `Bearer ${process.env.OLLAMA_API_KEY}`
  },
  options: {
    dimensions: 768
  }
}
const mockTagsResponse = {
  models: [{ name: defaultModel }]
};
const mockEmbedResponse = {
  embeddings: [[0.0086846575, 0.016799968, -0.14702265, -0.082375556]]
};
const autoDetectBody = {
  model: defaultModel,
  input: 'test',
  keep_alive: '5m',
  options: { dimensions: 768 }
};
const actualEmbedBody = {
  model: defaultModel,
  input: 'the test text to embed',
  keep_alive: '5m',
  options: { dimensions: 768 }
};

describe('Ollama', () => {
  let underTest;
  const originalApiKey = process.env.OLLAMA_API_KEY;

  beforeEach(() => {
    underTest = new Ollama(optionsFixture);

    nock.restore();
    nock.activate();
    nock.enableNetConnect();
  });

  afterEach(() => {
    process.env.OLLAMA_API_KEY = originalApiKey;

    nock.cleanAll();
    nock.restore();
  });

  describe('constructor()', () => {
    it('will construct with auth header and bespoke fetch for timeout', () => {
      process.env.OLLAMA_API_KEY = 'test-key-123';
      optionsFixture.headers.Authorization =`Bearer ${process.env.OLLAMA_API_KEY}`;


      assert.strictEqual(underTest.config.host, baseHost);
      assert.deepStrictEqual(underTest.config.headers, {
        'Authorization': 'Bearer test-key-123'
      });
    });
  });

  describe('initialize()', () => {
    it('will initialize', async () => {
      underTest.getDimensions = mock.fn();

      await underTest.initialize();

      assert.strictEqual(underTest.getDimensions.mock.calls.length, 1);
    });

    it('will return if already initialized', async () => {
      underTest.getDimensions = mock.fn();

      await underTest.initialize();
      const actual = await underTest.initialize();

      assert.strictEqual(actual, undefined);
    });

    it('will throw if error with custom message', async () => {

      await assert.rejects(
        () => underTest.initialize(),
        err => {
          assert.strictEqual(err.message, 'Failed to initialize Ollama embedder: Embedding failed: model "foobar" not found, try pulling it first');
          return true;
        }
      );
    });
  });

  describe('loadModel()', () => {
    it('will throw if Ollama errors', async () => {
      underTest.client.list = () => { throw new Error('foo'); }

      assert.rejects(
        () => underTest.loadModel(),
        err => {
          assert.strictEqual(err.message, 'Failed to check model availability for: foo');
          return true;
        }
      )
    });
  });

  describe('embed()', () => {
    it('will embed', async () => {

      nock(baseHost)
        .get('/api/tags')
        .reply(200, mockTagsResponse)
        .post('/api/embed', autoDetectBody)
        .reply(200, { embeddings: [[0.1, 0.2, 0.3, 0.4]] })
        .post('/api/embed', actualEmbedBody)
        .reply(200, mockEmbedResponse);


      await underTest.initialize();
      const actual = await underTest.embed('the test text to embed');

      assert.deepStrictEqual(actual, mockEmbedResponse.embeddings[0]);
    });

    it('will throw if not initialized', async () => {

      await assert.rejects(
        () => underTest.embed(defaultModel),
        err => {
          assert.strictEqual(err.message, 'Ollama not initialized. Call initialize() first.');
          return true;
        }
      );
    });

    it('will throw if invalid response from Ollama', async () => {
      nock(baseHost)
        .get('/api/tags')
        .reply(200, mockTagsResponse)
        .post('/api/embed', autoDetectBody)
        .reply(200, { embeddings: [[0.1, 0.2, 0.3]] })
        .post('/api/embed', actualEmbedBody)
        .reply(200, [{bar: 'biz'}]);

      await underTest.initialize();

      await assert.rejects(
        () => underTest.embed('the test text to embed'),
        err => {
          assert.strictEqual(err.message, 'Embedding failed: Invalid response: missing embeddings array');
          return true;
        }
      );
    });
  });

  describe('embedBatch()', () => {
    it('will call embed()', () => {
      underTest.embed = mock.fn();

      underTest.embedBatch(defaultModel);

      assert.strictEqual(underTest.embed.mock.calls.length, 1);
    });
  });

  describe('getDimensions()', () => {
    it('will get the dimensions', async () => {
      nock(baseHost)
        .get('/api/tags')
        .reply(200, mockTagsResponse)
        .post('/api/embed', autoDetectBody)
        .reply(200, { embeddings: [[0.1, 0.2, 0.3]] })

      await underTest.initialize();
      const actual = await underTest.getDimensions('test');

      assert.strictEqual(actual, 3);
    });
  });

  describe('getModel()', () => {
    it('will get the model name', () => {
      const actual = underTest.getModelName();

      assert.strictEqual(actual, underTest.config.model);
    });
  });

  describe('listModels()', () => {
    it('will list models', async () => {
      nock(baseHost)
        .get('/api/tags')
        .reply(200, mockTagsResponse)

        const actual = await underTest.listModels();
        const expected = [{ name: defaultModel }];

        assert.deepStrictEqual(actual, expected);
    });

    it('will catch and throw errors', async () => {
      nock(baseHost)
        .get('/api/tags')
        .reply(500);


        await assert.rejects(
          () => underTest.listModels(),
          err => {
            assert.strictEqual(err.message, 'Failed to list Ollama models: Error 500: Internal Server Error');
            return true;
          }
        );
    });
  });

  describe('pullModel()', () => {
    it('will pull a model without stream callback', async () => {
      const mockStream = Readable.from([
        '{"status":"pulling manifest"}\n',
        '{"status":"downloading","digest":"sha256:abc","total":100,"completed":50}\n',
        '{"status":"success"}\n'
      ]);

      const scope = nock(baseHost)
        .post('/api/pull', { name: defaultModel, stream: true })
        .reply(200, mockStream, { 'Content-Type': 'application/x-ndjson' });

      await underTest.pullModel();

      assert.ok(scope.isDone());
    });

    it('will pull a model with stream callback', async () => {
      const progressEvents = [
        { status: 'pulling manifest' },
        { status: 'downloading', digest: 'sha256:abc', total: 100, completed: 50 },
        { status: 'success' }
      ];

      const mockStream = Readable.from(
        progressEvents.map(e => JSON.stringify(e) + '\n')
      );

      nock(baseHost)
        .post('/api/pull', { name: defaultModel, stream: true })
        .reply(200, mockStream, { 'Content-Type': 'application/x-ndjson' });

      const callback = mock.fn();

      await underTest.pullModel(undefined, callback);

      assert.strictEqual(callback.mock.callCount(), progressEvents.length);
      progressEvents.forEach((event, index) => {
        assert.deepStrictEqual(callback.mock.calls[index].arguments[0], event);
      });
    });

    it('will throw error if pull fails', async () => {
      nock(baseHost)
        .post('/api/pull', { name: defaultModel, stream: true })
        .reply(500, { error: 'Internal server error' });


      await assert.rejects(
        async () => await underTest.pullModel(),
        (err) => {
          assert.match(err.message, /Failed to pull model 'foobar'/);
          return true;
        }
      );
    });
  });

  describe('unloadModel()', () => {
    it('will unload a model', async () => {
      nock(baseHost)
        .post('/api/embed', { model: defaultModel, input: '', keep_alive: 0 })
        .reply(200, {});

      await underTest.unloadModel();
    });

    it('will throw an error', async () => {
      nock(baseHost)
        .post('/api/embed', { model: defaultModel, input: '', keep_alive: 0 })
        .reply(500, {});

      underTest.log = {
        error: mock.fn()
      };

      await underTest.unloadModel();

      assert.strictEqual(underTest.log.error.mock.calls.length, 1);
      assert.strictEqual(underTest.log.error.mock.calls[0].arguments[0], 'Unable to unload model \'foobar\': Error 500: Internal Server Error');
    });
  });

  describe('cleanup()', () => {
    it('will cleanup', async () => {
      underTest.isInitialized = true;
      underTest.unloadModel = mock.fn();

      await underTest.cleanup();

      assert.strictEqual(underTest.unloadModel.mock.calls.length, 1);
      assert.strictEqual(underTest.isInitialized, false);
    });
  });
});
