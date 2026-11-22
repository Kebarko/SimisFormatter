import { describe, expect, it } from 'vitest';
import { isTextSimisHeader } from '../../src/core';

describe('isTextSimisHeader', () => {
    it.each([
        ['an engine', 'SIMISA@@@@@@@@@@JINX0D0t______\r\n\r\nWagon ( Mass ( 10t ) )'],
        ['a track database', 'SIMISA@@@@@@@@@@JINX0T0t______'],
        ['a text shape', 'SIMISA@@@@@@@@@@JINX0s1t______\n'],
    ])('accepts the header of %s', (_name, text) => {
        // Act
        const actual = isTextSimisHeader(text);

        // Assert
        expect(actual).toBe(true);
    });

    it.each([
        ['a binary file', 'SIMISA@@@@@@@@@@JINX0w0b______'],
        ['a compressed file', 'SIMISA@F\u0010\u0000\u0000\u0000@@@@'],
        ['text without a header', 'Wagon ( Mass ( 10t ) )'],
        ['a header after a blank line', '\r\nSIMISA@@@@@@@@@@JINX0D0t______'],
        ['a header after a byte order mark', '﻿SIMISA@@@@@@@@@@JINX0D0t______'],
        ['a header without the format letter', 'SIMISA@@@@@@@@@@JINX0D0'],
        ['a header with another subheader', 'SIMISA@@@@@@@@@@ABCDEFGt______'],
        ['empty text', ''],
    ])('rejects %s', (_name, text) => {
        // Act
        const actual = isTextSimisHeader(text);

        // Assert
        expect(actual).toBe(false);
    });
});
