import Chunker from './Chunker.js';
import Logger from '../../config/Logger.js';
import Parser from 'tree-sitter';
import languageDefs from './languageDefs/index.js';
import path from 'path';

class TreeSitter extends Chunker {
  constructor() {
    super();

    this.languageParsers = new Map();

    /** @type {Map<string, Object>} extension → language definition */
    this.languageDefsByExt = new Map();

    this.log = new Logger();

    this.initLanguages();
  }

  // ── Language Registration ────────────────────────────────────

  /**
   * Initialise parsers and handler maps from the language definitions registry.
   */
  initLanguages() {
    for (const def of languageDefs) {
      const parser = new Parser();
      parser.setLanguage(def.grammar);

      for (const ext of def.extensions) {
        this.languageParsers.set(ext, parser);
        this.languageDefsByExt.set(ext, def);
      }
    }

    this.log.info(
      `🌳 Languages initialized for: ${[...new Set([...this.languageParsers.keys()])].join(', ')}`
    );
  }

  // ── Public API ───────────────────────────────────────────────

  parseCodeFile(filePath, content) {
    const language = this.getLanguageFromPath(filePath);
    const parser = this.languageParsers.get(language);

    if (!parser) {
      this.log.error(`No Tree-sitter parser for ${language}`);
      return [];
    }

    try {
      const tree = parser.parse(content);

      this.log.info(`Parsed ${filePath} successfully`);

      const _chunks = this.extractChunksFromAST(tree, content, filePath, language);

      if (_chunks.length === 0) {
        this.log.error(`No AST chunks extracted from ${filePath}`);
        return [];
      }

      this.log.info(`Extracted ${_chunks.length} chunks from ${filePath}`);

      return _chunks.map((chunk, i) => ({
        ...chunk,
        id: `${Buffer.from(filePath).toString('base64')}:${i}:${Date.now()}`,
        file: filePath,
        language: language
      }));

    } catch (err) {
      this.log.error(`Tree-sitter parsing failed for ${filePath}: ${err.message}`, err);
      return [];
    }
  }

  // ── Generic AST Extraction ───────────────────────────────────

