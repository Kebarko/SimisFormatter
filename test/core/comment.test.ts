import { describe, expect, it } from 'vitest';
import { parse, SimisNode, SimisParseError } from '../../src/core';
import { lines, parseAndSave, save } from './helpers';

// Ported from SimisSharp's CommentTest.

describe('comment blocks', () => {
    it.each([
        ['comment ( note )', 'comment', ' note '],
        ['Comment(note)', 'Comment', 'note'],
        ['skip ( note )', 'skip', ' note '],
        ['SKIP ( note )', 'SKIP', ' note '],
        ['_skip ( note )', '_skip', ' note '],
        ['_Info ( note )', '_Info', ' note '],
        ['_ORTSMaxPower ( 1000kW )', '_ORTSMaxPower', ' 1000kW '],
        ['#ORTSMaxPower ( 1000kW )', '#ORTSMaxPower', ' 1000kW '],
        ['# ( note )', '#', ' note '],
        ['#( note )', '#', ' note '],
        ['_ ( note )', '_', ' note '],
        ['comment\r\n(\r\n  note\r\n)', 'comment', '\r\n  note\r\n'],
    ])('a comment block keeps its content verbatim: %j', (input, name, content) => {
        // Act
        const comment = single(parse(input).root.getNodes());

        // Assert
        expect(comment.isComment).toBe(true);
        expect(comment.value).toBe(name);
        expect(single(comment.getNodes()).value).toBe(content);
    });

    it.each([
        ['comment ( "a ) b" )', ' "a ) b" '],
        ['comment ( "a \\" ) b" )', ' "a \\" ) b" '],
        ['comment ( "a" + "b ) c" )', ' "a" + "b ) c" '],
        ['comment ( "a" +\r\n  "b ) c" )', ' "a" +\r\n  "b ) c" '],
        ['comment ( Wire ( 0.0   6.2 -0.219 ) )', ' Wire ( 0.0   6.2 -0.219 ) '],
        ['comment ( 5" tyre )', ' 5" tyre '],
        ['comment ( a\\) )', ' a\\) '],
        ['_ORTSMaxTractiveForceCurves ( 2 0 ( 0 0 ) 1 ( "x)" ) )', ' 2 0 ( 0 0 ) 1 ( "x)" ) '],
    ])('a comment block ends where Open Rails ends it: %j', (input, content) => {
        // Act
        const nodes = parse(input + '\r\nNext ( 1 )').root.getNodes();

        // Assert
        expect(nodes).toHaveLength(2);
        expect(nodes[0].isComment).toBe(true);
        expect(single(nodes[0].getNodes()).value).toBe(content);
        expect(nodes[1].value).toBe('Next');
        expect(single(nodes[1].getNodes()).value).toBe('1');
    });

    it.each([
        'comment (\r\n)',
        'comment (\n)',
        'comment ("abc")',
        'comment ( )',
        'comment ( Wire ( 0.0   6.2 -0.219 ) )',
        'A ( 1 ) comment ( note )',
    ])('a comment block round-trips verbatim: %j', (input) => {
        // Act
        const actual = parseAndSave(input);

        // Assert
        expect(actual).toBe(input + '\r\n');
    });

    it.each([
        'Name ( comment )',
        'Name ( Skip )',
        'A ( x skip y )',
        'A ( 1 comment )',
        'Filename ( _shape.s )',
        'Description ( #1 engine )',
        '"comment" ( x )',
    ])('a comment token without a block is a value: %j', (input) => {
        // Act
        const document = parse(input);
        const actual = save(document);

        // Assert
        expect([...descendants(document.root)].filter((n) => n.isComment).map((n) => n.value)).toEqual([]);
        expect(actual).toBe(input + '\r\n');
    });

    it.each([
        ['comment ( note', 1],
        ['comment ( "a ) b )', 1],
        ['_ORTSFoo ( ( 1 )', 1],
        ['A ( 1 )\r\n\r\ncomment (\r\n  note', 3],
        ['comment (\r\n  x\r\n  "a ) b )', 3],
        ['comment ( "a" +\r\n  "b ) c )', 2],
    ])('an unterminated comment block %j throws with line %i', (input, line) => {
        const exception = getParseError(() => parse(input));
        expect(exception.line).toBe(line);
    });

    it('removing comments keeps values', () => {
        // Arrange
        const input = lines(
            'Wagon (',
            '\tcomment ( Gondola Car )',
            '\t_ORTSMaxTractiveForceCurves ( 2 0 ( 0 0 ) 1 ( 0 0 ) )',
            '\t#ORTSBrakeShoeFriction ( 0 0.5 )',
            '\tSkip ( "a ) b" )',
            '\tName ( skip )',
            '\tSound ( _engine.sms )',
            '\tComment ( #1 )',
            ')');
        const expected = lines(
            'Wagon (',
            '\tName ( skip )',
            '\tSound ( _engine.sms )',
            ')');
        const document = parse(input);

        // Act
        const withComments = save(document);
        const withoutComments = save(document, { preserveComments: false });

        // Assert
        expect(withComments).toBe(input);
        expect(withoutComments).toBe(expected);
    });

    it('a comment requires a block', () => {
        // Arrange
        const node = new SimisNode('comment');

        // Act
        const leafIsComment = node.isComment;
        node.addParsedNode(new SimisNode(' note '));

        // Assert
        expect(leafIsComment).toBe(false);
        expect(node.isComment).toBe(true);
    });
});

/**
 * Returns the only item of `items`, as xUnit's `Assert.Single` does. The test fails when there is not exactly one item.
 * @param items The items, which must contain exactly one item.
 * @returns The only item.
 */
function single<T>(items: readonly T[]): T {
    expect(items).toHaveLength(1);
    return items[0];
}

/**
 * Returns the descendants of `node` in document order: each child node, followed by its own descendants.
 * Ported from the `Descendants` helper of SimisSharp's `CommentTest`.
 * @param node The node whose descendants are returned.
 * @returns The descendants of the node.
 */
function* descendants(node: SimisNode): Generator<SimisNode> {
    for (const subnode of node.getNodes()) {
        yield subnode;

        yield* descendants(subnode);
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
