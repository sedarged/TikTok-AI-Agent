import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRuns, patchRun } from '../api/client';
import type { Run } from '../api/types';
import { getErrorMessage } from '../utils/errors';
import { AnalyticsSkeleton } from '../components/SkeletonLoaders';

export default function Analytics() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    getRuns()
      .then(setRuns)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (
    runId: string,
    data: {
      views?: number;
      likes?: number;
      retention?: number;
      postedAt?: string | null;
      scheduledPublishAt?: string | null;
      publishedAt?: string | null;
    }
  ) => {
    setSavingId(runId);
    try {
      const updated = await patchRun(runId, data);
      setRuns((prev) => prev.map((r) => (r.id === runId ? updated : r)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const totalViews = runs.reduce((sum, r) => sum + (r.views ?? 0), 0);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Analytics</h1>
        <p className="text-gray-400 text-sm mb-6">
          Edit views, likes, retention, posted date, and scheduled publish date for each run.
        </p>
        <AnalyticsSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Analytics</h1>
      <p className="text-gray-400 text-sm mb-6">
        Edit views, likes, retention, posted date, and scheduled publish date for each run. Data is
        manual entry. Use Calendar to view upcoming runs and export CSV.
      </p>

      {error && (
        <div
          className="mb-4 p-3 rounded-lg text-sm"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-danger)' }}
        >
          {error}
        </div>
      )}

      <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--color-surface-2)' }}>
        <span className="text-gray-400">Total views: </span>
        <span className="font-semibold">{totalViews}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: 'var(--color-border)' }}>
              <th className="py-2 pr-4 font-medium text-gray-400">Topic</th>
              <th className="py-2 pr-4 font-medium text-gray-400">Niche</th>
              <th className="py-2 pr-4 font-medium text-gray-400">Status</th>
              <th className="py-2 pr-4 font-medium text-gray-400">Views</th>
              <th className="py-2 pr-4 font-medium text-gray-400">Likes</th>
              <th className="py-2 pr-4 font-medium text-gray-400">Retention</th>
              <th className="py-2 pr-4 font-medium text-gray-400">Posted at</th>
              <th className="py-2 pr-4 font-medium text-gray-400">Scheduled at</th>
              <th className="py-2 font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <RunRow key={run.id} run={run} onSave={handleSave} saving={savingId === run.id} />
            ))}
          </tbody>
        </table>
      </div>

      {runs.length === 0 && (
        <p className="text-gray-400 mt-6">
          No runs yet. Create a project and render to see runs here.
        </p>
      )}
    </div>
  );
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function RunRow({
  run,
  onSave,
  saving,
}: {
  run: Run;
  onSave: (
    runId: string,
    data: {
      views?: number;
      likes?: number;
      retention?: number;
      postedAt?: string | null;
      scheduledPublishAt?: string | null;
      publishedAt?: string | null;
    }
  ) => void;
  saving: boolean;
}) {
  const [views, setViews] = useState(String(run.views ?? ''));
  const [likes, setLikes] = useState(String(run.likes ?? ''));
  const [retention, setRetention] = useState(String(run.retention ?? ''));
  const [postedAt, setPostedAt] = useState(() => toDatetimeLocal(run.postedAt));
  const [scheduledAt, setScheduledAt] = useState(() => toDatetimeLocal(run.scheduledPublishAt));

  const topic = run.project?.topic ?? run.projectId;
  const niche = run.project?.nichePackId ?? '—';

  const handleSaveRow = () => {
    const v = views.trim() ? parseInt(views, 10) : undefined;
    const l = likes.trim() ? parseInt(likes, 10) : undefined;
    const ret = retention.trim() ? parseFloat(retention) : undefined;
    const posted = postedAt.trim() ? new Date(postedAt.trim()).toISOString() : undefined;
    const scheduled = scheduledAt.trim() ? new Date(scheduledAt.trim()).toISOString() : undefined;
    if (v !== undefined && isNaN(v)) return;
    if (l !== undefined && isNaN(l)) return;
    if (ret !== undefined && (isNaN(ret) || ret < 0 || ret > 1)) return;
    onSave(run.id, {
      views: v,
      likes: l,
      retention: ret,
      postedAt: posted ?? null,
      scheduledPublishAt: scheduled ?? null,
    });
  };

  return (
    <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
      <td className="py-2 pr-4 max-w-[180px] truncate" title={topic}>
        <Link
          to={`/run/${run.id}`}
          className="hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          {topic || '—'}
        </Link>
      </td>
      <td className="py-2 pr-4 text-gray-300">{niche}</td>
      <td className="py-2 pr-4 text-gray-300">{run.status}</td>
      <td className="py-2 pr-4">
        <input
          type="number"
          min={0}
          className="input w-20"
          value={views}
          onChange={(e) => setViews(e.target.value)}
        />
      </td>
      <td className="py-2 pr-4">
        <input
          type="number"
          min={0}
          className="input w-20"
          value={likes}
          onChange={(e) => setLikes(e.target.value)}
        />
      </td>
      <td className="py-2 pr-4">
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          className="input w-20"
          placeholder="0–1"
          value={retention}
          onChange={(e) => setRetention(e.target.value)}
        />
      </td>
      <td className="py-2 pr-4">
        <input
          type="datetime-local"
          className="input w-44"
          value={postedAt}
          onChange={(e) => setPostedAt(e.target.value)}
        />
      </td>
      <td className="py-2 pr-4">
        <input
          type="datetime-local"
          className="input w-44"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </td>
      <td className="py-2">
        <button
          type="button"
          onClick={handleSaveRow}
          disabled={saving}
          className="btn btn-secondary text-sm"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </td>
    </tr>
  );
}
