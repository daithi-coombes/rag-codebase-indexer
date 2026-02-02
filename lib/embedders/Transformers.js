import { pipeline, env } from '@huggingface/transformers';
import Embedder from './Embedder.js';

// Disable local model cache issues
env.allowLocalModels = false;

/**
 * Transformer-based embedder using Hugging Face transformers.js
 * Supports various sentence-transformer models from Hugging Face Hub.
 *
 * @class Transformer
 * @extends {Embedder}
 */
class Transformers extends Embedder {
  // TODO: finish this
}

export default Transformers;
