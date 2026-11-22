import { SimisParseError } from './errors';
import { unescape } from './escape';
import { isWhiteSpace } from './text';
import { isCommentToken, isValueEnd } from './tokens';

/**
 * The kind of token a {@link SimisReader} is positioned on. Ported from SimisSharp's `SimisTokenType`.
 */
export enum SimisTokenType {
    /**
     * No token: before the first {@link SimisReader.read} or after the end of the text.
     */
    None,

    /**
     * A value that does not name a block, such as `10t` or `"Bench locomotive"`.
     */
    Value,

    /**
     * The name of a block together with its opening parenthesis, such as `Mass (`.
     */
    StartBlock,

    /**
     * The closing parenthesis of a block.
     */
    EndBlock,

    /**
     * A whole comment block, such as `comment ( text )`. Reported only when comments are read.
     */
    Comment,
}

/**
 * The line feed, which counts lines.
 */
const LINE_FEED = 0x0a;

/**
 * The double quote, which starts and ends a quoted value.
 */
const QUOTE = 0x22;

/**
 * The opening parenthesis of a block.
 */
const OPEN_PARENTHESIS = 0x28;

/**
 * The closing parenthesis of a block.
 */
const CLOSE_PARENTHESIS = 0x29;

/**
 * The plus sign, which joins quoted strings.
 */
const PLUS = 0x2b;

/**
 * The backslash, which starts an escape sequence.
 */
const BACKSLASH = 0x5c;

/**
 * Reads SIMIS text one token at a time, without building a tree. Comment blocks are skipped the way Open Rails skips them,
 * unless comments are read. The SIMIS header, such as `SIMISA@@@@@@@@@@JINX0D0t______`, is the first value at depth 0.
 * Ported from SimisSharp's `SimisReader`, working on indices into the string instead of spans.
 */
export class SimisReader {
    /**
     * The text being read.
     */
    private readonly text: string;

    /**
     * True when comment blocks are reported as tokens instead of being skipped.
     */
    private readonly readComments: boolean;

    /**
     * The index of the next character to read.
     */
    private position = 0;

    /**
     * The 1-based line of the character at {@link position}.
     */
    private positionLine = 1;

    /**
     * The open blocks, three entries each: start and length of the name as written, and the line of the opening parenthesis.
     */
    private readonly openBlocks: number[] = [];

    /**
     * The number of open blocks recorded in {@link openBlocks}.
     */
    private openBlockCount = 0;

    /**
     * The start of the current value or name in {@link text}, at the opening quote when it is quoted.
     */
    private tokenStart = 0;

    /**
     * The length of the current value or name as written, including its quotes.
     */
    private tokenLength = 0;

    /**
     * The start of the content of the current comment block in {@link text}.
     */
    private commentStart = 0;

    /**
     * The length of the content of the current comment block.
     */
    private commentLength = 0;

    /**
     * Backing field of {@link tokenType}.
     */
    private currentTokenType = SimisTokenType.None;

    /**
     * Backing field of {@link depth}.
     */
    private currentDepth = 0;

    /**
     * Backing field of {@link line}.
     */
    private currentLine = 0;

    /**
     * Backing field of {@link isQuoted}.
     */
    private currentIsQuoted = false;

    /**
     * Backing field of {@link lineBreaksBefore}.
     */
    private currentLineBreaksBefore = 0;

    /**
     * Creates a reader positioned before the first token of `text`.
     * @param text SIMIS text without the byte order mark.
     * @param readComments When true, comment blocks are reported as {@link SimisTokenType.Comment} tokens instead of being skipped.
     */
    constructor(text: string, readComments = false) {
        this.text = text;
        this.readComments = readComments;
    }

    /**
     * The kind of the current token.
     */
    get tokenType(): SimisTokenType {
        return this.currentTokenType;
    }

    /**
     * The number of blocks around the current token. A block's {@link SimisTokenType.StartBlock} and {@link SimisTokenType.EndBlock}
     * tokens have the depth of the block's name, and the tokens inside it are one level deeper.
     */
    get depth(): number {
        return this.currentDepth;
    }

    /**
     * The 1-based line where the current token starts.
     */
    get line(): number {
        return this.currentLine;
    }

    /**
     * True when the current value or block name is written in double quotes.
     */
    get isQuoted(): boolean {
        return this.currentIsQuoted;
    }

