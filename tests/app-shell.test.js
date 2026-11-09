import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = fileURLToPath(new URL('../public/', import.meta.url));

function files(dir) {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
}

test('Offline-Start: jede App-Datei steht im Service Worker', () => {
  const sw = readFileSync(join(pub, 'sw.js'), 'utf8');
  const missing = files(pub)
    .map((f) => relative(pub, f))
    .filter((f) => /\.(js|css|html|png|svg|webmanifest)$/.test(f) && f !== 'sw.js' && !/\.local(\.example)?\.js$/.test(f))
    .filter((f) => !sw.includes(`'${f}'`));
  assert.deepEqual(missing, []);
});

test('Kein Regex-Lookbehind (stürzt auf iPhones mit Safari < 16.4 ab)', () => {
  const bad = files(join(pub, 'js')).filter((f) => /\(\?<[=!]/.test(readFileSync(f, 'utf8'))).map((f) => relative(pub, f));
  assert.deepEqual(bad, []);
});

test('Manifest verweist nur auf vorhandene Symbole', () => {
  const m = JSON.parse(readFileSync(join(pub, 'manifest.webmanifest'), 'utf8'));
  for (const i of m.icons) assert.ok(statSync(join(pub, i.src)).isFile(), i.src);
});
