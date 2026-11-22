import { describe, expect, it } from 'vitest';
import { findNodesByPath, isMatchForPath, parse, SimisNode } from '../../src/core';

/**
 * The document the path tests search, with the CRLF line breaks and without the final line break of the C# raw string literal.
 */
const text = [
    'Wagon (',
    '\tName ( Loco )',
    '\tMass ( 100t )',
    '\tCoupling ( Type ( Chain ) )',
    '\tCoupling ( Type ( Bar ) )',
    ')',
    'Engine (',
    '\tMass ( 90t )',
    '\tEffects ( Mass ( 1 ) )',
    ')',
].join('\r\n');

/**
 * Asserts that `actual` holds the same node objects as `expected`, in the same order,
 * as xUnit's `Assert.Equal` does for nodes, which compare by reference.
 * @param actual The nodes found.
 * @param expected The nodes expected.
 */
function expectSameNodes(actual: readonly SimisNode[], expected: readonly SimisNode[]): void {
    expect(actual).toHaveLength(expected.length);
    actual.forEach((node, i) => expect(node).toBe(expected[i]));
}

describe('findNodesByPath and isMatchForPath', () => {
    const document = parse(text);

    /**
     * Resolves a test path such as "Wagon/Coupling[2]/Type" with exact, case-sensitive names. An empty path is the document root.
     * @param path The names of the nodes from the document root, each with an optional 1-based index among the child nodes of that name.
     * @returns The node the path leads to.
     */
    function node(path: string): SimisNode {
        let current = document.root;
        for (const segment of path.split('/').filter((s) => s.length > 0)) {
            const name = segment.split('[')[0];
            const index = segment.includes('[') ? Number.parseInt(segment.slice(segment.indexOf('[') + 1, -1), 10) : 1;
            current = current.getNodes((n) => n.value === name)[index - 1];
        }
        return current;
    }

    /**
     * Returns the descendants of a node in document order, each node before its own descendants.
     * @param parent The node whose descendants are returned.
     * @returns The descendants.
     */
    function descendants(parent: SimisNode): SimisNode[] {
        return parent.getNodes().flatMap((subnode) => [subnode, ...descendants(subnode)]);
    }

    it.each([
        ['', '/Wagon/Mass', 'Wagon/Mass'],
        ['', 'Wagon/Mass', 'Wagon/Mass'],
        ['', 'wagon/MASS', 'Wagon/Mass'],
        ['', '/Mass'],
        ['', '/*/Mass', 'Wagon/Mass', 'Engine/Mass'],
        ['', '/W*n/M?ss', 'Wagon/Mass'],
        ['', '/*/*/Mass', 'Engine/Effects/Mass'],
        ['', '/Wagon/Coupling[2]/Type', 'Wagon/Coupling[2]/Type'],
        ['', '/Wagon/coupling[2]/type', 'Wagon/Coupling[2]/Type'],
        ['', '/Wagon/Coupling[3]'],
        ['', '/Wagon/[2]', 'Wagon/Mass'],
        ['', '/Wagon/[0]'],
        ['Wagon', '../Engine/Mass', 'Engine/Mass'],
        ['Wagon', '/Engine/Mass', 'Engine/Mass'],
        ['Engine/Effects/Mass', '/Wagon', 'Wagon'],
        ['Wagon', '.', 'Wagon'],
        ['Wagon/Mass', '../../Engine', 'Engine'],
    ])('finds nodes by path in a document (start %j, path %j)', (start, path, ...expected) => {
        // Act
        const result = findNodesByPath(node(start), path);

        // Assert
        expectSameNodes(result, expected.map(node));
    });

    it.each(['/', '..'])('finds nodes by path reaching the document root (%j)', (path) => {
        // Act
        const result = findNodesByPath(node('Wagon'), path);

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(document.root);
    });

    it('finds nodes by path respecting case', () => {
        expect(findNodesByPath(document.root, 'wagon/MASS', false)).toHaveLength(0);
        expect(findNodesByPath(document.root, 'Wagon/Mass', false)).toHaveLength(1);
    });

    it.each([
        ['Wagon/Mass', '/Wagon/Mass', true],
        ['Wagon/Mass', 'Wagon/Mass', true],
        ['Wagon/Mass', 'Mass', true],
        ['Wagon/Mass', '/Mass', false],
        ['Wagon/Mass', '/wagon/MASS', true],
        ['Wagon/Mass', '/*/Mass', true],
        ['Wagon/Mass', '\\Wagon\\Mass', true],
        ['Wagon/Mass', '/X/Wagon/Mass', false],
        ['Wagon', '/Wagon', true],
        ['Engine/Effects/Mass', '/Engine/Mass', false],
        ['Engine/Effects/Mass', 'Effects/Mass', true],
        ['Engine/Effects/Mass', '/Engine/*/Mass', true],
        ['', '/', true],
        ['Wagon', '/', false],
        ['Wagon', '', false],
    ])('matches a node to a path in a document (node %j, path %j, expected %s)', (nodePath, path, expected) => {
        expect(isMatchForPath(node(nodePath), path, true)).toBe(expected);
    });

    it('matches a node to a path respecting case', () => {
        expect(isMatchForPath(node('Wagon/Mass'), '/wagon/MASS', false)).toBe(false);
        expect(isMatchForPath(node('Wagon/Mass'), '/Wagon/Mass', false)).toBe(true);
    });

    it.each(['/Wagon/Mass', '/*/Mass', '/*/*/Mass', '/*', '/*/*', '*/Mass', '*/Type'])('find and match agree on %j', (path) => {
        // Act
        const found = findNodesByPath(document.root, path);
        const matched = descendants(document.root).filter((n) => isMatchForPath(n, path));

        // Assert
        if (path.startsWith('/')) {
            expectSameNodes(found, matched);
        } else {
            found.forEach((n) => expect(isMatchForPath(n, path)).toBe(true));
        }
    });

    it('the top node of a detached tree is the root', () => {
        // Arrange
        const a = new SimisNode('A');
        const b = new SimisNode('B');
        const c = new SimisNode('C');
        a.addParsedNode(b);
        b.addParsedNode(c);

        // Act & Assert
        const found = findNodesByPath(c, '/B/C');
        expect(found).toHaveLength(1);
        expect(found[0]).toBe(c);
        expect(findNodesByPath(c, '/A/B/C')).toHaveLength(0);
        expect(isMatchForPath(c, '/B/C')).toBe(true);
        expect(isMatchForPath(c, '/A/B/C')).toBe(false);
    });
});