    /**
     * The number of line breaks between the previous token and the current one. Used by the parser.
     */
    get lineBreaksBefore(): number {
        return this.currentLineBreaksBefore;
    }

    /**
     * The text of the current value, or the name of the current block or comment block, as written.
     * A quoted value is returned without its quotes, but its escape sequences are not decoded (see {@link getString}).
     * Empty for {@link SimisTokenType.EndBlock}.
     */
    get valueText(): string {
        return this.currentIsQuoted
            ? this.text.slice(this.tokenStart + 1, this.tokenStart + this.tokenLength - 1)
            : this.text.slice(this.tokenStart, this.tokenStart + this.tokenLength);
    }

    /**
     * The content of the current comment block between its parentheses, exactly as written. Empty for other tokens.
     */
    get commentText(): string {
        return this.text.slice(this.commentStart, this.commentStart + this.commentLength);
    }

    /**
     * The text of the current value with escape sequences decoded, so that it equals {@link SimisNode.value}.
     * @returns The decoded value, the block or comment block name, or an empty string for other tokens.
     */
    getString(): string {
        return this.currentIsQuoted ? unescape(this.valueText) : this.valueText;
    }

    /**
     * Moves to the next token.
     * @returns True when a token was read, false at the end of the text.
     * @throws {SimisParseError} When the text is not well-formed: an unterminated quoted string or comment block,
     * unbalanced parentheses, or a block without a name. {@link SimisParseError.line} tells where.
     */
    read(): boolean {
        for (;;) {
            const lineBreaks = this.skipWhiteSpace();

            this.currentTokenType = SimisTokenType.None;
            this.currentIsQuoted = false;
            this.tokenStart = this.tokenLength = this.commentStart = this.commentLength = 0;
            this.currentLineBreaksBefore = lineBreaks;
            this.currentLine = this.positionLine;

            if (this.position >= this.text.length) {
                if (this.openBlockCount > 0) {
                    throw this.notClosed();
                }

                this.currentDepth = 0;
                return false;
            }

            const c = this.text.charCodeAt(this.position);
            if (c === CLOSE_PARENTHESIS) {
                if (this.openBlockCount === 0) {
                    throw new SimisParseError("Unexpected ')' without an open block.", this.positionLine);
                }

                this.position++;
                this.openBlockCount--;
                this.currentTokenType = SimisTokenType.EndBlock;
                this.currentDepth = this.openBlockCount;
                return true;
            }

            if (c === OPEN_PARENTHESIS) {
                throw new SimisParseError("Expected a block name before '('.", this.positionLine);
            }

            this.readValueText();

            const next = this.skipWhiteSpaceFrom(this.position);
            if (next >= this.text.length || this.text.charCodeAt(next) !== OPEN_PARENTHESIS) {
                this.currentTokenType = SimisTokenType.Value;
                this.currentDepth = this.openBlockCount;
                return true;
            }

            this.positionLine += this.countLineFeeds(this.position, next);
            this.position = next + 1;

            if (!this.currentIsQuoted && isCommentToken(this.valueText)) {
                const end = this.findCommentBlockEnd(this.position);
                this.commentStart = this.position;
                this.commentLength = end - this.position;
                this.positionLine += this.countLineFeeds(this.commentStart, end);
                this.position = end + 1;

                if (!this.readComments) {
                    continue;
                }

                this.currentTokenType = SimisTokenType.Comment;
                this.currentDepth = this.openBlockCount;
                return true;
            }

            this.pushOpenBlock();
            this.currentTokenType = SimisTokenType.StartBlock;
            this.currentDepth = this.openBlockCount - 1;
            return true;
        }
    }

    /**
     * Skips the content of the current block, so that the reader is positioned on its {@link SimisTokenType.EndBlock}.
     * Does nothing unless the current token is a {@link SimisTokenType.StartBlock}.
     * @throws {SimisParseError} When the skipped text is not well-formed (see {@link read}).
     */
    skip(): void {
        if (this.currentTokenType !== SimisTokenType.StartBlock) {
            return;
        }

        const depth = this.currentDepth;
        while (this.read() && !this.isEndBlockAt(depth)) {
            // Keep reading until the block ends.
        }
    }

    /**
     * Returns true when the current token is the closing parenthesis of a block at `depth`.
     * @param depth The depth of the block.
     * @returns True when the block ends here.
     */
    private isEndBlockAt(depth: number): boolean {
        return this.currentTokenType === SimisTokenType.EndBlock && this.currentDepth === depth;
    }

