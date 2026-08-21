// End-to-end contract tests against the real C# Minimal API.
//
// Starts `dotnet run` in ./server, waits for port 5080, exercises every
// endpoint, then shuts it down. This is the test that catches the
// "Failed to fetch. Is the API running on http://localhost:5080?" symptom:
// if the .NET SDK is missing or the API will not boot, it fails here with a
// message that says exactly what to do about it.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = 'http://localhost:5080';
const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'server');
const BOOT_TIMEOUT_MS = 90_000;

let child = null;
let startedByUs = false;

async function isUp() {
  try {
    const res = await fetch(`${BASE}/api/records`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function hasDotnet() {
  const probe = spawn('dotnet', ['--version'], { shell: true, stdio: 'ignore' });
  const [code] = await once(probe, 'close');
  return code === 0;
}

before(async () => {
  if (await isUp()) return; // already running, reuse it

  assert.ok(
    await hasDotnet(),
    'The .NET SDK is not installed, so the API cannot start and every fetch from ' +
      'the client will fail with "Failed to fetch". Install .NET 8 ' +
      '(winget install Microsoft.DotNet.SDK.8), reopen the terminal, then re-run.',
  );

  child = spawn('dotnet', ['run'], { cwd: SERVER_DIR, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  startedByUs = true;

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isUp()) return;
    if (child.exitCode !== null) {
      assert.fail(`The API exited with code ${child.exitCode} before serving. Output:\n${log}`);
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  assert.fail(`The API did not answer on ${BASE} within ${BOOT_TIMEOUT_MS}ms. Output:\n${log}`);
}, { timeout: BOOT_TIMEOUT_MS + 10_000 });

after(() => {
  if (startedByUs && child?.exitCode === null) child.kill();
});

test('GET /api/records returns the six seeded records in camelCase', async () => {
  const res = await fetch(`${BASE}/api/records`);
  assert.equal(res.status, 200);

  const records = await res.json();
  assert.equal(records.length, 6);
  assert.deepEqual(
    Object.keys(records[0]).sort(),
    ['category', 'description', 'id', 'name', 'status'],
    'the client reads camelCase keys',
  );
  assert.deepEqual(
    records.map((r) => r.id),
    [1, 2, 3, 4, 5, 6],
  );
});

test('the seed data is 3 Active / 2 Completed / 1 On Hold', async () => {
  const records = await (await fetch(`${BASE}/api/records`)).json();
  const byStatus = records.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  assert.deepEqual(byStatus, { Active: 3, 'On Hold': 1, Completed: 2 });
});

test('GET /api/records/{id} returns one record, 404 when missing', async () => {
  const found = await fetch(`${BASE}/api/records/3`);
  assert.equal(found.status, 200);
  assert.equal((await found.json()).name, 'Mobile App v2');

  const missing = await fetch(`${BASE}/api/records/999`);
  assert.equal(missing.status, 404);
});

test('PUT /api/records/{id} updates the record and the change persists', async () => {
  const payload = {
    name: 'Payroll Migration (contract test)',
    category: 'Internal',
    status: 'Active',
    description: 'Edited by the contract test.',
  };

  const put = await fetch(`${BASE}/api/records/2`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  assert.equal(put.status, 200);

  const returned = await put.json();
  assert.equal(returned.id, 2, 'the id comes from the route');
  assert.deepEqual({ ...returned, id: undefined }, { ...payload, id: undefined });

  // Re-read: the server must have mutated its stored list, not a copy.
  const reread = await (await fetch(`${BASE}/api/records/2`)).json();
  assert.deepEqual(reread, returned);

  const byStatus = (await (await fetch(`${BASE}/api/records`)).json()).reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {},
  );
  assert.deepEqual(byStatus, { Active: 4, Completed: 2 }, 'derived counts follow the edit');
});

test('PUT ignores an id in the body and cannot re-key a record', async () => {
  const res = await fetch(`${BASE}/api/records/3`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 99, name: 'Mobile App v2', category: 'Mobile', status: 'Active', description: 'c' }),
  });

  assert.equal((await res.json()).id, 3);
  assert.equal((await fetch(`${BASE}/api/records/99`)).status, 404);
});

test('PUT trims whitespace and rejects a blank name with 400', async () => {
  const trimmed = await fetch(`${BASE}/api/records/5`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '  Security Audit 2026  ', category: ' Compliance ', status: ' Active ', description: ' e ' }),
  });
  const body = await trimmed.json();
  assert.equal(body.name, 'Security Audit 2026');
  assert.equal(body.category, 'Compliance');

  const blank = await fetch(`${BASE}/api/records/5`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '   ', category: 'x', status: 'Active', description: '' }),
  });
  assert.equal(blank.status, 400);
});

test('PUT to an unknown id is 404', async () => {
  const res = await fetch(`${BASE}/api/records/999`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ghost', category: '', status: 'Active', description: '' }),
  });
  assert.equal(res.status, 404);
});

test('CORS allows the Vite dev origin', async () => {
  const res = await fetch(`${BASE}/api/records`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});
