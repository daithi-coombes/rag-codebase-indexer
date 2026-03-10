import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import Treesitter from '../../../lib/chunkers/Treesitter.js';
import assert from 'node:assert';
import chunkParamJavascriptFixtures from '../../fixtures/Treesitter.buildChunk.javascript.params.js';
import chunkExpectedJavascriptFixtures from '../../fixtures/Treesitter.buildChunk.javascript.expected.js';
import chunkParamGolangFixtures from '../../fixtures/Treesitter.buildChunk.golang.params.js';
import chunkExpectedGolangFixtures from '../../fixtures/Treesitter.buildChunk.golang.expected.js';
import fs from 'node:fs';
import mockFs from 'mock-fs';

// load fixtures
const fixtures = {
  javascriptCodebase: fs.readFileSync('./tests/fixtures/codebases/javascriptFixture.js', 'utf8'),
  golangCodebase: fs.readFileSync('./tests/fixtures/codebases/golangFixture.go', 'utf8'),
  parseCodeFileExpected: fs.readFileSync('./tests/fixtures/Treesitter.parseCodeFile.expected.js', 'utf8')
};

describe('Treesitter', () => {
  let underTest;
  beforeEach(() => {
    underTest = new Treesitter();
    underTest.log.error = mock.fn();
    underTest.log.info = mock.fn();

    mockFs({
      'workspace/foo/bar': {
        'test-file-1.js': fixtures.javascriptCodebase,
        'test-file-2.js': fixtures.golangCodebase,
        'ignore-this-file.foobar': 'foobar',
        'inner-folder': {
          'test-file-3.js': 'console.log("testing mock fs")',
          'test-file-4.js': '',
          'ignore-this-file.foobar': 'foobar'
        }
      }
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe('buildChunk()', () => {
    describe('Javascript', () => {
      chunkParamJavascriptFixtures.forEach((params, i) => {
        it(`will create javascript chunks: ${params[0].type}`, async () => {
          const actual = underTest.buildChunk(...params);
          const expected = chunkExpectedJavascriptFixtures[i];

          assert.deepEqual(actual, expected);
        });
      });
    });

    describe('Golang', () => {
      chunkParamGolangFixtures.forEach((params, i) => {
        it(`will create golang chunks: ${params[0].type}`, async () => {
          const actual = underTest.buildChunk(...params);
          const expected = chunkExpectedGolangFixtures[i];

          assert.deepEqual(actual, expected);
        });
      });
    });

    it('will log error and return null', () => {
      const actual = underTest.buildChunk({});

      assert.equal(actual, null);
      assert.match(underTest.log.error.mock.calls[0].arguments[0], /^Error creating chunk:(.)+$/);
    });
  });

  describe('getEntityName()', () => {
    it('will catch errors and return anonymous', () => {
      const actual = underTest.getEntityName();
      const expected = 'anonymous';

      assert.strictEqual(actual, expected);
      assert.strictEqual(underTest.log.error.mock.calls[0].arguments[0], "Error in getEntityName: Cannot read properties of undefined (reading 'type')");
    });

    it('will catch identity', () => {

      const actual = underTest.getEntityName({
        type: 'variable_declarator',
        startPosition: {row: 8, column: 6},
        endPosition: {row: 8, column: 23},
        childCount: 1,
        child: () => {
          return {
            type: 'identifier',
            startPosition: {row: 36, column: 6},
            endPosition: {row: 36, column: 18},
            childCount: 0,
          }
        }
      }, fixtures.javascriptCodebase);
      const expected = 'fixtureArrow';

      assert.strictEqual(actual, expected);
    });
  });

  describe('getFieldNode()', () => {
    it('will return child node', () => {
      const node = {
        childForFieldName: mock.fn()
      };

      underTest.getFieldNode(node, 'foobar');

      assert.strictEqual(node.childForFieldName.mock.calls[0].arguments[0], 'foobar');
    });

    it('will return null if no child node', () => {
      const node = {};

      const actual = underTest.getFieldNode(node, 'foobar');

      assert.strictEqual(actual, null);
    });
  });

  describe('getLanguageFromPath()', () => {
    ['mjs', 'cjs', 'js'].forEach(ext => {
      it(`will get language for ${ext} file`, () => {

        const actual = underTest.getLanguageFromPath(`test-file.${ext}`);
        const expected = 'js';

        assert.strictEqual(actual, expected);
      });
    })
  });

  describe('parseCodeFile()', () => {
    it('will log error if no parser found', () => {
      const actual = underTest.parseCodeFile('foobar.biz', 'blahdeeblah');
      const expected = [];

      assert.deepStrictEqual(actual, expected);
      assert.strictEqual(underTest.log.error.mock.calls[0].arguments[0], 'No Tree-sitter parser for biz');
    });

    it('will create chunks', () => {
      underTest.printASTStats = () => {};

      const actual = underTest.parseCodeFile('workspace/foo/bar/test-file-1.js', fixtures.javascriptCodebase);

      assert.strictEqual(underTest.log.info.mock.calls[1].arguments[0], 'Extracted 10 chunks from workspace/foo/bar/test-file-1.js');
      assert.strictEqual(actual.length, 10);
    });

    it('will log error if no chunks found', () => {
      underTest.printASTStats = () => {}
      underTest.extractChunksFromAST = () => [];

      const actual = underTest.parseCodeFile('workspace/foo/bar/test-file-1.js', fixtures.javascriptCodebase);
      const expected = [];

      assert.strictEqual(underTest.log.error.mock.calls[0].arguments[0], 'No AST chunks extracted from workspace/foo/bar/test-file-1.js');
      assert.deepStrictEqual(actual, expected);
    });

    it('will catch errors', () => {
      underTest.languageParsers.get = () => {
        return {
          parse: () => {
            throw new Error('foobar');
          }
        }
      }

      const actual = underTest.parseCodeFile('workspace/foo/bar/test-file-1.js', fixtures.javascriptCodebase);
      const expected = [];

      assert.strictEqual(underTest.log.error.mock.calls[0].arguments[0], 'Tree-sitter parsing failed for workspace/foo/bar/test-file-1.js: foobar');
      assert.deepStrictEqual(actual, expected);
    });
  });

  describe('extractChunksFromAST()', () => {
    it('will throw error if no language def', () => {
      underTest.extractChunksFromAST({}, '', '', 'foobar'),

      assert.strictEqual(underTest.log.error.mock.calls[0].arguments[0], 'No language definition for \'foobar\'');
    });
  });

  describe('printASTStats()', () => {
    it('will print stats', () => {
      underTest.printASTStats({
        type: 'arrow_function',
        startPosition: {row: 31, column: 28},
        endPosition: {row: 31, column: 71},
        childCount: 1,
        child: () => {
          return {
            type: 'arrow_function',
            startPosition: {row: 31, column: 28},
            endPosition: {row: 31, column: 71},
            childCount: 0,
          }
        }
      });

      assert.deepStrictEqual(underTest.log.info.mock.calls[0].arguments[0], '📊 AST Node Statistics:');
      assert.deepStrictEqual(underTest.log.info.mock.calls[1].arguments[0], '  arrow_function: 2');
    });
  });

});
