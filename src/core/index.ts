/**
 * The core of the formatter: the SIMIS parser and writer ported from SimisSharp.
 * It must not import `vscode` or Node modules, so that it runs and is tested in plain Node.
 */
export { SimisParseError } from './errors';
export { format } from './format';
export { isTextSimisHeader } from './header';
export { createTableConfig, createWriterOptions } from './options';
export type { TableConfig, WriterOptions } from './options';
