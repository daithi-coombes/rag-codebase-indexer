import { afterEach, beforeEach, describe, it } from 'node:test';
import Treesitter from '../../../lib/chunkers/Treesitter.js';
import assert from 'node:assert';
import chunkParamFixtures from '../../fixtures/Treesitter.buildChunk.params.js';
import chunkFixturesExpected from '../../fixtures/Treesitter.buildChunk.expected.js';
import fs from 'node:fs';
import mock from 'mock-fs';

// load fixtures
const fixtures = {
  javascriptCodebase: fs.readFileSync('./tests/fixtures/codebases/javascriptFixture.js', 'utf8'),
  parseCodeFileExpected: fs.readFileSync('./tests/fixtures/Treesitter.parseCodeFile.expected.js', 'utf8')
};

describe('Treesitter', () => {
  beforeEach(() => {
    mock({
      'workspace/foo/bar': {
        'test-file-1.js': fixtures.javascriptCodebase,
        'test-file-2.js': '',
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
    mock.restore();
  });

  describe('buildChunk()', () => {
    chunkParamFixtures.forEach((params, i) => {
      it(`will create javascript chunks: ${params[0].type}`, async () => {
        const underTest = new Treesitter();

        const actual = underTest.buildChunk(...params);
        const expected = chunkFixturesExpected[i];

        assert.deepEqual(actual, expected);
      });
    });

    it('will log error and return null', () => {
      const underTest = new Treesitter();
      let errorSpy = '';

      underTest.log.error = (err) => errorSpy=err;

      const actual = underTest.buildChunk({});

      assert.equal(actual, null);
      assert.match(errorSpy, /^Error creating chunk:(.)+$/);
    });
  });

  describe('extractJavaScriptChunks()', () => {
    it('will check for variable declarations', () => {
      const underTest = new Treesitter();
      const rootNodeFixture = {
        type: 'variable_declarator',
        startPosition: {row: 8, column: 6},
        endPosition: {row: 8, column: 23},
        childCount: 1,
        child: () => {
          return {
            type: 'identifier',
            startPosition: {row: 8, column: 6},
            endPosition: {row: 8, column: 12},
            childCount: 0
          }
        }
      }
      underTest.buildChunk = () => chunkFixturesExpected[5];

      const { filePath, language } = chunkFixturesExpected[5].metadata;

      const actual = underTest.extractJavaScriptChunks(rootNodeFixture, fixtures.javascriptCodebase, filePath, language);
      const expected = JSON.parse(JSON.stringify(chunkFixturesExpected[5]));
      expected.metadata.variableName = 'fooBar';

      assert.deepStrictEqual(actual, [expected]);
    });

    it('will check for function declarations', () => {
      const underTest = new Treesitter();
      const rootNodeFixture = {
        type: 'function_declaration',
        startPosition: {row: 23, column: 0},
        endPosition: {row: 18, column: 1},
        childCount: 1,
        child: () => {
          return {
            type: 'identifier',
            startPosition: {row: 23, column: 9},
            endPosition: {row: 23, column: 24},
            childCount: 0,
          }
        }
      };
      const { filePath, language } = chunkFixturesExpected[3].metadata;
      underTest.buildChunk = () => chunkFixturesExpected[3];

      const actual = underTest.extractJavaScriptChunks(rootNodeFixture, fixtures.javascriptCodebase, filePath, language);
      const expected = JSON.parse(JSON.stringify(chunkFixturesExpected[3]));
      expected.metadata.functionName = 'fixtureFunction';
      expected.metadata.isAsync = false;

      assert.deepStrictEqual(actual, [expected]);
    });

    it('will check for generator function declarations', () => {
      const underTest = new Treesitter();
      const rootNodeFixture = {
        type: 'generator_function_declaration',
        startPosition: {row: 30, column: 0},
        endPosition: {row: 34, column: 1},
        childCount: 1,
        child: () => {
          return {
            type: 'identifier',
            startPosition: {row: 30, column: 16},
            endPosition: {row: 30, column: 31},
            childCount: 0,
          }
        }
      };
      const { filePath, language } = chunkFixturesExpected[4].metadata;
      underTest.buildChunk = () => chunkFixturesExpected[4];

      const actual = underTest.extractJavaScriptChunks(rootNodeFixture, fixtures.javascriptCodebase, filePath, language);
      const expected = JSON.parse(JSON.stringify(chunkFixturesExpected[4]));
      expected.metadata.functionName = 'async_generator';
      expected.metadata.isAsync = true;

      assert.deepStrictEqual(actual, [expected]);
    });

    it.only('will check for class declarations', () => {
      const underTest = new Treesitter();
      const rootNodeFixture = {
        type: 'class_declaration',
        startPosition: {row: 1, column: 0},
        endPosition: {row: 39, column: 0},
        childCount: 1,
        child: () => {
          return {
            type: 'identifier',
            startPosition: {row: 10, column: 6},
            endPosition: {row: 10, column: 18},
            childCount: 0,
          }
        }
      };
      const { filePath, language } = chunkFixturesExpected[0].metadata;
      underTest.buildChunk = () => chunkFixturesExpected[0];

      const actual = underTest.extractJavaScriptChunks(rootNodeFixture, fixtures.javascriptCodebase, filePath, language);
      const expected = JSON.parse(JSON.stringify(chunkFixturesExpected[0]));
      expected.metadata.className = 'FixtureClass'

      assert.deepStrictEqual(actual, [expected]);
    });

    it('will check for synchronous method declarations', () => {
      const underTest = new Treesitter();
      const rootNodeFixture = {
        type: 'method_definition',
        startPosition: {row: 14, column: 0},
        endPosition: {row: 16, column: 2},
        childCount: 1,
        child: () => {
          return {
            type: 'identifier',
            startPosition: {row: 14, column: 2},
            endPosition: {row: 14, column: 9},
            childCount: 0,
          }
        }
      };
      underTest.buildChunk = () => chunkFixturesExpected[1];
      const { filePath, language } = chunkFixturesExpected[1].metadata;

      const actual = underTest.extractJavaScriptChunks(rootNodeFixture, fixtures.javascriptCodebase, filePath, language);
      const expected = JSON.parse(JSON.stringify(chunkFixturesExpected[1]));
      expected.metadata.methodName = 'method1';
      expected.metadata.isAsync = false;

      assert.deepStrictEqual(actual, [expected]);
    });

    it('will check for asynchronous method declarations', () => {
      const underTest = new Treesitter();
      const rootNodeFixture = {
        type: 'method_definition',
        startPosition: {row: 18, column: 0},
        endPosition: {row: 21, column: 2},
        childCount: 1,
        child: () => {
          return {
            type: 'identifier',
            startPosition: {row: 18, column: 8},
            endPosition: {row: 18, column: 15},
            childCount: 0,
          }
        }
      };
      underTest.buildChunk = () => chunkFixturesExpected[1];
      const { filePath, language } = chunkFixturesExpected[1].metadata;

      const actual = underTest.extractJavaScriptChunks(rootNodeFixture, fixtures.javascriptCodebase, filePath, language);
      const expected = JSON.parse(JSON.stringify(chunkFixturesExpected[1]));
      expected.metadata.methodName = 'method2';
      expected.metadata.isAsync = true;

      assert.deepStrictEqual(actual, [expected]);
    });

    it('will check for named arrow function delcarations', () => {
      const underTest = new Treesitter();
      const rootNodeFixture = {
        type: 'arrow_function',
        startPosition: {row: 36, column: 21},
        endPosition: {row: 38, column: 1},
        childCount: 0,
        parent: {
          type: 'variable_declarator',
          startPosition: {row: 36, column: 6},
          endPosition: {row: 38, column: 1},
          childCount: 1,
          child: () => {
            return {
              type: 'identifier',
              startPosition: {row: 36, column: 6},
              endPosition: {row: 36, column: 18},
              childCount: 0,
            };
          }
        }
      };
      const { filePath, language } = chunkFixturesExpected[6].metadata;
      underTest.buildChunk = () => chunkFixturesExpected[6];

      const actual = underTest.extractJavaScriptChunks(rootNodeFixture, fixtures.javascriptCodebase, filePath, language);
      const expected = JSON.parse(JSON.stringify(chunkFixturesExpected[6]));
      expected.metadata.functionName = 'fixtureArrow';
      expected.metadata.isAsync = false;

      assert.deepStrictEqual(actual, [expected]);
    });

    it('will check for anonymous arrow function delcarations', () => {
      const underTest = new Treesitter();
      const rootNodeFixture = {
        type: 'arrow_function',
        startPosition: {row: 31, column: 28},
        endPosition: {row: 31, column: 71},
        childCount: 0,
      };
      const { filePath, language } = chunkFixturesExpected[7].metadata;
      underTest.buildChunk = () => chunkFixturesExpected[7];

      const actual = underTest.extractJavaScriptChunks(rootNodeFixture, fixtures.javascriptCodebase, filePath, language);
      const expected = JSON.parse(JSON.stringify(chunkFixturesExpected[7]));
      expected.metadata.functionName = 'anonymous';
      expected.metadata.isAsync = false;

      assert.deepStrictEqual(actual, [expected]);
    });
  });

  describe('getEntityName()', () => {
    it('will catch errors and return anonymous', () => {
      const underTest = new Treesitter();
      let spy = '';
      underTest.log.error = err => {
        spy = err;
      }

      const actual = underTest.getEntityName();
      const expected = 'anonymous';

      assert.strictEqual(actual, expected);
      assert.strictEqual(spy, "Error in getEntityName: Cannot read properties of undefined (reading 'type')");
    });

    it('will catch identity', () => {
      const underTest = new Treesitter();

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

  describe('getLanguageFromPath()', () => {
    ['mjs', 'cjs', 'js'].forEach(ext => {
      it(`will get language for ${ext} file`, () => {
        const underTest = new Treesitter();

        const actual = underTest.getLanguageFromPath(`test-file.${ext}`);
        const expected = 'js';

        assert.strictEqual(actual, expected);
      });
    })
  });

  describe('parseCodeFile()', () => {
    it('will log error if no parser found', () => {
      const underTest = new Treesitter();
      let spy = '';
      underTest.log.error = err => {
        spy = err;
      }

      const actual = underTest.parseCodeFile('foobar.biz', 'blahdeeblah');
      const expected = [];

      assert.deepStrictEqual(actual, expected);
      assert.strictEqual(spy, 'No Tree-sitter parser for biz');
    });

    it('will create chunks', () => {
      const underTest = new Treesitter();
      let spy = '';

      underTest.log.info = str => {
        spy = str;
      }
      underTest.printASTStats = () => {};

      const actual = underTest.parseCodeFile('workspace/foo/bar/test-file-1.js', fixtures.javascriptCodebase);

      assert.strictEqual(spy, 'Extracted 11 chunks from workspace/foo/bar/test-file-1.js');
      assert.strictEqual(actual.length, 11);
    });

    it('will log error if no chunks found', () => {
      const underTest = new Treesitter();
      let spy = '';

      underTest.log.error = err => {
        spy = err;
      }
      underTest.printASTStats = () => {}
      underTest.extractChunksFromAST = () => [];

      const actual = underTest.parseCodeFile('workspace/foo/bar/test-file-1.js', fixtures.javascriptCodebase);
      const expected = [];

      assert.strictEqual(spy, 'No AST chunks extracted from workspace/foo/bar/test-file-1.js');
      assert.deepStrictEqual(actual, expected);
    });

    it('will catch errors', () => {
      const underTest = new Treesitter();
      let spy = '';

      underTest.log.error = err => {
        spy = err;
      }
      underTest.languageParsers.get = () => {
        return {
          parse: () => {
            throw new Error('foobar');
          }
        }
      }

      const actual = underTest.parseCodeFile('workspace/foo/bar/test-file-1.js', fixtures.javascriptCodebase);
      const expected = [];

      assert.strictEqual(spy, 'Tree-sitter parsing failed for workspace/foo/bar/test-file-1.js: foobar');
      assert.deepStrictEqual(actual, expected);
    });
  });

  describe('printASTStats()', () => {
    it('will print stats', () => {
      const underTest = new Treesitter();
      const spy = [];
      underTest.log.info = msg => {
        spy.push(msg);
      };

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

      assert.deepStrictEqual(spy, [ '📊 AST Node Statistics:', '  arrow_function: 2' ]);
    });
  });

});
