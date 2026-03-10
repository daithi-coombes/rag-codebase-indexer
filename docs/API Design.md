# rag-codebase-indexer — Pipeline Composition API Design

## Overview

Two primary exports: **`Indexer`** (chunk → embed → cache) and **`VectorStore`** (ingest → search).
Both extend `EventEmitter` from `node:events` and emit progress events during long-running operations.

**Target runtime:** Node ≥ 20, ESM-only (CJS consumers use the existing `build.js` transpile step).

---

## Module Structure

```
lib/
├── Indexer.js                  # Public: async factory + index pipeline
├── VectorStore.js              # Public: ingest + hybrid search
├── chunkers/
│   ├── Chunker.js              # Base class
│   ├── Treesitter.js           # Default chunker
│   └── index.js                # Dynamic loader
├── embedders/
│   ├── Embedder.js             # Base class
│   ├── Ollama.js               # Default embedder
│   ├── Transformers.js         # HuggingFace Transformers
│   └── index.js                # Dynamic loader
├── stores/
│   ├── Chroma.js               # Default store
│   ├── Faiss.js                # Meta's Faiss store
│   ├── index.js                # Dynamic loader
│   └── Store.js                # Base class
└── index.js     # Barrel export
```

**What changes:**
- `Embed.js` → `Indexer.js` (renamed + restructured as async factory, extends EventEmitter)
- `VectorDB.js` + `VectorSearch.js` → `VectorStore.js` (merged, single connection, extends EventEmitter)
- Chunker and embedder layers stay exactly as-is

---

## Barrel Export

```js
// lib/rag-codebase-indexer.js
export { Indexer } from './Indexer.js';
export { VectorStore } from './VectorStore.js';
export { default as config } from '../config/index.js';
export const VERSION = '0.0.1';
```

---

## Event System

Both `Indexer` and `VectorStore` extend `EventEmitter` from `node:events`.
Long-running methods emit typed events that consumers can subscribe to.

### Events

| Event        | Emitted by                       | Payload            | Description                              |
|--------------|----------------------------------|--------------------|------------------------------------------|
| `'progress'` | `Indexer.index()`, `VectorStore.ingest()` | `ProgressEvent` | Granular phase/status updates            |
| `'error'`    | `Indexer.index()`, `VectorStore.ingest()` | `ErrorEvent`    | Non-fatal errors (skipped files, failed batches). Fatal errors reject the Promise. |
| `'done'`     | `Indexer.index()`, `VectorStore.ingest()` | `IndexResult` or `IngestResult` | Pipeline complete. Also returned by the `await`. |

### ProgressEvent shape

```ts
type ProgressEvent = {
  phase: 'scan' | 'chunk' | 'embed' | 'cache' | 'load' | 'ingest';
  status: 'start' | 'progress' | 'complete';
  current: number;       // items completed so far in this phase
  total: number;         // total items expected (0 if unknown at start)
  message?: string;      // human-readable description
  detail?: object;       // phase-specific payload (see below)
};
```

### ErrorEvent shape

```ts
type ErrorEvent = {
  phase: 'scan' | 'chunk' | 'embed' | 'cache' | 'load' | 'ingest';
  message: string;
  error: Error;          // the original error
  recoverable: boolean;  // true = pipeline continues, false = pipeline will reject
};
```

### Phase details

| Phase     | Emitter             | `detail` payload                                               |
|-----------|---------------------|----------------------------------------------------------------|
| `scan`    | `Indexer`           | `{ file: string }`                                             |
| `chunk`   | `Indexer`           | `{ file: string, chunks: number, language: string }`           |
| `embed`   | `Indexer`           | `{ index: number, status: 'success'\|'failure', error?: string }` |
| `cache`   | `Indexer`           | `{ embedFile: string }`                                        |
| `load`    | `VectorStore`       | `{ embedFile: string, totalChunks: number }`                   |
| `ingest`  | `VectorStore`       | `{ batch: number, inserted: number, rate: number }`            |

### Design rationale

**Why EventEmitter?**

