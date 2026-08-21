import { useCallback, useEffect, useMemo, useState } from 'react';
import RecordList from './components/RecordList';
import RecordDetail from './components/RecordDetail';
import SummaryBar from './components/SummaryBar';
import { getRecords, updateRecord } from './api';
import './App.css';

export default function App() {
  // Canonical list lives here, so the list, the detail panel and the summary
  // all read from one source of truth.
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    getRecords()
      .then((data) => {
        if (cancelled) return;
        setRecords(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(`${err.message}. Is the API running on http://localhost:5080?`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Derived output - computed from records, never stored in state, so the
  // counts can never drift out of sync with the list.
  const total = records.length;
  const selectedCount = selectedId === null ? 0 : 1;
  const selected = records.find((r) => r.id === selectedId) ?? null;

  const byStatus = useMemo(
    () =>
      records.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {}),
    [records],
  );

  const handleSave = useCallback(async (draft) => {
    const saved = await updateRecord(draft.id, draft);
    // Immutable replace: new array, new object reference for the saved row.
    setRecords((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    return saved;
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Record Manager</h1>
        <p className="app__subtitle">
          React front end over a C# Minimal API with an in-memory store.
        </p>
      </header>

      <SummaryBar total={total} selectedCount={selectedCount} byStatus={byStatus} />

      {loading && <p className="app__status">Loading records…</p>}
      {error && (
        <p className="app__status app__status--error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <main className="app__panels">
          <RecordList
            records={records}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <RecordDetail selected={selected} onSave={handleSave} />
        </main>
      )}
    </div>
  );
}
