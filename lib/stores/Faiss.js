import Store from './Store.js';
import pkg from 'faiss-node';
const { IndexFlatIP } = pkg;

class Faiss extends Store {
  #index;
  #faissFile;
  #metadata = [];

  constructor(config) {
    super();

    this.config = {
      cacheDir: './cache/rag/faiss',
      ...config
    }

    this.#faissFile = `${this.config.cacheDir}/${this.config.collection}.faiss`;
  }

  initialize(Client = IndexFlatIP) {
    this.#index = new Client(this.config.dimensions);
  }

  getAll() {
    return {
      documents: this.#metadata.map(m => m.document),
      metadatas: this.#metadata.map(m => m.metadata)
    }
  }


  /**
  * Insert data.
  *
  * @param  {type} data = {} { embeddings[], documents[], metadatas[] }
  * @return {Promise<void>}
  */
  insert(data = {}) {
    try {
      data.embeddings.forEach((e, i) => {
        this.#index.add(e);
        this.#metadata.push({
          document: data.documents[i],
          metadata: data.metadatas[i]
        });
      });
    } catch(e) {
      console.error(e);
      throw e;
    }

    this.#index.write(this.#faissFile);
  }

  query(query) {
    const nTotal = this.#index.ntotal();
    const total = nTotal<10 ? nTotal : 10;

    let results;
    try {
      results = this.#index.search(query, total);
    } catch(e) {
      console.error(e);
      throw e;
    }

    const documents = results.labels.map((label) => {
      return this.#metadata[label].document
    });
    const metadatas = results.labels.map((label) => {
      return this.#metadata[label].metadata
    });
    const distances = results.labels.map((label, i) => {
      return results.distances[i]
    });

    return {
      documents: [documents],
      metadatas: [metadatas],
      distances: [distances]
    };
  }
}

export default Faiss;
