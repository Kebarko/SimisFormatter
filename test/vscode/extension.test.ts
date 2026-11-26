import * as assert from 'node:assert';
import * as path from 'node:path';
import * as vscode from 'vscode';

/**
 * The folder of the test fixtures, from out/test/vscode where the compiled tests run.
 */
const fixtures = path.resolve(__dirname, '../../../test/fixtures');

/**
 * Opens a fixture file.
 * @param name The name of the file in the fixtures folder.
 * @returns The opened document.
 */
function openFixture(name: string): Thenable<vscode.TextDocument> {
    return vscode.workspace.openTextDocument(path.join(fixtures, name));
}

/**
 * Waits until the extension is active, as VS Code activates it by itself.
 * @param extension The extension to wait for.
 * @param timeout The longest time to wait, in milliseconds.
 * @returns True when the extension became active in time.
 */
async function whenActive(extension: vscode.Extension<unknown>, timeout: number): Promise<boolean> {
    const end = Date.now() + timeout;
    while (!extension.isActive && Date.now() < end) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return extension.isActive;
}

// The tests never call activate() themselves, so that they fail when VS Code would not start the extension.
// This suite runs first, and the other suites rely on the activation it waits for.
suite('Activation', () => {
    test('The extension starts when a SIMIS document is opened', async () => {
        // Arrange
        const extension = vscode.extensions.getExtension('kebarko.simis-formatter');
        assert.ok(extension);
        assert.strictEqual(extension.isActive, false);

        // Act
        await openFixture('Sample.eng');
        const active = await whenActive(extension, 10000);

        // Assert
        assert.strictEqual(active, true);
    });
});

suite('Language', () => {
    test('An engine is a SIMIS document', async () => {
        // Act
        const document = await openFixture('Sample.eng');

        // Assert
        assert.strictEqual(document.languageId, 'simis');
    });

    test('A file extension in capital letters is recognized', async () => {
        // Act
        const document = await openFixture('SAMPLE.WAG');

        // Assert
        assert.strictEqual(document.languageId, 'simis');
    });

    test('A SIMIS .dat file is recognized by its name', async () => {
        // Act
        const document = await openFixture('tsection.dat');

        // Assert
        assert.strictEqual(document.languageId, 'simis');
    });

    test('A file with another extension is recognized by its header', async () => {
        // Act
        const document = await openFixture('sample.inc');

        // Assert
        assert.strictEqual(document.languageId, 'simis');
    });

    test('A UTF-16 file is read without its byte order mark', async () => {
        // Act
        const document = await openFixture('Sample.eng');

        // Assert
        assert.ok(document.getText().startsWith('SIMISA@@@@@@@@@@JINX0D0t______\r\n'));
    });
});

/**
 * The header line of the documents formatted in the tests.
 */
const HEADER = 'SIMISA@@@@@@@@@@JINX0D0t______';

/**
 * Formats a new untitled SIMIS document through the formatting provider and applies the edits.
 * @param content The text of the document, with LF line breaks.
 * @param options The indentation passed to the formatter.
 * @returns The number of edits and the text of the document after they are applied, with LF line breaks.
 */
async function formatText(
    content: string,
    options: vscode.FormattingOptions = { tabSize: 4, insertSpaces: false },
): Promise<{ edits: number; text: string }> {
    const document = await vscode.workspace.openTextDocument({ language: 'simis', content });
    const edits =
        (await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>('vscode.executeFormatDocumentProvider', document.uri, options)) ?? [];

    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.set(document.uri, edits);
    await vscode.workspace.applyEdit(workspaceEdit);

    return { edits: edits.length, text: document.getText().replaceAll('\r\n', '\n') };
}

suite('Formatting', () => {
    test('A SIMIS document is formatted', async () => {
        // Act
        const actual = await formatText(`${HEADER}\n\nWagon ( Mass ( 10t ) comment ( Made up ) Size ( 1 2 3 ) )`);

        // Assert
        assert.strictEqual(actual.text, `${HEADER}\n\nWagon (\n\tMass ( 10t ) comment ( Made up )\n\tSize ( 1 2 3 )\n)\n`);
    });

    test('A formatted document gets no edits', async () => {
        // Arrange
        const document = await openFixture('Sample.eng');

        // Act
        const edits = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
            'vscode.executeFormatDocumentProvider',
            document.uri,
            { tabSize: 4, insertSpaces: false },
        );

        // Assert
        assert.deepStrictEqual(edits ?? [], []);
    });

    test('A document is indented with spaces when the editor inserts spaces', async () => {
        // Act
        const actual = await formatText(`${HEADER}\nWagon ( Mass ( 10t ) )`, { tabSize: 2, insertSpaces: true });

        // Assert
        assert.strictEqual(actual.text, `${HEADER}\nWagon (\n  Mass ( 10t )\n)\n`);
    });

    test('Text that cannot be parsed gets no edits', async () => {
        // Act
        const actual = await formatText(`${HEADER}\nWagon ( Mass ( 10t )`);

        // Assert
        assert.strictEqual(actual.edits, 0);
    });

    test('The settings change the formatting', async () => {
        // Arrange
        const settings = vscode.workspace.getConfiguration('simisFormatter');
        await settings.update('preserveComments', false, vscode.ConfigurationTarget.Global);

        try {
            // Act
            const actual = await formatText(`${HEADER}\nWagon ( comment ( Made up ) Mass ( 10t ) )`);

            // Assert
            assert.strictEqual(actual.text, `${HEADER}\nWagon (\n\tMass ( 10t )\n)\n`);
        } finally {
            await settings.update('preserveComments', undefined, vscode.ConfigurationTarget.Global);
        }
    });

    test('Text without a SIMIS header gets no edits', async () => {
        // Arrange
        const document = await vscode.workspace.openTextDocument({ language: 'simis', content: 'Wagon ( Mass ( 10t ) )' });

        // Act
        const edits = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
            'vscode.executeFormatDocumentProvider',
            document.uri,
            { tabSize: 4, insertSpaces: false },
        );

        // Assert
        assert.deepStrictEqual(edits ?? [], []);
    });
});

suite('Settings', () => {
    test('The settings have their defaults', () => {
        // Arrange
        const settings = vscode.workspace.getConfiguration('simisFormatter');

        // Act
        const preserveQuotes = settings.get('preserveQuotes');
        const inline = settings.get<string[]>('inline');

        // Assert
        assert.strictEqual(preserveQuotes, true);
        assert.ok(inline?.includes('InertiaTensor'));
    });

    test('SIMIS documents are indented with tabs by default', () => {
        // Act
        const insertSpaces = vscode.workspace.getConfiguration('editor', { languageId: 'simis' }).get('insertSpaces');

        // Assert
        assert.strictEqual(insertSpaces, false);
    });
});
