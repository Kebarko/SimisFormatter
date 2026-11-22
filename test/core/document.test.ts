import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core';
import { documentTestCases } from './documentTestData';
import { save } from './helpers';

/**
 * Ported from SimisSharp's `SimisDocumentTest`: each case of `SimisDocumentTestData` is parsed and written again with its options.
 */
describe('SimisDocument', () => {
    it.each(documentTestCases)('parses and saves $name', (testCase) => {
        // Arrange
        const { input, expected, options } = testCase;

        // Act
        const doc = parse(input);
        const actual = save(doc, options);

        // Assert
        expect(actual).toBe(expected);
    });
});