  /**
   * Walk the AST and dispatch to per-node-type handlers declared
   * in the language definition's `nodeHandlers` map.
   *
   * @param  {Object} tree     - tree-sitter parse tree
   * @param  {string} content  - raw source file content
   * @param  {string} filePath - file path
   * @param  {string} language - canonical language extension
   * @return {Object[]}        - array of chunk objects
   */
  extractChunksFromAST(tree, content, filePath, language) {
    const def = this.languageDefsByExt.get(language);
    if (!def) {
      this.log.error(`No language definition for '${language}'`);
      return [];
    }

    const chunks = [];
    const handlers = def.nodeHandlers;

    const visit = (node) => {
      const handlerName = handlers[node.type];

      if (handlerName) {
        if (typeof this[handlerName] !== 'function') {
          this.log.error(`Handler '${handlerName}' not implemented for node type '${node.type}'`);
        } else {
          const chunk = this[handlerName](node, content, filePath, language);

          if (chunk && chunk.text && chunk.text.length > 0) {
            chunks.push(chunk);
          }
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        visit(node.child(i));
      }
    };

    visit(tree.rootNode);
    return chunks;
  }

  // ── Shared Parse Helpers ─────────────────────────────────────

  /**
   * buildChunk - extract text from a node and build metadata.
   *
   * @param  {Object} node     The node returned from Treesitter.
   * @param  {String} content  The file contents.
   * @param  {String} filePath The file path.
   * @param  {String} language The language (eg 'js', 'go').
   * @param  {String} type     The chunk type (eg 'class', 'method', 'function').
   * @return {Object|null}     returns { text, metadata } or null on error.
   */
  buildChunk(node, content, filePath, language, type) {
    try {

      const startPosition = node.startPosition;
      const endPosition = node.endPosition;
      const lines = content.split('\n');
      let text = '';

      if (startPosition.row === endPosition.row) { // single-line node
        const line = lines[startPosition.row];
        text = line.substring(startPosition.column, endPosition.column);
      } else { // Multi-line node
        const firstLine = lines[startPosition.row];
        text = firstLine.substring(startPosition.column) + '\n';

        for (let i = startPosition.row + 1; i < endPosition.row; i++) {
          text += lines[i] + '\n';
        }

        const lastLine = lines[endPosition.row];
        text += lastLine.substring(0, endPosition.column);
      }

      text = text.trim();

      const res = {
        text: text,
        metadata: {
          filePath,
          language,
          type,
          astNodeType: node.type,
          startRow: startPosition.row,
          startColumn: startPosition.column,
          endRow: endPosition.row,
          endColumn: endPosition.column,
          textLength: text.length,
          // TODO: add these as metadata for context preservation
          // imports: this.extractImports(content),
          // dependencies: this.extractDependencies(node, content),
          // parentClass: this.getParentClass(node),
          // documentation: this.extractDocComment(node, content)
        }
      };

      return res;
    } catch (err) {
      this.log.error(`Error creating chunk: ${err.message}`, err);
      return null;
    }
  }

  /**
   * Get the first identifier name from a node's children (depth-first).
   * Works across languages — identifier nodes are named 'identifier'
   * in both JS and Go grammars.
   *
   * @param  {Object} node    - AST node
   * @param  {String} content - source file content
   * @return {String}         - identifier name or 'anonymous'
   */
  getEntityName(node, content) {
    try {
      const visit = (n) => {
        if (n.type === 'identifier' || n.type === 'type_identifier' || n.type === 'field_identifier') {
          return this.getNodeText(n, content);
        }
        for (let i = 0; i < n.childCount; i++) {
          const result = visit(n.child(i));
          if (result) return result;
        }
      };
      return visit(node) || 'anonymous';
    } catch (err) {
      this.log.error(`Error in getEntityName: ${err.message}`, err);
      return 'anonymous';
    }
  }

  /**
   * Find a named child node by its field name.
   * tree-sitter nodes expose `.childForFieldName(name)`.
   *
   * @param  {Object} node      - AST node
   * @param  {String} fieldName - field name (e.g. 'name', 'receiver', 'parameters')
   * @return {Object|null}      - child node or null
   */
  getFieldNode(node, fieldName) {
    return node.childForFieldName ? node.childForFieldName(fieldName) : null;
  }

  /**
   * Extract text from a node using start/end positions.
   *
   * @param  {Object} node    - AST node
   * @param  {String} content - source file content
   * @return {String}
   */
  getNodeText(node, content) {
    const startPosition = node.startPosition;
    const endPosition = node.endPosition;
    const lines = content.split('\n');
    /* eslint-disable-next-line no-useless-assignment */
    let text = '';

    if (startPosition.row === endPosition.row) {
      const line = lines[startPosition.row];
      text = line.substring(startPosition.column, endPosition.column);
    } else {
      const firstLine = lines[startPosition.row];
      text = firstLine.substring(startPosition.column) + '\n';

      for (let i = startPosition.row + 1; i < endPosition.row; i++) {
        text += lines[i] + '\n';
      }

      const lastLine = lines[endPosition.row];
      text += lastLine.substring(0, endPosition.column);
    }

    return text.trim();
  }

  getLanguageFromPath(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1);

    // Check language defs for extension aliases (e.g. mjs → js)
    const def = this.languageDefsByExt.get(ext);
    if (def && def.extensionAliases && def.extensionAliases[ext]) {
      return def.extensionAliases[ext];
    }

    return ext;
  }

  /**
   * Check whether a node represents an async function.
   * Applicable to JavaScript; Go doesn't have async/await.
   *
   * @param  {Object}  node    - AST node
   * @param  {String}  content - source file content
   * @return {boolean}
   */
  isAsyncFunction(node, content) {
    const text = this.getNodeText(node, content);
    return text.includes('async function') || text.startsWith('async ');
  }

  // ── JavaScript Handlers ──────────────────────────────────────

  parseFunctionNode(node, content, filePath, language) {
    const isAsync = this.isAsyncFunction(node, content);
    let funcName = this.getEntityName(node, content);
    let chunk = this.buildChunk(node, content, filePath, language, 'function');

    chunk.metadata.functionName = funcName;
    chunk.metadata.isAsync = isAsync;
    return chunk;
  }

