import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const fileUrl = import.meta.resolve('./codebases/golangFixture.go');
const filePath = fileURLToPath(fileUrl);
const content = fs.readFileSync(filePath, 'utf8');

export default [
  [
    {
      type: 'var_declaration',
      startPosition: {row: 10, column: 0},
      endPosition: {row: 10, column: 21},
      childCount: 2,
    },
    content,
    'golangFixture.go',
    'go',
    'variable'
  ],
  [
    {
      type: 'const_declaration',
      startPosition: {row: 14, column: 0},
      endPosition: {row: 14, column: 20},
      childCount: 2,
    },
    content,
    'golangFixture.go',
    'go',
    'constant'
  ],
  [
    {
      type: 'const_declaration',
      startPosition: {row: 18, column: 0},
      endPosition: {row: 22, column: 1},
      childCount: 6,
    },
    content,
    'golangFixture.go',
    'go',
    'constant'
  ],
  [
    {
      type: 'type_declaration',
      startPosition: {row: 26, column: 0},
      endPosition: {row: 30, column: 1},
      childCount: 2,
    },
    content,
    'golangFixture.go',
    'go',
    'type'
  ],
  [
    {
      type: 'type_declaration',
      startPosition: {row: 34, column: 0},
      endPosition: {row: 37, column: 1},
      childCount: 2,
    },
    content,
    'golangFixture.go',
    'go',
    'type'
  ],
  [
    {
      type: 'type_declaration',
      startPosition: {row: 41, column: 0},
      endPosition: {row: 41, column: 21},
      childCount: 2,
    },
    content,
    'golangFixture.go',
    'go',
    'type'
  ],
  [
    {
      type: 'method_declaration',
      startPosition: {row: 45, column: 0},
      endPosition: {row: 47, column: 1},
      childCount: 6,
    },
    content,
    'golangFixture.go',
    'go',
    'method'
  ],
  [
    {
      type: 'method_declaration',
      startPosition: {row: 51, column: 0},
      endPosition: {row: 55, column: 1},
      childCount: 6,
    },
    content,
    'golangFixture.go',
    'go',
    'method'
  ],
  [
    {
      type: 'function_declaration',
      startPosition: {row: 59, column: 0},
      endPosition: {row: 62, column: 1},
      childCount: 5,
    },
    content,
    'golangFixture.go',
    'go',
    'function'
  ],
  [
    {
      type: 'function_declaration',
      startPosition: {row: 66, column: 0},
      endPosition: {row: 68, column: 1},
      childCount: 5,
    },
    content,
    'golangFixture.go',
    'go',
    'function'
  ],
  [
    {
      type: 'function_declaration',
      startPosition: {row: 72, column: 0},
      endPosition: {row: 78, column: 1},
      childCount: 5,
    },
    content,
    'golangFixture.go',
    'go',
    'function'
  ],
  [
    {
      type: 'short_var_declaration',
      startPosition: {row: 73, column: 1},
      endPosition: {row: 73, column: 9},
      childCount: 3,
    },
    content,
    'golangFixture.go',
    'go',
    'variable'
  ],
  [
    {
      type: 'function_declaration',
      startPosition: {row: 82, column: 0},
      endPosition: {row: 84, column: 1},
      childCount: 5,
    },
    content,
    'golangFixture.go',
    'go',
    'function'
  ],
  [
    {
      type: 'function_declaration',
      startPosition: {row: 88, column: 0},
      endPosition: {row: 94, column: 1},
      childCount: 4,
    },
    content,
    'golangFixture.go',
    'go',
    'function'
  ],
  [
    {
      type: 'func_literal',
      startPosition: {row: 89, column: 12},
      endPosition: {row: 91, column: 2},
      childCount: 4,
    },
    content,
    'golangFixture.go',
    'go',
    'function'
  ],
  [
    {
      type: 'var_declaration',
      startPosition: {row: 98, column: 0},
      endPosition: {row: 100, column: 1},
      childCount: 2,
    },
    content,
    'golangFixture.go',
    'go',
    'variable'
  ],
  [
    {
      type: 'func_literal',
      startPosition: {row: 98, column: 19},
      endPosition: {row: 100, column: 1},
      childCount: 4,
    },
    content,
    'golangFixture.go',
    'go',
    'function'
  ],
  [
    {
      type: 'function_declaration',
      startPosition: {row: 104, column: 0},
      endPosition: {row: 110, column: 1},
      childCount: 5,
    },
    content,
    'golangFixture.go',
    'go',
    'function'
  ],
  [
    {
      type: 'short_var_declaration',
      startPosition: {row: 105, column: 1},
      endPosition: {row: 105, column: 27},
      childCount: 3,
    },
    content,
    'golangFixture.go',
    'go',
    'variable'
  ],
  [
    {
      type: 'func_literal',
      startPosition: {row: 106, column: 4},
      endPosition: {row: 108, column: 2},
      childCount: 3,
    },
    content,
    'golangFixture.go',
    'go',
    'function'
  ],
  [
    {
      type: 'function_declaration',
      startPosition: {row: 114, column: 0},
      endPosition: {row: 119, column: 1},
      childCount: 4,
    },
    content,
    'golangFixture.go',
    'go',
    'function'
  ],
  [
    {
      type: 'short_var_declaration',
      startPosition: {row: 115, column: 1},
      endPosition: {row: 115, column: 8},
      childCount: 3,
    },
    content,
    'golangFixture.go',
    'go',
    'variable'
  ],
  [
    {
      type: 'short_var_declaration',
      startPosition: {row: 116, column: 1},
      endPosition: {row: 116, column: 18},
      childCount: 3,
    },
    content,
    'golangFixture.go',
    'go',
    'variable'
  ]
];
