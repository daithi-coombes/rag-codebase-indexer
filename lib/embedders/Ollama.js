import { Ollama as OllamaClient } from 'ollama';
import Embedder from './Embedder.js';
import Logger from '../../config/Logger.js';

/**
 * Ollama-based embedder for local embedding generation using the official ollama-js library.
 * Requires Ollama service running locally or on a remote host.
 *
 * Recommended models:
 * - nomic-embed-text (768 dimensions) - Best for general use
 * - mxbai-embed-large (1024 dimensions) - Higher quality
 * - all-minilm (384 dimensions) - Faster, smaller
 *
 * @class Ollama
 * @extends {Embedder}
 * @see https://ollama.com/library for available models
 * @see https://github.com/ollama/ollama-js for library documentation
 */
class Ollama extends Embedder{
  /**
   * Creates an instance of Ollama embedder.
   *
   * @param {Object} config - Configuration options
   * @param {string} [config.model='nomic-embed-text'] - Ollama model name
   * @param {string} [config.host='http://localhost:11434'] - Ollama server URL
   * @param {number} [config.timeout=30000] - Request timeout in milliseconds
   * @param {number} [config.dimensions] - Embedding dimensions (auto-detected if not set)
   * @param {string} [config.keepAlive='5m'] - How long to keep model loaded (e.g., '5m', '1h')
   * @param {Object} [config.options] - Additional Ollama options (temperature, etc.)
   * @param {Object} [config.headers] - Custom headers to include with every request
   */
  constructor(config = {}, Log = Logger) {
    super();

    this.config = {
      model: 'nomic-embed-text',
      host: 'http://localhost:11434',
      dimensions: null,
      keepAlive: '5m',
      options: {},
      headers: {},
      ...config
    };

    this.isInitialized = false;
    this.modelName = this.config.model;
    this.dimensions = this.config.dimensions;
    this.log = new Log();

    const clientOpts = {
      host: this.config.host,
      headers: this.config.headers
    };
    if (config.timeout) {
      const config = this.config;
      clientOpts.fetch = async function userDefinedFetch(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        try {
          return await fetch(url, {
            ...options,
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }
      };
    }

    this.client = new OllamaClient(clientOpts);
  }

  /**
   * Initialize the Ollama embedder.
   * Verifies connection and auto-detects embedding dimensions.
   *
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If Ollama is not running or model is not available
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.loadModel();
      await this.getDimensions();

      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize Ollama embedder: ${error.message}`);
    }
  }

  /**
   * Ensure the embedding model is available.
   * Throws if model is not found.
   *
   * @async
   * @private
   * @returns {Promise<boolean>}
   * @throws {Error} If model is not available
   */
  async loadModel(model='') {
    if (model==='') model = this.config.model;

    try {
      const { models } = await this.client.list();

      const modelExists = models?.some(m =>
        m.name === model ||
        m.name.startsWith(model + ':')
      );

      if (!modelExists) {
        this.log.warn(`Model '${model}' not found. Please fix config or run initialize()`);
        return false
      }
    } catch (error) {
      throw new Error(`Failed to check model availability for: ${error.message}`);
    }

    return true;
  }

  /**
   * Generate embedding for a single text.
   *
   * @async
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} Embedding vector
   * @throws {Error} If not initialized or embedding fails
   */
  async embed(prompt) {
    if (!this.isInitialized && prompt !== 'test') {
      throw new Error('Ollama not initialized. Call initialize() first.');
    }

    try {
      const response = await this.client.embed({
        model: this.config.model,
        input: prompt,
        keep_alive: this.config.keepAlive,
        options: this.config.options
      });

      if (!response.embeddings || !Array.isArray(response.embeddings) || response.embeddings.length === 0) {
        throw new Error('Invalid response: missing embeddings array');
      }
      const embedding = response.embeddings[0];

      return embedding;
    } catch (error) {
      throw new Error(`Embedding failed: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch.
   * The official ollama-js library supports native batching.
   *
   * @async
   * @uses this.embed
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} Array of embedding vectors
   * @throws {Error} If not initialized or embedding fails
   */
  async embedBatch(texts) {
    return this.embed(texts);
  }

  /**
   * Get the embedding dimensions.
   *
   * @returns {number} Number of dimensions in embedding vectors
   * @throws {Error} If dimensions not yet detected (call initialize() first)
   */
  async getDimensions() {
    if (!this.dimensions) {
      const testEmbedding = await this.embed('test');
      this.dimensions = testEmbedding.length;
    }
    return this.dimensions;
  }

  /**
   * Get the model name.
   *
   * @returns {string} Model identifier
   */
  getModelName() {
    return this.config.model;
  }

  /**
   * Get list of available models from Ollama.
   *
   * @async
   * @returns {Promise<Object[]>} Array of model information
   * @throws {Error} If cannot fetch models
   */
  async listModels() {
    try {
      const { models } = await this.client.list();
      return models;
    } catch (error) {
      throw new Error(`Failed to list Ollama models: ${error.message}`);
    }
  }

  /**
   * Pull a model from Ollama library.
   * Note: This can take a while for large models.
   *
   * @async
   * @param {string} [modelName] - Model to pull (uses config.model if not provided)
   * @param {Function} [progressCallback] - Optional callback for progress updates
   * @returns {Promise<void>}
   * @throws {Error} If pull fails
   */
  async pullModel(modelName, progressCallback) {
    const model = modelName || this.config.model;

    try {
      const stream = await this.client.pull({
        model,
        stream: true
      });

      for await (const progress of stream) {
        if (progressCallback) {
          progressCallback(progress);
        }
      }
    } catch (err) {
      throw new Error(`Failed to pull model '${model}': ${err.message}`);
    }
  }

  /**
   * Unload the model from memory.
   *
   * @async
   * @returns {Promise<void>}
   */
  async unloadModel() {
    try {
      // Send a request with keep_alive=0 to unload immediately
      await this.client.embed({
        model: this.config.model,
        input: '',
        keep_alive: 0
      });
    } catch (err) {
      this.log.error(`Unable to unload model '${this.config.model}': ${err.message}`, err);
    }
  }

  /**
   * Cleanup resources.
   * Unloads the model from memory.
   *
   * @async
   * @returns {Promise<void>}
   */
  async cleanup() {
    await this.unloadModel();
    this.isInitialized = false;
  }
}

export default Ollama;
