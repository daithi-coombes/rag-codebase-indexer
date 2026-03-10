import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import Embedder from '../../../lib/embedders/Embedder.js';

/**
 * Creates a mock pipeline function that returns a fake Tensor.
 *
 * @param {Object}  [opts]
 * @param {number}  [opts.dims=384]         - Last dimension (embedding size).
 * @param {number[][]} [opts.vectors]       - Explicit vectors to return from tolist().
 * @returns {Function} Mock pipeline callable.
 */
function createMockPipe(opts = {}) {
  const dims = opts.dims ?? 384;
  const vector = opts.vectors?.[0] ?? Array.from({ length: dims }, (_, i) => i * 0.01);

  const mockPipe = mock.fn(() => {
    return {
      dims: [1, dims],
      tolist: () => [vector],
    };
  });

  return mockPipe;
}


describe('Transformers', () => {
  let Transformers;

  beforeEach(async () => {
    // Dynamic import so the module-level `env.allowLocalModels = false`
    ({ default: Transformers } = await import('../../../lib/embedders/Transformers.js'));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('constructor()', () => {
    it('will extend Embedder', () => {
      const underTest = new Transformers();

      assert.ok(underTest instanceof Embedder);
    });

    it('will apply default config values', () => {
      const underTest = new Transformers();

      assert.equal(underTest.config.ID, 'feature-extraction');
      assert.equal(underTest.config.model, 'nomic-embed-text');
      assert.deepEqual(underTest.config.pipeOpts, { pooling: 'mean', normalize: true });
      assert.equal(underTest.config.options, undefined);
    });

    it('will merge user config over defaults', () => {
      const underTest = new Transformers({
        model: 'Xenova/all-MiniLM-L6-v2',
        options: { dtype: 'fp32' },
        pipeOpts: { pooling: 'cls', normalize: false },
      });

      assert.equal(underTest.config.model, 'Xenova/all-MiniLM-L6-v2');
      assert.deepEqual(underTest.config.options, { dtype: 'fp32' });
      assert.deepEqual(underTest.config.pipeOpts, { pooling: 'cls', normalize: false });
      assert.equal(underTest.config.ID, 'feature-extraction');
    });

    it('will allow overriding the pipeline task ID', () => {
      const underTest = new Transformers({ ID: 'text-classification' });

      assert.equal(underTest.config.ID, 'text-classification');
    });

    it('will set dimensions to undefined before initialize', () => {
      const underTest = new Transformers();

      assert.equal(underTest.dimensions, undefined);
    });
  });

  describe('initialize()', () => {
    it('will create pipeline and detect dimensions', async () => {
      const mockPipeline = mock.fn(() => createMockPipe({ dims: 384 }));
      const underTest = new Transformers({
        model: 'Xenova/all-MiniLM-L6-v2',
        options: { dtype: 'fp32' },
      });

      await underTest.initialize(mockPipeline);

      assert.equal(underTest.dimensions, 384);
      assert.equal(mockPipeline.mock.calls.length, 1);
      assert.deepEqual(mockPipeline.mock.calls[0].arguments, [
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { dtype: 'fp32' },
      ]);
    });

    it('will default options to { dtype: "fp32" } when not provided', async () => {
      const mockPipeline = mock.fn(() => createMockPipe({ dims: 384 }));
      const underTest = new Transformers({ model: 'test-model' });

      await underTest.initialize(mockPipeline);

      assert.deepEqual(mockPipeline.mock.calls[0].arguments[2], { dtype: 'fp32' });
    });

    it('will use options when provided', async () => {
      const mockPipeline = mock.fn(() => createMockPipe({ dims: 384 }));
      const underTest = new Transformers({
        model: 'test-model',
        options: { device: 'webgpu', dtype: 'fp16' },
      });

      await underTest.initialize(mockPipeline);

      assert.deepEqual(mockPipeline.mock.calls[0].arguments[2], {
        device: 'webgpu',
        dtype: 'fp16',
      });
    });

    it('will assign the pipe returned by the pipeline factory', async () => {
      const fakePipe = createMockPipe({ dims: 256 });
      const mockPipeline = mock.fn(() => fakePipe);
      const underTest = new Transformers();

      await underTest.initialize(mockPipeline);

      assert.equal(underTest.pipe, fakePipe);
      assert.equal(underTest.dimensions, 256);
    });
  });

  describe('embed()', () => {
    it('will return a plain array embedding', async () => {
      const expectedVector = [0.1, 0.2, 0.3];
      const underTest = new Transformers();
      underTest.pipe = createMockPipe({ dims: 3, vectors: [expectedVector] });

      const actual = await underTest.embed('hello world');

      assert.deepEqual(actual, expectedVector);
    });

    it('will forward pipeOpts to the pipeline call', async () => {
      const pipeOpts = { pooling: 'cls', normalize: false };
      const underTest = new Transformers({ pipeOpts });
      underTest.pipe = createMockPipe({ dims: 3 });

      await underTest.embed('test prompt');

      const call = underTest.pipe.mock.calls[0];
      assert.equal(call.arguments[0], 'test prompt');
      assert.deepEqual(call.arguments[1], pipeOpts);
    });

    it('will use default pipeOpts when none provided', async () => {
      const underTest = new Transformers();
      underTest.pipe = createMockPipe({ dims: 3 });

      await underTest.embed('test');

      const call = underTest.pipe.mock.calls[0];
      assert.deepEqual(call.arguments[1], { pooling: 'mean', normalize: true });
    });

    it('will unwrap the batch dimension from tolist()', async () => {
      const vector = [0.5, -0.5];
      const underTest = new Transformers();
      underTest.pipe = mock.fn(() => ({
        dims: [1, 2],
        tolist: () => [vector],
      }));

      const actual = await underTest.embed('test');

      assert.ok(!Array.isArray(actual[0]));
      assert.deepEqual(actual, vector);
    });
  });

  describe('getDimensions()', () => {
    it('will detect dimensions from tensor shape', async () => {
      const underTest = new Transformers();
      underTest.pipe = createMockPipe({ dims: 768 });

      const actual = await underTest.getDimensions();

      assert.equal(actual, 768);
      assert.equal(underTest.dimensions, 768);
    });

    it('will use the last dimension from dims array', async () => {
      const underTest = new Transformers();
      underTest.pipe = mock.fn(() => ({
        dims: [1, 512],
        tolist: () => [Array(512).fill(0)],
      }));

      const actual = await underTest.getDimensions();

      assert.equal(actual, 512);
    });

    it('will call pipe with probe text', async () => {
      const underTest = new Transformers();
      underTest.pipe = createMockPipe({ dims: 384 });

      await underTest.getDimensions();

      assert.equal(underTest.pipe.mock.calls[0].arguments[0], 'test text');
    });

    it('will cache dimensions on the instance', async () => {
      const underTest = new Transformers();
      underTest.pipe = createMockPipe({ dims: 256 });

      await underTest.getDimensions();
      assert.equal(underTest.dimensions, 256);

      underTest.pipe = createMockPipe({ dims: 999 });
      assert.equal(underTest.dimensions, 256);
    });
  });

  describe('getModelName()', () => {
    it('will return the configured model name', async () => {
      const underTest = new Transformers({
        model: 'Xenova/all-MiniLM-L6-v2',
      });

      const actual = await underTest.getModelName();

      assert.equal(actual, 'Xenova/all-MiniLM-L6-v2');
    });

    it('will return the default model name', async () => {
      const underTest = new Transformers();

      const actual = await underTest.getModelName();

      assert.equal(actual, 'nomic-embed-text');
    });
  });
});
