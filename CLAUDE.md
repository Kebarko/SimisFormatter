# SimisFormatter

A VS Code extension, written in TypeScript, that formats the text files of Microsoft Train Simulator (MSTS) and Open Rails: engines (`.eng`), wagons (`.wag`), consists, activities, sound files and the other files written in the SIMIS format. A SIMIS file starts with a header such as `SIMISA@@@@@@@@@@JINX0D0t______`, followed by named blocks in parentheses, as in `Wagon ( Mass ( 10t ) )`.

The formatting rules are ported from the C# library **SimisSharp**, which is the reference implementation.

**Scope:** the extension only formats. It has no syntax highlighting, folding, diagnostics, outline or completion. Do not add them unless asked. The language contribution exists only so that VS Code can pick the formatter for these files.

Repository: https://github.com/Kebarko/SimisFormatter. License: MIT, as SimisSharp.

**Status:** the reader, parser and writer are ported, and the formatter matches SimisSharp on the whole test corpus (see "Test corpus"). Publishing to the Visual Studio Marketplace is set up (see "Releasing"). Version 0.1.0 is published, but it never starts (no activation event) and is turned off in Restricted Mode; version 0.1.1 fixes both.

## Reference implementation: SimisSharp

- Local source: `e:\source\repos\Kebarko\SimisSharp\` (read it, never edit it from this project).
- Also at https://github.com/Kebarko/SimisSharp and on NuGet as `SimisSharp`.
- Ported from: SimisSharp **v0.1.0** (commit `b498e0d`). Update this line when changes from SimisSharp are brought over.
- Its `README.md` describes the format, the comment rules and every writer option. Read it before changing formatting behavior.

**Parity rule:** for the same text and the same options, the formatter writes the same text as SimisSharp's `processor.Save(processor.Parse(text), options)`, except for line endings (see below). Text that SimisSharp fails to parse also fails here. A deliberate difference is allowed only when it is listed in the "Differences from SimisSharp" section of `README.md`.

### What is ported

| SimisSharp | SimisFormatter | Notes |
|---|---|---|
| `IO/TokenConfiguration.cs` | `src/core/tokens.ts` | Whitespace set, comment tokens (`comment`, `skip`, names that start with `#` or `_`). |
| `SimisReader.cs` | `src/core/reader.ts` | Tokenizer. A class working on indices into the string instead of a `ref struct` over spans. |
| `IO/Parser.cs` | `src/core/parser.ts` | Builds the node tree, keeping quotes, blank lines, comment positions and original text. |
| `SimisNode.cs` | `src/core/node.ts` | Only the tree and the formatting state the writer needs. No editing API, no typed accessors. |
| `SimisValue.cs` | `src/core/escape.ts` | Only escaping and unescaping of quoted strings. |
| `SimisPathService.cs`, `WildcardMatcher.cs` | `src/core/path.ts`, `src/core/wildcard.ts` | Path matching for the `inline` and `table` settings. |
| `IO/Writer.cs`, `IO/WriterOptions.cs` | `src/core/writer.ts`, `src/core/options.ts` | |
| `SimisParseException.cs` | `src/core/errors.ts` | `SimisParseError` with a 1-based `line`. |
| `SimisTextDecoder.CheckSubheader` | `src/core/header.ts` | `isTextSimisHeader`. |
| `SimisProcessor.Save(Parse(text))` | `src/core/format.ts` | `format(text, options, newLine)`, the entry point the extension and the corpus check call. |
| .NET `char.IsWhiteSpace`, `string.Trim`, `char.ToUpperInvariant`, `OrdinalIgnoreCase`, `int.TryParse` | `src/core/text.ts` | Helpers that behave as the .NET methods (see "Porting pitfalls"). |

Not ported: the rest of `SimisTextDecoder` (VS Code decodes the file), `SimisProcessor` file I/O and atomic saving, number parsing and formatting, node editing, and the typed accessors of the reader. `src/core/index.ts` exports what the extension, the tests and the tools use. The port keeps SimisSharp's quirks for parity, such as blank line counts stored in a byte (256 blank lines count as none); fix them in SimisSharp first.

### Porting pitfalls

