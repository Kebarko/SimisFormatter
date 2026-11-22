import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createWriterOptions } from '../src/core';

/**
 * A setting contributed in package.json.
 */
interface Setting {
    type: string;
    default: unknown;
}

/**
 * The contributed settings by name without the `simisFormatter.` prefix.
 */
function readSettings(): Map<string, Setting> {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const properties: Record<string, Setting> = manifest.contributes.configuration.properties;
    return new Map(Object.entries(properties).map(([key, setting]) => [key.replace(/^simisFormatter\./, ''), setting]));
}

describe('package.json', () => {
    it('has a setting for every writer option except the indentation', () => {
        // Arrange
        const options = Object.keys(createWriterOptions()).filter((key) => key !== 'indentSize' && key !== 'indentCharacter');

        // Act
        const settings = [...readSettings().keys()];

        // Assert
        expect(settings.sort()).toEqual(options.sort());
    });

    it('gives the boolean settings the defaults of SimisSharp', () => {
        // Arrange
        const defaults: Record<string, unknown> = { ...createWriterOptions() };

        // Act
        const booleans = [...readSettings()].filter(([, setting]) => setting.type === 'boolean');

        // Assert
        expect(booleans.length).toBeGreaterThan(0);
        for (const [key, setting] of booleans) {
            expect(setting.default, key).toBe(defaults[key]);
        }
    });
});
