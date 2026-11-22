import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/**/*.test.ts'],
        // The integration tests run inside VS Code (npm run test:vscode).
        exclude: ['test/vscode/**', 'node_modules/**'],
    },
});
