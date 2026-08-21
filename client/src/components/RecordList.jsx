export default function RecordList({ records, selectedId, onSelect }) {
  function handleKeyDown(event, id) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
    }
  }

  return (
    <section className="panel">
      <h2 className="panel__title">Records ({records.length})</h2>

      <div className="list" role="grid" aria-label="Records">
        <div className="list__head" role="row">
          <span role="columnheader">Name</span>
          <span role="columnheader">Category</span>
          <span role="columnheader">Status</span>
        </div>

        <div className="list__body">
          {records.map((record) => (
            // key is the stable server-side id, never the array index.
            <div
              key={record.id}
              role="row"
              tabIndex={0}
              aria-selected={record.id === selectedId}
              className={
                record.id === selectedId ? 'list__row list__row--selected' : 'list__row'
              }
              onClick={() => onSelect(record.id)}
              onKeyDown={(event) => handleKeyDown(event, record.id)}
            >
              <span role="gridcell">{record.name}</span>
              <span role="gridcell">{record.category}</span>
              <span role="gridcell">
                <span className={`badge badge--${record.status.replace(/\s+/g, '-').toLowerCase()}`}>
                  {record.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
