import { describe, expect, it } from 'vitest';
import { parse, SimisParseError, SimisReader, SimisTokenType, type SimisNode } from '../../src/core';
import { documentTestCases } from './documentTestData';

// Ported from SimisSharp's SimisReaderTest. ReadsTypedValues and ValueEqualsIgnoresCaseByDefault are not ported,
// because the typed accessors of the reader (TryGetNumber, TryGetDouble, TryGetInt32, TryGetUInt32, TryGetHex, TryGetBoolean
// and ValueEquals) are not part of the formatter.

/**
 * A wagon with a header, a blank line, nested blocks and several values on one line.
 */
const WAGON = 'SIMISA@@@@@@@@@@JINX0D0t______\r\n\r\nWagon ( Name\r\n\tMass ( 10t )\r\n\tSize ( 1 2 3 )\r\n)';

describe('SimisReader', () => {
    it('reads values and blocks', () => {
        // Act
        const tokens = readTokens(WAGON);

        // Assert
        expect(tokens).toEqual(['SIMISA@@@@@@@@@@JINX0D0t______', 'Wagon (', 'Name', 'Mass (', '10t', ')', 'Size (', '1', '2', '3', ')', ')']);
    });

    it('reports depth and line', () => {
        // Arrange
        const reader = new SimisReader(WAGON);
        const actual: [SimisTokenType, number, number][] = [];

        // Act
        while (reader.read()) {
            actual.push([reader.tokenType, reader.depth, reader.line]);
        }

        // Assert
        expect(actual).toEqual([
            [SimisTokenType.Value, 0, 1],
            [SimisTokenType.StartBlock, 0, 3], [SimisTokenType.Value, 1, 3],
            [SimisTokenType.StartBlock, 1, 4], [SimisTokenType.Value, 2, 4], [SimisTokenType.EndBlock, 1, 4],
            [SimisTokenType.StartBlock, 1, 5], [SimisTokenType.Value, 2, 5], [SimisTokenType.Value, 2, 5], [SimisTokenType.Value, 2, 5], [SimisTokenType.EndBlock, 1, 5],
            [SimisTokenType.EndBlock, 0, 6],
        ]);
        expect(reader.tokenType).toBe(SimisTokenType.None);
        expect(reader.read()).toBe(false);
    });

    it('counts lines inside quoted values and comments', () => {
        // Arrange
        const reader = new SimisReader('A ( "two\nlines" )\ncomment ( a\nb )\nB ( 1 )');
        const lines: number[] = [];

        // Act
        while (reader.read()) {
            lines.push(reader.line);
        }

        // Assert
        expect(lines).toEqual([1, 1, 2, 5, 5, 5]);
    });

    it('reads quoted values', () => {
        // Arrange
        const reader = new SimisReader('Name ( "My \\"big\\" (loco)" ) "Quoted Block" ( 1 )');

        // Act & Assert
        expect(reader.read()).toBe(true);
        expect(reader.isQuoted).toBe(false);
        expect(reader.read()).toBe(true);
        expect(reader.tokenType).toBe(SimisTokenType.Value);
        expect(reader.isQuoted).toBe(true);
        expect(reader.valueText).toBe('My \\"big\\" (loco)');
        expect(reader.getString()).toBe('My "big" (loco)');
        expect(reader.read()).toBe(true);
        expect(reader.read()).toBe(true);
        expect(reader.tokenType).toBe(SimisTokenType.StartBlock);
        expect(reader.isQuoted).toBe(true);
        expect(reader.getString()).toBe('Quoted Block');
    });

    it.each([
        ['a\\"b c', ['a\\"b', 'c']],
        ['a\\\\"b" c', ['a\\\\', '"b"', 'c']],
        ['"a"b', ['"a"', 'b']],
        ['A(1)B(2)', ['A (', '1', ')', 'B (', '2', ')']],
        ['A\r\n(\r\n1\r\n)', ['A (', '1', ')']],
        ['"" ( "" )', ['"" (', '""', ')']],
    ])('splits %j into tokens as the parser does', (input, expected) => {
        expect(readTokens(input)).toEqual(expected);
    });

    it('skips comments by default', () => {
        // Arrange
        const input = 'Wagon ( comment ( a ( b ) "c)" ) _Info ( x ) #ORTSMass ( 1t ) Skip(y) Name ( skip ) Sound ( _engine.sms ) )';

        // Act
        const tokens = readTokens(input);

        // Assert
        expect(tokens).toEqual(['Wagon (', 'Name (', 'skip', ')', 'Sound (', '_engine.sms', ')', ')']);
    });

    it('reads comments when asked', () => {
        // Arrange
        const reader = new SimisReader('Wagon (\r\n\tcomment ( a ( b ) "c)" )\r\n\t#ORTSMass (1t)\r\n)', true);

        // Act & Assert
        expect(reader.read()).toBe(true);
        expect(reader.read()).toBe(true);
        expect(reader.tokenType).toBe(SimisTokenType.Comment);
        expect(reader.depth).toBe(1);
        expect(reader.line).toBe(2);
        expect(reader.valueText).toBe('comment');
        expect(reader.commentText).toBe(' a ( b ) "c)" ');
        expect(reader.read()).toBe(true);
        expect(reader.tokenType).toBe(SimisTokenType.Comment);
        expect(reader.valueText).toBe('#ORTSMass');
        expect(reader.commentText).toBe('1t');
        expect(reader.read()).toBe(true);
        expect(reader.tokenType).toBe(SimisTokenType.EndBlock);
        expect(reader.commentText).toBe('');
    });

    it('skip moves to the end of the block', () => {
        // Arrange
        const reader = new SimisReader('A ( B ( 1 C ( 2 ) ) D ( 3 ) )');
        reader.read();
        reader.read();

        // Act
        reader.skip();

        // Assert
        expect(reader.tokenType).toBe(SimisTokenType.EndBlock);
        expect(reader.depth).toBe(1);
        expect(reader.read()).toBe(true);
        expect(reader.getString()).toBe('D');
    });

    it('skip ignores other tokens', () => {
        // Arrange
        const reader = new SimisReader('A ( 1 )');
        reader.read();
        reader.read();

        // Act
        reader.skip();

        // Assert
        expect(reader.tokenType).toBe(SimisTokenType.Value);
        expect(reader.getString()).toBe('1');
    });

    it.each([
        ['A ( B ( 1 )', 1, "'A' is not closed"],
        ['A ( 1 )\nB (\n\tC ( 2\n)\n', 2, "'B' is not closed"],
        ['"My Wagon" (\n', 1, "'My Wagon' is not closed"],
        ['A ( 1 )\n)\n', 2, "Unexpected ')'"],
        ['A ( "multi\nline" )\n)', 3, "Unexpected ')'"],
        ['comment ( a\nb )\n)', 3, "Unexpected ')'"],
        ['\n\n( 1 )', 3, "block name before '('"],
        ['A ( 1 ) ( 2 )', 1, "block name before '('"],
        ['A ( 1 )\nB ( "abc )\n', 2, 'Unterminated quoted string'],
        ['A ( "abc\\" )', 1, 'Unterminated quoted string'],
        ['A ( 1 )\r\n\r\ncomment (\r\n  note', 3, 'Unterminated comment block'],
        ['comment ( "a" +\r\n  "b ) c )', 2, 'Unterminated quoted string in comment block'],
    ])('malformed text %j throws with line %i', (input, line, message) => {
        // Act
        const exception = getParseError(() => readTokens(input));

        // Assert
        expect(exception.line).toBe(line);
        expect(exception.message).toContain(message);
    });

    it.each(documentTestCases)('the reader matches the parsed tree of $name', ({ input }) => {
        // Arrange
        const fromTree: string[] = [];
        for (const node of parse(input).root.nodes) {
            addTreeTokens(node, fromTree);
        }

        // Act
        const fromReader = readTokens(input, true);

        // Assert
        expect(fromReader).toEqual(fromTree);
    });
});