1. **Multiple listeners without fan-out boilerplate.**
   The Pulsar plugin's `ContextManager` currently has one consumer (the view's progress bar),
   but chat memory is planned post-release. When memory lands, it will need to listen for
   `chunk` completion events to track which files were indexed and anchor memories to specific
   files and git commits. With EventEmitter, that's just another `.on('progress', ...)` — the
   `Indexer` doesn't need to know or care how many things are listening.

2. **Clean detachment via the existing `dispose()` pattern.**
   Pulsar's `CompositeDisposable` model is subscription-based. EventEmitter fits naturally:
   `.on()` during setup, `.removeListener()` or `.removeAllListeners()` in `dispose()`.
   If the user closes the panel mid-index, the view removes its listener and stops pushing
   DOM updates — no boolean flags or wrapper functions needed.

3. **Selective subscription by phase.**
   The CLI wants everything. The Pulsar progress bar primarily cares about `embed` events
   (the slowest phase). The future memory system only cares about `chunk` completion.
   Consumers can filter on `event.phase` within a single `'progress'` listener, or (if we
   later add per-phase events) subscribe to exactly what they need.

4. **Zero cost in ESM on Node ≥ 20.**
   `EventEmitter` is built into `node:events` — no dependency, no bundle cost. On Node 20
   (now available via Pulsar's Electron 30 upgrade), the implementation is heavily optimised.
   The listener array overhead is negligible next to matrix multiplications and disk I/O.

5. **Consistent with the AI engineering ecosystem.**
   LangChain's `CallbackManager`, LlamaIndex's event system, and Haystack's pipeline events
   all use observer patterns rather than positional callbacks.

**Why `phase` + `status` instead of the existing `type`?**

The current `generateEmbeddings` callback uses `type: 'start' | 'progress' | 'end'`, which
conflates *what* is happening with *where* in the pipeline. Now that progress spans multiple
stages (scan → chunk → embed → cache), consumers need both dimensions. The Pulsar view can
switch its progress bar label on `phase` changes while updating the bar fill on
`status: 'progress'`.

**Why a single `'progress'` event rather than per-phase events (`'scan'`, `'chunk'`, etc.)?**

Per-phase events (e.g. `indexer.on('embed', handler)`) look cleaner at first, but they
fragment the listener surface. A consumer wanting a unified progress bar would need to
register 4 separate handlers that all do the same thing. The single `'progress'` event with
a `phase` field lets consumers choose their granularity:

```js
// Unified — handle everything in one place
indexer.on('progress', (evt) => updateProgressBar(evt));

// Selective — filter by phase
indexer.on('progress', (evt) => {
  if (evt.phase === 'embed') updateProgressBar(evt);
});
```

If demand emerges for per-phase events, they can be added later as sugar without breaking
the `'progress'` contract.

**`'error'` event vs rejecting the Promise.**

Non-fatal errors (a single file that can't be read, a single embedding that fails) emit
`'error'` with `recoverable: true` — the pipeline continues. Fatal errors (model fails to
load, disk full) both emit `'error'` with `recoverable: false` *and* reject the Promise
returned by `index()` / `ingest()`. This follows Node's convention where `'error'` events
are special on EventEmitter (an unhandled `'error'` throws), so consumers are encouraged to
always attach an error listener.

**`'done'` event: why both emit and return?**

The `await` return value is the primary contract for consumers who call `index()` or
`ingest()` directly. The `'done'` event exists for decoupled architectures where a
listener is registered elsewhere and doesn't have access to the Promise chain — e.g. the
Pulsar view listening for completion to auto-advance to the next pipeline step.

---

## Indexer API

```js
import { EventEmitter } from 'node:events';

class Indexer extends EventEmitter {

  /**
   * Async factory — loads model, initialises chunker, returns ready instance.
   * This is the ONLY way to create an Indexer. No public constructor.
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
  static async create(config) { }


  /**
   * Index a codebase: scan → chunk → embed → write cache.
   *
   * Emits:
   *   'progress' → ProgressEvent (phase: scan | chunk | embed | cache)
   *   'error'    → ErrorEvent (non-fatal: skipped files, failed embeddings)
   *   'done'     → IndexResult
   *
   * @param {Object} options
   * @param {string} options.projectPath      - root directory to scan
   * @param {string} [options.cacheDir]       - where to write the embeddings JSON
   * @param {string} [options.projectName]    - name used in cache filenames
   * @param {string[]} [options.include]      - glob patterns (default from config)
   * @param {string[]} [options.exclude]      - glob patterns (default from config)
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
  async index(options) { }


  /**
   * Model metadata — available after create().
   * @type {string}
   */
  get modelName() { }

  /**
   * Embedding vector dimensions — available after create().
   * @type {number}
   */
  get dimensions() { }

  /**
   * Provider identifier — available after create().
   * @type {string}
   */
  get provider() { }


  /**
   * Release model resources and remove all listeners.
   * @returns {Promise<void>}
   */
  async dispose() { }
}
```

### IndexResult

```ts
type IndexResult = {
  embedFile: string;          // absolute path to the embeddings JSON cache
  stats: {
    filesProcessed: number;
    totalFiles: number;
    totalChunks: number;
    languages: Record<string, number>;
    chunkSizes: { avg: number, min: number, max: number };
  };
  model: string;              // resolved model name
  dimensions: number;         // embedding dimensions
  timestamp: string;          // ISO 8601
};
```

---

## VectorStore API

```js
import { EventEmitter } from 'node:events';

class VectorStore extends EventEmitter {

  /**
   * Connect to a vector database. Async factory.
   *
   * @param {Object} config
   * @param {string} [config.url]             - default 'http://localhost:8000'
   * @param {string} config.collection        - collection name
   * @param {number} [config.batchSize]       - insert batch size, default 200
   * @returns {Promise<VectorStore>}
   *
   * @example
   * const store = await VectorStore.connect({
   *   collection: 'my-project',
   * });
   */
  static async connect(config) { }


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
  async ingest(indexResult) { }


  /**
   * Hybrid search: exact + semantic + keyword, fused and ranked.
   *
   * @param {string} query
   * @param {Object} [options]
   * @param {Object} [options.filters]        - metadata filters (e.g. { filePath: '...' })
   * @param {number} [options.topK]           - max results, default 15
   * @param {number} [options.minSimilarity]  - threshold, default 0.25
   * @param {FusionWeights} [options.weights] - override fusion weights
   * @returns {Promise<SearchResult>}
   *
   * @example
   * const results = await store.search('authentication middleware', {
   *   topK: 10,
   *   filters: { filePath: 'src/auth/' },
   * });
   */
  async search(query, options = {}) { }


  /**
   * Release connection resources and remove all listeners.
   * @returns {Promise<void>}
   */
  async dispose() { }
}
```

### IngestResult

```ts
type IngestResult = {
  collection: string;
  inserted: number;
  rate: number;           // items/sec
  totalTime: string;      // seconds, formatted
};
```

### SearchResult

```ts
type SearchResult = {
  results: Array<{
    code: string;
    file: string;
    type: string;               // 'function' | 'class' | 'method' | 'code_block'
    lineStart?: number;
    lineEnd?: number;
    className?: string;
    functionName?: string;
    relevance: number;          // 0–1 fused score
    sources: Set<string>;       // which strategies matched: 'exact', 'semantic', 'keyword'
    metadata: object;           // full raw metadata
  }>;
  groupedByFile: Map<string, Array<...>>;
  searchStats: {
    exact: number;
    semantic: number;
    keyword: number;
    total: number;
  };
};
```

---

## Usage Examples

### CLI / Script

```js
import { Indexer, VectorStore } from 'rag-codebase-indexer';

// ── Index ─────────────────────────────────────────────────

const indexer = await Indexer.create({
  provider: 'ollama',
  model: 'nomic-embed-text',
  chunker: 'treesitter',
  projectName: 'my-fluffy-project'
});

indexer.on('progress', ({ phase, current, total, message }) => {
  process.stdout.write(`\r[${phase}] ${current}/${total} — ${message}`);
});

indexer.on('error', ({ phase, message, recoverable }) => {
  if (recoverable) console.warn(`\n⚠ [${phase}] ${message}`);
});

const index = await indexer.index({
  projectPath: '/home/user/my-project',
  cacheDir: '~/.cache/rag',
});

// ── Ingest ────────────────────────────────────────────────

const store = await VectorStore.connect({
  collection: 'my-project',
});

store.on('progress', ({ phase, current, total, detail }) => {
  if (phase === 'ingest') {
    process.stdout.write(`\rIngesting: ${current}/${total} (${detail.rate}/sec)`);
  }
});

await store.ingest(index);

// ── Search ────────────────────────────────────────────────

const results = await store.search('how does authentication work?');
console.log(results.results);

// ── Cleanup ───────────────────────────────────────────────

await indexer.dispose();
await store.dispose();
```

### Pulsar Plugin (ContextManager)

```js
// In constructor or activation:
this.indexer = null;
this.store = null;

// ── indexCurrentProject() ──────────────────────────────────

async indexCurrentProject(options = {}) {
  const embedConfig = ConfigManager.getEmbedConfig();

  this.indexer = await Indexer.create({
    provider: embedConfig.provider,
    model: embedConfig.name,
    providerOptions: this._ragProviderOptions(embedConfig),
  });

  // View subscribes for progress bar updates
  this.indexer.on('progress', (evt) => this.view?.updateProgress(evt));

  // Future: memory system subscribes independently
  // this.indexer.on('progress', (evt) => {
  //   if (evt.phase === 'chunk' && evt.status === 'complete') {
  //     this.memory?.trackIndexedFiles(evt.detail);
  //   }
  // });

  this.indexer.on('error', ({ phase, message, recoverable }) => {
    if (!recoverable) {
      atom.notifications.addError(`Indexing failed at ${phase}`, { detail: message });
    }
  });

  const index = await this.indexer.index({
    projectPath: this.currentProjectRoot,
    cacheDir: this.cacheDir,
    projectName: this.projectName(),
    include: indexingConfig.include,
    exclude: indexingConfig.exclude,
  });

  await this.cacheEmbeddings(index.embedFile);
  this.isIndexed = true;
  return index;
}

// ── storeVector() ──────────────────────────────────────────

async storeVector(indexResult) {
  const dbConfig = ConfigManager.getVectorDbConfig();

  this.store = await VectorStore.connect({
    url: dbConfig.url,
    collection: this.getCollectionName(this.projectName()),
  });

  this.store.on('progress', (evt) => this.view?.updateProgress(evt));

  // 'done' event can auto-advance the UI step
  this.store.on('done', () => this.view?.advanceToStep('query'));

  return await this.store.ingest(indexResult);
}

// ── getContext() ───────────────────────────────────────────

async getContext(query, currentFile = null) {
  // Reuse the existing store connection, or reconnect
  if (!this.store) {
    const dbConfig = ConfigManager.getVectorDbConfig();
    this.store = await VectorStore.connect({
      url: dbConfig.url,
      collection: this.getCollectionName(this.projectName()),
    });
  }

  const searchConfig = ConfigManager.getSearchConfig();
  return await this.store.search(query, {
    topK: searchConfig.topK,
    filters: currentFile
      ? { filePath: path.relative(this.currentProjectRoot, currentFile) }
      : undefined,
  });
}

// ── destroy() ──────────────────────────────────────────────

async destroy() {
  await this.indexer?.dispose();  // removes all listeners + frees model
  await this.store?.dispose();    // removes all listeners + closes connection
  this.indexer = null;
  this.store = null;
}
```

### Listener Lifecycle in Pulsar

The key advantage of EventEmitter in the Pulsar context is clean detachment.
If the user closes the panel mid-index:

```js
// In AgenticAiView.destroy():
destroy() {
  // The view removes its own listeners — indexing continues
  // but stops pushing DOM updates
  this.indexer?.removeListener('progress', this._onProgress);
  this.store?.removeListener('progress', this._onProgress);

  this.subscriptions.dispose();
  this.element.remove();
}
```

The pipeline keeps running (no wasted work), but the view stops receiving events.
When the user reopens the panel, it can check `indexer.isRunning` or wait for the
`'done'` event to pick up where it left off.

---

## Internal Emit Pattern

For implementers — this is how `Indexer.index()` emits during each phase:

```js
async index(options) {
  const { projectPath, cacheDir, projectName, include, exclude, maxFileSize, batchSize } = options;

  // ── Phase: scan ───────────────────────────────────────
  this.emit('progress', { phase: 'scan', status: 'start', current: 0, total: 0 });

  const files = await this.#findFiles(projectPath, { include, exclude });

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
      const fileChunks = this.#chunkFile(file, projectPath);
      chunks.push(...fileChunks);

      this.emit('progress', {
        phase: 'chunk',
        status: 'progress',
        current: i + 1,
        total: files.length,
        message: `${file} → ${fileChunks.length} chunks`,
        detail: {
          file,
          chunks: fileChunks.length,
          language: this.#chunker.getLanguageFromPath(file),
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

  const embeddings = await this.#generateEmbeddings(texts, (index, status, error) => {
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

  this.emit('progress', {
    phase: 'embed',
    status: 'complete',
    current: chunks.length,
    total: chunks.length,
    message: `Embedded ${embeddings.embeddings.length} chunks (${embeddings.failedIndices.length} failed)`,
  });

  // ── Phase: cache ──────────────────────────────────────
  this.emit('progress', { phase: 'cache', status: 'start', current: 0, total: 1 });

  const embedFile = await this.#writeToCache(chunks, embeddings, stats, cacheDir, projectName);

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
    stats,
    model: this.modelName,
    dimensions: this.dimensions,
    timestamp: new Date().toISOString(),
  };

  this.emit('done', result);
  return result;
}
```

---

## Migration Notes

### What stays the same
- `Embedder` base class and all providers (Ollama, Transformers) — unchanged
- `Chunker` base class and Treesitter — unchanged
- Dynamic loader pattern (`embedders/index.js`, `chunkers/index.js`) — unchanged
- The embeddings JSON cache file format — unchanged (backward compatible)
- Config module — unchanged

### What changes

| Current                                              | New                                               |
|------------------------------------------------------|---------------------------------------------------|
| `new Embed(config)` + `loadModel()` + `processCodebase()` | `Indexer.create(config)` → `.index(options)` |
| `new VectorDB(opts)` + `bulkInsert(file)`            | `VectorStore.connect(config)` → `.ingest(indexResult)` |
| `new VectorSearch(opts)` + `initialize()` + `search()` | Same `VectorStore` instance → `.search(query)` |
| Progress via positional `cb` param                    | EventEmitter: `.on('progress', handler)`         |
| `Embed.loadChunker()` static helper                  | Internal to `Indexer.create()` (private)          |

### Breaking changes
- `Embed` class removed from public API (replaced by `Indexer`)
- `VectorDB` and `VectorSearch` removed from public API (replaced by `VectorStore`)
- Progress delivery changes from callback to EventEmitter
- The Pulsar `ContextManager` will need updating to use the new API (see example above)

---

## Open Questions

1. **Should `VectorStore.search()` lazy-load its own embedding model?**
   Currently `VectorSearch` loads its own embedder on `initialize()` for query embedding.
   Should `VectorStore` do the same internally, or should it accept an `Indexer` reference
   to reuse the already-loaded model? Reuse saves memory; independence is simpler.

2. **Should `Indexer.index()` return the raw chunks array as well?**
   The current `Embed.processCodebase()` doesn't expose chunks directly (they're in the
   cache file). If the Pulsar plugin wants to show chunk previews in the UI without
   re-reading the JSON, it'd be useful. But it makes `IndexResult` heavier.

3. **AbortController support.**
   Should `index()` and `ingest()` accept an `AbortSignal` for cancellation? This would
   let the Pulsar plugin cancel a running index if the user switches projects. The
   EventEmitter model makes this easy to implement — check `signal.aborted` between phases.
   This is a natural fit since `AbortController` is a standard ESM/Web API available in
   Node 20+ and Electron 30.
