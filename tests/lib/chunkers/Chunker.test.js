import { describe, it } from 'node:test';
import Chunker from '../../../lib/chunkers/Chunker.js';

describe('Chunker', () => {
  it('will load', () => {
    const actual = new Chunker();
    actual.parseCodeFile();
  });
});
