export default [
  {
    text: 'class FixtureClass {\n' +
    "  property1 = 'this is property1';\n" +
    "  property2 = 'this is property2';\n" +
    '\n' +
    '  method1(param1, param2){\n' +
    '    return param1 - param2;\n' +
    '  }\n' +
    '\n' +
    '  async method2(param1, param2){\n' +
    '    return await new Promise.resolve(param1 + param2);\n' +
    '  }\n' +
    '}',
    metadata: {
      filePath: 'javascriptFixture.js',
      language: 'js',
      type: 'class',
      astNodeType: 'class_declaration',
      startRow: 10,
      startColumn: 0,
      endRow: 21,
      endColumn: 1,
      textLength: 245
    }
  },{
    text: 'method1(param1, param2){\n    return param1 - param2;\n  }',
    metadata: {
      filePath: 'javascriptFixture.js',
      language: 'js',
      type: 'method',
      astNodeType: 'method_definition',
      startRow: 14,
      startColumn: 2,
      endRow: 16,
      endColumn: 3,
      textLength: 56
    }
  },{
    text: 'async method2(param1, param2){\n' +
    '    return await new Promise.resolve(param1 + param2);\n' +
    '  }',
    metadata: {
      filePath: 'javascriptFixture.js',
      language: 'js',
      type: 'method',
      astNodeType: 'method_definition',
      startRow: 18,
      startColumn: 2,
      endRow: 20,
      endColumn: 3,
      textLength: 89
    }
  },{
  text: "function fixtureFunction(param1='', param2={}){\n" +
    '  return {\n' +
    '    ...param2,\n' +
    '    res: param1\n' +
    '  };\n' +
    '}',
    metadata: {
      filePath: 'javascriptFixture.js',
      language: 'js',
      type: 'function',
      astNodeType: 'function_declaration',
      startRow: 23,
      startColumn: 0,
      endRow: 28,
      endColumn: 1,
      textLength: 96
    }
  },{
    text: 'async function* async_generator() {\n' +
      '  for (let i = 0; i < 10; i++) {\n' +
      '    yield await new Promise(r => setTimeout(_ => r("hello world"), 100));\n' +
      '  };\n' +
      '}',
    metadata: {
      filePath: 'javascriptFixture.js',
      language: 'js',
      type: 'function',
      astNodeType: 'generator_function_declaration',
      startRow: 30,
      startColumn: 0,
      endRow: 34,
      endColumn: 1,
      textLength: 149
    }
  },{
    text: "fooBar = 'bizBaz'",
    metadata: {
      filePath: 'javascriptFixture.js',
      language: 'js',
      type: 'variable',
      astNodeType: 'variable_declarator',
      startRow: 8,
      startColumn: 6,
      endRow: 8,
      endColumn: 23,
      textLength: 17
    }
  },{
    text: "(param1='') => {\n  return param1 + ' addition string stuff';\n}",
    metadata: {
      filePath: 'javascriptFixture.js',
      language: 'js',
      type: 'function',
      astNodeType: 'arrow_function',
      startRow: 35,
      startColumn: 21,
      endRow: 37,
      endColumn: 1,
      textLength: 62,
      isAsync: false,
      isArrow: true
    }
  },{
    text: 'r => setTimeout(_ => r("hello world"), 100)',
    metadata: {
      filePath: 'javascriptFixture.js',
      language: 'js',
      type: 'function',
      astNodeType: 'arrow_function',
      startRow: 31,
      startColumn: 28,
      endRow: 31,
      endColumn: 71,
      textLength: 43,
      isAsync: false,
      isArrow: true
    }
  }
];
