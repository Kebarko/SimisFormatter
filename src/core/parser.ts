import { requiresQuotes, SimisDocument, SimisNode } from './node';
import { SimisReader, SimisTokenType } from './reader';

/**
 * Parses `text` into a document tree in one pass, reading it with a {@link SimisReader}.
 * Keeps node quoting, comment positions and blank lines before and after nodes.
 * The content of a comment block is kept verbatim as a single child node. Ported from SimisSharp's `Parser`.
 * @param text The text to parse, without the byte order mark.
 * @returns The parsed document.
 * @throws {SimisParseError} When the text is not well-formed (see {@link SimisReader.read}).
 */
export function parse(text: string): SimisDocument {
    const document = new SimisDocument();
    let parent = document.root;
    // The node read last. Blank lines before a closing parenthesis are kept as trailing empty lines of its parent.
    let node = document.root;
    const reader = new SimisReader(text, true);

    while (reader.read()) {
        const lineBreaks = reader.lineBreaksBefore;

        switch (reader.tokenType) {
            case SimisTokenType.Value:
                node = addValue(parent, reader, lineBreaks);
                break;

            case SimisTokenType.StartBlock:
                node = addValue(parent, reader, lineBreaks);
                parent = node;
                break;

            case SimisTokenType.Comment: {
                node = addValue(parent, reader, lineBreaks);
                const commentText = reader.commentText;
                if (commentText.length === 0) {
                    node.addParsedNode(new SimisNode());
                } else {
                    // The comment content stays verbatim, even when it looks like quoted strings or blocks.
                    const content = new SimisNode(commentText);
                    content.isVerbatim = true;
                    node.addParsedNode(content);
                    node = content;
                }
                break;
            }

            case SimisTokenType.EndBlock:
                if (parent === node) {
                    node.addParsedNode(new SimisNode());
                }

                if (lineBreaks > 1 && node.parent !== null) {
                    node.parent.trailingEmptyLines = toByte(lineBreaks - 1);
                }

                parent = parent.parent ?? document.root;
                break;
        }
    }

    return document;
}

/**
 * Adds a node for the current value, block name or comment block name of `reader` to `parent`.
 * @param parent The node to add to.
 * @param reader The reader positioned on the value.
 * @param lineBreaks The number of line breaks before the value.
 * @returns The new node.
 */
function addValue(parent: SimisNode, reader: SimisReader, lineBreaks: number): SimisNode {
    const value = reader.getString();
    const node = new SimisNode(value);
    node.isQuoted = reader.isQuoted;
    node.isOnSameLineAsPrevious = !parent.isLeaf && lineBreaks === 0;
    node.leadingEmptyLines = lineBreaks > 1 ? toByte(lineBreaks - 1) : 0;

    // The text as written is kept only where the writer would write the value differently: a quoted value with an escape sequence,
    // or a line feed or tab that the writer would escape, and an unquoted value with a backslash or an escaped double quote.
    if (reader.isQuoted) {
        const written = reader.valueText;
        if (written.includes('\\') || written.includes('\n') || written.includes('\t')) {
            node.originalText = `"${written}"`;
        }
    } else if (requiresQuotes(value)) {
        node.originalText = value;
    }

    parent.addParsedNode(node);
    return node;
}

/**
 * Converts a count to a byte as SimisSharp does with an unchecked `(byte)` cast, which keeps the lowest 8 bits,
 * so that 256 blank lines are recorded as none. Kept for parity with SimisSharp.
 * @param count The count, which is positive.
 * @returns The count modulo 256.
 */
function toByte(count: number): number {
    return count & 0xff;
}
