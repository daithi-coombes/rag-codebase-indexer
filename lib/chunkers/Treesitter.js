import Chunker from './Chunker.js';
import JavaScript from 'tree-sitter-javascript';
import Logger from '../../config/Logger.js';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import path from 'path';

class TreeSitter extends Chunker {
  constructor() {
    super();

    this.languageParsers = new Map();
    this.log = new Logger();

    this.initLanguages();
  }

  /**
  * buildChunk - get chunk and build metadata.
  *
  * @param  {Object} node     The node returned from Treesitter.
  * @param  {String} content  The file contents.
  * @param  {String} filePath The file path.
  * @param  {String} language The language (eg 'js').
  * @param  {String} type     The node type (eg class, method, function).
  * @return {Object}          returns { text, metadata }.
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

      return {
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
          // TODO: add these as metadata for context preservation - claude ai sonnet 4.5
          // imports: this.extractImports(content),
          // dependencies: this.extractDependencies(node, content),
          // parentClass: this.getParentClass(node),
          // documentation: this.extractDocComment(node, content)
        }
      };
    } catch (err) {
      this.log.error(`Error creating chunk: ${err.message}`, err);
      return null;
    }
  }

  extractChunksFromAST(tree, content, filePath, language) {
    const chunks = [];
    const rootNode = tree.rootNode;

    if (['js', 'mjs', 'cjs', 'ts', 'tsx'].includes(language)) {
      chunks.push(...this.extractJavaScriptChunks(rootNode, content, filePath, language));
    }
    // TODO: build methods/logic for other languages.

    return chunks; //.filter(chunk => this.isCompleteStructure(chunk.text, language));
  }

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

    if (node.startRow === node.endRow ) {
      chunk = this.buildChunk(node, content, filePath, language, 'variable');
      chunk.metadata.variableName = this.getEntityName(node, content);
    }

    return chunk;
  }

  // parseFieldNode(node, content, filePath, language) {
  //   throw new Error('Found a parseFileNode');
  //   const valueNode = node.namedChildren.find(child =>
  //     child.type === 'arrow_function' || child.type === 'async_arrow_function'
  //   );
  //   if (valueNode) {
  //     arrowFunctionCount++;
  //     const fieldName = this.getEntityName(node, content);
  //     const isAsync = valueNode.type === 'async_arrow_function';
  //     const chunk = this.buildChunk(valueNode, content, filePath, language, 'method');
  //
  //     chunk.metadata.methodName = fieldName;
  //     chunk.metadata.isArrow = true;
  //     chunk.metadata.isAsync = isAsync;
  //     chunk.metadata.isClassProperty = true;
  //     return chunk;
  //   }
  // }

  extractJavaScriptChunks(rootNode, content, filePath, language) {

    const chunks = [];

    const visit = (node) => {
      let chunk = [];

      switch (node.type) {
        case 'function_declaration':
        case 'generator_function_declaration':
          chunk = this.parseFunctionNode(node, content, filePath, language);
          chunks.push(chunk);

          break;

        case 'arrow_function':
        case 'async_arrow_function':
          chunk = this.parseArrowFunctionNode(node, content, filePath, language);
          chunks.push(chunk);
          break;

        case 'class_declaration':
          chunk = this.parseClassNode(node, content, filePath, language);
          chunks.push(chunk);
          break;

        case 'method_definition':
          chunk = this.parseMethodNode(node, content, filePath, language);
          chunks.push(chunk);
          break;

        // case 'field_declaration':
        //   chunk = this.parseFieldNode(node, content, filePath, language);
        //   chunks.push(chunk);
        //   break;

        case 'variable_declarator':
          chunk = this.parseVariableNode(node, content, filePath, language);
          if (chunk.text.length > 0 ) {
            chunks.push(chunk);
          }
          break;
        default:
          // this.log.error('Cant find match for node: ', node);
      }

      for (let i = 0; i < node.childCount; i++) {
        visit(node.child(i));
      }
    };

    visit(rootNode);

    return chunks;
  }

  // getArrowFunctionName(node, content) {
  //   const visit = (n) => {
  //     if (n.type === 'identifier' && n !== node) {
  //       const startPos = n.startPosition;
  //       const endPos = n.endPosition;
  //       const lines = content.split('\n');
  //
  //       if (startPos.row === endPos.row) {
  //         return lines[startPos.row].substring(startPos.column, endPos.column);
  //       }
  //     }
  //     for (let i = 0; i < n.childCount; i++) {
  //       const result = visit(n.child(i));
  //       if (result) return result;
  //     }
  //     return null;
  //   };
  //   return visit(node) || 'anonymous';
  // }

  getEntityName(node, content) {
    try {
      // For function/class declarations, look for the name identifier
      const visit = (n) => {
        if (n.type === 'identifier') {
          const startPos = n.startPosition;
          const endPos = n.endPosition;
          const lines = content.split('\n');

          if (startPos.row === endPos.row) {
            const name = lines[startPos.row].substring(startPos.column, endPos.column);
            return name;
          }
        }
        // Also check for property_identifier (for methods like obj.method())
        // if (n.type === 'property_identifier') {
        //   const startPos = n.startPosition;
        //   const endPos = n.endPosition;
        //   const lines = content.split('\n');
        //
        //   if (startPos.row === endPos.row) {
        //     const name = lines[startPos.row].substring(startPos.column, endPos.column);
        //     return name;
        //   }
        // }
        for (let i = 0; i < n.childCount; i++) {
          const result = visit(n.child(i));
          if (result) return result;
        }
      };
      const result = visit(node);
      return result;
    } catch (err) {
      this.log.error(`Error in getEntityName: ${err.message}`, err);
      return 'anonymous';
    }
  }

  getNodeText(node, content) {
    const startPosition = node.startPosition;
    const endPosition = node.endPosition;
    const lines = content.split('\n');
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
    if (ext === 'mjs' || ext === 'cjs') {
      return 'js';
    }
    return ext;
  }

  isAsyncFunction(node, content) {
    const text = this.getNodeText(node, content);
    return text.includes('async function') || text.startsWith('async ');
  }

  // isCompleteStructure(text, language) {
  //   return true;
  //   // TODO: refactor hardcoded array to allow for other languages.
  //   if (['js', 'mjs', 'cjs', 'ts', 'tsx'].includes(language)) {
  //     // For JavaScript/TypeScript, check for balanced braces
  //     const openBraces = (text.match(/{/g) || []).length;
  //     const closeBraces = (text.match(/}/g) || []).length;
  //
  //     // Also check for function/class keywords
  //     const hasFunctionKeyword = text.includes('function ') || text.includes('=>') || text.includes('class ');
  //     const hasOpeningBrace = text.includes('{');
  //     const hasClosingBrace = text.includes('}');
  //
  //     return hasFunctionKeyword && hasOpeningBrace && hasClosingBrace &&
  //            Math.abs(openBraces - closeBraces) <= 1;
  //   }
  //
  //   return true; // For other languages, assume it's complete
  // }

  initLanguages() {
    const jsParser = new Parser();
    jsParser.setLanguage(JavaScript);

    const extensions = ['js', 'jsx', 'mjs', 'cjs', 'javascript'];
    extensions.forEach(ext => {
      this.languageParsers.set(ext, jsParser);
    });

    // TypeScript/TSX
    const tsParser = new Parser();
    tsParser.setLanguage(TypeScript.typescript);
    this.languageParsers.set('ts', tsParser);
    this.languageParsers.set('typescript', tsParser);

    // TypeScript JSX
    const tsxParser = new Parser();
    tsxParser.setLanguage(TypeScript.tsx);
    this.languageParsers.set('tsx', tsxParser);

    this.log.info(`🌳 Languages initialized for: ${[...new Set([...this.languageParsers.keys()])].join(', ')}`);
  }

  parseCodeFile(filePath, content) {
    const language = this.getLanguageFromPath(filePath);
    const parser = this.languageParsers.get(language);

    if (!parser) {
      this.log.error(`No Tree-sitter parser for ${language}`);
      return [];
    }

    try {
      const tree = parser.parse(content);

      this.log.info(`🌳 Parsed ${filePath} successfully`);

      const _chunks = this.extractChunksFromAST(tree, content, filePath, language);

      if (_chunks.length === 0) {
        this.log.error(`No AST chunks extracted from ${filePath}`);
        return [];
      }

      this.log.info(`Extracted ${_chunks.length} chunks from ${filePath}`);

      // Return the chunks directly, no need to push to another array
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

  printASTStats(rootNode) {
    const stats = {};

    const visit = (node) => {
      stats[node.type] = (stats[node.type] || 0) + 1;
      for (let i = 0; i < node.childCount; i++) {
        visit(node.child(i));
      }
    };

    visit(rootNode);

    // TODO: Clean this up... alot
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
