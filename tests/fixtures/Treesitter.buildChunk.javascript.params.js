import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const fileUrl = import.meta.resolve('./codebases/javascriptFixture.js');
const filePath = fileURLToPath(fileUrl);
const content = fs.readFileSync(filePath, 'utf8');

export default [
  [
    {
      type: 'class_declaration',
      startPosition: {row: 10, column: 0},
      endPosition: {row: 21, column: 1},
      childCount: 3,
    },
    content,
    'javascriptFixture.js',
    'js',
    'class'
  ],[
    {
      type: 'method_definition',
      startPosition: {row: 14, column: 2},
      endPosition: {row: 16, column: 3},
      childCount: 3,
    },
    content,
    'javascriptFixture.js',
    'js',
    'method'
  ],[
    {
      type: 'method_definition',
      startPosition: {row: 18, column: 2},
      endPosition: {row: 20, column: 3},
      childCount: 3,
    },
    content,
    'javascriptFixture.js',
    'js',
    'method'
  ],[
    {
      type: 'function_declaration',
      startPosition: {row: 23, column: 0},
      endPosition: {row: 28, column: 1},
      childCount: 4,
    },
    content,
    'javascriptFixture.js',
    'js',
    'function'
  ],[
    {
      type: 'generator_function_declaration',
      startPosition: {row: 30, column: 0},
      endPosition: {row: 34, column: 1},
      childCount: 6,
    },
    content,
    'javascriptFixture.js',
    'js',
    'function'
  ],[
    {
      type: 'variable_declarator',
      startPosition: {row: 8, column: 6},
      endPosition: {row: 8, column: 23},
      childCount: 0
    },
    content,
    'javascriptFixture.js',
    'js',
    'variable'
  ]
];
