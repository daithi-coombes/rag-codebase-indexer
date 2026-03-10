import Golang from 'tree-sitter-go';

/**
 * Go language definition for TreeSitter chunker.
 *
 * Go AST node types (from tree-sitter-go):
 *  - function_declaration  → `func foo() {}`
 *  - method_declaration    → `func (r *Receiver) foo() {}` (has receiver field)
 *  - type_declaration      → `type Foo struct {}` / `type Bar interface {}`
 *  - var_declaration       → `var x int = 1`
 *  - short_var_declaration → `x := 1`
 *  - const_declaration     → `const x = 1`
 *  - func_literal          → `func() {}` (anonymous / closures)
 *
 * @property {Object}   grammar      - tree-sitter grammar binding
 * @property {string[]} extensions   - file extensions this definition handles
 * @property {Object}   nodeHandlers - AST node type → handler method name on TreeSitter
 */
export default {
  grammar: Golang,
  extensions: ['go'],

  nodeHandlers: {
    'function_declaration':   'parseGoFunctionNode',
    'method_declaration':     'parseGoMethodNode',
    'type_declaration':       'parseGoTypeNode',
    'var_declaration':        'parseGoVarNode',
    'short_var_declaration':  'parseGoShortVarNode',
    'const_declaration':      'parseGoConstNode',
    'func_literal':           'parseGoFuncLiteralNode',
  },
};
