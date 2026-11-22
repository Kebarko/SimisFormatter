// Formats every text SIMIS file of a folder with SimisSharp, as the reference for the corpus check of SimisFormatter (npm run corpus).
//
// Usage: SimisSharpReference <input folder> <output folder> <writer options JSON file>
//
// For each text SIMIS file it writes, as UTF-8 without a byte order mark:
//   <output folder>/input/<relative path>     the text of the file as SimisSharp decodes it,
//   <output folder>/expected/<relative path>  the text SimisSharp writes, when the file can be parsed,
// and <output folder>/results.json lists the result of each file. Files that are not text SIMIS files are skipped.
// Nothing is written to the input folder, and the output folder must not be inside it.

using System.Text;
using System.Text.Json;
using KE.MSTS.SimisSharp;
using KE.MSTS.SimisSharp.IO;

if (args.Length != 3)
{
    Console.Error.WriteLine("Usage: SimisSharpReference <input folder> <output folder> <writer options JSON file>");
    return 2;
}

string input = Path.GetFullPath(args[0]);
string output = Path.GetFullPath(args[1]);

if (!Directory.Exists(input))
{
    Console.Error.WriteLine($"The input folder {input} does not exist.");
    return 2;
}

if (IsSameOrInside(output, input))
{
    Console.Error.WriteLine($"The output folder {output} must not be inside the input folder {input}.");
    return 2;
}

WriterOptions options = JsonSerializer.Deserialize<WriterOptions>(File.ReadAllText(args[2])) ?? new();
SimisProcessor processor = new();
UTF8Encoding utf8 = new(encoderShouldEmitUTF8Identifier: false);
List<FileResult> results = [];

foreach (string file in Directory.EnumerateFiles(input, "*", SearchOption.AllDirectories).Order(StringComparer.OrdinalIgnoreCase))
{
    string relative = Path.GetRelativePath(input, file).Replace('\\', '/');

    string text;
    try
    {
        text = processor.LoadText(file);
    }
    catch (NotSupportedException)
    {
        // Not a text SIMIS file, such as a texture or a binary shape.
        continue;
    }
    catch (Exception ex) when (ex is FormatException or IOException or UnauthorizedAccessException)
    {
        results.Add(new FileResult(relative, "load-error", null, ex.Message));
        continue;
    }

    WriteText(Path.Combine(output, "input", relative), text);

    try
    {
        string formatted = processor.Save(processor.Parse(text), options);
        WriteText(Path.Combine(output, "expected", relative), formatted);
        results.Add(new FileResult(relative, "formatted", null, null));
    }
    catch (SimisParseException ex)
    {
        results.Add(new FileResult(relative, "parse-error", ex.Line, ex.Message));
    }
}

JsonSerializerOptions jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = true };
Directory.CreateDirectory(output);
File.WriteAllText(Path.Combine(output, "results.json"), JsonSerializer.Serialize(results, jsonOptions), utf8);

Console.WriteLine($"SimisSharp read {results.Count} text SIMIS files: {results.Count(r => r.Status == "formatted")} formatted, "
    + $"{results.Count(r => r.Status == "parse-error")} not parsed, {results.Count(r => r.Status == "load-error")} not loaded.");
return 0;

// Writes text to a file as UTF-8 without a byte order mark, creating its folder.
void WriteText(string path, string text)
{
    Directory.CreateDirectory(Path.GetDirectoryName(path)!);
    File.WriteAllText(path, text, utf8);
}

// Returns true when path is folder or a path inside it.
static bool IsSameOrInside(string path, string folder)
{
    string relative = Path.GetRelativePath(folder, path);
    return relative == "." || (!relative.StartsWith("..", StringComparison.Ordinal) && !Path.IsPathRooted(relative));
}

// The result of one file: its path relative to the input folder, its status, and the line and message of an error.
record FileResult(string Path, string Status, int? Line, string? Message);
