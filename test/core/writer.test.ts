import { describe, expect, it } from 'vitest';
import { createTableConfig, createWriterOptions, parse, type SimisNode } from '../../src/core';
import { lines, save } from './helpers';

/**
 * Describes the values, comment flags and structure of a tree, ignoring quotes and formatting.
 * A node without a value, such as the placeholder of an empty block, is described with an empty value, as C# string interpolation writes null.
 * @param node The node whose child nodes are described.
 * @returns The description of the child nodes and their descendants.
 */
function describeTree(node: SimisNode): string {
    return node.nodes.map((n) => (n.isLeaf ? `[${n.value ?? ''}]` : `[${n.value ?? ''}${n.isComment ? '#' : ''}](${describeTree(n)})`)).join(' ');
}

describe('write', () => {
    it.each(['-2', '0', 'abc', '99999999999'])('a table without a valid column count is written plain (count %j)', (count) => {
        // Arrange
        const input = `Curve ( ${count} Table ( 1 2 3 4 ) )`;
        const options = createWriterOptions({ table: [createTableConfig({ name: 'Table', columns: '../[1]', fixedWidth: true })] });

        // Act
        const actual = save(parse(input), options);

        // Assert
        expect(actual).toBe(lines(`Curve ( ${count}`, '\tTable ( 1 2 3 4 )', ')'));
    });

    it.each(['-3', '0'])('a table with an invalid configured column count is written plain (columns %j)', (columns) => {
        // Arrange
        const options = createWriterOptions({ table: [createTableConfig({ name: 'Table', columns, fixedWidth: true })] });

        // Act
        const actual = save(parse('Table ( 1 2 3 4 )'), options);

        // Assert
        expect(actual).toBe(lines('Table ( 1 2 3 4 )'));
    });

    it('the table column count is limited to the number of values', () => {
        // Arrange
        const input = 'Curve ( 100000000 Table ( 1 22 333 ) )';
        const options = createWriterOptions({ table: [createTableConfig({ name: 'Table', columns: '../[1]', fixedWidth: true })] });

        // Act
        const actual = save(parse(input), options);

        // Assert
        expect(actual).toBe(lines('Curve ( 100000000', '\tTable (', '\t\t1 22 333', '\t)', ')'));
    });

    it.each([
        ['Briefing ( "One" + "Two" )', 'Briefing ( "One" + "Two" )'],
        ['Briefing ( "One" + "Two" + "Three" "Alone" )', 'Briefing ( "One" + "Two" + "Three" Alone )'],
        ['A ( "a b" "+" "c d" )', 'A ( "a b" "+" "c d" )'],
        ['A ( "x" "+" )', 'A ( x "+" )'],
        ['Wagon ( "_Mass" ( 10t ) )', 'Wagon (\r\n\t"_Mass" ( 10t )\r\n)'],
        ['Wagon ( "#Mass" ( 10t ) )', 'Wagon (\r\n\t"#Mass" ( 10t )\r\n)'],
        ['Wagon ( "comment" ( x ) )', 'Wagon (\r\n\t"comment" ( x )\r\n)'],
        ['Wagon ( "Mass" ( "_x" ) )', 'Wagon (\r\n\tMass ( _x )\r\n)'],
    ])('dropping quotes keeps the meaning of %j', (input, expected) => {
        // Act
        const document = parse(input);
        const actual = save(document, { preserveQuotes: false });
        const reparsed = parse(actual);

        // Assert
        expect(actual).toBe(expected + '\r\n');
        expect(describeTree(reparsed.root)).toBe(describeTree(document.root));
    });

    it('dropping quotes keeps concatenation at the root and in tables', () => {
        // Arrange
        const options = createWriterOptions({
            preserveQuotes: false,
            table: [createTableConfig({ name: 'Briefing', columns: '2', columnSeparator: '' })],
        });

        // Act
        const root = save(parse('"One" + "Two"'), options);
        const table = save(parse('Briefing ( "One\\n" + "Two" )'), options);

        // Assert
        expect(root).toBe(lines('"One"', '+', '"Two"'));
        expect(table).toBe(lines('Briefing (', '\t"One\\n"+', '\t"Two"', ')'));
    });
});