/**
 * Reads all tokens of `input`: values as decoded text, in quotes when they are quoted, block starts as the name and a parenthesis,
 * and comment blocks as `#name(content)`. Ported from the `Tokens` helper of SimisSharp's `SimisReaderTest`.
 * @param input The text to read.
 * @param readComments When true, comment blocks are read as tokens instead of being skipped.
 * @returns The tokens in the order they were read.
 */
function readTokens(input: string, readComments = false): string[] {
    const tokens: string[] = [];
    const reader = new SimisReader(input, readComments);
    while (reader.read()) {
        const value = reader.isQuoted ? `"${reader.getString()}"` : reader.getString();
        switch (reader.tokenType) {
            case SimisTokenType.StartBlock:
                tokens.push(value + ' (');
                break;
            case SimisTokenType.EndBlock:
                tokens.push(')');
                break;
            case SimisTokenType.Comment:
                tokens.push(`#${value}(${reader.commentText})`);
                break;
            default:
                tokens.push(value);
                break;
        }
    }

    return tokens;
}

/**
 * Adds the tokens that {@link readTokens} returns for the text of `node`, taken from the parsed tree.
 * Ported from the `AddTreeTokens` helper of SimisSharp's `SimisReaderTest`.
 * @param node The node whose tokens are added.
 * @param tokens The list the tokens are added to.
 */
function addTreeTokens(node: SimisNode, tokens: string[]): void {
    if (node.isDummyLeaf) {
        return;
    }

    const value = node.isQuoted ? `"${node.value}"` : node.value!;
    if (node.isLeaf) {
        tokens.push(value);
    } else if (node.isComment) {
        const content = node.nodes[0];
        tokens.push(`#${value}(${content.isVerbatim ? content.value : ''})`);
    } else {
        tokens.push(value + ' (');
        for (const subnode of node.nodes) {
            addTreeTokens(subnode, tokens);
        }

        tokens.push(')');
    }
}

/**
 * Runs `action` and returns the {@link SimisParseError} it throws, as xUnit's `Assert.Throws<SimisParseException>` does.
 * The test fails when the action throws another error or nothing at all.
 * @param action The action that is expected to throw.
 * @returns The error the action threw.
 */
function getParseError(action: () => unknown): SimisParseError {
    try {
        action();
    } catch (error) {
        expect(error).toBeInstanceOf(SimisParseError);
        return error as SimisParseError;
    }

    return expect.unreachable('Expected a SimisParseError, but nothing was thrown.');
}
