#!/usr/bin/env node

/**
 * CLI for rag-codebase-indexer
 *
 * Uses the Pipeline Composition API:
 *   Indexer      — scan → chunk → embed → cache
 *   VectorStore  — ingest cached embeddings + hybrid search
 *
 * Commands:
 *   embed <path>       Chunk & embed a codebase (writes cache file)
 *   load <file>        Ingest cached embeddings into ChromaDB
 *   search <query>     Hybrid search (exact + semantic + keyword fusion)
 *   analyze <file>     Analyze chunk sizes in an embeddings file
 */

import { Indexer, VectorStore, config } from '../lib/rag-codebase-indexer.js';
import Logger from '../config/Logger.js';
import fs from 'fs/promises';
import path from 'node:path';

const log = new Logger(config.env);

// ── Help ─────────────────────────────────────────────────────

function printHelp() {
  log.info(`
  🌳 rag-codebase-indexer CLI
  ============================================
  Pipeline Composition API — scan → chunk → embed → ingest → search

  Commands:
    embed <path>       - Chunk & embed a codebase (writes cache file)
    load <file>        - Ingest cached embeddings into ChromaDB
    search <query>     - Hybrid search (exact + semantic + keyword)
    analyze <file>     - Analyze chunk sizes in an embeddings file

  Embed Options:
    --provider <name>   Embedding provider: Ollama | Transformers (default: Ollama)
    --model <name>      Model name (default: nomic-embed-text)
    --chunker <name>    Chunker: Treesitter (default: Treesitter)
    --cache-dir <dir>   Directory for embedding cache (default: ./embeddings_cache)
    --project <name>    Project name for cache file naming

  Load Options:
    --collection <name> Collection name (required)
    --url <url>         ChromaDB URL (default: http://localhost:8000)
    --batch-size <n>    Insert batch size (default: 200)
    --dimensions <n>    Embedding dimensions (reads from file if omitted)
    --provider <name>   Embedding provider (default: Ollama)
    --model <name>      Model name (default: nomic-embed-text)

  Search Options:
    --collection <name> Collection name (required)
    --url <url>         ChromaDB URL (default: http://localhost:8000)
    --provider <name>   Embedding provider for query (default: Ollama)
    --model <name>      Embedding model for query (default: nomic-embed-text)
    --top-k <n>         Max results (default: 15)
    --file <pattern>    Filter results by file path
    --interactive       Start interactive search mode

  Examples:
    node cli.js embed ./src
    node cli.js embed ./src --provider Ollama --model nomic-embed-text
    node cli.js load ./embeddings_cache/embeddings_myproject.json --collection my-project
    node cli.js search "authentication middleware" --collection my-project
    node cli.js search --interactive --collection my-project
    node cli.js analyze ./embeddings_cache/embeddings_myproject.json
  `);
  process.exit(1);
}

// ── Arg Parser ───────────────────────────────────────────────

function parseArgs(args) {
  const parsed = {
    command: null,
    positional: [],
    options: {},
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const optionName = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('--')) {
        parsed.options[optionName] = nextArg;
        i++;
      } else {
        parsed.options[optionName] = true;
      }
    } else if (!parsed.command) {
      parsed.command = arg;
    } else {
      parsed.positional.push(arg);
    }
  }

  return parsed;
}

// ── Commands ─────────────────────────────────────────────────

/**
 * embed — Indexer.create() → indexer.index()
 *
 * Subscribes to EventEmitter progress/error/done events for CLI output.
 */
