/**
 * The header of an uncompressed file, which the subheader follows. A compressed file has another header in its place.
 */
const UNCOMPRESSED_HEADER = 'SIMISA@@@@@@@@@@';

/**
 * The start of the subheader: `JINX0`, which a two-character file type and the format letter follow, as in `JINX0D0t`.
 */
const SUBHEADER_START = 'JINX0';

/**
 * Index of the format letter in the subheader: `b` for binary or `t` for text.
 */
const FORMAT_INDEX = 7;

/**
 * Determines whether `text` starts with the header of a text SIMIS file, such as `SIMISA@@@@@@@@@@JINX0D0t______`.
 * SimisSharp loads only such files (see `SimisTextDecoder.CheckSubheader`), so the formatter formats only such text.
 * The header of a compressed file (`SIMISA@F`) and the subheader of a binary file (`JINX0D0b`) do not match.
 * @param text The text of the document, without the byte order mark, which VS Code removes when it reads a file.
 * @returns True when the text starts with `SIMISA@@@@@@@@@@JINX0`, two characters and `t`.
 */
export function isTextSimisHeader(text: string): boolean {
    if (!text.startsWith(UNCOMPRESSED_HEADER) || !text.startsWith(SUBHEADER_START, UNCOMPRESSED_HEADER.length)) {
        return false;
    }

    return text.charAt(UNCOMPRESSED_HEADER.length + FORMAT_INDEX) === 't';
}
