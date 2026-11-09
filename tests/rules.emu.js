// Prüft firestore.rules gegen den Firestore-Emulator (npm run test:rules).
// Der Emulator akzeptiert unsignierte Test-Tokens – echte Konten oder Daten sind nicht beteiligt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

// Die freigeschalteten Adressen stehen nur in firestore.rules (nicht im Repo) – der Test liest sie von dort.
const rulesFile = new URL(existsSync(new URL('../firestore.rules', import.meta.url)) ? '../firestore.rules' : '../firestore.rules.example', import.meta.url);
const allowed = [...readFileSync(rulesFile, 'utf8').matchAll(/"([^"\s]+@[^"\s]+)"/g)].map((m) => m[1]);
if (allowed.length < 1) throw new Error('Keine E-Mail-Adressen in firestore.rules gefunden');

const HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const PROJECT = 'demo-unsere-kueche';
const BASE = `http://${HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(email, verified = true) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, iat: now, exp: now + 3600, auth_time: now,
    sub: 'u-' + email.replace(/\W/g, ''), user_id: 'u-' + email.replace(/\W/g, ''), email, email_verified: verified,
    firebase: { sign_in_provider: 'google.com', identities: { email: [email] } },
  })}.`;
}

async function write(path, auth) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify({ fields: { title: { stringValue: 'Test' } } }),
  });
  return res.status;
}

async function read(path, auth) {
  const res = await fetch(`${BASE}/${path}`, { headers: auth ? { Authorization: `Bearer ${auth}` } : {} });
  return res.status;
}

const family = token(allowed[0]);
const partner = token(allowed[1] || allowed[0]);

test('Familie darf Haushalt, Sammlungen und Fotos lesen und schreiben', async () => {
  assert.equal(await write('households/kueche', family), 200);
  assert.equal(await write('households/kueche/recipes/r1', family), 200);
  assert.equal(await write('households/kueche/photos/p1', partner), 200);
  assert.equal(await read('households/kueche/recipes/r1', partner), 200);
  assert.equal(await read('households/kueche', family), 200);
});

test('Fremde Konten, unbestätigte Adressen und Gäste werden abgelehnt', async () => {
  const stranger = token('fremd@example.com');
  assert.equal(await read('households/kueche/recipes/r1', stranger), 403);
  assert.equal(await write('households/kueche/recipes/r2', stranger), 403);
  assert.equal(await read('households/kueche', token(allowed[0], false)), 403);
  assert.equal(await read('households/kueche/recipes/r1', null), 403);
  assert.equal(await write('households/kueche', null), 403);
});

test('Alles außerhalb des Haushalts ist gesperrt – auch für die Familie', async () => {
  assert.equal(await write('households/andere', family), 403);
  assert.equal(await write('households/andere/recipes/x', family), 403);
  assert.equal(await write('irgendwas/x', family), 403);
});
