import Store from './Store.js';
import { ChromaClient } from 'chromadb';

class Chroma extends Store {
  /* eslint-disable-next-line no-unused-private-class-members */
  #client;
  #collection;

  constructor(config) {
    super();

    const chromaOpts = {
      ssl: false,
      host: "localhost",
      port: 8000,
      ...config.storeOptions
    }

    this.config = {
      drop: true,
      name: config.collection || 'rag-codebase-indexer',
      ...config,
      chromaOpts
    }
  }

  async initialize(Client = ChromaClient) {
    const { name, dimensions } = this.config;
    const client = new Client(this.config.chromaOpts);

    if (this.config.drop) {
      try {
        await client.deleteCollection({ name });
      } catch(err) {
        if (err.name != 'ChromaNotFoundError') {
          throw err;
        }
      }
    }

    this.#collection = await client.createCollection({ name, dimensions });

    this.#client = client;
  }

  async getAll() {
    return await this.#collection.get({});
  }

  async insert(data = []) {
    await this.#collection.add(data);
  }

  async query(query, filters = {}) {
    const queryParams = {
      queryEmbeddings: [query],
      nResults: 50,
      include: ['documents', 'metadatas', 'distances'],
    };

    if (Object.keys(filters).length > 0) {
      const cleaned = this.cleanFilters(filters);
      if (Object.keys(cleaned).length > 0) {
        queryParams.where = cleaned;
      }
    }

    return this.#collection.query(queryParams);
  }

  /**
   * Clean and format filters for ChromaDB where-clause syntax.
   *
   * @param {Object} filters
   * @returns {Object}
   */
  cleanFilters(filters) {
    const cleaned = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        cleaned[key] = { $eq: value };
      } else if (typeof value === 'object') {
        const hasOperator =
          value.$eq || value.$contains || value.$ne ||
          value.$gt || value.$gte || value.$lt || value.$lte;
        cleaned[key] = hasOperator ? value : { $eq: value };
      }
    }

    return cleaned;
  }

}

export default Chroma;