- .NET `char.IsWhiteSpace` is not JavaScript `\s`: .NET includes U+0085 and excludes U+FEFF, JavaScript does the opposite. Build the explicit character set as `TokenConfiguration` does, and never use `\s` or `trim()` to find token boundaries.
- `StringComparison.OrdinalIgnoreCase` and `char.ToUpperInvariant` have no direct equivalent. Use `equalsIgnoreCase` and `toUpperInvariant` in `src/core/text.ts` for every case-insensitive comparison, never `localeCompare`, `toLowerCase` or `toUpperCase` directly. `char.ToUpperInvariant` differs from `toUpperCase` for 44 characters, such as the dotless `ı`, which .NET keeps; `text.ts` lists them, found by comparing every UTF-16 code unit.
- `int.TryParse(..., NumberStyles.Integer, InvariantCulture)` rejects `12abc` and values outside the 32-bit range, which `parseInt` accepts, and ignores trailing NUL characters. Use `tryParseInt32` in `src/core/text.ts`; the `Columns` setting and path indexes rely on it.
- `string.Length` and `PadLeft` count UTF-16 code units, as JavaScript's `length` and `padStart` do. Keep it that way so that table columns line up the same.
- The writer is synchronous and runs on the extension host. Text shapes (`.s`) and world files (`.w`) can be several megabytes, so keep the tokenizer index-based, without regular expressions or substrings per character.

## Test corpus

