import type { SimisNode } from './node';
import { isEmptyOrWhiteSpace, trimWhiteSpace, tryParseInt32 } from './text';
import { isMatch } from './wildcard';

/**
 * Matching and locating nodes by a path, ported from SimisSharp's `SimisPathService`.
 * Paths separate segments with '/' or '\'. A name segment matches a node value. It may contain the wildcards '*' and '?'
 * (see {@link isMatch}), and it ignores letter case by default, as MSTS and Open Rails do.
 * The topmost ancestor of a node is the root of its paths. In a parsed document this is {@link SimisDocument.root},
 * so the first segment of an absolute path such as `/Wagon/Mass` names a top-level node.
 */

/**
 * The segments of a path and whether it starts at the root.
 */
interface SplitPath {
    /**
     * The non-empty segments of the path.
     */
    readonly segments: readonly string[];

    /**
     * True when the path starts with a separator.
     */
    readonly isAbsolute: boolean;
}

/**
 * The paths split so far. The writer matches the same few paths against every node, so each path is split once.
 */
const splitPaths = new Map<string, SplitPath>();

/**
 * Determines whether `node` matches the given `path` pattern.
 * The last segment must match the node and each preceding segment must match the next ancestor.
 * A relative path matches at any depth, while an absolute path must lead from the root to the node.
 * Only name segments are supported. The segments ".", ".." and indexes such as "[2]" are matched literally.
 * @param node Node to test against the path.
 * @param path Path pattern. May be absolute (starting with '/') or relative.
 * @param ignoreCase Whether to ignore case when matching node values to path segments.
 * @returns True when the node's ancestry matches the path segments.
 */
export function isMatchForPath(node: SimisNode, path: string, ignoreCase = true): boolean {
    if (isEmptyOrWhiteSpace(path)) {
        return false;
    }

    const { segments, isAbsolute } = splitPath(path);
    let currentNode: SimisNode | null = node;

    for (let i = segments.length - 1; i >= 0; i--) {
        if (currentNode === null || currentNode.value === null) {
            return false;
        }

        if (!isMatch(currentNode.value, segments[i], ignoreCase)) {
            return false;
        }

        currentNode = currentNode.parent;
    }

    return !isAbsolute || (currentNode !== null && currentNode.parent === null);
}

/**
 * Finds the nodes matching `path`, starting from `node`.
 * @param node Starting node used to resolve relative paths. Absolute paths start at its root.
 * @param path Path expression. Can be absolute (leading '/') or relative. Supports the special segments "." and "..",
 * and a 1-based index that selects the n-th matching child, such as "Coupling[2]", or the n-th child, such as "[2]".
 * @param ignoreCase Whether to ignore case when matching node values to path segments.
 * @returns The matching nodes in document order. Empty when no node matches or the path is empty.
 */
export function findNodesByPath(node: SimisNode, path: string, ignoreCase = true): SimisNode[] {
    const result: SimisNode[] = [];

    if (isEmptyOrWhiteSpace(path)) {
        return result;
    }

    const { segments, isAbsolute } = splitPath(path);
    const start = isAbsolute ? getRoot(node) : node;

    findNodesByPathRecursive(start, segments, 0, ignoreCase, result);

    return result;
}

/**
 * Normalizes separators and splits `path` into its segments.
 * @param path Path expression.
 * @returns The non-empty segments and whether the path starts with a separator.
 */
function splitPath(path: string): SplitPath {
    let split = splitPaths.get(path);
    if (split === undefined) {
        const normalized = trimWhiteSpace(path.replaceAll('\\', '/'));
        split = {
            segments: normalized.split('/').filter((segment) => segment.length > 0),
            isAbsolute: normalized.startsWith('/'),
        };
        splitPaths.set(path, split);
    }

    return split;
}

/**
 * Walks up the parent chain to locate the root node of `node`.
 * @param node Node from which to discover the root.
 * @returns The highest ancestor, which has no parent.
 */
function getRoot(node: SimisNode): SimisNode {
    while (node.parent !== null) {
        node = node.parent;
    }
    return node;
}

/**
 * Resolves path segments recursively and accumulates the matching nodes.
 * @param node Current node under consideration.
 * @param segments The path segments to match.
 * @param index Current index within `segments`.
 * @param ignoreCase Whether to ignore case when matching node values to path segments.
 * @param result Accumulator for matched nodes.
 */
function findNodesByPathRecursive(node: SimisNode, segments: readonly string[], index: number, ignoreCase: boolean, result: SimisNode[]): void {
    if (index === segments.length) {
        result.push(node);
        return;
    }

    const segment = segments[index];

    if (segment === '.') {
        findNodesByPathRecursive(node, segments, index + 1, ignoreCase, result);
        return;
    }

    if (segment === '..') {
        if (node.parent !== null) {
            findNodesByPathRecursive(node.parent, segments, index + 1, ignoreCase, result);
        }
        return;
    }

    const { name, index: segmentIndex } = parseSegment(segment);

    if (segmentIndex !== undefined) {
        let remaining = segmentIndex;
        if (remaining < 1) {
            return;
        }

        for (const child of node.nodes) {
            if (isMatchForSegment(child, name, ignoreCase) && --remaining === 0) {
                findNodesByPathRecursive(child, segments, index + 1, ignoreCase, result);
                return;
            }
        }

        return;
    }

    for (const child of node.nodes) {
        if (isMatchForSegment(child, name, ignoreCase)) {
            findNodesByPathRecursive(child, segments, index + 1, ignoreCase, result);
        }
    }
}

/**
 * Returns true when `node` matches the segment name. A segment without a name matches any node.
 * @param node The node to test.
 * @param segmentName The name part of the segment, which may contain wildcards, or undefined for an index-only segment.
 * @param ignoreCase Whether to ignore case.
 * @returns True when the node matches.
 */
function isMatchForSegment(node: SimisNode, segmentName: string | undefined, ignoreCase: boolean): boolean {
    if (segmentName === undefined) {
        return true;
    }

    return node.value !== null && isMatch(node.value, segmentName, ignoreCase);
}

/**
 * Parses a single path segment, extracting an optional name and an optional 1-based index.
 * @param segment Segment to parse, such as "name", "name[2]" or "[3]".
 * @returns The name, which is undefined for an index-only segment, and the index, which is undefined when there is none.
 */
function parseSegment(segment: string): { name: string | undefined; index: number | undefined } {
    if (segment.startsWith('[') && segment.endsWith(']')) {
        // It is an index only.
        return { name: undefined, index: tryParseInt32(segment.slice(1, -1)) };
    }

    const bracketStart = segment.indexOf('[');
    if (bracketStart < 0) {
        // No index is specified.
        return { name: segment, index: undefined };
    }

    const bracketEnd = segment.indexOf(']', bracketStart + 1);
    if (bracketEnd < 0) {
        // A malformed segment is a name.
        return { name: segment, index: undefined };
    }

    return { name: segment.slice(0, bracketStart), index: tryParseInt32(segment.slice(bracketStart + 1, bracketEnd)) };
}
