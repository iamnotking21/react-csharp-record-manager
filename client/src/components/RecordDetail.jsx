import { useState } from 'react';

const STATUSES = ['Active', 'On Hold', 'Completed'];

export default function RecordDetail({ selected, onSave }) {
  // Local editable copy. Typing never touches the canonical record, so the
  // list and the summary stay unchanged until Save succeeds.
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [syncedFrom, setSyncedFrom] = useState(null);

  // Re-seed the draft during render whenever the incoming record changes
  // identity - a different row was picked, or a save returned a fresh object.
  // Adjusting state in render (rather than in an effect) avoids a second
  // render pass and keeps the draft from ever showing a stale record.
  if (selected !== syncedFrom) {
    setSyncedFrom(selected);
    setDraft(selected ? { ...selected } : null);
    setSaveError(null);
  }

  if (!draft) {
    return (
      <section className="panel">
        <h2 className="panel__title">Details</h2>
        <p className="panel__empty">Select a record to view details.</p>
      </section>
    );
  }

  const dirty =
    selected !== null &&
    (draft.name !== selected.name ||
      draft.category !== selected.category ||
      draft.status !== selected.status ||
      draft.description !== selected.description);

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <h2 className="panel__title">Details</h2>

      <form className="form" onSubmit={handleSubmit}>
        <label className="form__field">
          <span>Name</span>
          <input
            type="text"
            value={draft.name}
            onChange={(event) => setField('name', event.target.value)}
            required
          />
        </label>

        <label className="form__field">
          <span>Category</span>
          <input
            type="text"
            value={draft.category}
            onChange={(event) => setField('category', event.target.value)}
          />
        </label>

        <label className="form__field">
          <span>Status</span>
          <select
            value={draft.status}
            onChange={(event) => setField('status', event.target.value)}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="form__field">
          <span>Description</span>
          <textarea
            rows={4}
            value={draft.description}
            onChange={(event) => setField('description', event.target.value)}
          />
        </label>

        <div className="form__actions">
          <button type="submit" disabled={!dirty || saving || !draft.name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {dirty && !saving && <span className="form__hint">Unsaved changes</span>}
        </div>

        {saveError && (
          <p className="app__status app__status--error" role="alert">
            {saveError}
          </p>
        )}
      </form>
    </section>
  );
}
