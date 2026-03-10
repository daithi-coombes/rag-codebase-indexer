export default [
  {
    text: 'var FooBar = "bizBaz"',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'variable',
      astNodeType: 'var_declaration',
      startRow: 10,
      startColumn: 0,
      endRow: 10,
      endColumn: 21,
      textLength: 21
    }
  }, {
    text: 'const MaxRetries = 3',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'constant',
      astNodeType: 'const_declaration',
      startRow: 14,
      startColumn: 0,
      endRow: 14,
      endColumn: 20,
      textLength: 20
    }
  },{
    text: 'const (\n\tStatusPending  = iota\n\tStatusActive\n\tStatusInactive\n)',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'constant',
      astNodeType: 'const_declaration',
      startRow: 18,
      startColumn: 0,
      endRow: 22,
      endColumn: 1,
      textLength: 62
    }
  },{
    text: 'type FixtureStruct struct {\n' +
      '\tProperty1 string\n' +
      '\tProperty2 string\n' +
      '\tmu        sync.Mutex\n' +
      '}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'type',
      astNodeType: 'type_declaration',
      startRow: 26,
      startColumn: 0,
      endRow: 30,
      endColumn: 1,
      textLength: 87
    }
  },{
    text: 'type FixtureInterface interface {\n' +
      '\tMethod1(param1, param2 int) int\n' +
      '\tMethod2(param1, param2 int) (int, error)\n' +
      '}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'type',
      astNodeType: 'type_declaration',
      startRow: 34,
      startColumn: 0,
      endRow: 37,
      endColumn: 1,
      textLength: 110
    }
  },{
    text: 'type Distance float64',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'type',
      astNodeType: 'type_declaration',
      startRow: 41,
      startColumn: 0,
      endRow: 41,
      endColumn: 21,
      textLength: 21
    }
  },{
    text: 'func (f FixtureStruct) Method1(param1, param2 int) int {\n' +
      '\treturn param1 - param2\n' +
      '}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'method',
      astNodeType: 'method_declaration',
      startRow: 45,
      startColumn: 0,
      endRow: 47,
      endColumn: 1,
      textLength: 82
    }
  },{
    text: 'func (f *FixtureStruct) Method2(param1, param2 int) (int, error) {\n' +
      '\tf.mu.Lock()\n' +
      '\tdefer f.mu.Unlock()\n' +
      '\treturn param1 + param2, nil\n' +
      '}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'method',
      astNodeType: 'method_declaration',
      startRow: 51,
      startColumn: 0,
      endRow: 55,
      endColumn: 1,
      textLength: 131
    }
  },{
    text: 'func fixtureFunction(param1 string, param2 map[string]interface{}) map[string]interface{} {\n' +
      '\tparam2["res"] = param1\n' +
      '\treturn param2\n' +
      '}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'function',
      astNodeType: 'function_declaration',
      startRow: 59,
      startColumn: 0,
      endRow: 62,
      endColumn: 1,
      textLength: 132
    }
  },{
    text: 'func FixtureExportedFunction(x, y float64) float64 {\n' +
      '\treturn math.Sqrt(x*x + y*y)\n' +
      '}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'function',
      astNodeType: 'function_declaration',
      startRow: 66,
      startColumn: 0,
      endRow: 68,
      endColumn: 1,
      textLength: 83
    }
  },{
    text: 'func fixtureVariadic(prefix string, values ...int) string {\n' +
      '\tsum := 0\n' +
      '\tfor _, v := range values {\n' +
      '\t\tsum += v\n' +
      '\t}\n' +
      '\treturn fmt.Sprintf("%s: %d", prefix, sum)\n' +
      '}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'function',
      astNodeType: 'function_declaration',
      startRow: 72,
      startColumn: 0,
      endRow: 78,
      endColumn: 1,
      textLength: 156
    }
  },{
    text: 'sum := 0',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'variable',
      astNodeType: 'short_var_declaration',
      startRow: 73,
      startColumn: 1,
      endRow: 73,
      endColumn: 9,
      textLength: 8
    }
  },{
    text: 'func fixtureTuple() (string, error) {\n\treturn "hello", nil\n}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'function',
      astNodeType: 'function_declaration',
      startRow: 82,
      startColumn: 0,
      endRow: 84,
      endColumn: 1,
      textLength: 60
    }
  },{
    text: 'func fixtureWithClosure() {\n' +
      '\thandler := func(msg string) string {\n' +
      '\t\treturn fmt.Sprintf("handled: %s", msg)\n' +
      '\t}\n' +
      '\n' +
      '\t_ = handler("test")\n' +
      '}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'function',
      astNodeType: 'function_declaration',
      startRow: 88,
      startColumn: 0,
      endRow: 94,
      endColumn: 1,
      textLength: 133
    }
  },{
    text: 'func(msg string) string {\n\t\treturn fmt.Sprintf("handled: %s", msg)\n\t}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'function',
      astNodeType: 'func_literal',
      startRow: 89,
      startColumn: 12,
      endRow: 91,
      endColumn: 2,
      textLength: 69
    }
  },{
    text: 'var fixtureArrow = func(param1 string) string {\n' +
      '\treturn param1 + " addition string stuff"\n' +
      '}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'variable',
      astNodeType: 'var_declaration',
      startRow: 98,
      startColumn: 0,
      endRow: 100,
      endColumn: 1,
      textLength: 91
    }
  },{
    text: 'func(param1 string) string {\n\treturn param1 + " addition string stuff"\n}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'function',
      astNodeType: 'func_literal',
      startRow: 98,
      startColumn: 19,
      endRow: 100,
      endColumn: 1,
      textLength: 72
    }
  },{
    text: 'func fixtureGoroutine(input string) <-chan string {\n' +
      '\tch := make(chan string, 1)\n' +
      '\tgo func() {\n' +
      '\t\tch <- fmt.Sprintf("processed: %s", input)\n' +
      '\t}()\n' +
      '\treturn ch\n' +
      '}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'function',
      astNodeType: 'function_declaration',
      startRow: 104,
      startColumn: 0,
      endRow: 110,
      endColumn: 1,
      textLength: 154
    }
  },{
    text: 'ch := make(chan string, 1)',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'variable',
      astNodeType: 'short_var_declaration',
      startRow: 105,
      startColumn: 1,
      endRow: 105,
      endColumn: 27,
      textLength: 26
    }
  },{
    text: 'func() {\n\t\tch <- fmt.Sprintf("processed: %s", input)\n\t}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'function',
      astNodeType: 'func_literal',
      startRow: 106,
      startColumn: 4,
      endRow: 108,
      endColumn: 2,
      textLength: 55
    }
  },{
    text: 'func fixtureShortVars() {\n\tx := 42\n\tname := "fixture"\n\t_ = x\n\t_ = name\n}',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'function',
      astNodeType: 'function_declaration',
      startRow: 114,
      startColumn: 0,
      endRow: 119,
      endColumn: 1,
      textLength: 72
    }
  },{
    text: 'x := 42',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'variable',
      astNodeType: 'short_var_declaration',
      startRow: 115,
      startColumn: 1,
      endRow: 115,
      endColumn: 8,
      textLength: 7
    }
  },{
    text: 'name := "fixture"',
    metadata: {
      filePath: 'golangFixture.go',
      language: 'go',
      type: 'variable',
      astNodeType: 'short_var_declaration',
      startRow: 116,
      startColumn: 1,
      endRow: 116,
      endColumn: 18,
      textLength: 17
    }
  }
]
