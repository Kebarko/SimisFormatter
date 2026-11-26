# Changelog

## Unreleased

- Starts when a SIMIS file is opened. Version 0.1.0 never started, so VS Code reported that there was no formatter for SIMIS files.
- Works in folders that are not trusted (Restricted Mode). Before, VS Code turned the extension off in such a folder, so its SIMIS files opened as plain text and could not be formatted.

## 0.1.0 (2026-11-22)

- Formats the text SIMIS files of MSTS and Open Rails, such as engines, wagons, consists and activities, with the rules of SimisSharp 0.1.0.
- Recognizes these files by their extension, their name or their first line.
- Keeps comment blocks, blank lines and quotes, writes tables such as `ThrottleRPMTab` in aligned columns, and can be configured in the `simisFormatter` settings.
