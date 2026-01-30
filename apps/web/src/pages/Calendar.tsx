import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRunsUpcoming } from '../api/client';
import type { Run } from '../api/types';
import { getErrorMessage } from '../utils/errors';

function defaultFrom(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function defaultTo(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const mm = String(m + 1).padStart(2, '0');
  return `${y}-${mm}-${String(last).padStart(2, '0')}`;
}

export default function Calendar() {
  const [from, setFrom] = useState(() => defaultFrom());
  const [to, setTo] = useState(() => defaultTo());
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getRunsUpcoming(from, to)
      .then(setRuns)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [from, to]);

  const formatScheduled = (s: string | null | undefined) => {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  const exportCsv = () => {
    const base = window.location.origin;
    const header = 'topic,scheduledPublishAt,runId,link';
    const rows = runs.map((r) => {
      const topic = (r.project?.topic ?? '').replace(/"/g, '""');
      const s = r.scheduledPublishAt ?? '';
      const link = `${base}/run/${r.id}`;
      return `"${topic}","${s}","${r.id}","${link}"`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendar-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const topic = (r: Run) => r.project?.topic ?? r.projectId;

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Calendar</h1>
      <p className="text-gray-400 text-sm mb-6">
        Upcoming runs by scheduled publish date. Set scheduled date in Analytics.
      </p>

      {error && (
        <div
          className="mb-4 p-3 rounded-lg text-sm"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-danger)' }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label htmlFor="calendar-from" className="block text-sm font-medium text-gray-300 mb-1">
            From
          </label>
          <input
            id="calendar-from"
            type="date"
            className="input w-40"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="calendar-to" className="block text-sm font-medium text-gray-300 mb-1">
            To
          </label>
          <input
            id="calendar-to"
            type="date"
            className="input w-40"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={loading || runs.length === 0}
          className="btn btn-secondary"
        >
          Export CSV
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b" style={{ borderColor: 'var(--color-border)' }}>
                <th className="py-2 pr-4 font-medium text-gray-400">Topic</th>
                <th className="py-2 pr-4 font-medium text-gray-400">Scheduled</th>
                <th className="py-2 pr-4 font-medium text-gray-400">Run</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="py-2 pr-4 max-w-[220px] truncate" title={topic(r)}>
                    <Link
                      to={`/run/${r.id}`}
                      className="hover:underline"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {topic(r) || '—'}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-gray-300">
                    {formatScheduled(r.scheduledPublishAt ?? null)}
                  </td>
                  <td className="py-2 pr-4">
                    <Link
                      to={`/run/${r.id}`}
                      className="hover:underline text-xs"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {r.id.slice(0, 8)}…
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && runs.length === 0 && (
        <p className="text-gray-400 mt-6">
          No runs scheduled in this range. Set scheduled publish date in Analytics.
        </p>
      )}
    </div>
  );
}
