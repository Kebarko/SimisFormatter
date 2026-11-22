// Bundles the extension into dist/extension.js.
// Usage: node esbuild.mjs [--production] [--watch]
import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const context = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    // VS Code 1.90, the oldest version the extension supports, runs extensions on Node 20.
    target: 'node20',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    sourcemap: !production,
    sourcesContent: false,
    minify: production,
    logLevel: 'info',
});

if (watch) {
    await context.watch();
} else {
    await context.rebuild();
    await context.dispose();
}