describe('findNodesByPath in a tree of nodes', () => {
    // A
    // ├── B
    // │   ├── E
    // │   └── F
    // ├── C
    // │   ├── G
    // │   └── H
    // ├── B
    // │   ├── E
    // │   ├── I
    // │   └── J
    // └── D
    //     ├── K
    //     └── L

    // Level 1 (root)
    const nodeA = new SimisNode('A');

    // Level 2
    const nodeAB = new SimisNode('B');
    const nodeAC = new SimisNode('C');
    const nodeAB2 = new SimisNode('B');
    const nodeAD = new SimisNode('D');

    nodeA.addParsedNode(nodeAB);
    nodeA.addParsedNode(nodeAC);
    nodeA.addParsedNode(nodeAB2);
    nodeA.addParsedNode(nodeAD);

    // Level 3 - children of B
    const nodeABE = new SimisNode('E');
    const nodeABF = new SimisNode('F');
    nodeAB.addParsedNode(nodeABE);
    nodeAB.addParsedNode(nodeABF);

    // Level 3 - children of C
    const nodeACG = new SimisNode('G');
    const nodeACH = new SimisNode('H');
    nodeAC.addParsedNode(nodeACG);
    nodeAC.addParsedNode(nodeACH);

    // Level 3 - children of second B
    const nodeABE2 = new SimisNode('E');
    const nodeABI = new SimisNode('I');
    const nodeABJ = new SimisNode('J');
    nodeAB2.addParsedNode(nodeABE2);
    nodeAB2.addParsedNode(nodeABI);
    nodeAB2.addParsedNode(nodeABJ);

    // Level 3 - children of D
    const nodeADK = new SimisNode('K');
    const nodeADL = new SimisNode('L');
    nodeAD.addParsedNode(nodeADK);
    nodeAD.addParsedNode(nodeADL);

    it.each([
        { start: 'A', startNode: nodeA, path: 'B/E', expected: [nodeABE, nodeABE2] },
        { start: 'A', startNode: nodeA, path: 'B[2]/J', expected: [nodeABJ] },
        { start: 'A/D/L', startNode: nodeADL, path: '..\\K', expected: [nodeADK] },
        { start: 'A/B', startNode: nodeAB, path: '/C/[2]', expected: [nodeACH] },
    ])('finds nodes by path $path from $start', ({ startNode, path, expected }) => {
        // Arrange
        const node = startNode;

        // Act
        const result = findNodesByPath(node, path);

        // Assert
        expect(result).toHaveLength(expected.length);
        expectSameNodes(result, expected);
    });
});