    /**
     * Skips whitespace from the current position and returns the number of line breaks skipped.
     * @returns The number of line breaks skipped.
     */
    private skipWhiteSpace(): number {
        const text = this.text;
        let position = this.position;
        let lineBreaks = 0;
        while (position < text.length) {
            const c = text.charCodeAt(position);
            if (c === LINE_FEED) {
                lineBreaks++;
            } else if (!isWhiteSpace(c)) {
                break;
            }

            position++;
        }

        this.position = position;
        this.positionLine += lineBreaks;
        return lineBreaks;
    }

    /**
     * Returns the index of the first character at or after `index` that is not whitespace.
     * @param index The index to start at.
     * @returns The index, or the length of the text when only whitespace follows.
     */
    private skipWhiteSpaceFrom(index: number): number {
        const text = this.text;
        while (index < text.length && isWhiteSpace(text.charCodeAt(index))) {
            index++;
        }

        return index;
    }

    /**
     * Returns the number of line feeds between `start` and `end`.
     * @param start The index of the first character to check.
     * @param end The index after the last character to check.
     * @returns The number of line feeds.
     */
    private countLineFeeds(start: number, end: number): number {
        let count = 0;
        for (let i = start; i < end; i++) {
            if (this.text.charCodeAt(i) === LINE_FEED) {
                count++;
            }
        }

        return count;
    }

    /**
     * Reads the value that starts at the current position and moves past it.
     * A quoted value ends at the next double quote that is not escaped with a backslash.
     * An unquoted value ends before whitespace, a parenthesis or a double quote, but a double quote escaped with a backslash is part of it.
     * @throws {SimisParseError} When a quoted value is not terminated.
     */
    private readValueText(): void {
        const start = this.position;

        if (this.text.charCodeAt(start) === QUOTE) {
            const end = this.findClosingQuote(start + 1);
            this.positionLine += this.countLineFeeds(start, end);
            this.position = end + 1;
            this.currentIsQuoted = true;
        } else {
            this.position = this.findValueEnd(start);
        }

        this.tokenStart = start;
        this.tokenLength = this.position - start;
    }

    /**
     * Returns the index of the double quote that ends a quoted value whose content starts at `index`.
     * @param index The index of the first character after the opening quote.
     * @returns The index of the closing quote.
     * @throws {SimisParseError} When there is no such double quote.
     */
    private findClosingQuote(index: number): number {
        const text = this.text;
        while (index < text.length) {
            let found = index;
            while (found < text.length && text.charCodeAt(found) !== QUOTE && text.charCodeAt(found) !== BACKSLASH) {
                found++;
            }

            if (found >= text.length) {
                break;
            }

            index = found;
            if (text.charCodeAt(index) === QUOTE) {
                return index;
            }

            index += 2;
        }

        throw new SimisParseError('Unterminated quoted string.', this.positionLine);
    }

    /**
     * Returns the index after the end of an unquoted value that starts at `start`.
     * @param start The index of the first character of the value.
     * @returns The index of the first character after the value.
     */
    private findValueEnd(start: number): number {
        const text = this.text;
        let index = start;
        for (;;) {
            while (index < text.length && !isValueEnd(text.charCodeAt(index))) {
                index++;
            }

            if (index >= text.length) {
                return text.length;
            }

            if (text.charCodeAt(index) !== QUOTE || !this.isEscaped(start, index)) {
                return index;
            }

            index++;
        }
    }

    /**
     * Returns true when the character at `index` follows an odd number of backslashes, counted back to `start`.
     * @param start The index of the first character of the value.
     * @param index The index of the character to check.
     * @returns True when the character is escaped.
     */
    private isEscaped(start: number, index: number): boolean {
        let backslash = index - 1;
        while (backslash >= start && this.text.charCodeAt(backslash) === BACKSLASH) {
            backslash--;
        }

        return (index - backslash) % 2 === 0;
    }

    /**
     * Records the block whose name is the current token and whose opening parenthesis is on the current line.
     */
    private pushOpenBlock(): void {
        const index = this.openBlockCount * 3;
        this.openBlocks[index] = this.tokenStart;
        this.openBlocks[index + 1] = this.tokenLength;
        this.openBlocks[index + 2] = this.positionLine;
        this.openBlockCount++;
    }

