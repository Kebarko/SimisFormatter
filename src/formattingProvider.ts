import * as vscode from 'vscode';
import { format, isTextSimisHeader, SimisParseError } from './core';
import { getWriterOptions } from './settings';

/**
 * Formats whole SIMIS documents with the writer ported from SimisSharp.
 * Text that does not start with the header of a text SIMIS file gets no edits. Neither does text that cannot be parsed,
 * for which a warning with the line of the problem is shown. Partly formatted text is never returned.
 */
export class SimisFormattingProvider implements vscode.DocumentFormattingEditProvider {
    /**
     * Formats `document`.
     * @param document The document to format.
     * @param options The indentation VS Code uses for the document.
     * @param token Cancels the request, for example when the document changes.
     * @returns One edit that replaces the whole text, or no edits when the text is not formatted or is already formatted.
     */
    provideDocumentFormattingEdits(
        document: vscode.TextDocument,
        options: vscode.FormattingOptions,
        token: vscode.CancellationToken,
    ): vscode.TextEdit[] {
        const text = document.getText();
        if (!isTextSimisHeader(text)) {
            return [];
        }

        const newLine = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
        let formatted: string;
        try {
            formatted = format(text, getWriterOptions(document, options), newLine);
        } catch (error) {
            const name = vscode.workspace.asRelativePath(document.uri);
            if (error instanceof SimisParseError) {
                void vscode.window.showWarningMessage(`SimisFormatter did not format ${name}. ${error.message}`);
            } else {
                const message = error instanceof Error ? error.message : String(error);
                void vscode.window.showErrorMessage(`SimisFormatter could not format ${name}. ${message}`);
            }
            return [];
        }

        if (token.isCancellationRequested || formatted === text) {
            return [];
        }

        const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(text.length));
        return [vscode.TextEdit.replace(fullRange, formatted)];
    }
}
