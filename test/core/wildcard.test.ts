import { describe, expect, it } from 'vitest';
import { isMatch } from '../../src/core';

describe('isMatch', () => {
    it.each([
        // =========================
        // Empty / Null-Like Cases
        // =========================
        ['', '', false, true],
        ['', '*', false, true],
        ['', '**', false, true],
        ['', '?', false, false],
        ['', '?*', false, false],
        ['a', '', false, false],

        // =========================
        // Single Character Cases
        // =========================
        ['a', 'a', false, true],
        ['a', 'b', false, false],
        ['a', '?', false, true],
        ['a', '*', false, true],
        ['a', '**', false, true],
        ['a', '??', false, false],
        ['a', '*?', false, true],
        ['a', '?*', false, true],

        // =========================
        // Only Literal Matching
        // =========================
        ['abc', 'abc', false, true],
        ['abc', 'abcd', false, false],
        ['abcd', 'abc', false, false],
        ['abc', 'abx', false, false],

        // =========================
        // Only '*' Patterns
        // =========================
        ['abc', '*', false, true],
        ['abc', '**', false, true],
        ['abc', '***', false, true],

        // =========================
        // '?' Wildcards
        // =========================
        ['abc', '???', false, true],
        ['abc', '??', false, false],
        ['abc', 'a?c', false, true],
        ['abc', '?b?', false, true],
        ['abc', '?a?', false, false],

        // =========================
        // Mixed '?' and '*'
        // =========================
        ['abc', '*?', false, true],
        ['abc', '?*', false, true],
        ['abc', '*?*', false, true],
        ['abc', '*a*', false, true],
        ['abc', '*b*', false, true],
        ['abc', '*d*', false, false],
        ['abc', 'a*?', false, true],
        ['abc', 'a*?d', false, false],
        ['abc', '*a', false, false],
        ['abc', 'c*', false, false],

        // =========================
        // Consecutive '*' (Normalization)
        // =========================
        ['abc', 'a**c', false, true],
        ['abc', 'a***c', false, true],
        ['abc', '***a**b**c***', false, true],
        ['abc', '***a**b**d***', false, false],

        // =========================
        // Leading and Trailing '*'
        // =========================
        ['abcdef', '*def', false, true],
        ['abcdef', 'abc*', false, true],
        ['abcdef', '*cd*', false, true],
        ['abcdef', '*ce*', false, false],

        // =========================
        // Minimum Length Boundary (Pruning)
        // =========================
        ['abc', 'abcd*', false, false],
        ['abc', '????', false, false],
        ['abc', '?a?c', false, false],

        // =========================
        // Classic Tricky Cases
        // =========================
        ['adceb', '*a*b', false, true],
        ['acdcb', 'a*c?b', false, false],
        ['aa', 'a', false, false],
        ['aa', '*', false, true],
        ['cb', '?a', false, false],

        // =========================
        // Complex Patterns
        // =========================
        ['mississippi', 'm*iss*?ppi', false, true],
        ['mississippi', 'm*iss*?ppx', false, false],
        ['abefcdgiescdfimde', 'ab*cd?i*de', false, true],

        // =========================
        // Case-Insensitive Matching
        // =========================
        ['ABC', 'abc', true, true],
        ['abc', 'ABC', true, true],
        ['AbC', 'aBc', true, true],
        ['AbC', 'a?c', true, true],
        ['AbC', '*b*', true, true],
        ['HelloWorld', 'he*ld', true, true],
        ['HelloWorld', 'he*lx', true, false],
        ['CaseTest', 'casetest', false, false],
    ])('matches %j against %j (ignore case: %s) as %s', (text, pattern, ignoreCase, expected) => {
        // Act
        const result = isMatch(text, pattern, ignoreCase);

        // Assert
        expect(result).toBe(expected);
    });
});
