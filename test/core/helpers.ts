import { parse, write, type SimisDocument, type WriterOptions, createWriterOptions } from '../../src/core';

/**
 * The line break SimisSharp writes, which the ported tests expect.
 */
export const CRLF = '\r\n';

/**
 * Joins lines with CRLF and ends them with CRLF, as the `Lines` helper of the SimisSharp tests does.
 * @param lines The lines.
 * @returns The text.
 */
export function lines(...lines: string[]): string {
    return lines.join(CRLF) + CRLF;
}

/**
 * Writes a document with CRLF line breaks, as SimisSharp's `processor.Save(document, options)` does.
 * @param document The document to write.
 * @param options The options that differ from the defaults of SimisSharp's `WriterOptions`.
 * @returns The written text.
 */
export function save(document: SimisDocument, options: Partial<WriterOptions> | WriterOptions = {}): string {
    return write(document, createWriterOptions(options), CRLF);
}

/**
 * Parses text and writes it again with CRLF line breaks, as SimisSharp's `processor.Save(processor.Parse(text), options)` does.
 * @param text The text to parse.
 * @param options The options that differ from the defaults of SimisSharp's `WriterOptions`.
 * @returns The written text.
 */
export function parseAndSave(text: string, options: Partial<WriterOptions> | WriterOptions = {}): string {
    return save(parse(text), options);
}
