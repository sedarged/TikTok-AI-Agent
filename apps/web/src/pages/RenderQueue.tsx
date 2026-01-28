import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProject, retryRun, cancelRun, subscribeToRun } from '../api/client';
import type { Project, Run, LogEntry, SSEEvent } from '../api/types';

export default function RenderQueue() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;

    getProject(projectId)
      .then((proj) => {
        setProject(proj);
        setRuns(proj.runs || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleRetry = async (runId: string) => {
    try {
      const retriedRun = await retryRun(runId);
      setRuns(runs.map((r) => (r.id === runId ? retriedRun : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry run');
    }
  };

  const handleCancel = async (runId: string) => {
    try {
      await cancelRun(runId);
      setRuns(runs.map((r) => 
        r.id === runId ? { ...r, status: 'canceled' as const } : r
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel run');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      queued: 'badge-info',
      running: 'badge-warning',
      done: 'badge-success',
      failed: 'badge-error',
      canceled: 'badge-error',
    };
    return styles[status] || 'badge-info';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
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
        <Link to={`/project/${projectId}/plan`} className="btn btn-secondary">
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
          <Link to={`/project/${projectId}/plan`} className="btn btn-primary">
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
}: {
  run: Run;
  onRetry: () => void;
  onCancel: () => void;
  getStatusBadge: (status: string) => string;
}) {
  const [currentRun, setCurrentRun] = useState(run);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    try {
      setLogs(JSON.parse(run.logsJson || '[]'));
    } catch {
      setLogs([]);
    }
  }, [run.logsJson]);

  useEffect(() => {
    if (run.status !== 'running' && run.status !== 'queued') return;

    const unsubscribe = subscribeToRun(
      run.id,
      (event: SSEEvent) => {
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
          if (event.progress !== undefined) setCurrentRun((prev) => ({ ...prev, progress: event.progress! }));
          if (event.currentStep) setCurrentRun((prev) => ({ ...prev, currentStep: event.currentStep! }));
          if (event.logs) setLogs(event.logs);
        }
      }
    );

    return () => unsubscribe();
  }, [run.id, run.status]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`badge ${getStatusBadge(currentRun.status)}`}>
            {currentRun.status}
          </span>
          <span className="text-sm text-gray-400">
            {new Date(run.createdAt).toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {currentRun.status === 'done' && (
            <Link to={`/run/${run.id}`} className="btn btn-primary text-sm">
              View Output
            </Link>
          )}
          
          {(currentRun.status === 'failed' || currentRun.status === 'canceled') && (
            <button onClick={onRetry} className="btn btn-secondary text-sm">
              Retry
            </button>
          )}
          
          {(currentRun.status === 'running' || currentRun.status === 'queued') && (
            <button onClick={onCancel} className="btn btn-danger text-sm">
              Cancel
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
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${currentRun.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="bg-gray-950 rounded-lg p-3 max-h-48 overflow-y-auto">
        <div className="space-y-1 font-mono text-xs">
          {logs.slice(-20).map((log, i) => (
            <div
              key={i}
              className={`${
                log.level === 'error'
                  ? 'text-red-400'
                  : log.level === 'warn'
                  ? 'text-yellow-400'
                  : 'text-gray-400'
              }`}
            >
              <span className="text-gray-600">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>{' '}
              {log.message}
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-gray-600">No logs yet...</p>
          )}
        </div>
      </div>
    </div>
  );
}
