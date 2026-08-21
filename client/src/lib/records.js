// Pure helpers shared by App.jsx and the test suite. Kept free of React so
// the rules that matter most (immutability, derived counts) can be tested
// directly with node:test - no test framework, no extra packages.

/**
 * Replace one record by id, returning a new array. Never mutates the input
 * array or any record object inside it.
 */
export function replaceRecord(records, updated) {
  return records.map((record) => (record.id === updated.id ? updated : record));
}

/** Count of records grouped by status, e.g. { Active: 3, Completed: 2 }. */
export function groupByStatus(records) {
  return records.reduce((acc, record) => {
    acc[record.status] = (acc[record.status] ?? 0) + 1;
    return acc;
  }, {});
}

/** The selected record, or null when nothing is selected or the id is stale. */
export function findSelected(records, selectedId) {
  return records.find((record) => record.id === selectedId) ?? null;
}

/** True when the draft differs from the record it was seeded from. */
export function isDirty(draft, original) {
  if (!draft || !original) return false;
  return (
    draft.name !== original.name ||
    draft.category !== original.category ||
    draft.status !== original.status ||
    draft.description !== original.description
  );
}

/** A save is allowed only for a changed record with a non-blank name. */
export function canSave(draft, original, saving) {
  return isDirty(draft, original) && !saving && draft.name.trim() !== '';
}