  parseArrowFunctionNode(node, content, filePath, language) {
    let isAsync = node.type === 'async_arrow_function' || this.isAsyncFunction(node, content);
    let chunk = this.buildChunk(node, content, filePath, language, 'function');

    chunk.metadata.isAsync = isAsync;
    chunk.metadata.isArrow = true;

    const parent = node.parent;
    if (parent && parent.type === 'variable_declarator') {
      chunk.metadata.functionName = this.getNodeText(parent.child(0), content);
    } else {
      chunk.metadata.functionName = 'anonymous';
    }

    return chunk;
  }

  parseClassNode(node, content, filePath, language) {
    const identifier = this.getEntityName(node, content);
    const chunk = this.buildChunk(node, content, filePath, language, 'class');

    chunk.metadata.className = identifier;
    return chunk;
  }

  parseMethodNode(node, content, filePath, language) {
    const isAsync = this.isAsyncFunction(node, content);
    const methodName = this.getEntityName(node, content);
    const chunk = this.buildChunk(node, content, filePath, language, 'method');

    chunk.metadata.methodName = methodName;
    chunk.metadata.isAsync = isAsync;
    return chunk;
  }

  parseVariableNode(node, content, filePath, language) {
    let chunk = '';

    if (node.startPosition.row === node.endPosition.row) {
      chunk = this.buildChunk(node, content, filePath, language, 'variable');
      chunk.metadata.variableName = this.getEntityName(node, content);
    }

    return chunk;
  }

  // ── Go Handlers ──────────────────────────────────────────────

  /**
   * Parse a Go function declaration.
   *
   * AST shape: (function_declaration name: (identifier) parameters: (parameter_list) body: (block))
   *
   * @example `func main() { ... }`
   */
  parseGoFunctionNode(node, content, filePath, language) {
    const nameNode = this.getFieldNode(node, 'name');
    const funcName = nameNode ? this.getNodeText(nameNode, content) : this.getEntityName(node, content);
    const chunk = this.buildChunk(node, content, filePath, language, 'function');

    chunk.metadata.functionName = funcName;
    chunk.metadata.isExported = /^[A-Z]/.test(funcName);
    return chunk;
  }

  /**
   * Parse a Go method declaration (function with receiver).
   *
   * AST shape: (method_declaration
   *   receiver: (parameter_list (parameter_declaration name: (identifier) type: ...))
   *   name: (field_identifier)
   *   parameters: (parameter_list)
   *   body: (block))
   *
   * @example `func (s *Server) Start() { ... }`
   */
  parseGoMethodNode(node, content, filePath, language) {
    const nameNode = this.getFieldNode(node, 'name');
    const methodName = nameNode ? this.getNodeText(nameNode, content) : this.getEntityName(node, content);
    const chunk = this.buildChunk(node, content, filePath, language, 'method');

    chunk.metadata.methodName = methodName;
    chunk.metadata.isExported = /^[A-Z]/.test(methodName);

    // Extract receiver type
    const receiverNode = this.getFieldNode(node, 'receiver');
    if (receiverNode) {
      chunk.metadata.receiver = this.getNodeText(receiverNode, content);
    }

    return chunk;
  }

  /**
   * Parse a Go type declaration (struct, interface, type alias).
   *
   * AST shape: (type_declaration (type_spec name: (type_identifier) type: (struct_type|interface_type|...)))
   *
   * @example `type Server struct { ... }`
   */
  parseGoTypeNode(node, content, filePath, language) {
    const chunk = this.buildChunk(node, content, filePath, language, 'type');

    // type_declaration wraps one or more type_spec children
    const typeSpec = node.namedChildren.find(c => c.type === 'type_spec');
    if (typeSpec) {
      const nameNode = this.getFieldNode(typeSpec, 'name');
      const typeName = nameNode ? this.getNodeText(nameNode, content) : this.getEntityName(typeSpec, content);
      chunk.metadata.typeName = typeName;
      chunk.metadata.isExported = /^[A-Z]/.test(typeName);

      // Detect the underlying type kind (struct, interface, etc.)
      const typeNode = this.getFieldNode(typeSpec, 'type');
      if (typeNode) {
        chunk.metadata.typeKind = typeNode.type; // e.g. 'struct_type', 'interface_type'
      }
    } else {
      chunk.metadata.typeName = this.getEntityName(node, content);
    }

    return chunk;
  }

