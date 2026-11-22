import { describe, expect, it } from 'vitest';
import { escape, parse, requiresQuotes, SimisDocument, SimisNode, unescape } from '../../src/core';
import { parseAndSave, save } from './helpers';

// Ported from SimisSharp's QuotingTest. SimisSharp's verbatim strings (@"...") are written here as ordinary strings
// with the same characters, so a backslash in a verbatim string is "\\" and a doubled quote ("") is a single '"'.

describe('quoting', () => {
    it.each([
        ['A ( "abc" x )', 'A ( abc x )'],
        ['A ( "" x )', 'A ( "" x )'],
        ['A ( "a b" x )', 'A ( "a b" x )'],
        ['A ( "a\tb" x )', 'A ( "a\tb" x )'],
        ['A ( "a\r\nb" x )', 'A ( "a\r\nb" x )'],
        ['A ( "a(b" x )', 'A ( "a(b" x )'],
        ['A ( "a)b" x )', 'A ( "a)b" x )'],
        ['A ( "a\\"b" x )', 'A ( "a\\"b" x )'],
    ])('the writer quotes values that need quotes: %j', (input, expected) => {
        // Act
        const actual = parseAndSave(input, { preserveQuotes: false });

        // Assert
        expect(actual).toBe(expected + '\r\n');
    });

    it.each([
        '',
        'abc',
        'a b',
        'a\tb',
        'a\nb',
        'a(b',
        'a)b',
        'a\\"b',
        'comment',
        '_skip',
    ])('the value %j round-trips', (value) => {
        // Arrange
        const document = new SimisDocument();
        const node = new SimisNode('A');
        node.addParsedNode(new SimisNode(value));
        node.addParsedNode(new SimisNode('x'));
        document.root.addParsedNode(node);

        // Act
        const text = save(document, { preserveQuotes: false });
        const parsed = single(parse(text).root.getNodes());

        // Assert
        expect(parsed.value).toBe('A');
        expect(parsed.getNodes().map((n) => n.value)).toEqual([value, 'x']);
    });

    it.each([
        ['', true],
        ['abc', false],
        ['3.5f', false],
        ['common.cab/cab.cvf', false],
        ['..\\common.cab\\cab.cvf', true],
        ['a b', true],
        ['a\tb', true],
        ['a\r\nb', true],
        ['a(b', true],
        ['a)b', true],
        ['a"b', true],
    ])('requiresQuotes(%j) returns %s', (value, expected) => {
        expect(requiresQuotes(value)).toBe(expected);
    });

    it.each([
        ['"..\\\\..\\\\common.snd\\\\gen.sms"', '..\\..\\common.snd\\gen.sms'],
        ['"Line one\\nLine two"', 'Line one\nLine two'],
        ['"Tab\\there"', 'Tab\there'],
        ['"say \\"hi\\""', 'say "hi"'],
        ['"\\M"', 'M'],
        ['"plain"', 'plain'],
        ['..\\plain\\path', '..\\plain\\path'],
    ])('the parser decodes the quoted value %j', (token, expected) => {
        // Act
        const node = parse(`A ( ${token} )`).root.nodes[0].nodes[0];

        // Assert
        expect(node.value).toBe(expected);
    });

    it.each([
        'A ( "..\\\\..\\\\common.snd\\\\gen.sms" )',
        'A ( "Line one\\nLine two" )',
        'A ( "\\M" )',
        'A ( ..\\plain\\path )',
        'A ( a\\"b )',
    ])('unchanged values are written as read: %j', (input) => {
        expect(parseAndSave(input)).toBe(input + '\r\n');
    });

    // SimisSharp changes the value of a parsed node (node.Value = value), which clears the text kept from parsing.
    // The formatter has no editing API, so the test builds the same tree by hand: a block A with a new, unquoted node.
    it.each([
        ['say "hi"', '"say \\"hi\\""'],
        ['C:\\My Folder\\', '"C:\\\\My Folder\\\\"'],
        ['..\\..\\common.cab\\cab.cvf', '"..\\\\..\\\\common.cab\\\\cab.cvf"'],
        ['Line one\nLine two', '"Line one\\nLine two"'],
        ['Tab\there', '"Tab\\there"'],
        ['5" gauge', '"5\\" gauge"'],
        ['plain', 'plain'],
    ])('changed value %j is quoted and escaped', (value, expectedText) => {
        // Arrange
        const document = new SimisDocument();
        const block = new SimisNode('A');
        document.root.addParsedNode(block);

        // Act
        block.addParsedNode(new SimisNode(value));
        const text = save(document);
        const reparsed = parse(text).root.nodes[0].nodes[0];

        // Assert
        expect(text).toBe(`A ( ${expectedText} )\r\n`);
        expect(reparsed.value).toBe(value);
    });

    it.each([
        ['A ( "abc" )', 'A ( abc )'],
        ['A ( "a\\\\b" )', 'A ( "a\\\\b" )'],
        ['A ( "\\M" )', 'A ( M )'],
        ['A ( "a\\"b" )', 'A ( "a\\"b" )'],
    ])('dropping quotes keeps escapes where needed: %j', (input, expected) => {
        expect(parseAndSave(input, { preserveQuotes: false })).toBe(expected + '\r\n');
    });

    it.each([
        ['', ''],
        ['plain', 'plain'],
        ['a\\\\b', 'a\\b'],
        ['a\\"b', 'a"b'],
        ['\\n\\t', '\n\t'],
        ['\\x\\y', 'xy'],
        ['end\\', 'end\\'],
    ])('unescape(%j) returns %j', (text, expected) => {
        expect(unescape(text)).toBe(expected);
    });

    it.each([
        '',
        'plain',
        'C:\\My Folder\\',
        'say "hi"',
        'a\nb\tc\rd',
    ])('escaping %j round-trips', (text) => {
        expect(unescape(escape(text))).toBe(text);
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
