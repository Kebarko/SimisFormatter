import { describe, expect, it } from 'vitest';
import { equalsIgnoreCase, isWhiteSpace, toUpperInvariant, trimWhiteSpace, tryParseInt32, WHITE_SPACE } from '../../src/core/text';

// The expected values come from .NET 10: char.IsWhiteSpace, char.ToUpperInvariant and
// int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out int value).

describe('isWhiteSpace', () => {
    it('accepts exactly the characters .NET char.IsWhiteSpace accepts', () => {
        // Act
        const whiteSpace: number[] = [];
        for (let code = 0; code <= 0xffff; code++) {
            if (isWhiteSpace(code)) {
                whiteSpace.push(code);
            }
        }

        // Assert
        expect(whiteSpace).toEqual(WHITE_SPACE);
        expect(WHITE_SPACE).toContain(0x0085);
        expect(WHITE_SPACE).not.toContain(0xfeff);
        expect(WHITE_SPACE).not.toContain(0x180e);
    });
});

describe('trimWhiteSpace', () => {
    it.each([
        ['  a b  ', 'a b'],
        ['\u0085a　', 'a'],
        ['﻿a', '﻿a'],
        ['   ', ''],
        ['a', 'a'],
    ])('trims %j to %j', (text, expected) => {
        // Act
        const actual = trimWhiteSpace(text);

        // Assert
        expect(actual).toBe(expected);
    });
});

describe('toUpperInvariant', () => {
    it.each([
        ['a', 'A'],
        ['z', 'Z'],
        ['A', 'A'],
        ['1', '1'],
        ['é', 'É'],
        ['ž', 'Ž'],
        ['ſ', 'S'],
        ['ı', 'ı'],
        ['ß', 'ß'],
        ['ﬀ', 'ﬀ'],
        ['ᾀ', 'ᾈ'],
        ['ꟁ', 'ꟁ'],
        ['\uD83D', '\uD83D'],
    ])('converts %j to %j as .NET does', (character, expected) => {
        // Act
        const actual = toUpperInvariant(character.charCodeAt(0));

        // Assert
        expect(String.fromCharCode(actual)).toBe(expected);
    });
});

describe('equalsIgnoreCase', () => {
    it.each([
        ['COMMENT', 'comment', true],
        ['Skip', 'skip', true],
        ['ſkip', 'skip', true],
        ['ıd', 'id', false],
        ['skip', 'skips', false],
        ['', '', true],
    ])('compares %j and %j as %s', (a, b, expected) => {
        // Act
        const actual = equalsIgnoreCase(a, b);

        // Assert
        expect(actual).toBe(expected);
    });
});

describe('tryParseInt32', () => {
    it.each([
        ['12', 12],
        [' 12 ', 12],
        ['\t12\r\n', 12],
        ['+5', 5],
        ['-7', -7],
        ['-0', 0],
        ['0002', 2],
        ['2147483647', 2147483647],
        ['-2147483648', -2147483648],
        ['12\0\0', 12],
    ])('reads %j as %d', (text, expected) => {
        // Act
        const actual = tryParseInt32(text);

        // Assert
        expect(actual).toBe(expected);
    });

    it.each([
        '',
        ' ',
        '+',
        '-',
        '12abc',
        '1 2',
        '1.0',
        '1e3',
        '0x10',
        '2147483648',
        '-2147483649',
        '99999999999',
        ' 12',
        '１２',
        '−12',
        '12\0 ',
    ])('rejects %j', (text) => {
        // Act
        const actual = tryParseInt32(text);

        // Assert
        expect(actual).toBeUndefined();
    });
});
