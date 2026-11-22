# SimisFormatter

## Overview

SimisFormatter is a Visual Studio Code extension that formats the text files of Microsoft Train Simulator (MSTS) and Open Rails. These files use the SIMIS format: a header such as `SIMISA@@@@@@@@@@JINX0D0t______`, followed by named blocks in parentheses, as in `Wagon ( Mass ( 10t ) )`. Engines (`.eng`), wagons (`.wag`), consists (`.con`), activities (`.act`), sound files (`.sms`) and many other files are written this way.

The formatter indents blocks, writes tables such as `ThrottleRPMTab` in aligned columns, and keeps comment blocks, blank lines and quotes. It follows the rules of the [SimisSharp](https://github.com/Kebarko/SimisSharp) library, which reads files the way Open Rails reads them.

## Supported files

Files with these extensions are opened as MSTS SIMIS documents: `.act`, `.con`, `.cvf`, `.eng`, `.env`, `.fbk`, `.haz`, `.mkr`, `.pal`, `.pat`, `.rdb`, `.ref`, `.rit`, `.s`, `.sd`, `.sms`, `.srv`, `.tdb`, `.tit`, `.trf`, `.trk`, `.w`, `.wag` and `.ws`.

The SIMIS `.dat` files of MSTS, such as `tsection.dat`, `sigcfg.dat` and `carspawn.dat`, and `drivers.db` are recognized by their names. Any other file whose first line is a SIMIS header is recognized by that line, unless another language already claims its extension.

Only text SIMIS files are formatted. Binary and compressed files, such as most shapes (`.s`) and world files (`.w`) of MSTS, are not changed. Decompress them first.

## Usage

Open a file and run **Format Document** (Shift+Alt+F on Windows). To format SIMIS files whenever they are saved, add this to your settings:

```json
"[simis]": {
    "editor.formatOnSave": true
}
```

Files are indented with tabs, as MSTS writes them. VS Code detects the indentation of each file it opens (`editor.detectIndentation`), so a file indented with spaces keeps its spaces. To indent every SIMIS file with tabs, turn the detection off for SIMIS files:

```json
"[simis]": {
    "editor.detectIndentation": false
}
```

## Settings

| Setting | Default | Description |
|---|---|---|
| `simisFormatter.preserveQuotes` | `true` | Keep the quotes of values that were quoted in the file. When off, quotes are written only where a value needs them, such as a value with a space, or where removing them would change the meaning, such as strings joined with `+`. |
| `simisFormatter.preserveComments` | `true` | Keep comment blocks: `comment ( ... )`, `skip ( ... )` and blocks whose name starts with `#` or `_`. When off, they are removed. |
| `simisFormatter.preserveCommentPosition` | `true` | Keep a comment block on the same line as the value or block before it, where it was on the same line in the file. |
| `simisFormatter.preserveEmptyLines` | `true` | Keep the blank lines of the file. |
| `simisFormatter.collapseEmptyLines` | `true` | Write several blank lines in a row as one. |
| `simisFormatter.ignoreCase` | `true` | Ignore letter case when matching the paths in `inline` and `table`, as MSTS and Open Rails ignore it. |
| `simisFormatter.inline` | `InertiaTensor`, `Conditions` and the triggers of sound files | Paths of blocks that are written on one line, together with everything in them. |
| `simisFormatter.table` | `ThrottleRPMTab`, `CurvePoints/*` and other tables of engines, wagons and activities | Blocks whose values are written in rows with a fixed number of columns. |

A path is a list of block names separated by `/`, where the last name is the block and each name before it is the next block around it, such as `Engine/MaxPower`. A path that starts with `/` starts at the top of the file. `*` matches any text and `?` any one character.

Each entry of `simisFormatter.table` has:

- **name**: the path of the blocks.
- **columns**: the number of columns, such as `"2"`, or a path from the block to the value that holds the number, such as `"../[2]"`.
- **columnSeparator**: the text between columns. Default: a space.
- **offset**: the number of values written before the table, such as a row count. Default: 0.
- **fixedWidth**: pad values so that the columns line up. Default: false.

```json
"simisFormatter.table": [
    { "name": "ThrottleRPMTab", "columns": "2", "fixedWidth": true },
    { "name": "CurvePoints/*", "columns": "2", "fixedWidth": true, "offset": 1 }
]
```

Setting `simisFormatter.inline` or `simisFormatter.table` replaces the whole default list, so copy the entries you want to keep from the default value, which the settings editor shows.

## Encodings

MSTS writes its files in UTF-16 with a byte order mark. VS Code reads such files and saves them in the same encoding, and the formatter does not change it. A file saved in an ANSI code page, such as Windows-1250 for Central European text, must be opened in that encoding: reopen it with **Change File Encoding**, or set `files.encoding` for SIMIS files.

## Limitations

- A file with an extra or a missing closing parenthesis, or with unbalanced quotes, is not formatted, although MSTS and Open Rails read it. A warning shows the line of the problem.
- Formatting keeps the content of a file, but not its layout: indentation, spacing and line breaks are rewritten.
- The Open Rails `include` directive is formatted as an ordinary block. The included file is not formatted.
- The help texts in the `GLOBAL` folder of MSTS are SIMIS files with the extension `.txt`, which belongs to plain text. To format them, add `"files.associations": { "**/GLOBAL/*.txt": "simis" }` to your settings.
- Some of the extensions, such as `.env`, `.s` and `.w`, are also used by other languages. A file that does not start with a SIMIS header is never changed, and `files.associations` can give such files their language back.

## Differences from SimisSharp

The formatter writes the same text as SimisSharp, except for line endings: it keeps the line endings of the document, while SimisSharp always writes CRLF.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
