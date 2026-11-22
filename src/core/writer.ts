import { quote, requiresQuotes, type SimisDocument, type SimisNode } from './node';
import type { TableConfig, WriterOptions } from './options';
import { findNodesByPath, isMatchForPath } from './path';
import { tryParseInt32 } from './text';
import { isCommentToken } from './tokens';

/**
 * Collects the written text and keeps its length, as the `StringBuilder` of SimisSharp's writer does.
 */
class TextBuilder {
    /**
     * The parts written so far.
     */
    private readonly parts: string[] = [];

    /**
     * The number of characters written so far.
     */
    length = 0;

    /**
     * Appends text.
     * @param text The text to append.
     */
    append(text: string): void {
        if (text.length > 0) {
            this.parts.push(text);
            this.length += text.length;
        }
    }

    /**
     * Returns the text written so far.
     * @returns The text.
     */
    toString(): string {
        return this.parts.join('');
    }
}

/**
 * The state of a write, which SimisSharp passes as separate parameters.
 */
interface WriteContext {
    /**
     * Destination of the text.
     */
    readonly sb: TextBuilder;

    /**
     * Writer options controlling formatting.
     */
    readonly options: WriterOptions;

    /**
     * The line break to write.
     */
    readonly newLine: string;
}

/**
 * Writes `document` to text according to `options`. Ported from SimisSharp's `Writer`.
 * Lines end with `newLine`, where SimisSharp always writes CRLF, and text that is not empty ends with a line break.
 * Text copied from the parsed file, such as a comment block or a quoted string that spans lines, keeps its own line breaks.
 * @param document The document to write.
 * @param options Writer options.
 * @param newLine The line break to write, `'\r\n'` or `'\n'`.
 * @returns The text of the document.
 */
export function write(document: SimisDocument, options: WriterOptions, newLine: string): string {
    const context: WriteContext = { sb: new TextBuilder(), options, newLine };

    writeRootNode(context, document.root);

    const text = context.sb.toString();
    return text.length > 0 && !text.endsWith(newLine) ? text + newLine : text;
}

/**
 * Writes the nodes at the document root level, leaving out placeholders, and comment blocks unless they are preserved.
 * @param context The state of the write.
 * @param node The root node of the document.
 */
function writeRootNode(context: WriteContext, node: SimisNode): void {
    const subnodes = getWrittenNodes(node, context.options);
    for (let i = 0; i < subnodes.length; i++) {
        writeNode(context, subnodes[i], 0, false, keepQuotes(subnodes, i, context.options.preserveQuotes));
    }
}

/**
 * Returns the child nodes that are written: all but placeholders, and comment blocks only when they are preserved.
 * @param node The node whose children are written.
 * @param options Writer options.
 * @returns The child nodes to write, in document order.
 */
function getWrittenNodes(node: SimisNode, options: WriterOptions): SimisNode[] {
    return node.getNodes((n) => !n.isDummyLeaf && (!n.isComment || options.preserveComments));
}

/**
 * Writes a single node and its children recursively.
 * @param context The state of the write.
 * @param node Node to write.
 * @param level Current indent level.
 * @param inline Whether this node should be written inline with its parent.
 * @param preserveQuotes Whether the node value keeps its quotes (see {@link keepQuotes}).
 */
function writeNode(context: WriteContext, node: SimisNode, level: number, inline: boolean, preserveQuotes: boolean): void {
    const { sb, options, newLine } = context;
    const indent = options.indentCharacter.repeat(level * options.indentSize);

    const isCommentOnSameLine = node.isComment && options.preserveCommentPosition && node.isOnSameLineAsPrevious;

    if (sb.length > 0 && level === 0 && !isCommentOnSameLine) {
        sb.append(newLine);
    }

    writeEmptyLines(context, node.leadingEmptyLines);

    if (inline || isCommentOnSameLine) {
        sb.append(' ');
    } else {
        sb.append(indent);
    }

    sb.append(formatValue(node, preserveQuotes));

    if (!inline && options.inline.some((path) => isMatchForPath(node, path, options.ignoreCase))) {
        inline = true;
    }

    if (!node.isLeaf) {
        const subnodes = getWrittenNodes(node, options);

        let closeAtNextLine = false;
        let lastIsVerbatim = false;
        const tableConfig = options.table.find((table) => isMatchForPath(node, table.name, options.ignoreCase));
        let totalColumns = 0;
        let currentColumn = 0;
        let columnWidths: number[] = [];
        if (tableConfig !== undefined) {
            totalColumns = Math.min(Math.max(getColumns(tableConfig, node, options.ignoreCase), 0), subnodes.length);
            if (tableConfig.fixedWidth) {
                columnWidths = getColumnWidths(subnodes, totalColumns, tableConfig.offset, options.preserveQuotes);
            }
        }

        sb.append(' ');
        sb.append('(');
        for (let i = 0; i < subnodes.length; i++) {
            const subnode = subnodes[i];
            const keepSubnodeQuotes = keepQuotes(subnodes, i, options.preserveQuotes);

            if (subnode.isLeaf) {
                lastIsVerbatim = subnode.isVerbatim;
                if (lastIsVerbatim) {
                    sb.append(subnode.value ?? '');
                } else if (tableConfig !== undefined && totalColumns > 0 && i >= tableConfig.offset) {
                    if (currentColumn === 0) {
                        sb.append(newLine);
                        sb.append(indent);
                        sb.append(options.indentCharacter.repeat(options.indentSize));
                    } else {
                        sb.append(tableConfig.columnSeparator);
                    }

                    let value = formatValue(subnode, keepSubnodeQuotes);
                    if (columnWidths.length > currentColumn && value.length < columnWidths[currentColumn]) {
                        value = value.padStart(columnWidths[currentColumn]);
                    }

                    sb.append(value);

                    currentColumn++;
                    if (currentColumn >= totalColumns) {
                        currentColumn = 0;
                    }

                    closeAtNextLine = true;
                } else {
                    sb.append(' ');
                    sb.append(formatValue(subnode, keepSubnodeQuotes));
                }
            } else {
                if (!inline && !(subnode.isComment && options.preserveCommentPosition && subnode.isOnSameLineAsPrevious)) {
                    closeAtNextLine = true;
                    sb.append(newLine);
                }

                writeNode(context, subnode, level + 1, inline, keepSubnodeQuotes);
            }
        }

        if (closeAtNextLine) {
            sb.append(newLine);
            sb.append(indent);
        } else if (!lastIsVerbatim) {
            sb.append(' ');
        }
        sb.append(')');
    }

    writeEmptyLines(context, node.trailingEmptyLines);
}

