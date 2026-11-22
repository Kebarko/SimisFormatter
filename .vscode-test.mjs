// Configuration of the integration tests, which @vscode/test-cli runs in a downloaded VS Code.
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
    files: 'out/test/vscode/**/*.test.js',
    workspaceFolder: './test/fixtures',
    // Other installed extensions are disabled, so that they cannot claim the SIMIS file extensions.
    launchArgs: ['--disable-extensions'],
    mocha: {
        ui: 'tdd',
        timeout: 20000,
    },
});
