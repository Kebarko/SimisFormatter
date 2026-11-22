/**
 * The core of the formatter: the SIMIS parser and writer ported from SimisSharp.
 * It must not import `vscode` or Node modules, so that it runs and is tested in plain Node.
 */
export { SimisParseError } from './errors';
export { escape, unescape } from './escape';
export { format } from './format';
export { isTextSimisHeader } from './header';
export { quote, requiresQuotes, SimisDocument, SimisNode } from './node';
export { createTableConfig, createWriterOptions } from './options';
export type { TableConfig, WriterOptions } from './options';
export { parse } from './parser';
export { findNodesByPath, isMatchForPath } from './path';
export { SimisReader, SimisTokenType } from './reader';
export { isMatch } from './wildcard';
export { write } from './writer';
