import javascript from './javascript.js';
import golang from './golang.js';

/**
 * Registry of all language definitions.
 *
 * To add a new language:
 *  1. Create a new file in this directory (e.g. `python.js`)
 *  2. Import it here and add it to the array
 *  3. Implement any language-specific parse handlers in Treesitter.js
 */
export default [
  javascript,
  golang,
];
