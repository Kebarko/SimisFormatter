// Compares the formatter with SimisSharp on every text SIMIS file of a folder.
//
// Usage: npm run corpus -- <folder>
//
// It formats the files with SimisSharp (tools/SimisSharpReference) and with src/core, using the default settings from package.json,
// and reports each file whose output differs and each file that fails to parse in only one of the two.
// Everything is written to .corpus/, which is in .gitignore. Nothing is written to the folder.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { createTableConfig, createWriterOptions, format, SimisParseError, type TableConfig, type WriterOptions } from '../src/core';

/**
 * The root folder of the repository.
 */
const repository = path.resolve(__dirname, '..');

/**
 * The folder for everything the corpus check writes.
 */
const corpus = path.join(repository, '.corpus');

/**
 * The folder the reference tool writes to.
 */
const reference = path.join(corpus, 'reference');

/**
 * The line break SimisSharp writes, which the formatter is given so that the outputs can be compared.
 */
const newLine = '\r\n';

/**
 * The number of problems printed to the console. The report lists all of them.
 */
const printedProblems = 20;

/**
 * The result of one file as the reference tool writes it to results.json.
 */
interface ReferenceResult {
    path: string;
    status: 'formatted' | 'parse-error' | 'load-error';
    line: number | null;
    message: string | null;
}

/**
 * The output of the formatter for one file: the formatted text, a parse error, or another error.
 */
type Outcome = { kind: 'formatted'; text: string } | { kind: 'parse-error'; line: number; message: string } | { kind: 'error'; message: string };

/**
 * Reads the default writer options from the settings contributed in package.json. The indentation is a tab,
 * as the extension uses for SIMIS documents by default.
 * @returns The writer options.
 */
function readDefaultOptions(): WriterOptions {
    const manifest = JSON.parse(readFileSync(path.join(repository, 'package.json'), 'utf8'));
    const settings: Record<string, { default: unknown }> = manifest.contributes.configuration.properties;
    const get = <T>(key: string): T => settings[`simisFormatter.${key}`].default as T;

    return createWriterOptions({
        preserveQuotes: get('preserveQuotes'),
        preserveComments: get('preserveComments'),
        preserveCommentPosition: get('preserveCommentPosition'),
        preserveEmptyLines: get('preserveEmptyLines'),
        collapseEmptyLines: get('collapseEmptyLines'),
        ignoreCase: get('ignoreCase'),
        inline: get('inline'),
        table: get<TableConfig[]>('table').map(createTableConfig),
    });
}

/**
 * Converts writer options to the JSON that SimisSharp's `WriterOptions` reads, whose property names are in Pascal case.
 * @param options The writer options.
 * @returns An object to serialize.
 */
function toSimisSharpOptions(options: WriterOptions): object {
    return {
        IndentSize: options.indentSize,
        IndentCharacter: options.indentCharacter,
        PreserveQuotes: options.preserveQuotes,
        PreserveComments: options.preserveComments,
        PreserveCommentPosition: options.preserveCommentPosition,
        PreserveEmptyLines: options.preserveEmptyLines,
        CollapseEmptyLines: options.collapseEmptyLines,
        IgnoreCase: options.ignoreCase,
        Inline: options.inline,
        Table: options.table.map((table) => ({
            Name: table.name,
            Columns: table.columns,
            ColumnSeparator: table.columnSeparator,
            Offset: table.offset,
            FixedWidth: table.fixedWidth,
        })),
    };
}

/**
 * Formats text with the formatter and catches its errors.
 * @param text The text to format.
 * @param options The writer options.
 * @returns The outcome.
 */
function formatText(text: string, options: WriterOptions): Outcome {
    try {
        return { kind: 'formatted', text: format(text, options, newLine) };
    } catch (error) {
        if (error instanceof SimisParseError) {
            return { kind: 'parse-error', line: error.line, message: error.message };
        }
        return { kind: 'error', message: error instanceof Error ? error.message : String(error) };
    }
}

/**
 * Describes the first line where two texts differ.
 * @param expected The text SimisSharp writes.
 * @param actual The text the formatter writes.
 * @returns The line number and both versions of the line.
 */
