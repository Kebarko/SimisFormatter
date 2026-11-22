/**
 * Text helpers that behave as the .NET methods SimisSharp uses, which JavaScript has no exact equivalent for:
 * `char.IsWhiteSpace`, `string.Trim`, `char.ToUpperInvariant`, `StringComparison.OrdinalIgnoreCase` and `int.TryParse`.
 * Every case-insensitive comparison of the core goes through {@link equalsIgnoreCase} or {@link toUpperInvariant}.
 */

/**
 * The characters .NET 10 `char.IsWhiteSpace` accepts, which are not those of the JavaScript `\s`:
 * .NET includes U+0085 and excludes U+FEFF, JavaScript does the opposite.
 */
export const WHITE_SPACE: readonly number[] = [
    0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x0085, 0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005,
    0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000,
];

/**
 * Determines whether a character is whitespace, as .NET `char.IsWhiteSpace` does (see {@link WHITE_SPACE}).
 * @param code The UTF-16 code unit of the character.
 * @returns True when the character is whitespace.
 */
export function isWhiteSpace(code: number): boolean {
    if (code <= 0x20) {
        return code === 0x20 || (code >= 0x09 && code <= 0x0d);
    }

    if (code < 0x85) {
        return false;
    }

    return (
        code === 0x85 ||
        code === 0xa0 ||
        code === 0x1680 ||
        (code >= 0x2000 && code <= 0x200a) ||
        code === 0x2028 ||
        code === 0x2029 ||
        code === 0x202f ||
        code === 0x205f ||
        code === 0x3000
    );
}

/**
 * Removes whitespace from both ends of `text`, as .NET `string.Trim()` does (see {@link isWhiteSpace}).
 * @param text The text to trim.
 * @returns The text without leading and trailing whitespace.
 */
export function trimWhiteSpace(text: string): string {
    let start = 0;
    let end = text.length;
    while (start < end && isWhiteSpace(text.charCodeAt(start))) {
        start++;
    }
    while (end > start && isWhiteSpace(text.charCodeAt(end - 1))) {
        end--;
    }
    return start === 0 && end === text.length ? text : text.slice(start, end);
}

/**
 * Determines whether `text` is empty or holds only whitespace, as .NET `string.IsNullOrWhiteSpace` does.
 * @param text The text to check.
 * @returns True when the text is empty or holds only whitespace.
 */
export function isEmptyOrWhiteSpace(text: string): boolean {
    for (let i = 0; i < text.length; i++) {
        if (!isWhiteSpace(text.charCodeAt(i))) {
            return false;
        }
    }
    return true;
}

/**
 * The upper-case mappings of .NET 10 `char.ToUpperInvariant` that differ from the single-character results of JavaScript's `toUpperCase`:
 * the dotless i, which .NET keeps, Greek letters with a subscript iota, whose full upper case in JavaScript has two characters,
 * and letters added in later versions of Unicode than .NET 10 uses. Found by comparing every UTF-16 code unit.
 */
const UPPER_CASE_EXCEPTIONS: ReadonlyMap<number, number> = new Map([
    [0x0131, 0x0131], [0x019b, 0x019b], [0x0264, 0x0264], [0x1c8a, 0x1c8a],
    [0x1f80, 0x1f88], [0x1f81, 0x1f89], [0x1f82, 0x1f8a], [0x1f83, 0x1f8b], [0x1f84, 0x1f8c], [0x1f85, 0x1f8d], [0x1f86, 0x1f8e], [0x1f87, 0x1f8f],
    [0x1f90, 0x1f98], [0x1f91, 0x1f99], [0x1f92, 0x1f9a], [0x1f93, 0x1f9b], [0x1f94, 0x1f9c], [0x1f95, 0x1f9d], [0x1f96, 0x1f9e], [0x1f97, 0x1f9f],
    [0x1fa0, 0x1fa8], [0x1fa1, 0x1fa9], [0x1fa2, 0x1faa], [0x1fa3, 0x1fab], [0x1fa4, 0x1fac], [0x1fa5, 0x1fad], [0x1fa6, 0x1fae], [0x1fa7, 0x1faf],
    [0x1fb3, 0x1fbc], [0x1fc3, 0x1fcc], [0x1ff3, 0x1ffc], [0x2c5f, 0x2c5f],
    [0xa7c1, 0xa7c1], [0xa7c8, 0xa7c8], [0xa7ca, 0xa7ca], [0xa7cd, 0xa7cd], [0xa7cf, 0xa7cf], [0xa7d1, 0xa7d1], [0xa7d3, 0xa7d3], [0xa7d5, 0xa7d5],
    [0xa7d7, 0xa7d7], [0xa7d9, 0xa7d9], [0xa7db, 0xa7db], [0xa7f6, 0xa7f6],
]);

