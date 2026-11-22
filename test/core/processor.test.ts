import { describe, expect, it } from 'vitest';
import { createWriterOptions, parse, SimisParseError, write } from '../../src/core';
import { lines, save } from './helpers';

/**
 * Parses text that is not well-formed and returns the error the parser throws.
 * The test fails when the parser throws nothing, or throws an error that is not a {@link SimisParseError}.
 * @param text The text to parse.
 * @returns The error thrown by the parser.
 */
function catchParseError(text: string): SimisParseError {
    try {
        parse(text);
    } catch (error) {
        expect(error).toBeInstanceOf(SimisParseError);
        return error as SimisParseError;
    }

    throw new Error('The parser did not throw a SimisParseError.');
}

describe('parse and write', () => {
    it.each([1, 2, 3])('blank lines are kept without collapsing (%i in a row)', (blankLines) => {
        // Arrange
        const input = lines('A ( 1 )') + '\r\n'.repeat(blankLines) + lines('B ( 2 )');

        // Act
        const actual = save(parse(input), { collapseEmptyLines: false });

        // Assert
        expect(actual).toBe(input);
    });

    it.each([1, 3])('blank lines are collapsed (%i in a row)', (blankLines) => {
        // Arrange
        const input = lines('A ( 1 )') + '\r\n'.repeat(blankLines) + lines('B ( 2 )');

        // Act
        const actual = save(parse(input));

        // Assert
        expect(actual).toBe(lines('A ( 1 )', '', 'B ( 2 )'));
    });

    it('blank lines inside blocks are kept', () => {
        // Arrange
        const input = lines(
            'SIMISA@@@@@@@@@@JINX0D0t______',
            '',
            '',
            'Wagon (',
            '',
            '',
            '\tMass ( 10t )',
            '',
            '\tSize ( 1 2 3 )',
            '',
            '',
            ')',
            '',
            '',
            'Engine ( 1 )',
        );
        const collapsed = lines(
            'SIMISA@@@@@@@@@@JINX0D0t______',
            '',
            'Wagon (',
            '',
            '\tMass ( 10t )',
            '',
            '\tSize ( 1 2 3 )',
            '',
            ')',
            '',
            'Engine ( 1 )',
        );
        const document = parse(input);
        const wagon = document.root.nodes[1];

        // Act
        const kept = save(document, { collapseEmptyLines: false });
        const collapsedActual = save(document);
        const removed = save(document, { preserveEmptyLines: false });

        // Assert
        expect(wagon.leadingEmptyLines).toBe(2);
        expect(wagon.nodes[0].leadingEmptyLines).toBe(2);
        expect(wagon.nodes[1].leadingEmptyLines).toBe(1);
        expect(wagon.nodes[1].trailingEmptyLines).toBe(2);
        expect(document.root.nodes[2].leadingEmptyLines).toBe(2);
        expect(kept).toBe(input);
        expect(collapsedActual).toBe(collapsed);
        expect(removed).toBe(lines('SIMISA@@@@@@@@@@JINX0D0t______', 'Wagon (', '\tMass ( 10t )', '\tSize ( 1 2 3 )', ')', 'Engine ( 1 )'));
    });

    it.each([
        ['A ( B ( 1 )', 1, "'A' is not closed"],
        ['A ( 1 )\nB (\n\tC ( 2\n)\n', 2, "'B' is not closed"],
        ['Wagon (\n\tMass (\n\t\t10t\n', 2, "'Mass' is not closed"],
        ['"My Wagon" (\n', 1, "'My Wagon' is not closed"],
        ['A ( 1 ) ) B ( 2 )', 1, "Unexpected ')'"],
        ['A ( 1 )\n)\n', 2, "Unexpected ')'"],
        [')', 1, "Unexpected ')'"],
        ['A ( "multi\nline" )\n)', 3, "Unexpected ')'"],
        ['comment ( a\nb )\n)', 3, "Unexpected ')'"],
        ['(', 1, "block name before '('"],
        ['\n\n( 1 )', 3, "block name before '('"],
        ['A ( 1 ) ( 2 )', 1, "block name before '('"],
        ['A ( ( 1 ) )', 1, "block name before '('"],
        ['A (\n\tB ( 1 )\n\t( 2 )\n)', 3, "block name before '('"],
        ['A ( 1 ) )\nB ( "abc )', 1, "Unexpected ')'"],
        ['A ( "abc )\n)', 1, 'Unterminated quoted string'],
    ])('a malformed block throws with its line: %j', (input, line, message) => {
        // Act
        const error = catchParseError(input);

        // Assert
        expect(error.line).toBe(line);
        expect(error.message.startsWith(`Line ${line}: `)).toBe(true);
        expect(error.message).toContain(message);
    });

    it.each([
        ['A ( "abc )', 1],
        ['A ( 1 )\nB ( "abc )\n', 2],
        ['A ( "ok\nstill ok" )\nB ( "abc )', 3],
    ])('an unterminated quoted string throws with its line: %j', (input, line) => {
        const error = catchParseError(input);
        expect(error.line).toBe(line);
    });

    it.each(['', 'A', 'A ( )', '"A" ( 1 )', 'A ( B ( C ( 1 ) ) D ( ) )\nE ( 2 )'])('a well-formed block parses: %j', (input) => {
        expect(() => parse(input)).not.toThrow();
    });

    // MSTS expects CRLF line endings, which the writer uses on every operating system, also for text read with LF line endings.
    it('the writer uses CRLF line endings', () => {
        // Act
        const actual = save(parse('A ( 1 )\nB (\n\tC ( 2 )\n)\n'));

        // Assert
        expect(actual).toBe('A ( 1 )\r\nB (\r\n\tC ( 2 )\r\n)\r\n');
    });

    // The extension writes the line ending of the document, which VS Code passes to the writer, instead of always writing CRLF.
    it('the writer uses LF line endings when it is given LF', () => {
        // Act
        const actual = write(parse('A ( 1 )\r\nB (\r\n\tC ( 2 )\r\n)\r\n'), createWriterOptions(), '\n');

        // Assert
        expect(actual).toBe('A ( 1 )\nB (\n\tC ( 2 )\n)\n');
    });

    it('text copied from the file keeps its line breaks', () => {
        // Arrange: the comment block and the quoted string span lines, and their line feeds are part of the text that is copied.
        const input = 'A (\n\tcomment ( a\nb )\n\tB ( "x\ny" )\n)\n';

        // Act
        const actual = save(parse(input));

        // Assert
        expect(actual).toBe('A (\r\n\tcomment ( a\nb )\r\n\tB ( "x\ny" )\r\n)\r\n');
    });
});
