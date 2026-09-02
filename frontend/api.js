const API_BASE = 'http://localhost:5000/api';

export async function fetchMetrics() {
    const res = await fetch(`${API_BASE}/metrics`);
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
}

export async function triggerSeed() {
    const res = await fetch(`${API_BASE}/seed`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to trigger seed');
    return res.json();
}
