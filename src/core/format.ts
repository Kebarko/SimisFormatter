import type { WriterOptions } from './options';
import { parse } from './parser';
import { write } from './writer';

/**
 * Formats SIMIS text as SimisSharp's `processor.Save(processor.Parse(text), options)` does,
 * except that lines end with `newLine` instead of CRLF.
 * Text copied from the input, such as a comment block or a quoted string that spans lines, keeps its own line breaks.
 * @param text The text to format, without the byte order mark.
 * @param options The writer options.
 * @param newLine The line break to write, `'\r\n'` or `'\n'`.
 * @returns The formatted text.
 * @throws {SimisParseError} When the text is not well-formed.
 */
export function format(text: string, options: WriterOptions, newLine: string): string {
    return write(parse(text), options, newLine);
}
