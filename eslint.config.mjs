import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
    {
        ignores: ['dist/', 'out/', '.vscode-test/', '.corpus/', 'node_modules/', 'tools/SimisSharpReference/'],
    },
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        rules: {
            curly: 'error',
            eqeqeq: 'error',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
    {
        // Configuration files and scripts that run in Node.
        files: ['**/*.mjs', 'tools/**/*.ts'],
        languageOptions: {
            globals: globals.node,
        },
    },
);