  /**
   * Parse a Go var declaration.
   *
   * AST shape: (var_declaration (var_spec name: (identifier) ...))
   *
   * @example `var count int = 0`
   */
  parseGoVarNode(node, content, filePath, language) {
    const chunk = this.buildChunk(node, content, filePath, language, 'variable');

    const varSpec = node.namedChildren.find(c => c.type === 'var_spec');
    if (varSpec) {
      const nameNode = this.getFieldNode(varSpec, 'name');
      chunk.metadata.variableName = nameNode
        ? this.getNodeText(nameNode, content)
        : this.getEntityName(varSpec, content);
    } else {
      chunk.metadata.variableName = this.getEntityName(node, content);
    }

    return chunk;
  }

  /**
   * Parse a Go short variable declaration.
   *
   * AST shape: (short_var_declaration left: (expression_list) right: (expression_list))
   *
   * @example `x := 42`
   */
  parseGoShortVarNode(node, content, filePath, language) {
    // Only chunk single-line short vars to match JS variable behaviour
    if (node.startPosition.row !== node.endPosition.row) {
      return '';
    }

    const chunk = this.buildChunk(node, content, filePath, language, 'variable');

    const leftNode = this.getFieldNode(node, 'left');
    chunk.metadata.variableName = leftNode
      ? this.getNodeText(leftNode, content)
      : this.getEntityName(node, content);

    return chunk;
  }

  /**
   * Parse a Go const declaration.
   *
   * AST shape: (const_declaration (const_spec name: (identifier) ...))
   *
   * @example `const MaxRetries = 3`
   */
  parseGoConstNode(node, content, filePath, language) {
    const chunk = this.buildChunk(node, content, filePath, language, 'constant');

    const constSpec = node.namedChildren.find(c => c.type === 'const_spec');
    if (constSpec) {
      const nameNode = this.getFieldNode(constSpec, 'name');
      chunk.metadata.constantName = nameNode
        ? this.getNodeText(nameNode, content)
        : this.getEntityName(constSpec, content);
    } else {
      chunk.metadata.constantName = this.getEntityName(node, content);
    }

    return chunk;
  }

  /**
   * Parse a Go func literal (anonymous function / closure).
   *
   * AST shape: (func_literal parameters: (parameter_list) body: (block))
   *
   * @example `handler := func(w http.ResponseWriter, r *http.Request) { ... }`
   */
  parseGoFuncLiteralNode(node, content, filePath, language) {
    const chunk = this.buildChunk(node, content, filePath, language, 'function');

    // Try to find a name from the parent assignment
    const parent = node.parent;
    if (parent) {
      if (parent.type === 'short_var_declaration') {
        const leftNode = this.getFieldNode(parent, 'left');
        chunk.metadata.functionName = leftNode
          ? this.getNodeText(leftNode, content)
          : 'anonymous';
      } else if (parent.type === 'var_spec') {
        const nameNode = this.getFieldNode(parent, 'name');
        chunk.metadata.functionName = nameNode
          ? this.getNodeText(nameNode, content)
          : 'anonymous';
      } else {
        chunk.metadata.functionName = 'anonymous';
      }
    } else {
      chunk.metadata.functionName = 'anonymous';
    }

    chunk.metadata.isAnonymous = true;
    return chunk;
  }

  // ── Diagnostics ──────────────────────────────────────────────

  printASTStats(rootNode) {
    const stats = {};

    const visit = (node) => {
      stats[node.type] = (stats[node.type] || 0) + 1;
      for (let i = 0; i < node.childCount; i++) {
        visit(node.child(i));
      }
    };

    visit(rootNode);

    this.log.info('📊 AST Node Statistics:');
    Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([type, count]) => {
        this.log.info(`  ${type}: ${count}`);
      });
  }
}

export default TreeSitter;
