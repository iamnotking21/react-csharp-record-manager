// Pure-logic tests for the client's record helpers.
// Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canSave,
  findSelected,
  groupByStatus,
  isDirty,
  replaceRecord,
} from '../client/src/lib/records.js';

const seed = () => [
  { id: 1, name: 'Client Portal Redesign', category: 'Web', status: 'Active', description: 'a' },
  { id: 2, name: 'Payroll Migration', category: 'Internal', status: 'On Hold', description: 'b' },
  { id: 3, name: 'Mobile App v2', category: 'Mobile', status: 'Active', description: 'c' },
  { id: 4, name: 'Data Warehouse Cleanup', category: 'Data', status: 'Completed', description: 'd' },
  { id: 5, name: 'Security Audit 2026', category: 'Compliance', status: 'Active', description: 'e' },
  { id: 6, name: 'Onboarding Automation', category: 'Internal', status: 'Completed', description: 'f' },
];

test('replaceRecord swaps the matching row and returns a new array', () => {
  const records = seed();
  const updated = { ...records[1], status: 'Active' };
  const next = replaceRecord(records, updated);

  assert.notEqual(next, records, 'must return a new array');
  assert.equal(next.length, records.length);
  assert.equal(next[1].status, 'Active');
  assert.equal(next[1], updated, 'the replaced slot holds the new object');
});

test('replaceRecord never mutates the input array or its records', () => {
  const records = seed();
  const snapshot = structuredClone(records);
  const identities = records.map((r) => r);

  replaceRecord(records, { ...records[0], name: 'Changed' });

  assert.deepEqual(records, snapshot, 'input array unchanged');
  records.forEach((r, i) => assert.equal(r, identities[i], 'no record object replaced in place'));
});

test('replaceRecord leaves untouched rows referentially identical', () => {
  const records = seed();
  const next = replaceRecord(records, { ...records[2], name: 'New' });

  next.forEach((r, i) => {
    if (i === 2) assert.notEqual(r, records[i]);
    else assert.equal(r, records[i], 'unchanged rows keep their identity');
  });
});

test('replaceRecord is a no-op for an unknown id', () => {
  const records = seed();
  const next = replaceRecord(records, { id: 999, name: 'Ghost' });
  assert.deepEqual(next, records);
});

test('groupByStatus counts the seed data as 3 Active / 2 Completed / 1 On Hold', () => {
  assert.deepEqual(groupByStatus(seed()), { Active: 3, 'On Hold': 1, Completed: 2 });
});

test('groupByStatus follows an edited status', () => {
  const records = replaceRecord(seed(), { ...seed()[1], status: 'Active' });
  assert.deepEqual(groupByStatus(records), { Active: 4, Completed: 2 });
});

test('groupByStatus of an empty list is an empty object', () => {
  assert.deepEqual(groupByStatus([]), {});
});

test('findSelected returns the record, or null for no/stale selection', () => {
  const records = seed();
  assert.equal(findSelected(records, 3).name, 'Mobile App v2');
  assert.equal(findSelected(records, null), null);
  assert.equal(findSelected(records, 999), null);
});

test('isDirty is false for an untouched draft copy', () => {
  const original = seed()[0];
  assert.equal(isDirty({ ...original }, original), false);
});

test('isDirty detects a change in every editable field', () => {
  const original = seed()[0];
  for (const field of ['name', 'category', 'status', 'description']) {
    assert.equal(isDirty({ ...original, [field]: 'x' }, original), true, `${field} not detected`);
  }
});

test('isDirty is false when either side is missing', () => {
  assert.equal(isDirty(null, seed()[0]), false);
  assert.equal(isDirty(seed()[0], null), false);
});

test('canSave requires a change, a non-blank name, and no save in flight', () => {
  const original = seed()[0];
  const changed = { ...original, name: 'Renamed' };

  assert.equal(canSave(changed, original, false), true);
  assert.equal(canSave({ ...original }, original, false), false, 'unchanged draft');
  assert.equal(canSave(changed, original, true), false, 'save already in flight');
  assert.equal(canSave({ ...original, name: '   ' }, original, false), false, 'blank name');
});