async function handleEmbed(commandArgs) {
  const [codebasePath] = commandArgs.positional;

  if (!codebasePath) {
    log.error('Error: Please specify a codebase path');
    printHelp();
  }

  const provider = commandArgs.options.provider || 'Ollama';
  const model = commandArgs.options.model || 'nomic-embed-text';
  const chunker = commandArgs.options.chunker || 'Treesitter';
  const cacheDir = commandArgs.options['cache-dir'] || './embeddings_cache';
  const projectName = commandArgs.options.project || path.basename(path.resolve(codebasePath));

  log.info(`🚀 Creating Indexer: ${provider} → ${model} (chunker: ${chunker})`);

  const indexer = await Indexer.create({
    provider,
    model,
    chunker,
    projectName,
  });

  // ── Subscribe to events ──────────────────────────────────

  indexer.on('progress', (evt) => {
    switch (evt.status) {
      case 'start':
        log.info(`\n── ${evt.phase.toUpperCase()} ──`);
        break;
      case 'progress':
        // Only log every 10th embed event to avoid flooding
        if (evt.phase === 'embed' && evt.current % 10 !== 0 && evt.current !== evt.total) break;
        log.info(`  [${evt.phase}] ${evt.current}/${evt.total} ${evt.message || ''}`);
        break;
      case 'complete':
        log.info(`  ✅ ${evt.phase}: ${evt.message}`);
        break;
    }
  });

  indexer.on('error', (evt) => {
    const prefix = evt.recoverable ? '⚠️' : '❌';
    log.error(`  ${prefix} [${evt.phase}] ${evt.message}`);
  });

  indexer.on('done', (result) => {
    log.info(`\n🎉 Indexing complete!`);
    log.info(`   Model: ${result.model}`);
    log.info(`   Dimensions: ${result.dimensions}`);
    log.info(`   Cache file: ${result.embedFile}`);
    log.info(`   Timestamp: ${result.timestamp}`);
    log.info(`\n   Next steps:`);
    log.info(`   → Load into ChromaDB: node cli.js load ${result.embedFile} --collection <name>`);
    log.info(`   → Analyze chunks:     node cli.js analyze ${result.embedFile}`);
  });

  // ── Run the pipeline ─────────────────────────────────────

  console.time('Total indexing time');

  try {
    await indexer.index({
      projectPath: path.resolve(codebasePath),
      cacheDir,
      include: config.embed?.codebase?.include || ['**/*.js', '**/*.mjs', '**/*.ts', '**/*.py', '**/*.jsx', '**/*.tsx'],
      exclude: config.embed?.codebase?.exclude || ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.git/**', '**/build/**'],
      maxFileSize: 2 * 1024 * 1024,
    });
  } finally {
    console.timeEnd('Total indexing time');
    await indexer.dispose();
  }
}


/**
 * load — VectorStore.connect() → store.ingest()
 *
 * Reads the embedFile, connects to ChromaDB, bulk inserts.
 */
async function handleLoad(commandArgs) {
  const [file] = commandArgs.positional;

  if (!file) {
    log.error('Error: Please specify an embeddings file');
    printHelp();
  }

  const collection = commandArgs.options.collection;
  if (!collection) {
    log.error('Error: --collection is required');
    printHelp();
  }

  const url = commandArgs.options.url || 'http://localhost:8000';
  const batchSize = commandArgs.options['batch-size']
    ? parseInt(commandArgs.options['batch-size'], 10)
    : 200;
  const provider = commandArgs.options.provider || 'Ollama';
  const model = commandArgs.options.model || 'nomic-embed-text';

  // Read dimensions from the embeddings file if not provided
  let dimensions = commandArgs.options.dimensions
    ? parseInt(commandArgs.options.dimensions, 10)
    : null;

  if (!dimensions) {
    try {
      const data = JSON.parse(await fs.readFile(file, 'utf-8'));
      dimensions = data.dimensions;
      if (!dimensions) {
        log.error('Error: Could not read dimensions from embeddings file. Use --dimensions <n>');
        process.exit(1);
      }
    } catch (err) {
      log.error(`Error reading embeddings file: ${err.message}`);
      process.exit(1);
    }
  }

  log.info(`📦 Connecting to ChromaDB: ${url}`);
  log.info(`   Collection: ${collection}`);
  log.info(`   Batch size: ${batchSize}`);
  log.info(`   Dimensions: ${dimensions}`);

  const store = await VectorStore.connect({
    url,
    collection,
    batchSize,
    dimensions,
    embedOptions: { provider, model },
  });

  // ── Subscribe to events ──────────────────────────────────

  store.on('start', (evt) => {
    log.info(`\n── ${evt.phase.toUpperCase()} ──`);
    log.info(`   ${evt.message}`);
  });

  store.on('progress', (evt) => {
    log.info(`  [${evt.phase}] ${evt.message}`);
  });

  store.on('error', (evt) => {
    const prefix = evt.recoverable ? '⚠️' : '❌';
    log.error(`  ${prefix} [${evt.phase}] ${evt.message}`);
  });

  store.on('complete', (evt) => {
    log.info(`  ✅ ${evt.message}`);
  });

  // ── Run ingestion ────────────────────────────────────────

  console.time('Ingestion time');

  try {
    const stats = await store.ingest({ embedFile: file, dimensions });

    log.info(`\n🎉 Ingestion complete!`);
    log.info(`   Collection: ${stats.collection}`);
    log.info(`   Inserted: ${stats.inserted}`);
    log.info(`   Rate: ${stats.rate} items/sec`);
    log.info(`   Time: ${stats.totalTime}s`);
    log.info(`\n   Next step:`);
    log.info(`   → Search: node cli.js search "your query" --collection ${collection}`);
  } finally {
    console.timeEnd('Ingestion time');
    await store.dispose();
  }
}


/**
 * search — VectorStore.connect() → store.search()
 *
 * Runs hybrid search (exact + semantic + keyword) with fusion ranking.
 */
async function handleSearch(commandArgs) {
  const query = commandArgs.positional.join(' ');

  const collection = commandArgs.options.collection;
  if (!collection) {
    log.error('Error: --collection is required');
    printHelp();
  }

  const url = commandArgs.options.url || 'http://localhost:8000';
  const provider = commandArgs.options.provider || 'Ollama';
  const model = commandArgs.options.model || 'nomic-embed-text';
  const topK = commandArgs.options['top-k']
    ? parseInt(commandArgs.options['top-k'], 10)
    : 15;
  const fileFilter = commandArgs.options.file || null;
  const dimensions = commandArgs.options.dimensions
    ? parseInt(commandArgs.options.dimensions, 10)
    : 384;

  if (commandArgs.options.interactive) {
    return interactiveSearch({ url, collection, provider, model, topK, dimensions });
  }

  if (!query) {
    log.error('Error: Please specify a search query or use --interactive');
    printHelp();
  }

  const store = await VectorStore.connect({
    url,
    collection,
    dimensions,
    embedOptions: { provider, model },
  });

  store.on('error', (evt) => {
    log.error(`  ⚠️ [${evt.phase}] ${evt.message}`);
  });

  try {
    const filters = fileFilter ? { source_file: fileFilter } : {};

    const results = await store.search(query, { topK, filters });

    formatSearchResults(results, query);
  } finally {
    await store.dispose();
  }
}


/**
 * Interactive search REPL.
 */
async function interactiveSearch(opts) {
  const { url, collection, provider, model, topK, dimensions } = opts;

  const store = await VectorStore.connect({
    url,
    collection,
    dimensions,
    embedOptions: { provider, model },
  });

  store.on('error', (evt) => {
    log.error(`  ⚠️ [${evt.phase}] ${evt.message}`);
  });

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  log.info(`
🌳 Interactive Code Search
================================================
Collection: ${collection}
Provider:   ${provider} → ${model}
Commands:   /quit to exit

Enter a search query:
`);

  const ask = () => {
    rl.question('\n🔍 Search: ', async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === '/quit' || trimmed.toLowerCase() === 'exit') {
        log.info('\n👋 Goodbye!');
        rl.close();
        await store.dispose();
        return;
      }

      if (!trimmed) {
        ask();
        return;
      }

      try {
        const results = await store.search(trimmed, { topK });
        formatSearchResults(results, trimmed);
      } catch (err) {
        log.error(`Error: ${err.message}`);
      }

      ask();
    });
  };

  ask();
}


/**
 * analyze — Read an embeddings file and report chunk size distribution.
 */
async function handleAnalyze(commandArgs) {
  const [file] = commandArgs.positional;

  if (!file) {
    log.error('Error: Please specify an embeddings file');
    printHelp();
  }

  log.info(`📊 Analyzing chunk sizes in: ${file}`);

  const data = JSON.parse(await fs.readFile(file, 'utf-8'));

  const sizes = data.chunks.map(c => (c.text || '').length);
  const avg = sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;
  const max = sizes.length > 0 ? Math.max(...sizes) : 0;
  const min = sizes.length > 0 ? Math.min(...sizes) : 0;

  log.info(`\n📊 Chunk Size Analysis:`);
  log.info('='.repeat(40));
  log.info(`Total chunks: ${sizes.length}`);
  log.info(`Model: ${data.model || 'unknown'}`);
  log.info(`Dimensions: ${data.dimensions || 'unknown'}`);
  log.info(`Average size: ${Math.round(avg)} chars`);
  log.info(`Min size: ${min} chars`);
  log.info(`Max size: ${max} chars`);

  const bins = {
    '0-100': 0,
    '100-500': 0,
    '500-1000': 0,
    '1000-2000': 0,
    '2000+': 0,
  };

  sizes.forEach(size => {
    if (size <= 100) bins['0-100']++;
    else if (size <= 500) bins['100-500']++;
    else if (size <= 1000) bins['500-1000']++;
    else if (size <= 2000) bins['1000-2000']++;
    else bins['2000+']++;
  });

  log.info('\nSize distribution:');
  Object.entries(bins).forEach(([range, count]) => {
    const pct = sizes.length > 0 ? ((count / sizes.length) * 100).toFixed(1) : '0.0';
    const bar = '█'.repeat(Math.round(count / sizes.length * 40));
    log.info(`  ${range.padEnd(10)} ${String(count).padStart(5)} (${pct.padStart(5)}%) ${bar}`);
  });
}


// ── Formatting ───────────────────────────────────────────────

/**
 * Format and print a SearchResult to stdout.
 *
 * @param {SearchResult} searchResult
 * @param {string} query
 */
function formatSearchResults(searchResult, query) {
  const { results, groupedByFile, searchStats } = searchResult;

  if (results.length === 0) {
    log.info(`\n🔍 No results for: "${query}"`);
    return;
  }

  log.info(`\n📁 Results grouped by file:`);
  log.info('='.repeat(60));

  for (const [filePath, items] of groupedByFile.entries()) {
    const fileName = path.basename(filePath);
    log.info(`\n📄 ${fileName} (${filePath})`);
    log.info('-'.repeat(40));

    items.forEach((item, i) => {
      const type = item.type || 'code';
      const isClass = type === 'class';
      const icon = isClass ? '🏛️ ' : '';
      const sources = item.sources ? `(${[...item.sources].join('+')})` : '';

      log.info(`${i + 1}. ${icon}[${type}] Relevance: ${item.relevance.toFixed(3)} ${sources}`);

      if (item.lineStart != null && item.lineEnd != null) {
        log.info(`   Lines: ${item.lineStart}-${item.lineEnd}`);
      }

      if (item.functionName) log.info(`   Function: ${item.functionName}`);
      if (item.className) log.info(`   Class: ${item.className}`);

      const previewLen = isClass ? 1200 : (type === 'function' || type === 'method' ? 800 : 400);
      log.info(`\n${item.code.substring(0, previewLen)}`);
      if (item.code.length > previewLen) {
        log.info(`\n... (${item.code.length - previewLen} more characters)\n`);
      }
      log.info('');
    });
  }

  log.info(`\n📊 Search Statistics:`);
  log.info('='.repeat(40));
  log.info(`Total results: ${searchStats.total}`);
  log.info(`Exact matches: ${searchStats.exact}`);
  log.info(`Semantic matches: ${searchStats.semantic}`);
  log.info(`Keyword matches: ${searchStats.keyword}`);
  log.info(`Files: ${groupedByFile.size}`);
}


// ── Main ─────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    printHelp();
  }

  const commandArgs = parseArgs(args);

  switch (commandArgs.command) {
    case 'embed':
      await handleEmbed(commandArgs);
      break;

    case 'load':
      await handleLoad(commandArgs);
      break;

    case 'search':
      await handleSearch(commandArgs);
      break;

    case 'analyze':
      await handleAnalyze(commandArgs);
      break;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    default:
      log.error(`Unknown command: ${commandArgs.command}`);
      printHelp();
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log.error('Fatal error:', error);
    process.exit(1);
  });
}
