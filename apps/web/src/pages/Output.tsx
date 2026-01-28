import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRun, verifyRun, getExportData, duplicateProject, subscribeToRun } from '../api/client';
import type { Run, VerificationResult, Artifacts, LogEntry, ProviderStatus, SSEEvent } from '../api/types';

interface OutputProps {
  status: ProviderStatus | null;
}

export default function Output({ status: _status }: OutputProps) {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!runId) return;

    getRun(runId)
      .then((data) => {
        setRun(data);
        try {
          setLogs(JSON.parse(data.logsJson || '[]'));
        } catch {
          setLogs([]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [runId]);

  // Subscribe to SSE for running jobs
  useEffect(() => {
    if (!runId || !run || (run.status !== 'running' && run.status !== 'queued')) return;

    const unsubscribe = subscribeToRun(
      runId,
      (event: SSEEvent) => {
        if (event.type === 'progress') {
          setRun((prev) => prev ? { ...prev, progress: event.progress || 0 } : null);
        } else if (event.type === 'step') {
          setRun((prev) => prev ? { ...prev, currentStep: event.step || '' } : null);
        } else if (event.type === 'log' && event.log) {
          setLogs((prev) => [...prev, event.log!]);
        } else if (event.type === 'done') {
          setRun((prev) => prev ? { ...prev, status: 'done', progress: 100 } : null);
          // Refresh to get artifacts
          getRun(runId).then(setRun);
        } else if (event.type === 'failed') {
          setRun((prev) => prev ? { ...prev, status: 'failed' } : null);
        } else if (event.type === 'state') {
          if (event.status) setRun((prev) => prev ? { ...prev, status: event.status! } : null);
          if (event.progress !== undefined) setRun((prev) => prev ? { ...prev, progress: event.progress! } : null);
          if (event.currentStep) setRun((prev) => prev ? { ...prev, currentStep: event.currentStep! } : null);
          if (event.logs) setLogs(event.logs);
        }
      }
    );

    return () => unsubscribe();
  }, [runId, run?.status]);

  const handleVerify = async () => {
    if (!runId) return;
    setVerifying(true);
    try {
      const result = await verifyRun(runId);
      setVerification(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify artifacts');
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = async () => {
    if (!runId) return;
    try {
      const data = await getExportData(runId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${runId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export');
    }
  };

  const handleDuplicate = async () => {
    if (!run?.projectId) return;
    try {
      const newProject = await duplicateProject(run.projectId);
      window.location.href = `/project/${newProject.id}/plan`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate project');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Run not found</p>
      </div>
    );
  }

  const artifacts: Artifacts = JSON.parse(run.artifactsJson || '{}');
  const isComplete = run.status === 'done';
  const isRunning = run.status === 'running' || run.status === 'queued';
  const isFailed = run.status === 'failed';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isComplete ? 'Video Complete' : isRunning ? 'Rendering...' : 'Render Output'}
          </h1>
          <p className="text-gray-400">
            {run.project?.title || 'Project'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`badge ${
              isComplete
                ? 'badge-success'
                : isRunning
                ? 'badge-warning'
                : 'badge-error'
            }`}
          >
            {run.status}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Progress for running jobs */}
      {isRunning && (
        <div className="card">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span>{run.currentStep || 'Starting...'}</span>
            <span>{run.progress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-green-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${run.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Video Player */}
      {isComplete && artifacts.mp4Path && (
        <div className="card p-0 overflow-hidden">
          <div className="aspect-[9/16] max-h-[600px] bg-black flex items-center justify-center mx-auto">
            <video
              controls
              className="max-h-full max-w-full"
              src={`/artifacts/${artifacts.mp4Path}`}
              poster={artifacts.thumbPath ? `/artifacts/${artifacts.thumbPath}` : undefined}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="card bg-red-900/30 border-red-700">
          <h3 className="font-semibold text-red-400 mb-2">Render Failed</h3>
          <p className="text-gray-300 text-sm mb-4">
            The render process encountered an error. Check the logs below for details.
          </p>
          <Link
            to={`/project/${run.projectId}/plan`}
            className="btn btn-secondary"
          >
            Back to Plan Studio
          </Link>
        </div>
      )}

      {/* Actions */}
      {isComplete && (
        <div className="card">
          <h3 className="font-semibold mb-4">Actions</h3>
          <div className="flex flex-wrap gap-3">
            {artifacts.mp4Path && (
              <a
                href={`/api/run/${runId}/download`}
                download
                className="btn btn-primary"
              >
                Download MP4
              </a>
            )}
            
            <button onClick={handleExport} className="btn btn-secondary">
              Export JSON
            </button>
            
            <button onClick={handleDuplicate} className="btn btn-secondary">
              Duplicate Project
            </button>
            
            <button
              onClick={handleVerify}
              className="btn btn-secondary"
              disabled={verifying}
            >
              {verifying ? 'Verifying...' : 'Verify Artifacts'}
            </button>
            
            <Link
              to={`/project/${run.projectId}/plan`}
              className="btn btn-secondary"
            >
              Edit Plan
            </Link>
          </div>
        </div>
      )}

      {/* Verification Results */}
      {verification && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Verification Results</h3>
            <span
              className={`badge ${
                verification.passed ? 'badge-success' : 'badge-error'
              }`}
            >
              {verification.passed ? 'PASS' : 'FAIL'}
            </span>
          </div>

          <div className="space-y-2">
            {verification.checks.map((check, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 p-2 rounded ${
                  check.passed ? 'bg-green-900/20' : 'bg-red-900/20'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    check.passed
                      ? 'bg-green-600 text-white'
                      : 'bg-red-600 text-white'
                  }`}
                >
                  {check.passed ? '✓' : '✗'}
                </span>
                <div className="flex-1">
                  <span className="font-medium">{check.name}</span>
                  <p className="text-sm text-gray-400">{check.message}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-700 text-sm text-gray-400">
            {verification.summary.passed}/{verification.summary.total} checks passed
          </div>
        </div>
      )}

      {/* Artifacts */}
      {isComplete && Object.keys(artifacts).length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">Artifacts</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {artifacts.mp4Path && (
              <ArtifactItem label="Final Video" path={artifacts.mp4Path} />
            )}
            {artifacts.thumbPath && (
              <ArtifactItem
                label="Thumbnail"
                path={artifacts.thumbPath}
                isImage
              />
            )}
            {artifacts.captionsPath && (
              <ArtifactItem label="Captions" path={artifacts.captionsPath} />
            )}
            {artifacts.imagesDir && (
              <ArtifactItem label="Scene Images" path={artifacts.imagesDir} isDir />
            )}
            {artifacts.audioDir && (
              <ArtifactItem label="Audio Files" path={artifacts.audioDir} isDir />
            )}
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="card">
        <h3 className="font-semibold mb-4">Render Log</h3>
        <div className="bg-gray-950 rounded-lg p-4 max-h-64 overflow-y-auto">
          <div className="space-y-1 font-mono text-xs">
            {logs.map((log, i) => (
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
              <p className="text-gray-600">No logs available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArtifactItem({
  label,
  path,
  isImage,
  isDir,
}: {
  label: string;
  path: string;
  isImage?: boolean;
  isDir?: boolean;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      {isImage && (
        <img
          src={`/artifacts/${path}`}
          alt={label}
          className="w-full h-24 object-cover rounded mb-2"
        />
      )}
      <p className="font-medium text-sm">{label}</p>
      <p className="text-gray-500 text-xs truncate">{path}</p>
      {isDir && <span className="badge badge-info text-xs mt-1">Directory</span>}
    </div>
  );
}
