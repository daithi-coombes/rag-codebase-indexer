import { EventEmitter } from 'node:events';
import chunkLoader from './chunkers/index.js';
import embedderLoader from './embedders/index.js';
import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'node:path';

/**
 * @typedef {Object} IndexResult
 * @property {string} embedFile - Source file path.
 * @property {object} stats - Stats.
 * @property {number} stats.filesProcessed - Total files processed.
 * @property {number} stats.totalChunks - Total chunks parsed.
 * @property {Record<string, number>} stats.languages - Number of files processed per language.
 * @property {Object} stats.chunkSizes - Chunking stats.
 * @property {number} stats.chunkSizes.avg - The average chunk size.
 * @property {number} stats.chunkSizes.min - The minimum chunk size.
 * @property {number} stats.chunkSizes.max - The maximum chunk size.
 * @property {string} model - The model used.
 * @property {number} dimensions - The dimensions used.
 * @property {string} timestamp - ISO 8601
 */

class Indexer extends EventEmitter {
  #chunker;
  #chunkerName;
  #dimensions;
  #embedder;
  #modelName;
  #projectName;
  #provider;

  constructor(config) {
    super();

    this.#chunkerName = config.chunker || 'Treesitter';
    this.#modelName = config.model;
    this.#projectName = config.projectName || 'rag-codebase-indexer';
    this.#provider = config.provider;
  }

  /**
   * Async factory — loads model, initialises chunker, returns ready instance.
   *
   * @param {Object} config
   * @param {string} config.provider          - 'ollama' | 'transformers'
   * @param {string} config.model             - e.g. 'nomic-embed-text', 'Xenova/all-MiniLM-L6-v2'
   * @param {string} [config.chunker]         - default: 'treesitter'
   * @param {Object} [config.providerOptions] - provider-specific (host, device, dtype, etc.)
   * @returns {Promise<Indexer>}
   *
   * @example
   * const indexer = await Indexer.create({
   *   provider: 'ollama',
   *   model: 'nomic-embed-text',
   * });
   */
  static async create(config) {
    const indexer = new Indexer(config);

    const embedderOpts = {
      concurrency: 5,
      ...config.embedderOpts
    };
    const chunkerOpts = {
      ...config.chunkerOpts
    };

    await indexer.loadEmbedder(embedderOpts, config.embedder);
    await indexer.loadChunker(chunkerOpts, config.chunker);

    return indexer;
  }



  /**
   * Get the chunker name.
   *
   * @return {string}
   */
  get chunkerName() {
    return this.#chunkerName;
  }


  /**
   * Embedding vector dimensions
   * @type {number}
   */
  get dimensions() {
    return this.#dimensions;
  }


  /**
   * Model metadata
   * @type {string}
   */
  get modelName() {
    return this.#modelName;
  }


  /**
   * Project Name.
   * @type {string}
   */
  get projectName() {
    return this.#projectName;
  }


  /**
   * Provider identifier
   * @type {string}
   */
  get provider() {
    return this.#provider;
  }



  /**
   * Chunk a file.
   *
   * @param  {string} file        The file relative to project path.
   * @param  {string} projectPath The absolute project path.
   * @return {Object}      { chunks, language }
   */
  async chunkFile(file, projectPath) {
    const filePath = path.resolve(projectPath, file);
    const content = await fs.readFile(filePath, 'utf-8');

    const language = this.#chunker.getLanguageFromPath(filePath);
    const chunks = this.#chunker.parseCodeFile(file, content);

    return {
      chunks,
      language
    };
  }


  /**
   * Find files.
   *
   * @param  {string} rootPath The absolute path for the codebase.
   * @param  {Object} opts     { exclude, include, maxFileSize }
   * @return {Array}
   */
   async findFiles(rootPath, opts) {
     const files = [];
     const maxFileSize = opts?.maxFileSize || this.maxFileSize;

     for (const pattern of opts.include) {
       const _files = await fg(pattern, {
         cwd: rootPath,
         ignore: opts.exclude,
         nodir: true,
         absolute: false
       });

       const statsPromises = _files.map(file => fs.stat(path.join(rootPath, file)));
       const statsResults = await Promise.all(statsPromises);

       _files.forEach((file, i) => {
         const stats = statsResults[i];
         if (stats.size <= maxFileSize) {
           files.push(file);
         } else {
           this.emit('error', {
             phase: 'scan',
             status: 'progress',
             current: 0,
             total: 0,
             message: `Skipping large file: ${file} (${Math.round(stats.size / 1024)}KB)`
           });
         }
       });
     }

     return [...new Set(files)];
   }


