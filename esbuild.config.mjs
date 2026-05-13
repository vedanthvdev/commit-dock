import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const codiconsSrc = path.join(__dirname, 'node_modules', '@vscode', 'codicons', 'dist');
const codiconsDest = path.join(__dirname, 'dist', 'webview', 'codicons');

function copyCodicons() {
  if (!fs.existsSync(codiconsSrc)) {
    console.warn('Skipping codicons copy (run npm install).');
    return;
  }
  fs.mkdirSync(codiconsDest, { recursive: true });
  for (const file of ['codicon.css', 'codicon.ttf']) {
    const from = path.join(codiconsSrc, file);
    const to = path.join(codiconsDest, file);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, to);
    }
  }
}

async function run() {
  const extCtx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    sourcemap: !production,
    minify: production,
    external: ['vscode'],
    logLevel: 'info',
  });

  const webCtx = await esbuild.context({
    entryPoints: ['src/webview/main.ts'],
    bundle: true,
    outfile: 'dist/webview/main.js',
    platform: 'browser',
    target: 'es2022',
    format: 'iife',
    sourcemap: !production,
    minify: production,
    loader: { '.css': 'css' },
    logLevel: 'info',
  });

  const buildAll = async () => {
    await extCtx.rebuild();
    await webCtx.rebuild();
    copyCodicons();
  };

  if (watch) {
    await buildAll();
    await extCtx.watch();
    await webCtx.watch();
    console.log('Watching extension + webview…');
  } else {
    await buildAll();
    await extCtx.dispose();
    await webCtx.dispose();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
