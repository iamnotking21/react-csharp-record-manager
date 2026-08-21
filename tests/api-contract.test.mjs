// End-to-end contract tests against the real C# Minimal API.
//
// Starts its own `dotnet run` in ./server on a private port, exercises every
// endpoint against the freshly seeded store, then shuts it down. This is the
// test that catches the "Failed to fetch. Is the API running?" symptom:
// if the .NET SDK is missing or the API will not boot, it fails here with a
// message that says exactly what to do about it.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// A private port, deliberately not the dev port. The tests assert absolute
// counts against the seed data, so they must never run against a long-running
// dev API whose in-memory store has already been edited by hand.
const PORT = 5081;
const BASE = `http://localhost:${PORT}`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_DIR = join(ROOT, 'server');
const ARTIFACTS_DIR = join(ROOT, '.test-artifacts');
// The first `dotnet run` restores and builds, which is slow on a cold machine.
const BOOT_TIMEOUT_MS = 60_000; // the build happens separately, before this clock starts
// The hook also restores and builds, which is slow the first time on a cold machine.
const SETUP_TIMEOUT_MS = 300_000;

/**
 * Resolve the dotnet executable without going through a shell. Spawning via a
 * shell would make `child.pid` the shell's, leaving the real server orphaned at
 * teardown and hanging the test runner. On Windows the SDK is often installed
 * after the current shell captured its PATH, so fall back to the default path.
 */
function resolveDotnet() {
  const fallback = process.platform === 'win32'
    ? join(process.env.ProgramFiles ?? 'C:\Program Files', 'dotnet', 'dotnet.exe')
    : '/usr/share/dotnet/dotnet';

  for (const candidate of ['dotnet', fallback]) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' });
      return candidate;
    } catch {
      if (candidate !== 'dotnet' && existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/** Kill the server and everything it spawned. `child.kill()` misses the tree. */
function killTree(pid) {
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch {
    // already gone
  }
}

let child = null;

async function isUp() {
  try {
    const res = await fetch(`${BASE}/api/records`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

before(async () => {
  assert.equal(
    await isUp(),
    false,
    `Something is already listening on ${BASE}. These tests need a freshly ` +
      'seeded API, so they start their own on this port rather than reusing one. ' +
      'Stop whatever is on it and re-run.',
  );

  const dotnet = resolveDotnet();
  assert.ok(
    dotnet,
    'The .NET SDK is not installed, so the API cannot start and every fetch from ' +
      'the client will fail with "Failed to fetch". Install .NET 8 ' +
      '(winget install --id Microsoft.DotNet.SDK.8 --source winget), reopen the ' +
      'terminal, then re-run.',
  );

  // Build into a private artifacts directory rather than server/bin. A running
  // dev server holds bin/.../server.exe open, and MSBuild fails with MSB3021
  // when it cannot overwrite it.
  try {
    execFileSync(dotnet, ['build', '--artifacts-path', ARTIFACTS_DIR], {
      cwd: SERVER_DIR,
      stdio: 'pipe',
    });
  } catch (err) {
    assert.fail(`The API failed to build.
${err.stdout ?? ''}${err.stderr ?? ''}`);
  }

  // Run the built DLL directly. `dotnet run --artifacts-path` still launches
  // server/bin/.../server.exe, which does not exist in a fresh clone.
  const dll = join(ARTIFACTS_DIR, 'bin', 'server', 'debug', 'server.dll');
  assert.ok(existsSync(dll), `Expected a built server at ${dll}`);

  child = spawn(dotnet, [dll], {
    cwd: SERVER_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    env: { ...process.env, ASPNETCORE_URLS: BASE },
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isUp()) return;
    if (child.exitCode !== null) {
      assert.fail(`The API exited with code ${child.exitCode} before serving. Output:\n${log}`);
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  assert.fail(`The API did not answer on ${BASE} within ${BOOT_TIMEOUT_MS}ms. Output:\n${log}`);
}, { timeout: SETUP_TIMEOUT_MS });

after(() => {
  if (child?.pid === undefined || child.exitCode !== null) return;
  killTree(child.pid);
  // Release the pipes so the runner's event loop can drain and node can exit.
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
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
