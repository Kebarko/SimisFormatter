import * as vscode from 'vscode';
import { createTableConfig, createWriterOptions, type TableConfig, type WriterOptions } from './core';

/**
 * The section of the settings of the extension, as in `simisFormatter.preserveQuotes`.
 */
const SECTION = 'simisFormatter';

/**
 * Reads the writer options for `document`: the indentation from the formatting options VS Code passes,
 * and everything else from the `simisFormatter` settings that apply to the document, including folder and language settings.
 * A setting whose value has the wrong type, which settings.json allows, is replaced by its default.
 * @param document The document to format.
 * @param formatting The formatting options VS Code passes to the formatter.
 * @returns The writer options.
 */
export function getWriterOptions(document: vscode.TextDocument, formatting: vscode.FormattingOptions): WriterOptions {
    const settings = vscode.workspace.getConfiguration(SECTION, document);
    const defaults = createWriterOptions();
    const useSpaces = formatting.insertSpaces && Number.isInteger(formatting.tabSize) && formatting.tabSize > 0;

    return createWriterOptions({
        indentCharacter: useSpaces ? ' ' : '\t',
        indentSize: useSpaces ? formatting.tabSize : 1,
        preserveQuotes: getBoolean(settings, 'preserveQuotes', defaults.preserveQuotes),
        preserveComments: getBoolean(settings, 'preserveComments', defaults.preserveComments),
        preserveCommentPosition: getBoolean(settings, 'preserveCommentPosition', defaults.preserveCommentPosition),
        preserveEmptyLines: getBoolean(settings, 'preserveEmptyLines', defaults.preserveEmptyLines),
        collapseEmptyLines: getBoolean(settings, 'collapseEmptyLines', defaults.collapseEmptyLines),
        ignoreCase: getBoolean(settings, 'ignoreCase', defaults.ignoreCase),
        inline: getArray(settings, 'inline').filter((path): path is string => typeof path === 'string'),
        table: getArray(settings, 'table').flatMap(toTableConfig),
    });
}

/**
 * Reads a setting that holds true or false.
 * @param settings The settings of the extension.
 * @param key The name of the setting within the section.
 * @param fallback The value used when the setting is not a boolean.
 * @returns The value of the setting, or `fallback`.
 */
function getBoolean(settings: vscode.WorkspaceConfiguration, key: string, fallback: boolean): boolean {
    const value: unknown = settings.get(key);
    return typeof value === 'boolean' ? value : fallback;
}

/**
 * Reads a setting that holds a list.
 * @param settings The settings of the extension.
 * @param key The name of the setting within the section.
 * @returns The items of the list, which are not checked yet, or an empty list when the setting is not a list.
 */
function getArray(settings: vscode.WorkspaceConfiguration, key: string): unknown[] {
    const value: unknown = settings.get(key);
    return Array.isArray(value) ? value : [];
}

/**
 * Turns an entry of the `simisFormatter.table` setting into a table configuration.
 * An entry without a `name` and `columns` text is left out, and any other property with the wrong type gets its default.
 * @param entry An item of the setting.
 * @returns The table configuration, or no configuration when the entry is left out.
 */
function toTableConfig(entry: unknown): TableConfig[] {
    if (typeof entry !== 'object' || entry === null) {
        return [];
    }

    const { name, columns, columnSeparator, offset, fixedWidth } = entry as Record<string, unknown>;
    if (typeof name !== 'string' || typeof columns !== 'string') {
        return [];
    }

    return [
        createTableConfig({
            name,
            columns,
            ...(typeof columnSeparator === 'string' && { columnSeparator }),
            ...(typeof offset === 'number' && Number.isInteger(offset) && offset >= 0 && { offset }),
            ...(typeof fixedWidth === 'boolean' && { fixedWidth }),
        }),
    ];
}
