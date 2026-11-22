import { escape } from './escape';
import { isCommentToken, requiresQuotesFor } from './tokens';

/**
 * The child nodes of a node without children, shared so that leaves need no list.
 */
const NO_NODES: readonly SimisNode[] = Object.freeze([]);

/**
 * A node in the SIMIS document tree: a value, such as `10t`, or a block, whose name is its {@link value}
 * and whose content is its child nodes, such as `Mass ( 10t )`. The root of a tree, such as {@link SimisDocument.root}, has no value.
 * Ported from SimisSharp's `SimisNode`, with the formatting state the writer needs and without the editing API.
 */
export class SimisNode {
    /**
     * The value of the node: a value, a block name, or the verbatim content of a comment block.
     * Null for the root of a tree and for the placeholder of an empty block (see {@link isDummyLeaf}).
     * The escape sequences of a quoted value are decoded (see {@link unescape}), so `"C:\\Routes"` has the value `C:\Routes`.
     * An unquoted value is kept as written. The writer quotes and escapes a value when it needs to.
     */
    readonly value: string | null;

    /**
     * The value as it was written in the parsed text, including quotes.
     * The parser keeps it only where the writer would write the value differently: a quoted value with an escape sequence, a line feed or a tab,
     * and an unquoted value with a backslash or an escaped double quote. Otherwise it is null.
     * The writer reuses it so that values are written exactly as they were read.
     */
    originalText: string | null = null;

    /**
     * The parent node. Null for the root of a tree.
     */
    parent: SimisNode | null = null;

    /**
     * True when the node was parsed on the same line as the node before it. The parser never sets it on the first child of a block,
     * even when it is on the line of the block name. The writer uses it to keep a comment block on the line of the node before it
     * (see {@link WriterOptions.preserveCommentPosition}).
     */
    isOnSameLineAsPrevious = false;

    /**
     * Number of blank lines written before the node (see {@link WriterOptions.preserveEmptyLines}).
     * The parser sets it to the number of blank lines before the value or block name. Like SimisSharp's `byte`, it is between 0 and 255.
     */
    leadingEmptyLines = 0;

    /**
     * Number of blank lines written after the node, after its closing parenthesis when it is a block (see {@link WriterOptions.preserveEmptyLines}).
     * The parser stores the blank lines found before a closing parenthesis on the block that contains the last value or block name read before it,
     * which may be a block nested in the block being closed. Like SimisSharp's `byte`, it is between 0 and 255.
     */
    trailingEmptyLines = 0;

    /**
     * True when the value was quoted in the parsed text. The writer keeps the quotes when {@link WriterOptions.preserveQuotes} is true,
     * and quotes a value that needs quotes either way (see {@link requiresQuotes}). A quoted block name never makes a comment block (see {@link isComment}).
     */
    isQuoted = false;

    /**
     * True when the value is written exactly as it is, without quotes and without a separating space.
     * The parser sets it on the content of a comment block.
     */
    isVerbatim = false;

    /**
     * The child nodes. The list is created with the first child, so that values, which are most nodes of a tree, have none.
     */
    private subnodes: SimisNode[] | null = null;

    /**
     * Creates a node.
     * @param value The value of the node, or null for the root of a tree or the placeholder of an empty block.
     */
    constructor(value: string | null = null) {
        this.value = value;
    }

    /**
     * True when the node has no child nodes. An empty block, such as `Lights ( )`, is not a leaf: it has a placeholder child (see {@link isDummyLeaf}).
     */
    get isLeaf(): boolean {
        return this.subnodes === null || this.subnodes.length === 0;
    }

    /**
     * True when the node is a leaf and has no value. It is the placeholder child of an empty block, such as `Lights ( )`,
     * which keeps the block written with its parentheses.
     */
    get isDummyLeaf(): boolean {
        return this.isLeaf && this.value === null;
    }

    /**
     * True when the node is a comment block, which MSTS and Open Rails ignore.
     * A comment block is named `comment` or `skip` in any letter case, or has a name that begins with `#` or `_`.
     * The name must not be quoted and the node must have child nodes, so a leaf such as `skip` is an ordinary value.
     * A parsed comment block keeps its content in a single child node marked {@link isVerbatim}.
     */
    get isComment(): boolean {
        return !this.isLeaf && this.value !== null && !this.isQuoted && isCommentToken(this.value);
    }

    /**
     * The child nodes in document order. The list must not be changed.
     */
    get nodes(): readonly SimisNode[] {
        return this.subnodes ?? NO_NODES;
    }

    /**
     * Returns a new list of the child nodes, filtered by `predicate` when it is given.
     * @param predicate The condition a child node must meet.
     * @returns The matching child nodes in document order.
     */
    getNodes(predicate?: (node: SimisNode) => boolean): SimisNode[] {
        if (this.subnodes === null) {
            return [];
        }

        return predicate === undefined ? [...this.subnodes] : this.subnodes.filter(predicate);
    }

    /**
     * Adds a node after the existing child nodes and sets its parent, without checks.
     * The parser adds new nodes that have a value, and the placeholder of an empty block.
     * @param subnode The new node to add.
     */
    addParsedNode(subnode: SimisNode): void {
        subnode.parent = this;
        (this.subnodes ??= []).push(subnode);
    }
}

/**
 * Root container for a SIMIS document. Ported from SimisSharp's `SimisDocument`.
 */
export class SimisDocument {
    /**
     * Root node of the document. It has no value and contains the top-level nodes as children.
     * In a parsed file the first child is usually the SIMIS header, such as `SIMISA@@@@@@@@@@JINX0D0t______`.
     */
    readonly root = new SimisNode();
}

/**
 * Returns true when `value` must be quoted to be read back as the same single value by SimisSharp and Open Rails:
 * it is empty, or it contains whitespace, a parenthesis, a double quote or a backslash.
 * Ported from SimisSharp's `SimisNode.SimisNodeFormatting.RequiresQuotes`.
 * @param value The node value.
 * @returns True when the value must be quoted.
 */
export function requiresQuotes(value: string): boolean {
    if (value.length === 0) {
        return true;
    }

    for (let i = 0; i < value.length; i++) {
        if (requiresQuotesFor(value.charCodeAt(i))) {
            return true;
        }
    }

    return false;
}

/**
 * Wraps `value` in quotes, escaping it (see {@link escape}). Ported from SimisSharp's `SimisNode.SimisNodeFormatting.Quote`.
 * @param value The value to quote.
 * @returns The quoted and escaped value.
 */
export function quote(value: string): string {
    return `"${escape(value)}"`;
}
