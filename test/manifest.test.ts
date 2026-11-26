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
 * The parts of package.json that the tests read.
 */
interface Manifest {
    activationEvents?: string[];
    capabilities?: {
        untrustedWorkspaces?: {
            supported?: boolean | 'limited';
        };
    };
    contributes: {
        configuration: {
            properties: Record<string, Setting>;
        };
    };
}

/**
 * Reads package.json.
 */
function readManifest(): Manifest {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as Manifest;
}

/**
 * The contributed settings by name without the `simisFormatter.` prefix.
 */
function readSettings(): Map<string, Setting> {
    const properties = readManifest().contributes.configuration.properties;
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

    it('starts the extension when a SIMIS document is opened', () => {
        // Arrange
        const manifest = readManifest();

        // Act
        const activationEvents = manifest.activationEvents ?? [];

        // Assert
        // VS Code adds onLanguage:simis by itself only for a language with a configuration file, which the language simis does not have.
        expect(activationEvents).toContain('onLanguage:simis');
    });

    it('supports untrusted workspaces, so that VS Code keeps the extension on in Restricted Mode', () => {
        // Arrange
        const manifest = readManifest();

        // Act
        const supported = manifest.capabilities?.untrustedWorkspaces?.supported;

        // Assert
        expect(supported).toBe(true);
    });
});
