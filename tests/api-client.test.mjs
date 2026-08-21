// Tests the client's fetch wrapper against a stubbed global fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecords, updateRecord } from '../client/src/api.js';

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  return calls;
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

test('getRecords calls the records endpoint on port 5080', async () => {
  const calls = stubFetch(() => ok([{ id: 1 }]));
  const result = await getRecords();

  assert.equal(calls[0].url, 'http://localhost:5080/api/records');
  assert.deepEqual(result, [{ id: 1 }]);
});

test('updateRecord PUTs JSON to the record id', async () => {
  const calls = stubFetch(() => ok({ id: 2, name: 'Renamed' }));
  await updateRecord(2, {
    id: 2,
    name: 'Renamed',
    category: 'Internal',
    status: 'Active',
    description: 'd',
  });

  const { url, options } = calls[0];
  assert.equal(url, 'http://localhost:5080/api/records/2');
  assert.equal(options.method, 'PUT');
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(options.body), {
    name: 'Renamed',
    category: 'Internal',
    status: 'Active',
    description: 'd',
  });
});

test('updateRecord omits id from the body so the route stays authoritative', async () => {
  const calls = stubFetch(() => ok({ id: 2 }));
  await updateRecord(2, { id: 99, name: 'n', category: 'c', status: 's', description: 'd' });

  assert.equal('id' in JSON.parse(calls[0].options.body), false);
});

test('a non-2xx response throws with the method, path and status', async () => {
  stubFetch(() => ({ ok: false, status: 404, json: async () => ({}) }));

  await assert.rejects(
    () => updateRecord(999, { name: 'n', category: '', status: '', description: '' }),
    /PUT \/api\/records\/999 failed \(404\)/,
  );
});

test('a network failure propagates so the UI can show its hint', async () => {
  stubFetch(() => {
    throw new TypeError('Failed to fetch');
  });

  await assert.rejects(() => getRecords(), /Failed to fetch/);
});
