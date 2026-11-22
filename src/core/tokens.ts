import { equalsIgnoreCase, isWhiteSpace } from './text';

/**
 * Holds the token configuration used by the reader, parser and writer. Ported from SimisSharp's `TokenConfiguration`.
 */

/**
 * Keywords that start a comment block. They are compared case-insensitively.
 */
const COMMENT_KEYWORDS: readonly string[] = ['comment', 'skip'];

/**
 * Determines whether a character ends an unquoted value: every character .NET `char.IsWhiteSpace` accepts (see {@link isWhiteSpace}),
 * both parentheses and the double quote.
 * @param code The UTF-16 code unit of the character.
 * @returns True when the character ends an unquoted value.
 */
export function isValueEnd(code: number): boolean {
    return code === 0x28 || code === 0x29 || code === 0x22 || isWhiteSpace(code);
}

/**
 * Determines whether a value must be quoted for a character: those that end an unquoted value (see {@link isValueEnd}),
 * and the backslash, which starts an escape sequence.
 * @param code The UTF-16 code unit of the character.
 * @returns True when a value with the character must be quoted.
 */
export function requiresQuotesFor(code: number): boolean {
    return code === 0x5c || isValueEnd(code);
}

/**
 * Determines whether `token` starts a comment block when a block follows it.
 * MSTS and Open Rails ignore the block after the keywords `comment` and `skip` in any letter case,
 * and after any token that begins with `#` or `_`, such as `_skip`, `_info` or `#ORTSMaxPower`.
 * @param token Token text without quotes. A quoted token never starts a comment, so callers check that the token is not quoted.
 * @returns True when the token starts a comment block if it is followed by a block.
 */
export function isCommentToken(token: string): boolean {
    if (token.length === 0) {
        return false;
    }

    const first = token.charCodeAt(0);
    if (first === 0x23 || first === 0x5f) {
        return true;
    }

    for (const keyword of COMMENT_KEYWORDS) {
        if (equalsIgnoreCase(token, keyword)) {
            return true;
        }
    }

    return false;
}
