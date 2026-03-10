class Store {

  /**
   * The collection name.
   * @type {string}
   * @private
   */
  /* eslint-disable-next-line no-unused-private-class-members */
  #collection;


  /**
   * Any async setup.
   *
   * @return {void}
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }


  /**
   * Return all documents.
   *
   * @return {ObjectArray}
   */
  async getAll() {
    throw new Error('getAll() must be implemented by subclass');
  }

  /**
   * Insert embedding.
   *
   * @return {Any}
   */
  /* eslint-disable-next-line no-unused-vars */
  async insert(data) {
    throw new Error('insert() must be implemented by subclass');
  }

  /* eslint-disable-next-line no-unused-vars */
  async query(query, filters = {}) {
    throw new Error('query() must be implemented by subclass');
  }
}

export default Store;
