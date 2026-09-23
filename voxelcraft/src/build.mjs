// Builds voxelcraft/index.html as ONE self-contained file.
// Bundle step uses esbuild; output has no external requests, so the file
// works when double-clicked (file://) as well as over http://.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

const result = await build({
  entryPoints: [join(root, 'game.js')],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: false,          // keep readable; the file is mostly three.js anyway
  write: false,
  legalComments: 'none',
});

const bundle = result.outputFiles[0].text;
const template = readFileSync(join(root, 'template.html'), 'utf8');

if (!template.includes('<script id="game-bundle"></script>')) {
  console.error('ERROR: template placeholder <script id="game-bundle"></script> not found');
  process.exit(1);
}

const html = template.replace(
  '<script id="game-bundle"></script>',
  '<script>\n' + bundle.replace(/<\/script/gi, '<\\/script') + '\n</script>'
);

const out = join(root, '..', 'index.html');
writeFileSync(out, html);

// sanity checks: no external requests, no module syntax left over
const external = html.match(/(?:src|href)\s*=\s*["'](https?:|\/\/|\.\/|\.\.\/)/g);
if (external) {
  console.error('ERROR: external references remain:', external);
  process.exit(1);
}
if (/<script[^>]*type\s*=\s*["']module["']/.test(html)) {
  console.error('ERROR: module script in output (breaks file://)');
  process.exit(1);
}
console.log(`OK  built ${out}  ${(html.length / 1024).toFixed(0)} KB, single file, no network needed`);