`f:\Games\_origTrainSim\` is an original MSTS installation with 3,799 uncompressed text SIMIS files (all UTF-16 with a byte order mark; its `.w` files and most `.s` files are compressed binary). It is the only corpus for now. It is **read-only**: never write, rename or delete anything in it, and never commit its files, or text decoded or formatted from them. They are copyrighted.

The corpus check compares the formatter with SimisSharp on every text SIMIS file of a folder:

- `tools/SimisSharpReference/` is a .NET 10 console app that references the SimisSharp NuGet package at the version in "Ported from". For each text SIMIS file it writes the decoded text (`input/`), SimisSharp's output (`expected/`) and the result of each file (`results.json`).
- `tools/corpus.ts` (`npm run corpus -- <folder>`) writes the default settings from `package.json` as SimisSharp options, runs the reference app, formats the same decoded text with `src/core`, and reports each file whose output differs (with the first differing line) and each file that fails to parse in only one of the two, or on another line. Line endings are CRLF on both sides. It takes about two and a half minutes, mostly for the reference app.
- Output goes to `.corpus/` (`report.txt` lists every problem), which is in `.gitignore`. Nothing is written next to the input files. Do not use SimisSharp's `samples/SimisSharp.Console` for this, because it writes its output next to the file it reads.
- Baseline: SimisSharp v0.1.0 formats 3,777 of the 3,799 files and fails to parse 22. A complete port reports 3,777 with the same output, 22 not parsed by either, and 0 problems.

Run the corpus check after every change to the reader, parser or writer. Report its numbers (files checked, same output, problems) instead of saying it passed.

## Architecture

- `src/core/` holds the parser and writer. It must not import `vscode` or Node modules, so that it runs and is tested in plain Node.
- `src/extension.ts` registers the provider for the language `simis`. `src/formattingProvider.ts` is the `DocumentFormattingEditProvider`, and `src/settings.ts` turns the settings and VS Code's `FormattingOptions` into `WriterOptions`.
- `src/` is type-checked without Node types (`types: []` in `tsconfig.json`), so it cannot use Node APIs or `console`. `test/`, `test/vscode/` and `tools/` have their own `tsconfig.json` with Node types.
- There are no runtime dependencies. The extension is bundled with esbuild into `dist/extension.js` (target Node 20, for VS Code 1.90, the oldest supported version; `@types/vscode` is pinned to 1.90.0 to match). `.vscodeignore` leaves everything but `dist/`, `package.json`, `README.md`, `CHANGELOG.md` and `LICENSE` out of the `.vsix`.
- Tool versions: TypeScript stays on 6.0 because typescript-eslint does not support TypeScript 7 yet.

### Language contribution

`package.json` contributes the language `simis` (name "MSTS SIMIS") with:

- `extensions`: `.act`, `.con`, `.cvf`, `.eng`, `.env`, `.fbk`, `.haz`, `.mkr`, `.pal`, `.pat`, `.rdb`, `.ref`, `.rit`, `.s`, `.sd`, `.sms`, `.srv`, `.tdb`, `.tit`, `.trf`, `.trk`, `.w`, `.wag`, `.ws`. These are the extensions of the text SIMIS files in the test corpus, plus `.w` and `.s`, which are text once decompressed.
- `filenames` for `.dat` and `.db` files, whose extensions are too general to claim: `drivers.db` and the SIMIS `.dat` files of the corpus, such as `tsection.dat`, `sigcfg.dat`, `carspawn.dat` and the GUI `.dat` files. `sigscr.dat` is a signal script, not a SIMIS file, and is not listed.
- `firstLine`: `^SIMISA@@@@@@@@@@JINX0..t`, for SIMIS files with other names. VS Code uses it only when no extension or file name matches.

`activationEvents` lists `onLanguage:simis`, and it must stay. VS Code generates an `onLanguage` event from a language contribution only when the language has a `configuration` file, which `simis` does not have (a language configuration would add brackets and comment toggling, which are out of scope). Without the event the extension never starts, and VS Code reports "There is no formatter for 'simis' files installed".

Not claimed: `.txt` (the help texts in `GLOBAL\` are SIMIS files, but the extension belongs to plain text) and `.bak`. Users can map them with `files.associations`.

Some of the extensions are also used by other languages (`.env`, `.con`, `.act`, `.pat`, `.ref`, `.s`, `.w`). The header check below keeps the formatter away from files that are not SIMIS text.

### How formatting behaves in VS Code

- Only text that starts with the header of a text SIMIS file, `SIMISA@@@@@@@@@@JINX0` followed by two characters and `t`, is formatted, as SimisSharp loads only such files. Other text, including compressed (`SIMISA@F`) and binary files, gets no edit.
- The whole document is formatted with one `TextEdit` that replaces the full range. When the result equals the current text, no edit is returned, so the document is not marked as changed.
- When the text cannot be parsed (an unclosed block, an extra `)`, an unterminated quoted string), no edit is returned and a warning with the line of the problem is shown (`window.showWarningMessage`). The formatter never returns partly formatted text.
- The formatter works on the text VS Code has decoded and never touches bytes or encodings. VS Code reads UTF-16 files with a byte order mark, as MSTS writes them, and saves them in the same encoding. Files in an ANSI code page need the right `files.encoding`.
- Line endings follow the document (`document.eol`). VS Code turns line breaks in an edit into the document's line endings anyway. The writer takes the line ending as a parameter instead of writing CRLF.
- Settings are read with `workspace.getConfiguration('simisFormatter', document)`, so folder and language settings apply.
- The extension works in Restricted Mode: `package.json` declares `"capabilities": { "untrustedWorkspaces": { "supported": true } }`, because it runs no code from the workspace and its settings only change the formatting (the wildcard matcher uses a table, not regular expressions, so no pattern can hang it). Without the declaration, VS Code turns off any extension with a `main` in a folder that is not trusted, the language `simis` is not registered, and the files open as plain text ("There is no formatter for 'plaintext' files installed"). A new setting that runs a program or reads a file would need `"limited"` and `restrictedConfigurations` instead.

### Settings

Every `WriterOptions` property is a setting under `simisFormatter.`, in camel case: `preserveQuotes`, `preserveComments`, `preserveCommentPosition`, `preserveEmptyLines`, `collapseEmptyLines`, `ignoreCase`, `inline` (array of paths), and `table` (array of objects with `name`, `columns`, `columnSeparator`, `offset` and `fixedWidth`). Defaults are those of SimisSharp, and `inline` and `table` default to the lists in SimisSharp's `samples/SimisSharp.Console/writeroptions.json`. Indentation comes from the `FormattingOptions` VS Code passes (`insertSpaces`, `tabSize`). The extension contributes `"[simis]": { "editor.insertSpaces": false }` as a default, because MSTS files are indented with tabs.

Each setting needs a `markdownDescription` in `package.json`. Keep the settings and `src/core/options.ts` in sync.

## Commands

```
npm install
npm run build          # bundle with esbuild into dist/
npm run watch          # rebuild on change
npm run typecheck      # tsc on src/, test/, test/vscode/ and tools/
npm run lint           # eslint
npm test               # unit tests (Vitest)
npm run test:vscode    # build, then integration tests in a VS Code downloaded to .vscode-test/
npm run corpus -- f:\Games\_origTrainSim   # compare with SimisSharp on real files
npm run package        # build the .vsix with @vscode/vsce
```

If Vitest fails every file with `TypeError: Cannot read properties of undefined (reading 'config')`, the shell entered the project folder with a drive letter in another case (such as `/e/...` in Git Bash); run it from PowerShell, or from `E:\source\repos\Kebarko\SimisFormatter`.

Before reporting a change as done, run `typecheck`, `lint` and `test`, and `test:vscode` when `src/extension.ts`, `src/formattingProvider.ts`, `src/settings.ts` or `package.json` changed.

CI (`.github/workflows/ci.yml`) runs `typecheck`, `lint`, `test` and `test:vscode` on Windows and Linux for every push to `main` and every pull request, and keeps the `.vsix` built on Linux as an artifact. It cannot run the corpus check, so run that locally.

Press F5 in VS Code ("Run Extension") to try the extension in a development host, which opens `test/fixtures/`.

## Releasing

`.github/workflows/publish.yml` publishes the extension to the Visual Studio Marketplace when a tag such as `v0.2.0` is pushed. It checks that the tag matches the version in `package.json`, runs all checks, builds the `.vsix`, and publishes that package with Trusted Publishing (`vsce publish --oidc`), so no token is stored anywhere.

- The Marketplace publisher ID is `kebarko`, the `publisher` in `package.json`. Its Trusted Publishing policy (at https://marketplace.visualstudio.com/manage) names the owner `Kebarko`, the repository `SimisFormatter`, the workflow `publish.yml` and the environment `marketplace`. Renaming the workflow file or the environment breaks publishing until the policy is changed to match.
- To release: set the version in `package.json` (major.minor.patch only; the Marketplace does not accept pre-release suffixes such as `-beta`), rename "Unreleased" in `CHANGELOG.md` to the version and date, run the checks and the corpus check, commit, then tag the commit `v<version>` and push the commit and the tag.
- Ask before pushing a version tag. A published version cannot be replaced, only followed by a new version.
- Open VSX, which VSCodium and other editors use, is not set up.

## Code style

- TypeScript with `strict` on. No `any` without a comment explaining why.
- Names mirror SimisSharp (`SimisNode`, `SimisReader`, `WriterOptions`, `isMatchForPath`) in TypeScript casing, so that the two code bases can be compared side by side.
- Every function, class, property and constant has a JSDoc comment in full sentences, as SimisSharp has XML documentation comments. Port the C# comment with the code it documents.
- Settings descriptions, messages and the README are written in plain, complete sentences, like SimisSharp's README.
- `.editorconfig`: CRLF line endings, 4 spaces, 2 spaces for JSON, UTF-8 without a byte order mark (unlike SimisSharp, because JSON tools do not expect one).

## Tests

- `test/manifest.test.ts` checks that the settings in `package.json` match `WriterOptions`.
- Unit tests of the core live in `test/core/`. The SimisSharp tests about reading, quoting, comments, paths, wildcards and writing (`SimisReaderTest`, `QuotingTest`, `CommentTest`, `SimisPathServiceTest`, `WildcardMatcherTest`, `WriterTest`, and the round-trip cases of `SimisDocumentTest`) are ported with the same cases and readable names. Keep their `// Arrange`, `// Act`, `// Assert` structure.
- Each bug fix starts with a test that fails.
- Integration tests in `test/vscode/` stay few: the extension starts by itself, the language is detected and a fixture is formatted through the provider. They never call `activate()`, so that a missing activation event fails them; the first suite waits for VS Code to start the extension, and the others rely on it.
- Fixtures in `test/fixtures/` are small, made-up files, saved as MSTS saves them: UTF-16LE with a byte order mark and CRLF (`.editorconfig` and `.gitattributes` keep them so). Never commit files from an MSTS installation or third-party add-ons (see "Test corpus").

## Git

- Commit messages are one imperative sentence that starts with a capital letter and ends with a period, with no prefix, as in SimisSharp: `Load compressed text files.`
- Commit or push only when asked.
