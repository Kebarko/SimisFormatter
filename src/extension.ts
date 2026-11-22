import * as vscode from 'vscode';
import { SimisFormattingProvider } from './formattingProvider';

/**
 * Registers the formatter for the language `simis`. VS Code activates the extension when it opens a document in that language.
 * @param context The context of the extension, which disposes the registration when the extension is deactivated.
 */
export function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider({ language: 'simis' }, new SimisFormattingProvider()),
    );
}
