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

suiteSetup(async () => {
    await vscode.extensions.getExtension('kebarko.simis-formatter')?.activate();
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

suite('Formatting', () => {
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
