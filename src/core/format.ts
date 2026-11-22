import type { WriterOptions } from './options';

/**
 * Formats SIMIS text as SimisSharp's `processor.Save(processor.Parse(text), options)` does,
 * except that lines end with `newLine` instead of CRLF.
 * Text copied from the input, such as a comment block or a quoted string that spans lines, keeps its own line breaks.
 * @param _text The text to format, without the byte order mark.
 * @param _options The writer options.
 * @param _newLine The line break to write, `'\r\n'` or `'\n'`.
 * @returns The formatted text.
 * @throws {SimisParseError} When the text is not well-formed.
 */
export function format(_text: string, _options: WriterOptions, _newLine: string): string {
    // The reader, parser and writer are not ported from SimisSharp yet.
    throw new Error('The SIMIS parser and writer are not ported from SimisSharp yet.');
}
