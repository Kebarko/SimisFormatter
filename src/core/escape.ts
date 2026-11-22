/**
 * Escaping of quoted values, ported from SimisSharp's `SimisValue.Unescape` and `SimisValue.Escape`.
 */

/**
 * Decodes the escape sequences of the text between the quotes of a quoted value, as Open Rails does:
 * `\n` is a line feed, `\t` is a tab, and a backslash before any other character stands for that character,
 * so `\\` is a backslash and `\"` is a double quote. A backslash at the end of the text stays.
 * @param text Text between the quotes, as written.
 * @returns The decoded text.
 */
export function unescape(text: string): string {
    const backslash = text.indexOf('\\');
    if (backslash < 0) {
        return text;
    }

    let result = text.slice(0, backslash);
    for (let i = backslash; i < text.length; i++) {
        const c = text[i];
        if (c !== '\\' || i === text.length - 1) {
            result += c;
            continue;
        }

        const next = text[++i];
        result += next === 'n' ? '\n' : next === 't' ? '\t' : next;
    }

    return result;
}

/**
 * Encodes `text` for writing between the quotes of a quoted value, so that {@link unescape} reads it back unchanged:
 * a backslash, a double quote, a line feed and a tab are written as `\\`, `\"`, `\n` and `\t`.
 * @param text The text to encode.
 * @returns The encoded text.
 */
export function escape(text: string): string {
    if (!/[\\"\n\t]/.test(text)) {
        return text;
    }

    let result = '';
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        switch (c) {
            case '\\':
                result += '\\\\';
                break;
            case '"':
                result += '\\"';
                break;
            case '\n':
                result += '\\n';
                break;
            case '\t':
                result += '\\t';
                break;
            default:
                result += c;
                break;
        }
    }

    return result;
}