function describeDifference(expected: string, actual: string): string {
    const expectedLines = expected.split(newLine);
    const actualLines = actual.split(newLine);
    let index = 0;
    while (index < expectedLines.length && index < actualLines.length && expectedLines[index] === actualLines[index]) {
        index++;
    }

    const show = (line: string | undefined): string => (line === undefined ? '(end of text)' : JSON.stringify(line.slice(0, 120)));
    return `line ${index + 1}: SimisSharp ${show(expectedLines[index])}, formatter ${show(actualLines[index])}`;
}

/**
 * Compares the outcome of the formatter with the result of SimisSharp for one file.
 * @param result The result of SimisSharp.
 * @param outcome The outcome of the formatter.
 * @param expected The text SimisSharp writes, when it formatted the file.
 * @returns A description of the problem, or undefined when both agree.
 */
function compare(result: ReferenceResult, outcome: Outcome, expected: string | undefined): string | undefined {
    if (outcome.kind === 'error') {
        return `formatter error: ${outcome.message}`;
    }

    if (result.status === 'formatted') {
        if (outcome.kind === 'parse-error') {
            return `only the formatter failed to parse: ${outcome.message}`;
        }
        return outcome.text === expected ? undefined : describeDifference(expected ?? '', outcome.text);
    }

    if (outcome.kind === 'formatted') {
        return `only SimisSharp failed to parse: ${result.message}`;
    }
    return outcome.message === result.message ? undefined : `different parse errors: SimisSharp ${result.message}, formatter ${outcome.message}`;
}

/**
 * Runs the corpus check.
 * @returns The exit code: 0 when the formatter agrees with SimisSharp on every file, 1 when it does not, 2 for wrong arguments.
 */
function main(): number {
    const folderArgument = process.argv[2];
    if (folderArgument === undefined || !statSync(folderArgument, { throwIfNoEntry: false })?.isDirectory()) {
        console.error('Usage: npm run corpus -- <folder with SIMIS files>');
        return 2;
    }
    const folder = path.resolve(folderArgument);

    const options = readDefaultOptions();
    const optionsFile = path.join(corpus, 'writeroptions.json');
    mkdirSync(corpus, { recursive: true });
    writeFileSync(optionsFile, JSON.stringify(toSimisSharpOptions(options), null, 2));
    rmSync(reference, { recursive: true, force: true });

    const project = path.join(repository, 'tools', 'SimisSharpReference');
    const run = spawnSync('dotnet', ['run', '--project', project, '-c', 'Release', '--', folder, reference, optionsFile], { stdio: 'inherit' });
    if (run.status !== 0) {
        console.error('The reference tool failed.');
        return 1;
    }

    const results: ReferenceResult[] = JSON.parse(readFileSync(path.join(reference, 'results.json'), 'utf8'));
    const problems: string[] = [];
    let checked = 0;
    let bothFailed = 0;
    let milliseconds = 0;

    for (const result of results) {
        if (result.status === 'load-error') {
            continue;
        }

        checked++;
        const text = readFileSync(path.join(reference, 'input', result.path), 'utf8');
        const expected = result.status === 'formatted' ? readFileSync(path.join(reference, 'expected', result.path), 'utf8') : undefined;

        const start = performance.now();
        const outcome = formatText(text, options);
        milliseconds += performance.now() - start;

        const problem = compare(result, outcome, expected);
        if (problem !== undefined) {
            problems.push(`${result.path}: ${problem}`);
        } else if (result.status === 'parse-error') {
            bothFailed++;
        }
    }

    const loadErrors = results.length - checked;
    const summary = [
        `Folder: ${folder}`,
        `Files checked: ${checked}`,
        `Same output as SimisSharp: ${checked - bothFailed - problems.length}`,
        `Not parsed by either, with the same error: ${bothFailed}`,
        `Problems: ${problems.length}`,
        `Not loaded by SimisSharp, and not checked: ${loadErrors}`,
        `Formatting time: ${Math.round(milliseconds)} ms`,
    ];

    const reportFile = path.join(corpus, 'report.txt');
    writeFileSync(reportFile, [...summary, '', ...problems, ''].join('\n'));

    console.log('');
    console.log(summary.join('\n'));
    if (problems.length > 0) {
        console.log('');
        console.log(problems.slice(0, printedProblems).join('\n'));
        if (problems.length > printedProblems) {
            console.log(`... and ${problems.length - printedProblems} more.`);
        }
    }
    console.log(`\nReport: ${reportFile}`);

    return problems.length === 0 ? 0 : 1;
}

process.exitCode = main();
