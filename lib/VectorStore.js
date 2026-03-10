import { EventEmitter } from 'node:events';
import StoreLoader from './stores/index.js';
import defaultConfig from '../config/index.js';
import embedderLoader from './embedders/index.js';
import fs from 'fs/promises';

/**
 * @typedef {Object} IngestResult
 * @property {string} collection - The collection name.
 * @property {number} inserted - Total documents inserted.
 * @property {number} rate - Documents per second.
 * @property {string} totalTime - Total time in seconds.
 */

/**
 * @typedef {Object} Result
 * @property {string} code - Blob of the underlying code.
 * @property {string} file - The related filename.
 * @property {string} type - Code identifier type.
 * @property {number} lineStart - File line code block starts.
 * @property {number} lineEnd - File line code block ends.
 * @property {string} className - The classname if relevant.
 * @property {string} functionName - The function name if relevant.
 * @property {number} relevance - The fused score (0 - 1)
 * @property {Set<string>} sources - 'exact', 'semantic' and 'keyword' matches count.
 * @property {metadata} metadata - The full raw metadata.
 */

 /**
  * @typedef {Object} SearchResult
  * @property {Array[Result]} results - An object array of reuslts
  * @property {number} inserted - Total documents inserted.
  * @property {number} rate - Documents per second.
  * @property {string} totalTime - Total time in seconds.
  * @property {Map<string, Array<...>>} groupedByFile
  * @property {Object} searchStats - Search Statistics.
  * @property {number} searchStats.exact - Total exact matches
  * @property {number} searchStats.semantic - Total semantic matches.
  * @property {number} searchStats.total - Total matches.
  */

class VectorStore extends EventEmitter {
  #store;
  /* eslint-disable-next-line no-unused-private-class-members */
  #dimensions;
  #embedder;


  /**
   * constructor
   *
   * @param  {config.store} config The store configuration
   * @param  {type} store  description
   * @return {type}        description
   */
  constructor(config, store){
    super();

    this.#store = store;
    this.config = {
      ...defaultConfig.store,
      ...config
    };
  }

  /**
   * Connect to a vector database. Async factory.
   *
   * @param {config.store} config           - []../config/index.js].store{}
   * @param {string} config.collection      - collection name
   * @param {string} config.dimensions      - collection dimensions
   * @param {number} [config.batchSize]     - insert batch size, default 200
   * @param {Object} [config.storeOptions]  - the store client options
   * @param {string} [StoreClass]           - optional, dependency inject a store
   * @returns {Promise<VectorStore>}
   *
   * @example
   * const store = await VectorStore.connect({
   *   collection: 'my-project',
   * });
   */
  static async connect(config, StoreClass) {
    if (!config.collection) {
      throw new Error('You must specify a collection name');
    }
    if (!config.dimensions) {
      throw new Error('You must specify the dimensions');
    }

    let store;
    if (StoreClass) {
      store = new StoreClass(config);
      /* c8 ignore next */
    } else {
      /* c8 ignore next */
      const Store = await StoreLoader(config.storeName);
      /* c8 ignore next */
      store = new Store(config);
      /* c8 ignore next */
    }

    await store.initialize();

    return new VectorStore(config, store);
  }


