import { pipeline } from '@huggingface/transformers';
import Embedder from './Embedder.js';


/**
 * Transformer-based embedder using Hugging Face transformers.js
 * Supports various sentence-transformer models from Hugging Face Hub.
 *
 * Uses the `feature-extraction` pipeline from `@huggingface/transformers` (v3+)
 * to generate embeddings. Output is device-agnostic — works with WASM (CPU)
 * and WebGPU backends via the `Tensor.tolist()` API.
 *
 * @class Transformers
 * @extends {Embedder}
 *
 * @example
 * const embedder = new Transformers({
 *   model: 'Xenova/all-MiniLM-L6-v2',
 *   options: { dtype: 'fp32' },
 * });
 * await embedder.initialize();
 * const vector = await embedder.embed('hello world');
 */
class Transformers extends Embedder {

  /** @type {number|undefined} Embedding vector dimensions, set after initialize(). */
  dimensions;

  /**
   * Create a Transformers embedder instance.
   *
   * @param {Object}  [config={}]
   * @param {string}  [config.ID='feature-extraction']   - HuggingFace pipeline task identifier.
   * @param {string}  [config.model='nomic-embed-text']   - Model name or HuggingFace Hub path
   *                                                        (e.g. `'Xenova/all-MiniLM-L6-v2'`).
   * @param {Object}  [config.options]                  - Options forwarded to the HuggingFace
   *                                                        `pipeline()` factory (e.g. `{ dtype: 'fp32' }`,
   *                                                        `{ device: 'webgpu' }`).
   * @param {Object}  [config.pipeOpts]                   - Options forwarded to each pipeline call
   *                                                        (e.g. `{ pooling: 'mean', normalize: true }`).
   */
  constructor(config = {}) {
    super();

    this.config = {
      ID: 'feature-extraction',
      model: 'nomic-embed-text',
      pipeOpts: { pooling: 'mean', normalize: true },
      ...config
    };
  }

  /**
   * Load the HuggingFace pipeline and detect embedding dimensions.
   *
   * Must be called before `embed()` or `getDimensions()`.
   *
   * @param {Object}  [Pipeline] - Inject custom pipeline.
   *
   * @async
   * @returns {Promise<void>}
   */
   async initialize(Pipeline = null) {
       const options = {
           dtype: 'fp32',
           ...this.config.options,
       };

       /* c8 ignore next */
       const _pipeline = Pipeline || pipeline;
       this.pipe = await _pipeline(
           this.config.ID,
           this.config.model,
           options,
       );

       await this.getDimensions();
   }

  /**
   * Generate an embedding vector for a single text prompt.
   *
   * @async
   * @param {string} prompt - The text to embed.
   * @returns {Promise<number[]>} Embedding vector.
   */
  async embed(prompt) {
    const output = await this.pipe(prompt, this.config.pipeOpts);
    const [embedding] = output.tolist();

    return embedding;
  }

  /**
   * Detect and cache the embedding dimensions by running a probe embedding.
   *
   * @async
   * @returns {Promise<number>} The number of dimensions in the embedding vector.
   */
  async getDimensions() {
    const output = await this.pipe('test text');

    this.dimensions = output.dims.at(-1);
    return this.dimensions;
  }

  /**
   * Get the model name or HuggingFace Hub identifier.
   *
   * @async
   * @returns {Promise<string>} The model identifier string.
   */
  async getModelName() {
    return this.config.model;
  }
}

export default Transformers;