/**
 * Resolves the configured column count. When {@link TableConfig.columns} is a number, that number is returned;
 * otherwise the value is looked up by path from the node. The count may come from the file, so the caller limits it to the number of values.
 * @param tableConfig The table configuration of the node.
 * @param node The node written as a table.
 * @param ignoreCase Whether to ignore case when following a path.
 * @returns The column count, or 0 when it cannot be found.
 */
function getColumns(tableConfig: TableConfig, node: SimisNode, ignoreCase: boolean): number {
    const columns = tryParseInt32(tableConfig.columns);
    if (columns !== undefined) {
        return columns;
    }

    const sourceNodes = findNodesByPath(node, tableConfig.columns, ignoreCase);
    const sourceValue = sourceNodes.length > 0 ? sourceNodes[0].value : null;
    return (sourceValue === null ? undefined : tryParseInt32(sourceValue)) ?? 0;
}

/**
 * Computes the width of the widest value in each column for fixed-width table output.
 * @param nodes The child nodes to measure.
 * @param totalColumns Number of columns in the table.
 * @param offset Index before which the table columns do not start.
 * @param preserveQuotes Whether quoted values keep their quotes when measured.
 * @returns The width of each column.
 */
function getColumnWidths(nodes: SimisNode[], totalColumns: number, offset: number, preserveQuotes: boolean): number[] {
    const result = new Array<number>(totalColumns).fill(0);

    for (let colIdx = 0; colIdx < totalColumns; colIdx++) {
        for (let nodeIdx = colIdx + offset; nodeIdx < nodes.length; nodeIdx += totalColumns) {
            const value = formatValue(nodes[nodeIdx], keepQuotes(nodes, nodeIdx, preserveQuotes));

            if (value.length > result[colIdx]) {
                result[colIdx] = value.length;
            }
        }
    }

    return result;
}

/**
 * Returns whether the node at `index` keeps its quotes: always when `preserveQuotes` is true,
 * and otherwise when dropping them would change the meaning. A quoted value next to a `+` is part of a concatenated string,
 * a quoted `+` would become the concatenation operator, and a quoted block name that is a comment token would make the block a comment.
 * @param nodes The nodes written at one level, in document order.
 * @param index The index of the node in `nodes`.
 * @param preserveQuotes Whether quotes are preserved (see {@link WriterOptions.preserveQuotes}).
 * @returns True when the node value keeps its quotes.
 */
function keepQuotes(nodes: SimisNode[], index: number, preserveQuotes: boolean): boolean {
    if (preserveQuotes) {
        return true;
    }

    const node = nodes[index];
    if (!node.isQuoted || node.value === null) {
        return false;
    }

    if (node.value === '+') {
        return true;
    }

    if (!node.isLeaf && isCommentToken(node.value)) {
        return true;
    }

    return isConcatenationOperator(nodes, index - 1) || isConcatenationOperator(nodes, index + 1);
}

/**
 * Returns true when the node at `index` is an unquoted `+` value, which joins the quoted strings around it.
 * @param nodes The nodes written at one level, in document order.
 * @param index The index to check, which may be outside `nodes`.
 * @returns True when the node is an unquoted `+` value.
 */
function isConcatenationOperator(nodes: SimisNode[], index: number): boolean {
    if (index < 0 || index >= nodes.length) {
        return false;
    }

    const node = nodes[index];
    return node.isLeaf && node.value === '+' && !node.isQuoted;
}

/**
 * Returns the text of a node value. A value read from text that the writer would write differently keeps the text it was read from,
 * unless its quotes are dropped. Any other value is quoted and escaped when it is quoted or needs quotes.
 * @param node The node whose value is written.
 * @param preserveQuotes Whether a quoted value keeps its quotes (see {@link keepQuotes}).
 * @returns The text to write, or an empty string for a node without a value.
 */
function formatValue(node: SimisNode, preserveQuotes: boolean): string {
    const value = node.value;
    if (value === null) {
        return '';
    }

    const keep = preserveQuotes && node.isQuoted;
    const shouldQuote = keep || requiresQuotes(value);

    const original = node.originalText;
    if (original !== null) {
        const originalIsQuoted = original.length > 0 && original.charCodeAt(0) === 0x22;

        // A quoted token is reused while it stays quoted. An unquoted token reads back as the same value.
        if (originalIsQuoted ? shouldQuote : !keep) {
            return original;
        }
    }

    return shouldQuote ? quote(value) : value;
}

/**
 * Appends the recorded number of blank lines, respecting the options.
 * @param context The state of the write.
 * @param count The number of blank lines recorded for the node.
 */
function writeEmptyLines(context: WriteContext, count: number): void {
    const { sb, options, newLine } = context;
    if (!options.preserveEmptyLines) {
        return;
    }

    for (let i = 0; i < count; i++) {
        if (i > 0 && options.collapseEmptyLines) {
            break;
        }

        sb.append(newLine);
    }
}
