// Thin wrapper over fetch. No HTTP client package - fetch is built in.
const API_BASE = 'http://localhost:5080';

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`${options?.method ?? 'GET'} ${path} failed (${response.status})`);
  }

  return response.json();
}

export function getRecords() {
  return request('/api/records');
}

export function updateRecord(id, record) {
  return request(`/api/records/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: record.name,
      category: record.category,
      status: record.status,
      description: record.description,
    }),
  });
}
