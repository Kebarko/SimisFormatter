/**
 * The error thrown when SIMIS text is not well-formed, such as an unterminated quoted string or comment block,
 * or unbalanced parentheses. {@link SimisParseError.line} is the line where the problem was found.
 * Ported from SimisSharp's `SimisParseException`.
 */
export class SimisParseError extends Error {
    /**
     * The 1-based line where the problem was found.
     */
    readonly line: number;

    /**
     * Description of the problem, without the line number.
     */
    readonly description: string;

    /**
     * Creates the error. Its message starts with the line, as in `Line 12: Unterminated quoted string.`, as SimisSharp's does.
     * @param description Description of the problem, without the line number.
     * @param line The 1-based line where the problem was found.
     */
    constructor(description: string, line: number) {
        super(`Line ${line}: ${description}`);
        this.name = 'SimisParseError';
        this.description = description;
        this.line = line;
    }
}
