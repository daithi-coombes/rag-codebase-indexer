import _ from 'lodash';
import Logger from './Logger.js';

const ENV = process.env.NODE_ENV || 'development';
const log = new Logger();

const defaultConfig = {
  "chunker": {
    "type": "Treesitter",
    "chunkSize": 1500,
    "chunkOverlap": 200
  },
  "embed": {
    "codebase": {
      batchSize: 50,
      cacheDir: './embeddings_cache',
      exclude: [ '**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.git/**', '**/vendor/**', '**/*.test.js', '**/*.spec.js', '**/*.d.ts'],
      include: ['**/*.js', '**/*.js', '**/*.ts', '**/*.py', '**/*.jsx', '**/*.tsx'],
      maxFileSize: 2 * 1024 * 1024,
      projectName: "rag-codebase-indexer"
    },
    "model": {},
  },
  "providers": {
    "Ollama": {
      host: 'http://localhost:11434',
      timeout: 30000, // 30 seconds
      dimensions: null,
      keepAlive: '5m',
      options: {},
      models: {
        "nomic-embed-text": {
          "type": "embed",
          "dimensions": 768,
          "maxTokens": 2048
        },
        "mxbai-embed-large": {
          "type": "embed",
          "dimensions": 1024,
          "maxTokens": 512
        },
        "all-minilm": {
          "type": "embed",
          "dimensions": 384,
          "maxTokens": 512
        },
        "snowflake-arctic-embed": {
          "type": "embed",
          "dimensions": 1024,
          "maxTokens": 512
        },
        "bge-m3": {
          "type": "embed",
          "dimensions": 1024,
          "maxTokens": 8192
        },
        "bge-large": {
          "type": "embed",
          "dimensions": 1024,
          "maxTokens": 512
        },
        "embeddinggemma": {
          "type": "embed",
          "dimensions": 768,
          "maxTokens": 2048
        },
        "qwen3-embedding": {
          "type": "embed",
          "dimensions": 1024,
          "maxTokens": 32768
        },
        "deepseek-coder": {
          "type": "llm",
          "contextWindow": 16384,
          "temperature": 0.7
        },
        "deepseek-r1": {
          "type": "llm",
          "contextWindow": 16384,
          "temperature": 0.7
        },
        "llama3": {
          "type": "llm",
          "contextWindow": 8192,
          "temperature": 0.8,
          "maxTokens": 4096
        },
        "llama3.1": {
          "type": "llm",
          "contextWindow": 131072,
          "temperature": 0.7,
          "maxTokens": 4096
        },
        "llama3.2": {
          "type": "llm",
          "contextWindow": 131072,
          "temperature": 0.7,
          "maxTokens": 4096
        },
        "codellama": {
          "type": "llm",
          "contextWindow": 16384,
          "temperature": 0.5,
          "maxTokens": 4096
        },
        "mistral": {
          "type": "llm",
          "contextWindow": 32768,
          "temperature": 0.7
        },
        "mixtral": {
          "type": "llm",
          "contextWindow": 32768,
          "temperature": 0.7
        },
        "gemma3": {
          "type": "llm",
          "contextWindow": 8192,
          "temperature": 0.7
        },
        "qwen2.5": {
          "type": "llm",
          "contextWindow": 32768,
          "temperature": 0.7
        },
        "qwen3": {
          "type": "llm",
          "contextWindow": 32768,
          "temperature": 0.7
        },
        "phi3": {
          "type": "llm",
          "contextWindow": 4096,
          "temperature": 0.7
        },
        "starcoder2": {
          "type": "llm",
          "contextWindow": 16384,
          "temperature": 0.5
        },
        "command-r": {
          "type": "llm",
          "contextWindow": 131072,
          "temperature": 0.7
        }
      }
    },
    "Transformers": {
      "Xenova/all-MiniLM-L6-v2": {
        "type": "embed",
        "dimensions": 384,
        "maxTokens": 512,
        "quantized": true
      },
      "Xenova/bge-small-en-v1.5": {
        "type": "embed",
        "dimensions": 384,
        "maxTokens": 512,
        "quantized": true
      },
      "Xenova/all-mpnet-base-v2": {
        "type": "embed",
        "dimensions": 768,
        "maxTokens": 512,
        "quantized": false
      }
    }
  }
}

/**
* Get an embed config, adds missing defaults.
*
* @param  {Object} config The user provided config.
* @return {Object}        Complete object.
*/
export function getEmbed(config) {
  const { name, provider } = config.model;
  if (!name || !provider) {
    throw new Error(`Embed config missing 'name' or 'provider'`);
  }

  const userModelOpts     = config.model.options || {};
  const defaultModelOpts  = defaultConfig.providers[provider].models[name];
  config.model.options    = _.merge({}, defaultModelOpts, userModelOpts);

  // TODO: tinish this, there will be more than one chunker
  const chunker = _.merge({}, defaultConfig.embed.chunker, config.chunker);

  const codebase = _.mergeWith({}, defaultConfig.embed.codebase, config.codebase, (objValue, srcValue) => {
    return (Array.isArray(srcValue)) ? srcValue : undefined;
  });

  return {
    codebase,
    model: config.model,
    chunker
  }
}

export function getProvider(provider = 'Ollama') {
  return defaultConfig[provider];
}

export const deprecatedConfig = {
  env: ENV,
  embed: {
    batchSize: 16,
    cacheDir: './embeddings_cache',
    codebase: {
      ignore: [ '**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.git/**', '**/vendor/**', '**/*.test.js', '**/*.spec.js', '**/*.d.ts'],
      maxFileSize: 2 * 1024 * 1024, // skip files over this limit
      patterns: ['**/*.js', '**/*.js', '**/*.ts', '**/*.py', '**/*.jsx', '**/*.tsx']
    },
    model: {
      name: 'Xenova/all-MiniLM-L6-v2',
      options: {
        dimensions: 384,
        pooling: 'mean',
        normalize: true,
        truncation: true,
        max_length: 512
      }
    },
  },
  chunker: 'Treesitter',
  stats: {
    filesProcessed: 0,
    totalChunks: 0,
    languages: new Map()
  }
};

export default defaultConfig;
