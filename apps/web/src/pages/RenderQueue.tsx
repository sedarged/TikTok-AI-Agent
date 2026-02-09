import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject, retryRun, cancelRun, subscribeToRun } from '../api/client';
import type { Project, Run, LogEntry, SSEEvent } from '../api/types';
import { getErrorMessage } from '../utils/errors';
import { safeJsonParse } from '../utils/safeJsonParse';
import { RunListSkeleton } from '../components/SkeletonLoaders';

export default function RenderQueue() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const controller = new AbortController();
    const { signal } = controller;

    getProject(projectId, { signal })
      .then((proj) => {
        if (signal.aborted) return;
        setProject(proj);
        setRuns(proj.runs || []);
      })
      .catch((err) => {
        if (signal.aborted) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [projectId]);

  const handleRetry = async (runId: string) => {
    if (actionInProgress === runId) return;

    setActionInProgress(runId);
    try {
      const retriedRun = await retryRun(runId);
      setRuns((prev) => prev.map((r) => (r.id === runId ? retriedRun : r)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCancel = async (runId: string) => {
    if (actionInProgress === runId) return;

    setActionInProgress(runId);
    try {
      await cancelRun(runId);
      setRuns((prev) =>
        prev.map((r) => (r.id === runId ? { ...r, status: 'canceled' as const } : r))
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionInProgress(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      queued: 'badge-info',
      running: 'badge-warning',
      done: 'badge-success',
      failed: 'badge-error',
      canceled: 'badge-error',
      qa_failed: 'badge-warning',
    };
    return styles[status] || 'badge-info';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Render Queue</h1>
            <div className="h-4 rounded w-48 mt-2" style={{ background: 'var(--color-border)' }} />
          </div>
          <div className="h-9 rounded w-32" style={{ background: 'var(--color-border)' }} />
        </div>
        <RunListSkeleton count={3} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Project not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Render Queue</h1>
          <p className="text-gray-400">{project.title}</p>
        </div>
        <Link to={`/project/${projectId}/plan`} className="btn btn-secondary w-full sm:w-auto">
          Back to Plan
        </Link>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 mb-4">No render runs yet</p>
          <Link to={`/project/${projectId}/plan`} className="btn btn-primary w-full sm:w-auto">
            Go to Plan Studio
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              onRetry={() => handleRetry(run.id)}
              onCancel={() => handleCancel(run.id)}
              getStatusBadge={getStatusBadge}
              isActionInProgress={actionInProgress === run.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RunCard({
  run,
  onRetry,
  onCancel,
  getStatusBadge,
  isActionInProgress = false,
}: {
  run: Run;
  onRetry: () => void;
  onCancel: () => void;
  getStatusBadge: (status: string) => string;
  isActionInProgress?: boolean;
}) {
  const [currentRun, setCurrentRun] = useState(run);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    setLogs(safeJsonParse<LogEntry[]>(run.logsJson || '[]', []));
  }, [run.logsJson]);

  // SSE subscription when run is active; reconnect in client; unsubscribe when status leaves running/queued
  useEffect(() => {
    if (run.status !== 'running' && run.status !== 'queued') return;

    const unsubscribe = subscribeToRun(run.id, (event: SSEEvent) => {
      if (event.type === 'progress') {
        setCurrentRun((prev) => ({ ...prev, progress: event.progress || 0 }));
      } else if (event.type === 'step') {
        setCurrentRun((prev) => ({ ...prev, currentStep: event.step || '' }));
      } else if (event.type === 'log' && event.log) {
        setLogs((prev) => [...prev, event.log!]);
      } else if (event.type === 'done') {
        setCurrentRun((prev) => ({ ...prev, status: 'done', progress: 100 }));
      } else if (event.type === 'failed') {
        setCurrentRun((prev) => ({ ...prev, status: 'failed' }));
      } else if (event.type === 'state') {
        if (event.status) setCurrentRun((prev) => ({ ...prev, status: event.status! }));
        if (event.progress !== undefined)
          setCurrentRun((prev) => ({ ...prev, progress: event.progress! }));
        if (event.currentStep)
          setCurrentRun((prev) => ({ ...prev, currentStep: event.currentStep! }));
        if (event.logs) setLogs(event.logs);
      }
    });

    return () => unsubscribe();
  }, [run.id, run.status]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`badge ${getStatusBadge(currentRun.status)}`}>{currentRun.status}</span>
          <span className="text-sm text-gray-400">{new Date(run.createdAt).toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-2">
          {currentRun.status === 'done' && (
            <Link to={`/run/${run.id}`} className="btn btn-primary text-sm w-full sm:w-auto">
              View Output
            </Link>
          )}

          {(currentRun.status === 'failed' || currentRun.status === 'canceled') && (
            <button
              onClick={onRetry}
              disabled={isActionInProgress}
              className="btn btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Retry render"
            >
              {isActionInProgress ? 'Retrying...' : 'Retry'}
            </button>
          )}

          {(currentRun.status === 'running' || currentRun.status === 'queued') && (
            <button
              onClick={onCancel}
              disabled={isActionInProgress}
              className="btn btn-danger text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Cancel render"
            >
              {isActionInProgress ? 'Canceling...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {(currentRun.status === 'running' || currentRun.status === 'queued') && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-1">
            <span>{currentRun.currentStep || 'Starting...'}</span>
            <span>{currentRun.progress}%</span>
          </div>
          <div className="w-full rounded-full h-2" style={{ background: 'var(--color-surface-2)' }}>
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{ width: `${currentRun.progress}%`, background: 'var(--color-primary)' }}
            />
          </div>
        </div>
      )}

      {/* Logs */}
      <div>
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center gap-2 text-sm mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg
            className={`w-4 h-4 transition-transform ${showLogs ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {showLogs ? 'Hide logs' : 'Show logs'}
          {logs.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              ({logs.length})
            </span>
          )}
        </button>

        {showLogs && (
          <div
            className="rounded-lg p-3 max-h-48 overflow-y-auto"
            style={{ background: 'var(--color-bg)' }}
          >
            <div className="space-y-1 font-mono text-xs">
              {logs.slice(-20).map((log, i) => (
                <div
                  key={i}
                  style={{
                    color:
                      log.level === 'error'
                        ? 'var(--color-danger)'
                        : log.level === 'warn'
                          ? 'var(--color-warning)'
                          : 'var(--color-text-muted)',
                  }}
                >
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>{' '}
                  {log.message}
                </div>
              ))}
              {logs.length === 0 && (
                <p style={{ color: 'var(--color-text-muted)' }}>No logs yet...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
