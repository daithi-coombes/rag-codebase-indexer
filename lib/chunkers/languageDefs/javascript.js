import JavaScript from 'tree-sitter-javascript';

/**
 * JavaScript / JSX language definition for TreeSitter chunker.
 *
 * @property {Object}   grammar          - tree-sitter grammar binding
 * @property {string[]} extensions       - file extensions this definition handles
 * @property {Object}   extensionAliases - maps extension variants → canonical language id
 * @property {Object}   nodeHandlers     - AST node type → handler method name on TreeSitter
 */
export default {
  grammar: JavaScript,
  extensions: ['js', 'mjs', 'cjs', 'go'],
  extensionAliases: { mjs: 'js', cjs: 'js' },

  nodeHandlers: {
    'function_declaration':           'parseFunctionNode',
    'generator_function_declaration': 'parseFunctionNode',
    'arrow_function':                 'parseArrowFunctionNode',
    'async_arrow_function':           'parseArrowFunctionNode',
    'class_declaration':              'parseClassNode',
    'method_definition':              'parseMethodNode',
    'variable_declarator':            'parseVariableNode',
  },
};
