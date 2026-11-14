// Bundles src/ into a single self-contained dist/index.html
// (no server needed: double-click it, or load it in the cabinet's kiosk browser).
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');
mkdirSync('dist', { recursive: true });

function writeHtml(js) {
  const tpl = readFileSync('src/index.html', 'utf8');
  writeFileSync('dist/index.html', tpl.replace('/*__GAME__*/', () => js));
  console.log(`[build] dist/index.html (${(js.length / 1024).toFixed(1)} KB js)`);
}

const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: !watch,
  write: false,
  target: 'es2020',
  plugins: [{
    name: 'inline-html',
    setup(build) {
      build.onEnd((res) => {
        if (res.errors.length) return;
        writeHtml(res.outputFiles[0].text);
      });
    },
  }],
};

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log('[build] watching src/ ...');
} else {
  await esbuild.build(opts);
}
