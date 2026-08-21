export default function SummaryBar({ total, selectedCount, byStatus }) {
  const statuses = Object.entries(byStatus).sort(([a], [b]) => a.localeCompare(b));

  return (
    <section className="summary" aria-label="Summary">
      <div className="summary__stat">
        <span className="summary__label">Total records</span>
        <span className="summary__value">{total}</span>
      </div>

      <div className="summary__stat">
        <span className="summary__label">Selected</span>
        <span className="summary__value">{selectedCount}</span>
      </div>

      <div className="summary__stat summary__stat--wide">
        <span className="summary__label">By status</span>
        <span className="summary__groups">
          {statuses.length === 0 && <em>none</em>}
          {statuses.map(([status, count]) => (
            <span key={status} className="summary__group">
              {status}: <strong>{count}</strong>
            </span>
          ))}
        </span>
      </div>
    </section>
  );
}