/**
 * The upper case of every UTF-16 code unit, created when the first character outside ASCII is converted.
 */
let upperCaseTable: Uint16Array | undefined;

/**
 * Returns the upper case of a character, as .NET `char.ToUpperInvariant` does: one character for one character.
 * @param code The UTF-16 code unit of the character.
 * @returns The UTF-16 code unit of its upper case, or `code` when it has none.
 */
export function toUpperInvariant(code: number): number {
    if (code < 0x80) {
        return code >= 0x61 && code <= 0x7a ? code - 0x20 : code;
    }

    upperCaseTable ??= createUpperCaseTable();
    return upperCaseTable[code];
}

/**
 * Creates the table of {@link toUpperInvariant}.
 * @returns The upper case of every UTF-16 code unit.
 */
function createUpperCaseTable(): Uint16Array {
    const table = new Uint16Array(0x10000);
    for (let code = 0; code < table.length; code++) {
        const upper = String.fromCharCode(code).toUpperCase();
        table[code] = UPPER_CASE_EXCEPTIONS.get(code) ?? (upper.length === 1 ? upper.charCodeAt(0) : code);
    }
    return table;
}

/**
 * Compares two strings ignoring letter case, as .NET `StringComparison.OrdinalIgnoreCase` does: character by character,
 * after converting each to upper case (see {@link toUpperInvariant}).
 * @param a The first string.
 * @param b The second string.
 * @returns True when the strings are equal ignoring letter case.
 */
export function equalsIgnoreCase(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        const x = a.charCodeAt(i);
        const y = b.charCodeAt(i);
        if (x !== y && toUpperInvariant(x) !== toUpperInvariant(y)) {
            return false;
        }
    }
    return true;
}

/**
 * Determines whether a character is whitespace that .NET number parsing allows around a number: U+0009 to U+000D and the space.
 * @param code The UTF-16 code unit of the character.
 * @returns True when the character is allowed around a number.
 */
function isNumberWhiteSpace(code: number): boolean {
    return code === 0x20 || (code >= 0x09 && code <= 0x0d);
}

/**
 * Reads a signed 32-bit integer, as .NET `int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out int value)` does:
 * ASCII digits with an optional leading `+` or `-`, optionally surrounded by whitespace (see {@link isNumberWhiteSpace}),
 * and optionally followed by NUL characters, which .NET ignores. Unlike `parseInt`, it rejects text such as `12abc` and values out of range.
 * @param text The text to read.
 * @returns The integer, or undefined when the text is not an integer in range.
 */
export function tryParseInt32(text: string): number | undefined {
    const length = text.length;
    let i = 0;
    while (i < length && isNumberWhiteSpace(text.charCodeAt(i))) {
        i++;
    }

    let negative = false;
    if (i < length && (text.charCodeAt(i) === 0x2b || text.charCodeAt(i) === 0x2d)) {
        negative = text.charCodeAt(i) === 0x2d;
        i++;
    }

    const digitsStart = i;
    let value = 0;
    while (i < length) {
        const digit = text.charCodeAt(i) - 0x30;
        if (digit < 0 || digit > 9) {
            break;
        }
        value = value * 10 + digit;
        if (value > 0x80000000) {
            return undefined;
        }
        i++;
    }

    if (i === digitsStart) {
        return undefined;
    }

    while (i < length && isNumberWhiteSpace(text.charCodeAt(i))) {
        i++;
    }
    while (i < length && text.charCodeAt(i) === 0) {
        i++;
    }
    if (i !== length) {
        return undefined;
    }

    if (negative) {
        return 0 - value;
    }
    return value <= 0x7fffffff ? value : undefined;
}
