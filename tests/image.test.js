import test from 'node:test';
import assert from 'node:assert/strict';
import { fitSize, targetBytes, bestQuality, formatBytes, MAX_EDGE } from '../public/js/image.js';

test('Verkleinern auf die längste Seite, nie vergrößern', () => {
  assert.deepEqual(fitSize(4032, 3024, MAX_EDGE), [1280, 960]); // iPhone-Foto quer
  assert.deepEqual(fitSize(3024, 4032, MAX_EDGE), [960, 1280]); // hochkant
  assert.deepEqual(fitSize(800, 600, MAX_EDGE), [800, 600]); // kleines Bild bleibt
});

test('Zielgröße richtet sich nach der Bildfläche', () => {
  assert.equal(targetBytes(1280, 960), 135168);
  assert.equal(targetBytes(400, 300), 50000); // Untergrenze
  assert.equal(targetBytes(1280, 1280), 180224);
  assert.ok(targetBytes(1280, 1280) <= 190000);
});

// Nachgebautes Kodieren: Dateigröße wächst mit der Qualität.
const fakeEncoder = (bytesAtFull) => async (q) => ({ size: Math.round(bytesAtFull * q * q) });

test('Höchste Qualität, die ins Ziel passt', async () => {
  const r = await bestQuality(fakeEncoder(400_000), 135_000);
  assert.ok(r.blob.size <= 135_000);
  assert.ok(r.quality > 0.55 && r.quality < 0.6, `Qualität ${r.quality}`); // √(135/400) ≈ 0,58
  const small = await bestQuality(fakeEncoder(60_000), 135_000);
  assert.equal(small.quality, 0.86); // schon klein genug → beste Qualität
  const huge = await bestQuality(fakeEncoder(5_000_000), 135_000);
  assert.equal(huge.overTarget, true); // dann wird weiter verkleinert
});

test('Größen lesbar anzeigen', () => {
  assert.equal(formatBytes(4_400_000), '4,2 MB');
  assert.equal(formatBytes(138_000), '135 KB');
});