    /**
     * Creates the error for the innermost open block at the end of the text, reported at the line of its opening parenthesis.
     * @returns The error to throw.
     */
    private notClosed(): SimisParseError {
        const index = (this.openBlockCount - 1) * 3;
        const start = this.openBlocks[index];
        const name = this.text.slice(start, start + this.openBlocks[index + 1]);
        const value = name.charCodeAt(0) === QUOTE ? unescape(name.slice(1, -1)) : name;

        return new SimisParseError(`The block '${value}' is not closed.`, this.openBlocks[index + 2]);
    }

    /**
     * Returns the 1-based line of the character at `index`.
     * @param index The index of the character.
     * @returns The 1-based line.
     */
    private getLine(index: number): number {
        return this.countLineFeeds(0, index) + 1;
    }

    /**
     * Finds the closing parenthesis of a comment block whose content starts at `start`.
     * The content is skipped item by item the same way Open Rails skips a comment block, so parentheses inside quoted strings,
     * including strings joined with `+`, and characters escaped with a backslash do not open or close a block.
     * @param start The index of the first character after the opening parenthesis.
     * @returns Index of the closing parenthesis.
     * @throws {SimisParseError} When the block or a quoted string inside it is not terminated.
     */
    private findCommentBlockEnd(start: number): number {
        const text = this.text;
        let depth = 1;
        let i = start;

        for (;;) {
            i = this.skipStfWhiteSpace(i);
            if (i >= text.length) {
                throw new SimisParseError('Unterminated comment block.', this.getLine(start - 1));
            }

            const c = text.charCodeAt(i++);
            switch (c) {
                case OPEN_PARENTHESIS:
                    depth++;
                    break;
                case CLOSE_PARENTHESIS:
                    if (--depth === 0) {
                        return i - 1;
                    }
                    break;
                case QUOTE:
                    i = this.skipQuotedItem(i);
                    break;
                default:
                    i = this.skipPlainItem(i);
                    break;
            }
        }
    }

    /**
     * Skips the rest of a quoted item whose opening quote precedes `index`, including any strings appended with `+`.
     * @param index The index of the first character after the opening quote.
     * @returns Index of the first character after the item.
     * @throws {SimisParseError} When the quoted string is not terminated.
     */
    private skipQuotedItem(index: number): number {
        const text = this.text;
        let quoteStart = index - 1;

        for (;;) {
            if (index >= text.length) {
                throw new SimisParseError('Unterminated quoted string in comment block.', this.getLine(quoteStart));
            }

            const c = text.charCodeAt(index++);
            if (c === BACKSLASH) {
                index++;
            } else if (c === QUOTE) {
                let next = this.skipStfWhiteSpace(index);
                if (next >= text.length || text.charCodeAt(next) !== PLUS) {
                    return index;
                }

                next = this.skipStfWhiteSpace(next + 1);
                if (next >= text.length || text.charCodeAt(next) !== QUOTE) {
                    return next;
                }

                quoteStart = next;
                index = next + 1;
            }
        }
    }

    /**
     * Skips the rest of an unquoted item whose first character precedes `index`.
     * The item ends before a parenthesis, or after whitespace or a double quote. A backslash escapes the next character.
     * @param index The index of the second character of the item.
     * @returns Index of the first character after the item.
     */
    private skipPlainItem(index: number): number {
        const text = this.text;
        while (index < text.length) {
            const c = text.charCodeAt(index);
            if (c === OPEN_PARENTHESIS || c === CLOSE_PARENTHESIS) {
                break;
            }

            index++;
            if (c === QUOTE || isStfWhiteSpace(c)) {
                break;
            }

            if (c === BACKSLASH && index < text.length) {
                index++;
            }
        }

        return index;
    }

    /**
     * Returns the index of the first character at or after `index` that is not whitespace as Open Rails defines it.
     * @param index The index to start at.
     * @returns The index, or the length of the text when only whitespace follows.
     */
    private skipStfWhiteSpace(index: number): number {
        const text = this.text;
        while (index < text.length && isStfWhiteSpace(text.charCodeAt(index))) {
            index++;
        }

        return index;
    }
}

/**
 * Whitespace as defined by the Open Rails STF reader: any control character or space.
 * @param code The UTF-16 code unit of the character.
 * @returns True when the character is whitespace.
 */
function isStfWhiteSpace(code: number): boolean {
    return code <= 0x20;
}
