/**
 * Configuration of a block whose values are written in rows with a fixed number of columns, each row on its own line
 * (see {@link WriterOptions.table}). Ported from SimisSharp's `WriterOptions.TableConfig`.
 */
export interface TableConfig {
    /**
     * Path pattern of the blocks written as a table (see SimisSharp's `SimisPathService.IsMatchForPath`).
     */
    name: string;

    /**
     * Either a numeric string for the number of columns, or a path relative to the table block whose first match holds the column count,
     * such as `../[2]` (see SimisSharp's `SimisPathService.FindNodesByPath`).
     * The count is limited to the number of values, and a block whose count is 0 or less, or cannot be found, is written normally.
     */
    columns: string;

    /**
     * Separator inserted between columns. Default is a single space.
     */
    columnSeparator: string;

    /**
     * Number of values written normally before the table starts, such as a leading row count. Default is 0 (no offset).
     */
    offset: number;

    /**
     * When true, values are padded on the left to the width of the widest value in their column, so that numbers line up on the right.
     * Default is false.
     */
    fixedWidth: boolean;
}

/**
 * Options that control how a SIMIS document is written to text: indentation, comment and quote preservation, inline and table formatting.
 * Ported from SimisSharp's `WriterOptions`.
 */
export interface WriterOptions {
    /**
     * Number of characters per indent level. Default is 1.
     */
    indentSize: number;

    /**
     * Character used for indenting, a tab (`'\t'`) or a space (`' '`). Default is a tab.
     */
    indentCharacter: string;

    /**
     * When true, the writer keeps quotes on values that were quoted in the text.
     * When false, quotes are dropped except where a value needs them, or where dropping them would change the meaning:
     * strings joined with `+`, a quoted `+`, and a quoted block name that would make the block a comment block.
     * Default is true.
     */
    preserveQuotes: boolean;

    /**
     * When true, the writer keeps comment blocks. When false, they are left out. Default is true.
     */
    preserveComments: boolean;

    /**
     * When true, a comment block that was parsed on the same line as the node before it stays on that line.
     * When false, it starts a new line like any other block. Default is true.
     */
    preserveCommentPosition: boolean;

    /**
     * When true, writes the blank lines recorded before and after nodes. When false, no blank lines are written. Default is true.
     */
    preserveEmptyLines: boolean;

    /**
     * When true, collapses several preserved blank lines in a row into one. Applies only when {@link WriterOptions.preserveEmptyLines} is true.
     * Default is true.
     */
    collapseEmptyLines: boolean;

    /**
     * When true, the writer ignores letter case when matching paths for inline and table formatting. Default is true.
     */
    ignoreCase: boolean;

    /**
     * Path patterns of blocks that are written inline: a matching block and everything in it are written on one line
     * (see SimisSharp's `SimisPathService.IsMatchForPath`). Default is an empty list.
     */
    inline: string[];

    /**
     * Configuration of blocks whose values are written in rows, each row on its own line.
     * When several configurations match a block, the first one in the list is used. Default is an empty list.
     */
    table: TableConfig[];
}

/**
 * Creates writer options with the defaults of SimisSharp's `WriterOptions`, replacing those given in `options`.
 * @param options The options that differ from the defaults.
 * @returns The complete options.
 */
export function createWriterOptions(options: Partial<WriterOptions> = {}): WriterOptions {
    return {
        indentSize: 1,
        indentCharacter: '\t',
        preserveQuotes: true,
        preserveComments: true,
        preserveCommentPosition: true,
        preserveEmptyLines: true,
        collapseEmptyLines: true,
        ignoreCase: true,
        inline: [],
        table: [],
        ...options,
    };
}

/**
 * Creates a table configuration with the defaults of SimisSharp's `WriterOptions.TableConfig`, replacing those given in `config`.
 * @param config The path of the blocks, their column count, and the properties that differ from the defaults.
 * @returns The complete table configuration.
 */
export function createTableConfig(config: Pick<TableConfig, 'name' | 'columns'> & Partial<TableConfig>): TableConfig {
    return {
        columnSeparator: ' ',
        offset: 0,
        fixedWidth: false,
        ...config,
    };
}
