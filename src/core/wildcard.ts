import { toUpperInvariant } from './text';

/**
 * The asterisk, which matches any sequence of characters.
 */
const ASTERISK = 0x2a;

/**
 * The question mark, which matches any single character.
 */
const QUESTION_MARK = 0x3f;

/**
 * Determines whether the whole of `text` matches `pattern`, which may contain the wildcards `?`, matching any single character,
 * and `*`, matching any sequence of characters, including an empty one. Ported from SimisSharp's `WildcardMatcher.IsMatch`.
 * @param text The text to test.
 * @param pattern The pattern to match the text against.
 * @param ignoreCase Whether to ignore letter case, comparing characters as .NET `char.ToUpperInvariant` converts them.
 * @returns True when the text matches the pattern.
 */
export function isMatch(text: string, pattern: string, ignoreCase: boolean): boolean {
    // Normalize the pattern by collapsing consecutive '*' characters into a single '*'.
    pattern = normalizePattern(pattern);

    // Count the non-asterisk characters of the pattern to rule out impossible matches quickly.
    let requiredChars = 0;
    let hasWildcard = false;
    for (let i = 0; i < pattern.length; i++) {
        const c = pattern.charCodeAt(i);
        if (c !== ASTERISK) {
            requiredChars++;
        }
        if (c === ASTERISK || c === QUESTION_MARK) {
            hasWildcard = true;
        }
    }

    if (text.length < requiredChars) {
        return false;
    }

    // Without wildcards, the table below matches exactly when every character matches. This shortcut gives the same result.
    if (!hasWildcard) {
        if (text.length !== pattern.length) {
            return false;
        }
        for (let i = 0; i < text.length; i++) {
            if (!charsEqual(pattern.charCodeAt(i), text.charCodeAt(i), ignoreCase)) {
                return false;
            }
        }
        return true;
    }

    // table[i * width + j] is 1 when the first i characters of the text match the first j characters of the pattern.
    const width = pattern.length + 1;
    const table = new Uint8Array((text.length + 1) * width);

    // Empty text matches empty pattern.
    table[0] = 1;

    // Handle patterns with leading '*' characters.
    for (let j = 1; j <= pattern.length; j++) {
        if (pattern.charCodeAt(j - 1) === ASTERISK) {
            table[j] = table[j - 1];
        }
    }

    // Fill the table.
    for (let i = 1; i <= text.length; i++) {
        for (let j = 1; j <= pattern.length; j++) {
            const p = pattern.charCodeAt(j - 1);
            if (p === ASTERISK) {
                // '*' can match zero characters (table[i, j - 1]) or one or more characters (table[i - 1, j]).
                table[i * width + j] = table[i * width + j - 1] | table[(i - 1) * width + j];
            } else if (p === QUESTION_MARK || charsEqual(p, text.charCodeAt(i - 1), ignoreCase)) {
                // Match the current character if it is '?' or matches the text character.
                table[i * width + j] = table[(i - 1) * width + j - 1];
            }
        }
    }

    // The result is in the bottom-right cell of the table.
    return table[text.length * width + pattern.length] === 1;
}

/**
 * Collapses consecutive asterisks in `pattern` into a single asterisk.
 * @param pattern The input wildcard pattern.
 * @returns The pattern in which any sequence of consecutive '*' characters is replaced with a single '*'.
 */
function normalizePattern(pattern: string): string {
    return pattern.includes('**') ? pattern.replace(/\*{2,}/g, '*') : pattern;
}

/**
 * Compares two characters, ignoring letter case as .NET `char.ToUpperInvariant` does when `ignoreCase` is true.
 * @param c1 The first character.
 * @param c2 The second character.
 * @param ignoreCase Whether to ignore case.
 * @returns True when the characters are equal.
 */
function charsEqual(c1: number, c2: number, ignoreCase: boolean): boolean {
    return c1 === c2 || (ignoreCase && toUpperInvariant(c1) === toUpperInvariant(c2));
}
