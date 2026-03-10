# rag-codebase-indexer

[![CI](https://github.com/daithi-coombes/rag-codebase-indexer/actions/workflows/ci.yml/badge.svg)](https://github.com/daithi-coombes/rag-codebase-indexer/actions/workflows/ci.yml)

Index, embed and store a codebase in a vector database, then search for semantic context on your prompts.

> [!CAUTION]
> This is a beta release — help is appreciated: [issues](https://github.com/daithi-coombes/rag-codebase-indexer/issues)

All LLM code files are in [.docs](./docs).


## Overview

The pipeline has three stages:

1. **Index** - Create embeddings, stores state in JSON file by default.
    1. **Chunk** — parse source files into AST-aware chunks [Treesitter by default]
    2. **Embed** — generate vector embeddings for each chunk (Ollama / HuggingFace Transformers)
2. **Ingest** — store chunks + embeddings in a vector database (ChromaDB)
3. **Search** — hybrid search combining exact, semantic, and keyword matching

Two primary exports drive this: **`Indexer`** handles stages 1.1–1.2, **`VectorStore`** handles stages 2–3. Both extend `EventEmitter` and emit progress events during long-running operations.


## Requirements

- Node.js ≥ 20 (ESM)
- [Ollama](https://ollama.ai) running locally (default embedding provider)
- [ChromaDB](https://www.trychroma.com/) running locally (default vector store)
- Docker (for ChromaDB): `docker-compose up -d`


## Installation

```bash
npm install
```

## Module Usage

```javascript
import { Indexer, VectorStore } from 'rag-codebase-indexer';

// ── Index ─────────────────────────────────────────────────

const indexer = await Indexer.create({
  provider: 'Ollama',
  model: 'nomic-embed-text',
  projectName: 'my-project',
});

indexer.on('progress', ({ phase, current, total, message }) => {
  process.stdout.write(`\r[${phase}] ${current}/${total} — ${message}`);
});

indexer.on('error', ({ phase, message, recoverable }) => {
  if (recoverable) console.warn(`\n⚠ [${phase}] ${message}`);
});

const result = await indexer.index({
  projectPath: '/home/user/my-project',
  cacheDir: '~/.cache/rag',
});

// ── Ingest ────────────────────────────────────────────────

const store = await VectorStore.connect({
  collection: 'my-project',
  dimensions: result.dimensions,
});

store.on('progress', ({ phase, current, total }) => {
  if (phase === 'ingest') {
    process.stdout.write(`\rIngesting: ${current}/${total}`);
  }
});

await store.ingest(result);

// ── Search ────────────────────────────────────────────────

const searchResult = await store.search('how does authentication work?', {
  topK: 10,
  filters: { source_file: 'src/auth/' },
});

console.log(searchResult.results);

// ── Cleanup ───────────────────────────────────────────────

await indexer.dispose();
await store.dispose();
```

### Event System

Both `Indexer` and `VectorStore` emit typed events:

| Event | Payload | Description |
|-------|---------|-------------|
| `progress` | `{ phase, status, current, total, message }` | Granular phase/status updates |
| `error` | `{ phase, message, error, recoverable }` | Non-fatal errors (pipeline continues). Fatal errors reject the Promise. |
| `done` | `IndexResult` or `IngestResult` | Pipeline complete. Also returned by `await`. |

Phases for `Indexer`: `scan` → `chunk` → `embed` → `cache`. Phases for `VectorStore`: `ingest`, `search`.


## Configuration

### Adding a provider

Add the provider to `config -> providers[]`
```javascript
...
"providers": {
  "$providerName": {
    opts: {},
    models: {
      '$modelName': { ...}
    }
  }
  "Ollama": {
    ...
  }
  "Transformers": {
    ...
  }
...
```

Create the embedder logic for your new provider by extending
 `lib/embedders/Embedder.js` with `$providerName.js` (camel case):

```javascript
import { Ollama as OllamaClient } from 'ollama';
import Embedder from './Embedder.js';

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
...
async initialize() {...}
async embed(text {...}
async embedBatch(texts) {...}
getDimensions() {...}
getModelName() {...}
}
```


### Adding a model
 - add the model to `config -> providers -> models`:
```javascript
"providers": {
  "Ollama": {
    host: 'http://localhost:11434',
    timeout: 30000, // 30 seconds
    dimensions: null,
    keepAlive: '5m',
    options: {},
    models: {
      ...
    }
    "Transformers": {
      models: {
      ...
      }
  }
```


## CLI Usage

The CLI wraps the same `Indexer` and `VectorStore` APIs.

### Embed a codebase

Scans files, chunks with Treesitter, generates embeddings, and writes a cache file.

```bash
node bin/cli.js embed ./src
node bin/cli.js embed ./src --provider Ollama --model nomic-embed-text
node bin/cli.js embed ./src --chunker Treesitter --cache-dir ~/.cache/rag --project my-project
```

| Option | Default | Description |
|--------|---------|-------------|
| `--provider` | `Ollama` | Embedding provider (`Ollama` or `Transformers`) |
| `--model` | `nomic-embed-text` | Model name |
| `--chunker` | `Treesitter` | Chunking strategy |
| `--cache-dir` | `./embeddings_cache` | Where to write the embeddings JSON |
| `--project` | directory name | Project name (used in cache filename) |

### Load into ChromaDB

Reads a cached embeddings file and bulk-inserts into a ChromaDB collection.

```bash
node bin/cli.js load ./embeddings_cache/embeddings_my-project.json --collection my-project
```

| Option | Default | Description |
|--------|---------|-------------|
| `--collection` | *(required)* | ChromaDB collection name |
| `--url` | `http://localhost:8000` | ChromaDB URL |
| `--batch-size` | `200` | Insert batch size |
| `--dimensions` | *(read from file)* | Override embedding dimensions |
| `--provider` | `Ollama` | Embedding provider |
| `--model` | `nomic-embed-text` | Model name |

### Search

Runs hybrid search (exact identifier matching + semantic vector similarity + keyword) with fusion ranking.

```bash
node bin/cli.js search "authentication middleware" --collection my-project
node bin/cli.js search "handleAuth" --collection my-project --file src/auth/
node bin/cli.js search --interactive --collection my-project
```

| Option | Default | Description |
|--------|---------|-------------|
| `--collection` | *(required)* | ChromaDB collection name |
| `--url` | `http://localhost:8000` | ChromaDB URL |
| `--provider` | `Ollama` | Embedding provider for query embedding |
| `--model` | `nomic-embed-text` | Model name |
| `--top-k` | `15` | Max results |
| `--file` | — | Filter results by file path |
| `--dimensions` | `384` | Embedding dimensions |
| `--interactive` | — | Launch interactive search REPL |

### Analyze chunks

Reports chunk size distribution from an embeddings cache file.

```bash
node bin/cli.js analyze ./embeddings_cache/embeddings_my-project.json
```

## Tests

```bash
npm run coverage
```

## Roadmap

### v0.1.0 — Pipeline Composition API
- [x] `Indexer` async factory with EventEmitter progress
- [x] `VectorStore` with ingest + hybrid search
- [x] CLI rewrite using new API
- [ ] Config module cleanup
- [ ] Release beta

### v0.2.0 — Extensibility
- [ ] Pluggable vector database interface (don't hardcode ChromaDB)
- [ ] Additional embedding providers
- [ ] Additional language support (Go, Python, TypeScript)

### Future
- [ ] Chat memory system
- [ ] AbortController support for cancellable pipelines
