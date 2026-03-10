/**
 * Base class for all embedders.
 * Defines the interface that all embedding implementations must follow.
 *
 * @abstract
 * @class Embedder
 */
class Embedder {

  /**
   * Initialize the embedder.
   * This should load models, setup connections, etc.
   *
   * @abstract
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If not implemented by subclass
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Generate embedding for a single text.
   *
   * @abstract
   * @async
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} Embedding vector as an array.
   * @throws {Error} If not implemented by subclass
   */
  /* eslint-disable-next-line no-unused-vars */
  async embed(text) {
    throw new Error('embed() must be implemented by subclass');
  }

  /**
   * Generate embeddings for multiple texts in batch.
   * Default implementation calls embed() for each text.
   * Subclasses should override for better performance.
   *
   * @async
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} Array of embedding vectors
   */
  async embedBatch(texts) {
    const embeddings = [];
    for (const text of texts) {
      const embedding = await this.embed(text);
      embeddings.push(embedding);
    }
    return embeddings;
  }

  /**
   * Get the embedding dimensions.
   *
   * @abstract
   * @returns {number} Number of dimensions in embedding vectors
   * @throws {Error} If not implemented by subclass
   */
  getDimensions() {
    throw new Error('getDimensions() must be implemented by subclass');
  }

  /**
   * Get the model name or identifier.
   *
   * @abstract
   * @returns {string} Model identifier
   * @throws {Error} If not implemented by subclass
   */
  getModelName() {
    throw new Error('getModelName() must be implemented by subclass');
  }
}

export default Embedder;