  /**
   * Ingest an IndexResult into the vector database.
   * Reads the embedFile, creates/replaces collection, bulk inserts.
   *
   * Emits:
   *   'progress' → ProgressEvent (phase: load | ingest)
   *   'error'    → ErrorEvent (non-fatal: failed batches with retry)
   *   'done'     → IngestResult
   *
   * @param {IndexResult} indexResult         - output from Indexer.index()
   * @param {Class} [EmbedderClass]           - default null
   * @returns {Promise<IngestResult>}
   *
   * @example
   * store.on('progress', ({ phase, current, total, detail }) => {
   *   if (phase === 'ingest') {
   *     console.log(`Batch ${detail.batch}: ${current}/${total} (${detail.rate}/sec)`);
   *   }
   * });
   *
   * const stats = await store.ingest(indexResult);
   */
  async ingest(indexResult, EmbedderClass = null) {
    const requiredFields = ['embedFile', 'dimensions'];
    const missing = requiredFields.filter(field => !(field in indexResult));

    if (missing.length > 0) {
      throw new Error(
        `Missing required field(s): ${missing.join(', ')}`
      );
    }

    // TODO: no route to add embedOptions
    await this.loadEmbedder(indexResult, EmbedderClass);

    const { ids, embeddings, documents, metadatas } =
      await this.loadEmbeddings(indexResult.embedFile);

    let inserted = 0;
    const startTime = Date.now();

    this.emit('start', {
      phase: 'ingest',
      status: 'start',
      current: 0,
      total: ids.length,
      message: `Starting ingesting ${ids.length} items in batches of ${this.config.batchSize}`
    });

    for (let i = 0; i < ids.length; i += this.config.batchSize) {
      const batchEnd = Math.min(i + this.config.batchSize, ids.length);
      const batchIds = ids.slice(i, batchEnd);
      const batchEmbeddings = embeddings.slice(i, batchEnd);
      const batchDocuments = documents.slice(i, batchEnd);
      const batchMetadatas = metadatas.slice(i, batchEnd);

      try {
        await this.#store.insert({
          ids: batchIds,
          embeddings: batchEmbeddings,
          documents: batchDocuments,
          metadatas: batchMetadatas
        });

        inserted = batchEnd;
        const elapsed = (Date.now() - startTime) / 1000;
        let rate = Math.floor(inserted / elapsed);

        this.emit('progress', {
          phase: 'ingest',
          status: 'progress',
          current: inserted,
          total: ids.length,
          message: `Batch ${Math.ceil(batchEnd / this.config.batchSize)}: ${inserted}/${ids.length} items (${rate}/sec)`
        });

      } catch (err) {
        // Try smaller batch
        if (this.config.batchSize > 50) {
          this.config.batchSize = Math.floor(this.config.batchSize / 2);
          this.emit('error', {
            phase: 'ingest',
            message: `Retrying with smaller batch: ${this.config.batchSize}`,
            error: err,
            recoverable: true
          });
          i -= this.config.batchSize * 2; // Go back and retry
        } else {
          this.emit('error', {
            phase: 'ingest',
            message: `Skipping batch after repeated failures`,
            error: err,
            recoverable: false
          });
          inserted += batchEnd - i;
          i = batchEnd - 1;
        }
      }
    }

    const totalTime = (Date.now() - startTime) / 1000;

    this.emit('complete', {
      phase: 'ingest',
      status: 'complete',
      current: 0,
      total: ids.length,
      message: `Finished ingesting ${ids.length} items. Total time ${totalTime}/sec`
    });

    return {
      collection: this.config.collection,
      inserted,
      rate: Math.floor(inserted / totalTime),
      totalTime: totalTime.toFixed(2)
    }
  }


  /**
  * Parse an embeddings file created by {Embed}
  *
  * @param  {string} embedFile  The embeddings json file.
  * @return {Object}            Returns the parsed data.
  */
  async loadEmbeddings(embedFile) {
    const data = JSON.parse(await fs.readFile(embedFile, 'utf-8'));

    // Filter out chunks that are too short
    // TODO: the text length should be in config.
    const validChunks = data.chunks.filter(chunk =>
      chunk.text && chunk.text.length > 50 && chunk.embedding
    );

    // Prepare arrays
    const ids = [];
    const embeddings = [];
    const documents = [];
    const metadatas = [];

    for (const [, item] of validChunks.entries()) {
      ids.push(item.id);
      embeddings.push(item.embedding);
      documents.push(item.text);
      metadatas.push({
        ...item.metadata,
        text_length: item.text.length,
        parser: data.parser || 'standard',
        model: data.model
      });
    }

    return { ids, embeddings, documents, metadatas, dimensions: data.dimensions };
  }


  /**
   * Hybrid search: exact + semantic + keyword, fused and ranked.
   *
   * @param {string} query
   * @param {Object} [options]
   * @param {Object} [options.filters]        - metadata filters (e.g. { source_file: '...' })
   * @param {number} [options.topK]           - max results, default 15
   * @param {number} [options.minSimilarity]  - threshold, default 0.25
   * @param {FusionWeights} [options.weights] - override fusion weights
   * @returns {Promise<SearchResult>}
   *
   * @example
   * const results = await store.search('authentication middleware', {
   *   topK: 10,
   *   filters: { source_file: 'src/auth/' },
   * });
   */
  async search(query, options = {}) {
    const {
      filters = {},
      topK = 15,
      minSimilarity = 0.25,
      weights = this.config.weights,
    } = options;

    this.emit('progress', {
      phase: 'search',
      status: 'start',
      current: 0,
      total: 3,
      message: `Hybrid search: "${query.substring(0, 80)}"`,
    });

    let allItems = null;
    const fetchAll = async () => {
      if (!allItems) {
        allItems = await this.#store.getAll();
      }
      return allItems;
    };

    // Run all three strategies in parallel — all receive filters
    const [exactMatches, semanticResults, keywordResults] = await Promise.all([
      this.findExactMatches(query, fetchAll, filters),
      this.semanticSearch(query, filters),
      this.keywordSearch(query, fetchAll, filters),
    ]);

    // TODO: emit progress during 3 stages above
    this.emit('progress', {
      phase: 'search',
      status: 'progress',
      current: 3,
      total: 3,
      message: `Candidates → exact: ${exactMatches.length}, semantic: ${semanticResults.length}, keyword: ${keywordResults.length}`,
    });

    const result = this.fuseResults(
      exactMatches, semanticResults, keywordResults,
      weights, topK, minSimilarity,
    );

    this.emit('progress', {
      phase: 'search',
      status: 'complete',
      current: result.results.length,
      total: result.results.length,
      message: `Found ${result.results.length} results from ${result.groupedByFile.size} files`,
    });

    return result;
  }


  // ── Search Strategies ──────────────────────────────────────

  /**
   * Exact identifier matching: scores against function names, class names,
   * method names, variable names, and exact phrase containment.
   *
   * Scoring tiers:
   *   1.0  — metadata identifier exactly equals query
   *   0.9  — `class <query>`, `function <query>`, or `<query>(` in source
   *   0.75 — exact phrase anywhere in chunk
   *
   * @param {string} query
   * @param {Function} fetchAll  Shared collection.get() fetcher
   * @param {Object} [filters={}] Metadata filters (applied client-side)
   * @returns {Promise<ScoredResult[]>}
   */
  async findExactMatches(query, fetchAll, filters = {}) {
    try {
      const items = await fetchAll();
      const queryLower = query.toLowerCase();
      const results = [];

      items.documents.forEach((doc, i) => {
        const metadata = items.metadatas[i];

        // Apply filters client-side
        if (!VectorStore.matchesFilters(metadata, filters)) return;

        const docLower = doc.toLowerCase();
        let score = 0;

        // Identifier-level matches (highest confidence)
        const identifierMatch =
          (metadata.functionName && metadata.functionName.toLowerCase() === queryLower) ||
          (metadata.methodName   && metadata.methodName.toLowerCase()   === queryLower) ||
          (metadata.className    && metadata.className.toLowerCase()    === queryLower) ||
          (metadata.variableName && metadata.variableName.toLowerCase() === queryLower);

        if (identifierMatch) {
          score = 1.0;
        }
        // inner/anon function definition in source (high confidence)
        else if (
          docLower.includes(`function ${queryLower}`) ||
          docLower.includes(`${queryLower}(`)
        ) {
          score = 0.9;
        }
        // Exact phrase anywhere in chunk
        else if (docLower.includes(queryLower)) {
          score = 0.75;
        }

        if (score > 0) {
          results.push({
            document: doc,
            metadata,
            distance: 1 - score,
            score,
            source: 'exact',
          });
        }
      });

      return results.sort((a, b) => b.score - a.score);
    } catch (err) {
      this.emit('error', {
        phase: 'search:exact',
        message: `Exact match search failed: ${err.message}`,
        error: err,
        recoverable: true,
      });
      return [];
    }
  }


  /**
   * Vector similarity search via ChromaDB. Embeds the query and finds
   * the closest vectors. Accepts optional metadata filters.
   *
   * @param {string} query
   * @param {Object} [filters={}]  ChromaDB where-clause filters
   * @returns {Promise<ScoredResult[]>}
   */
  async semanticSearch(query, filters = {}) {
    try {
      const queryEmbedding = await this.#embedder.embed(query);

      const raw = await this.#store.query(queryEmbedding, filters);

      if (!raw.documents[0]) return [];

      return raw.documents[0]
        .map((doc, i) => {
          const distance = raw.distances[0][i];
          return {
            document: doc,
            metadata: raw.metadatas[0][i],
            distance,
            score: 1 - distance,
            source: 'semantic',
          };
        })
        .filter(r => VectorStore.matchesFilters(r.metadata, filters));
    } catch (err) {
      this.emit('error', {
        phase: 'search:semantic',
        message: `Semantic search failed: ${err.message}`,
        error: err,
        recoverable: true,
      });
      return [];
    }
  }


  /**
   * Keyword search: tokenises the query into individual terms and scores
   * each chunk by how many distinct terms appear in it. Useful for
   * multi-word natural-language queries where semantic search can miss
   * concrete symbol names (e.g. "handle auth token refresh").
   *
   * @param {string} query
   * @param {Function} fetchAll  Shared collection.get() fetcher
   * @param {Object} [filters={}] Metadata filters (applied client-side)
   * @returns {Promise<ScoredResult[]>}
   */
  async keywordSearch(query, fetchAll, filters = {}) {
    const KEYWORD_MIN_SCORE = 0.1;

    try {
      const keywords = this.tokeniseQuery(query);
      if (keywords.length === 0) return [];

      const items = await fetchAll();
      const results = [];

      items.documents.forEach((doc, i) => {
        const metadata = items.metadatas[i];

        // Apply filters client-side
        if (!VectorStore.matchesFilters(metadata, filters)) return;

        const docLower = doc.toLowerCase();

        // Count distinct keyword hits
        const hitCount = keywords.filter(kw => docLower.includes(kw)).length;
        if (hitCount === 0) return;

        // Ratio of matched keywords; bonus for longer chunks
        const baseScore = hitCount / keywords.length;
        const lengthBonus = Math.min(doc.length / 500, 1) * 0.1;
        const score = Math.min(baseScore + lengthBonus, 1.0);

        if (score >= KEYWORD_MIN_SCORE) {
          results.push({
            document: doc,
            metadata,
            distance: 1 - score,
            score,
            source: 'keyword',
          });
        }
      });

      return results.sort((a, b) => b.score - a.score);
    } catch (err) {
      this.emit('error', {
        phase: 'search:keyword',
        message: `Keyword search failed: ${err.message}`,
        error: err,
        recoverable: true,
      });
      return [];
    }
  }


  // ── Fusion ─────────────────────────────────────────────────


  /**
   * Merge results from all three strategies into a single ranked list.
   *
   * Deduplicates by source_file + startRow + endRow. When the same chunk
   * appears in multiple strategies its weighted scores are summed, so
   * chunks that score well across strategies rank higher.
   *
   * A result survives if its fused score ≥ minSimilarity, OR if it's a
   * keyword-only result with score ≥ KEYWORD_MIN_SCORE (lower bar for
   * natural-language queries).
   *
   * @param {ScoredResult[]} exactMatches
   * @param {ScoredResult[]} semanticResults
   * @param {ScoredResult[]} keywordResults
   * @param {Object}  weights        { exact, semantic, keyword }
   * @param {number}  topK
   * @param {number}  minSimilarity
   * @returns {SearchResult}
   */
  fuseResults(exactMatches, semanticResults, keywordResults, weights, topK, minSimilarity) {
    const KEYWORD_MIN_SCORE = 0.1;
    let fused = new Map();

    fused = VectorStore.addResults(exactMatches,    weights.exact,    'exact', fused);
    fused = VectorStore.addResults(semanticResults, weights.semantic, 'semantic', fused);
    fused = VectorStore.addResults(keywordResults,  weights.keyword,  'keyword', fused);

    const ranked = VectorStore.getRanked(fused, topK, KEYWORD_MIN_SCORE, minSimilarity);

    // Build the SearchResult shape
    const results = ranked.map(r => ({
      code:         r.document,
      file:         r.metadata.source_file,
      type:         r.metadata.chunk_type,
      lineStart:    r.metadata.startRow,
      lineEnd:      r.metadata.endRow,
      className:    r.metadata.className,
      functionName: r.metadata.functionName ?? r.metadata.methodName,
      relevance:    r.fusedScore,
      sources:      r.sources,
      metadata:     r.metadata,
    }));

    const groupedByFile = new Map();
    for (const r of results) {
      if (!groupedByFile.has(r.file)) groupedByFile.set(r.file, []);
      groupedByFile.get(r.file).push(r);
    }

    return {
      results,
      groupedByFile,
      searchStats: {
        exact:    exactMatches.length,
        semantic: semanticResults.length,
        keyword:  keywordResults.length,
        total:    ranked.length,
      },
    };
  }


  // ── Static Helpers ─────────────────────────────────────────


  /**
   * Filter, sort, slice
   * A result survives if EITHER:
   *   - its fused score ≥ minSimilarity, OR
   *   - its best raw score from any single strategy ≥ minSimilarity
   * This prevents fusion weighting from killing results that a single
   * strategy found highly relevant (e.g. semantic score 0.6 × weight 0.4 = 0.24
   * would be below 0.25 threshold without this).
   *
   * @param {Map} fused The fused results to rank.
   * @param {number} topK The number of results to return.
   * @param {number} keywordMinScore The minimum score.
   * @param {number} minSimilarity The minimum similarity.
   *
   * @return {Map}
   */
  static getRanked(fused, topK, keywordMinScore, minSimilarity) {
    return Array.from(fused.values())
      .filter(r => {
        const isKeywordOnly = r.sources.size === 1 && r.sources.has('keyword');
        const floor = isKeywordOnly ? keywordMinScore : minSimilarity;
        return r.fusedScore >= floor || r.bestRawScore >= minSimilarity;
      })
      .sort((a, b) => {
        // Class definitions always surface first
        const aIsClass = a.metadata.chunk_type === 'class';
        const bIsClass = b.metadata.chunk_type === 'class';
        if (aIsClass && !bIsClass) return -1;
        if (!aIsClass && bIsClass) return  1;
        return b.fusedScore - a.fusedScore;
      })
      .slice(0, topK);

  }

  /**
  * Deduplicates results.
  *
  * @param  {Array} results The results to deduplicate.
  * @param  {number} weight  The weights.
  * @param  {string} source  The results source.
  * @param  {Map} fused   Previous deduplicated results, if any.
  * @return {Map}
  */
  static addResults(results, weight, source, fused) {
    for (const result of results) {
      const key = VectorStore.getResultKey(result.metadata);

      if (fused.has(key)) {
        const existing = fused.get(key);
        existing.fusedScore += result.score * weight;
        existing.sources.add(source);

        // Track the best raw score from any single strategy
        if (result.score > existing.bestRawScore) {
          existing.bestRawScore = result.score;
        }

        // Keep the lower distance (closer = better)
        if (result.distance < existing.distance) {
          existing.distance = result.distance;
        }
      } else {
        fused.set(key, {
          ...result,
          fusedScore: result.score * weight,
          bestRawScore: result.score,
          sources: new Set([source]),
        });
      }
    }

    return fused;
  };


  /**
   * Tokenise a query into lowercase keywords, stripping stop-words
   * and short tokens so keyword search focuses on meaningful terms.
   *
   * @param {string} query
   * @returns {string[]}
   */
  tokeniseQuery(query) {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !this.config.stopWords.has(token));
  }


  /**
   * Generate unique deduplication key for a result.
   *
   * @param {Object} metadata
   * @returns {string}
   */
  static getResultKey(metadata) {
    const file     = metadata.source_file || 'unknown';
    const startRow = metadata.startRow ?? 0;
    const endRow   = metadata.endRow ?? 0;
    return `${file}_${startRow}_${endRow}`;
  }


  /**
   * Client-side metadata filter matching for exact and keyword strategies
   * (which use collection.get() rather than collection.query()).
   *
   * Supports simple equality and $contains for string fields.
   * An empty filters object matches everything.
   *
   * @param {Object} metadata
   * @param {Object} filters  e.g. { source_file: 'lib/foo.js' }
   * @returns {boolean}
   */
  static matchesFilters(metadata, filters) {
    if (!filters || Object.keys(filters).length === 0) return true;

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;

      const metaValue = metadata[key];
      if (metaValue === undefined || metaValue === null) return false;

      // Simple equality
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        // Support partial path matching: filter 'lib/context-manager.js'
        // should match metadata 'lib/context-manager.js' or
        // 'src/lib/context-manager.js' (contains check)
        if (typeof value === 'string' && typeof metaValue === 'string') {
          if (!metaValue.includes(value) && !value.includes(metaValue)) return false;
        } else {
          if (metaValue !== value) return false;
        }
      }
      // Operator object
      else if (typeof value === 'object') {
        if (value.$eq !== undefined && metaValue !== value.$eq) return false;
        if (value.$contains !== undefined && typeof metaValue === 'string' && !metaValue.includes(value.$contains)) return false;
        if (value.$ne !== undefined && metaValue === value.$ne) return false;
      }
    }

    return true;
  }


  /**
   * Load an embedder.
   *
   * @async
   * @param  {type} opts = {}     The embedder options.
   * @param  {type} [EmbedderClass] A bespoke EmbedderClass.
   * @return {undefined}
   */
  async loadEmbedder(opts = {}, EmbedderClass) {
    if (EmbedderClass) {
      this.#embedder = new EmbedderClass(opts);
      /* c8 ignore next */
    } else {
      /* c8 ignore next */
      const Embedder = await embedderLoader(opts.provider);
      /* c8 ignore next */
      this.#embedder = new Embedder(opts);
      /* c8 ignore next */
    }
    await this.#embedder.initialize();

    this.#dimensions = await this.#embedder.getDimensions();
  }


  /**
   * Release connection resources and remove all listeners.
   * @returns {Promise<void>}
   */
  async dispose() { }
}

export default VectorStore;
