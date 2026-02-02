export default [
 {
   text: "fooBar = 'bizBaz'",
   metadata: {
     filePath: 'workspace/foo/bar/test-file-1.js',
     language: 'js',
     type: 'variable',
     astNodeType: 'variable_declarator',
     lineStart: 8,
     lineEnd: 8,
     startRow: 7,
     startColumn: 6,
     endRow: 7,
     endColumn: 23,
     textLength: 17,
     variableName: 'fooBar'
   },
   id: 'd29ya3NwYWNlL2Zvby9iYXIvdGVzdC1maWxlLTEuanM=:0:1769830993368',
   file: 'workspace/foo/bar/test-file-1.js',
   language: 'js'
 },
 {
   text: 'class FixtureClass {\\n' +
     "  property1 = 'this is property1';\\n" +
     "  property2 = 'this is property2';\\n" +
     '\\n' +
     '  method1(param1, param2){\\n' +
     '    return param1 - param2;\\n' +
     '  }\\n' +
     '\\n' +
     '  async method2(param1, param2){\\n' +
     '    return await new Promise.resolve(param1 + param2);\\n' +
     '  }\\n' +
     '}',
   metadata: {
     filePath: 'workspace/foo/bar/test-file-1.js',
     language: 'js',
     type: 'class',
     astNodeType: 'class_declaration',
     lineStart: 10,
     lineEnd: 21,
     startRow: 9,
     startColumn: 0,
     endRow: 20,
     endColumn: 1,
     textLength: 245,
     className: 'FixtureClass'
   },
   id: 'd29ya3NwYWNlL2Zvby9iYXIvdGVzdC1maWxlLTEuanM=:1:1769830993368',
   file: 'workspace/foo/bar/test-file-1.js',
   language: 'js'
 },
 {
   text: 'method1(param1, param2){\\n    return param1 - param2;\\n  }',
   metadata: {
     filePath: 'workspace/foo/bar/test-file-1.js',
     language: 'js',
     type: 'method',
     astNodeType: 'method_definition',
     lineStart: 14,
     lineEnd: 16,
     startRow: 13,
     startColumn: 2,
     endRow: 15,
     endColumn: 3,
     textLength: 56,
     methodName: 'param1',
     isAsync: false
   },
   id: 'd29ya3NwYWNlL2Zvby9iYXIvdGVzdC1maWxlLTEuanM=:2:1769830993368',
   file: 'workspace/foo/bar/test-file-1.js',
   language: 'js'
 },
 {
   text: 'async method2(param1, param2){\\n' +
     '    return await new Promise.resolve(param1 + param2);\\n' +
     '  }',
   metadata: {
     filePath: 'workspace/foo/bar/test-file-1.js',
     language: 'js',
     type: 'method',
     astNodeType: 'method_definition',
     lineStart: 18,
     lineEnd: 20,
     startRow: 17,
     startColumn: 2,
     endRow: 19,
     endColumn: 3,
     textLength: 89,
     methodName: 'param1',
     isAsync: true
   },
   id: 'd29ya3NwYWNlL2Zvby9iYXIvdGVzdC1maWxlLTEuanM=:3:1769830993368',
   file: 'workspace/foo/bar/test-file-1.js',
   language: 'js'
 },
 {
   text: "function fixtureFunction(param1='', param2={}){\\n" +
     '  return {\\n' +
     '    ...param2,\\n' +
     '    res: param1\\n' +
     '  };\\n' +
     '}',
   metadata: {
     filePath: 'workspace/foo/bar/test-file-1.js',
     language: 'js',
     type: 'function',
     astNodeType: 'function_declaration',
     lineStart: 23,
     lineEnd: 28,
     startRow: 22,
     startColumn: 0,
     endRow: 27,
     endColumn: 1,
     textLength: 96,
     functionName: 'fixtureFunction',
     isAsync: false
   },
   id: 'd29ya3NwYWNlL2Zvby9iYXIvdGVzdC1maWxlLTEuanM=:4:1769830993368',
   file: 'workspace/foo/bar/test-file-1.js',
   language: 'js'
 },
 {
   text: 'async function* async_generator() {\\n' +
     '  for (let i = 0; i < 10; i++) {\\n' +
     '    yield await new Promise(r => setTimeout(_ => r("hello world"), 100));\\n' +
     '  };\\n' +
     '}',
   metadata: {
     filePath: 'workspace/foo/bar/test-file-1.js',
     language: 'js',
     type: 'function',
     astNodeType: 'generator_function_declaration',
     lineStart: 30,
     lineEnd: 34,
     startRow: 29,
     startColumn: 0,
     endRow: 33,
     endColumn: 1,
     textLength: 149,
     functionName: 'async_generator',
     isAsync: true
   },
   id: 'd29ya3NwYWNlL2Zvby9iYXIvdGVzdC1maWxlLTEuanM=:5:1769830993368',
   file: 'workspace/foo/bar/test-file-1.js',
   language: 'js'
 },
 {
   text: 'i = 0',
   metadata: {
     filePath: 'workspace/foo/bar/test-file-1.js',
     language: 'js',
     type: 'variable',
     astNodeType: 'variable_declarator',
     lineStart: 31,
     lineEnd: 31,
     startRow: 30,
     startColumn: 11,
     endRow: 30,
     endColumn: 16,
     textLength: 5,
     variableName: 'i'
   },
   id: 'd29ya3NwYWNlL2Zvby9iYXIvdGVzdC1maWxlLTEuanM=:6:1769830993368',
   file: 'workspace/foo/bar/test-file-1.js',
   language: 'js'
 },
 {
   text: 'r => setTimeout(_ => r("hello world"), 100)',
   metadata: {
     filePath: 'workspace/foo/bar/test-file-1.js',
     language: 'js',
     type: 'function',
     astNodeType: 'arrow_function',
     lineStart: 32,
     lineEnd: 32,
     startRow: 31,
     startColumn: 28,
     endRow: 31,
     endColumn: 71,
     textLength: 43,
     isAsync: false,
     isArrow: true,
     functionName: 'anonymous'
   },
   id: 'd29ya3NwYWNlL2Zvby9iYXIvdGVzdC1maWxlLTEuanM=:7:1769830993368',
   file: 'workspace/foo/bar/test-file-1.js',
   language: 'js'
 },
 {
   text: '_ => r("hello world")',
   metadata: {
     filePath: 'workspace/foo/bar/test-file-1.js',
     language: 'js',
     type: 'function',
     astNodeType: 'arrow_function',
     lineStart: 32,
     lineEnd: 32,
     startRow: 31,
     startColumn: 44,
     endRow: 31,
     endColumn: 65,
     textLength: 21,
     isAsync: false,
     isArrow: true,
     functionName: 'anonymous'
   },
   id: 'd29ya3NwYWNlL2Zvby9iYXIvdGVzdC1maWxlLTEuanM=:8:1769830993368',
   file: 'workspace/foo/bar/test-file-1.js',
   language: 'js'
 },
 {
   text: "fixtureArrow = (param1='') => {\\n" +
     "  return param1 + ' addition string stuff';\\n" +
     '}',
   metadata: {
     filePath: 'workspace/foo/bar/test-file-1.js',
     language: 'js',
     type: 'variable',
     astNodeType: 'variable_declarator',
     lineStart: 36,
     lineEnd: 38,
     startRow: 35,
     startColumn: 6,
     endRow: 37,
     endColumn: 1,
     textLength: 77,
     variableName: 'fixtureArrow'
   },
   id: 'd29ya3NwYWNlL2Zvby9iYXIvdGVzdC1maWxlLTEuanM=:9:1769830993369',
   file: 'workspace/foo/bar/test-file-1.js',
   language: 'js'
 },
 {
   text: "(param1='') => {\\n  return param1 + ' addition string stuff';\\n}",
   metadata: {
     filePath: 'workspace/foo/bar/test-file-1.js',
     language: 'js',
     type: 'function',
     astNodeType: 'arrow_function',
     lineStart: 36,
     lineEnd: 38,
     startRow: 35,
     startColumn: 21,
     endRow: 37,
     endColumn: 1,
     textLength: 62,
     isAsync: false,
     isArrow: true,
     functionName: 'fixtureArrow'
   },
   id: 'd29ya3NwYWNlL2Zvby9iYXIvdGVzdC1maWxlLTEuanM=:10:1769830993369',
   file: 'workspace/foo/bar/test-file-1.js',
   language: 'js'
 }
];