  /**
   * Generate embeddings.
   *
   * @async
   * @uses {this.#embedder.concurrency}
   * @param  {Array} texts = [] Array of texts to embed.
   * @param  {function} cb      Callback to handle statuses.
   * @return {Object}           { embeddings, failedIndices }
   */
  async generateEmbeddings(texts = [], cb) {
    const results = new Array(texts.length).fill(null);
    const failedIndices = [];
    let completed = 0;

    const queue = texts.map((text, index) => ({ text, index }));

    const worker = async () => {
      while (queue.length) {
        const { text, index } = queue.shift();
        try {
          const embedding = await this.#embedder.embed(text);
          results[index] = embedding;
          cb(index, 'success');
        } catch (err) {
          cb(index, 'failure', err);
          failedIndices.push(index);
        }
      }
    };

    const workers = Array(this.#embedder.concurrency).fill().map(() => worker());
    await Promise.all(workers);

    return { embeddings: results, failedIndices };
  }



  /**
   * Index a codebase.
   *
   * Emits:
   *   'progress' → ProgressEvent (phase: scan | chunk | embed | cache)
   *   'error'    → ErrorEvent (non-fatal: skipped files, failed embeddings)
   *   'done'     → IndexResult
   *
   * @param {Object} options
   * @param {string} options.projectPath      - root directory to scan
   * @param {string} [options.cacheDir]       - where to write the embeddings JSON
   * @param {string[]} [options.include]      - glob patterns
   * @param {string[]} [options.exclude]      - glob patterns
   * @param {number} [options.maxFileSize]    - bytes, default 2MB
   * @param {number} [options.batchSize]      - embedding concurrency, default 5
   * @returns {Promise<IndexResult>}
   *
   * @example
   * indexer.on('progress', ({ phase, current, total }) => {
   *   console.log(`[${phase}] ${current}/${total}`);
   * });
   *
   * const result = await indexer.index({
   *   projectPath: '/path/to/project',
   *   cacheDir: '~/.cache/rag',
   * });
   */
  async index(options) {
    const {
      projectPath,
      cacheDir,
      include,
      exclude,
      maxFileSize,
      batchSize
    } = options;

    // ── Phase: scan ───────────────────────────────────────
    this.emit('progress', { phase: 'scan', status: 'start', current: 0, total: 0 });

    const files = await this.findFiles(projectPath, { include, exclude, maxFileSize });

    this.emit('progress', {
      phase: 'scan',
      status: 'complete',
      current: files.length,
      total: files.length,
      message: `Found ${files.length} files`,
    });

    // ── Phase: chunk ──────────────────────────────────────
    this.emit('progress', { phase: 'chunk', status: 'start', current: 0, total: files.length });

    const chunks = [];
    for (const [i, file] of files.entries()) {
      try {
        const fileChunks = await this.chunkFile(file, projectPath);
        // console.log('fileChunks: ', fileChunks);
        chunks.push(...fileChunks.chunks);

        this.emit('progress', {
          phase: 'chunk',
          status: 'progress',
          current: i + 1,
          total: files.length,
          message: `${file} → ${fileChunks.chunks.length} chunks`,
          detail: {
            file,
            chunks: fileChunks.chunks.length,
            language: fileChunks.language
          },
        });
      } catch (err) {
        this.emit('error', {
          phase: 'chunk',
          message: `Failed to chunk ${file}: ${err.message}`,
          error: err,
          recoverable: true,
        });
      }
    }

    this.emit('progress', {
      phase: 'chunk',
      status: 'complete',
      current: files.length,
      total: files.length,
      message: `${chunks.length} total chunks from ${files.length} files`,
    });

    // ── Phase: embed ──────────────────────────────────────
    this.emit('progress', { phase: 'embed', status: 'start', current: 0, total: chunks.length });

    const texts = chunks.map(c => c.text);
    let completed = 0;

    const embeddings = await this.generateEmbeddings(texts, (index, status, error) => {
      completed++;
      this.emit('progress', {
        phase: 'embed',
        status: 'progress',
        current: completed,
        total: chunks.length,
        message: `Embedding ${completed}/${chunks.length}`,
        detail: { index, status, error },
      });

      if (status === 'failure') {
        this.emit('error', {
          phase: 'embed',
          message: `Embedding failed for chunk ${index}: ${error}`,
          error: new Error(error),
          recoverable: true,
        });
      }
    });

    const { embeddings: embeddingVectors, failedIndices = [] } = embeddings;
    const failedSet = new Set(failedIndices);
    const validChunks = chunks
      .map((chunk, i) => ({ chunk, embedding: embeddingVectors[i], index: i }))
      .filter(({ embedding, index }) => embedding !== null && !failedSet.has(index));

    this.emit('progress', {
      phase: 'embed',
      status: 'complete',
      current: chunks.length,
      total: chunks.length,
      message: `Embedded ${validChunks.length} chunks (${embeddings.failedIndices.length} failed)`,
    });

    // ── Phase: cache ──────────────────────────────────────
    this.emit('progress', { phase: 'cache', status: 'start', current: 0, total: 1 });

    const embedFile = await this.writeToCache(validChunks, cacheDir);

    this.emit('progress', {
      phase: 'cache',
      status: 'complete',
      current: 1,
      total: 1,
      message: `Saved to ${embedFile}`,
      detail: { embedFile },
    });

    // ── Done ──────────────────────────────────────────────
    const result = {
      embedFile,
      provider: this.provider,
      model: this.modelName,
      dimensions: this.dimensions,
      timestamp: new Date().toISOString(),
    };

    this.emit('done', result);
    return result;
  }


  /**
   * Load a Chunker.
   *
   * @async
   * @param  {Object} opts = {}  Chunker options.
   * @param  {Class} [ChunkerClass] The chunker class to use.
   * @return {undefined}
   */
  async loadChunker(opts = {}, ChunkerClass) {
    let Chunker
    if (ChunkerClass) {
      this.#chunker = new ChunkerClass(opts);
    } else {
      const Chunker = await chunkLoader(this.chunkerName);
      this.#chunker = new Chunker(opts);
    }
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
    let Embedder
    if (EmbedderClass) {
      this.#embedder = new EmbedderClass(opts);
    } else {
      const Embedder = await embedderLoader(this.provider);
      this.#embedder = new Embedder(opts);
    }
    await this.#embedder.initialize();

    this.#dimensions = await this.#embedder.getDimensions();
  }


  /**
   * Write validated chunk+embedding pairs to a JSON cache file.
   *
   * The output format is the contract between Indexer and VectorStore.
   * It contains only what VectorStore.ingest() needs:
   *   - Per chunk: id, text, embedding, metadata (from chunker), file, language
   *   - File-level: model, dimensions, total count, timestamp
   *
   * @async
   * @param {Array<{chunk: Object, embedding: number[]}>} validChunks
   *   Pre-filtered chunk+embedding pairs (failed embeddings already excluded).
   * @param {string} cacheDir Directory to write the cache file.
   * @returns {Promise<string>} Absolute path to the written cache file.
   */
  async writeToCache(validChunks = [], cacheDir) {
    const output = {
      chunks: validChunks.map(({ chunk, embedding }) => ({
        id: chunk.id,
        text: chunk.text,
        metadata: chunk.metadata,
        embedding,
        file: chunk.file,
        language: chunk.language,
      })),
      model: this.modelName,
      dimensions: this.dimensions,
      total: validChunks.length,
      timestamp: new Date().toISOString(),
    };

    await fs.mkdir(cacheDir, { recursive: true });

    const filename = path.resolve(
      path.join(cacheDir, `embeddings_${this.#projectName}.json`)
    );

    await fs.writeFile(filename, JSON.stringify(output, null, 2));

    return filename;
  }


  /**
   * Release model resources and remove all listeners.
   * @returns {Promise<void>}
   */
   async dispose() {
     if (this.#embedder?.cleanup) {
       await this.#embedder.cleanup();
     }
     this.#embedder = null;
     this.#chunker = null;
     this.removeAllListeners();
   }
 }

export default Indexer;
