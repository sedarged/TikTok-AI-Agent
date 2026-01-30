import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getRun,
  verifyRun,
  getExportData,
  duplicateProject,
  subscribeToRun,
  retryRun,
} from '../api/client';
import type {
  Run,
  VerificationResult,
  Artifacts,
  LogEntry,
  ProviderStatus,
  SSEEvent,
} from '../api/types';
import { getErrorMessage } from '../utils/errors';

interface OutputProps {
  status: ProviderStatus | null;
}

export default function Output({ status }: OutputProps) {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<Run | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showRenderLog, setShowRenderLog] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showVerificationExpanded, setShowVerificationExpanded] = useState(false);
  const [showArtifactsExpanded, setShowArtifactsExpanded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryFromStep, setRetryFromStep] = useState<string>('');
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const RENDER_STEPS = [
    'tts_generate',
    'asr_align',
    'images_generate',
    'captions_build',
    'music_build',
    'ffmpeg_render',
    'finalize_artifacts',
  ] as const;

  useEffect(() => {
    if (!runId) return;

    const controller = new AbortController();
    const { signal } = controller;

    getRun(runId, { signal })
      .then((data) => {
        if (signal.aborted) return;
        setRun(data);
        try {
          setLogs(JSON.parse(data.logsJson || '[]'));
        } catch {
          setLogs([]);
        }
      })
      .catch((err) => {
        if (signal.aborted) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [runId]);

  // Subscribe to SSE once per runId (reconnect with backoff in client); single subscription avoids duplicate streams
  useEffect(() => {
    if (!runId) return;

    const unsubscribe = subscribeToRun(
      runId,
      (event: SSEEvent) => {
        if (event.type === 'progress') {
          setRun((prev) => (prev ? { ...prev, progress: event.progress || 0 } : null));
        } else if (event.type === 'step') {
          setRun((prev) => (prev ? { ...prev, currentStep: event.step || '' } : null));
        } else if (event.type === 'log' && event.log) {
          setLogs((prev) => [...prev, event.log!]);
        } else if (event.type === 'done') {
          setRun((prev) => (prev ? { ...prev, status: 'done', progress: 100 } : null));
          getRun(runId).then(setRun);
        } else if (event.type === 'failed') {
          setRun((prev) => (prev ? { ...prev, status: 'failed' } : null));
        } else if (event.type === 'state' && event.status === 'qa_failed') {
          setRun((prev) => (prev ? { ...prev, status: 'qa_failed', progress: 100 } : null));
          getRun(runId).then(setRun);
        } else if (event.type === 'state') {
          if (event.status) setRun((prev) => (prev ? { ...prev, status: event.status! } : null));
          if (event.progress !== undefined)
            setRun((prev) => (prev ? { ...prev, progress: event.progress! } : null));
          if (event.currentStep)
            setRun((prev) => (prev ? { ...prev, currentStep: event.currentStep! } : null));
          if (event.logs) setLogs(event.logs);
        }
      },
      (err) => setError(getErrorMessage(err))
    );

    return () => unsubscribe();
  }, [runId]);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleVerify = async () => {
    if (!runId) return;
    setVerifying(true);
    try {
      const result = await verifyRun(runId);
      setVerification(result);
    } catch (err) {
      setError(getErrorMessage(err));
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
      setError(getErrorMessage(err));
    }
  };

  const handleDuplicate = async () => {
    if (!run?.projectId) return;
    try {
      const newProject = await duplicateProject(run.projectId);
      navigate(`/project/${newProject.id}/plan`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div
          className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
        />
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

  let artifacts: Artifacts = {};
  try {
    artifacts = JSON.parse(run.artifactsJson || '{}') as Artifacts;
  } catch {
    artifacts = {};
  }
  const isComplete = run.status === 'done';
  const isRunning = run.status === 'running' || run.status === 'queued';
  const isFailed = run.status === 'failed';
  const isQaFailed = run.status === 'qa_failed';
  const isDryRun = artifacts.dryRun === true || status?.renderDryRun === true;

  const verificationLong = verification && verification.checks.length > 5;
  const artifactKeys = isComplete
    ? [
        'mp4Path',
        'thumbPath',
        'thumbPaths',
        'captionsPath',
        'imagesDir',
        'audioDir',
        'dryRunReportPath',
      ].filter((k) => (artifacts as Record<string, unknown>)[k])
    : [];
  const artifactsLong = artifactKeys.length > 5;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isComplete
              ? 'Video Complete'
              : isRunning
                ? 'Rendering...'
                : isQaFailed
                  ? 'QA Failed'
                  : isFailed
                    ? 'Render Failed'
                    : 'Render Output'}
          </h1>
          <p className="text-gray-400">{run.project?.title || 'Project'}</p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`badge ${
              isComplete
                ? 'badge-success'
                : isRunning
                  ? 'badge-warning'
                  : isQaFailed
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

      {isComplete && isDryRun && (
        <div className="card bg-yellow-900/20 border-yellow-700">
          <h3 className="font-semibold text-yellow-300 mb-2">Dry-run Render</h3>
          <p className="text-gray-300 text-sm">
            This run executed the render pipeline without external providers or MP4 output.
          </p>
        </div>
      )}

      {/* Progress for running jobs */}
      {isRunning && (
        <div className="card">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
            <span>{run.currentStep || 'Starting...'}</span>
            <span>{run.progress}%</span>
          </div>
          <div className="w-full rounded-full h-3" style={{ background: 'var(--color-surface-2)' }}>
            <div
              className="h-3 rounded-full transition-all duration-300"
              style={{ width: `${run.progress}%`, background: 'var(--color-primary)' }}
            />
          </div>
        </div>
      )}

      {/* Video Player (use API artifact URL so it works when /artifacts static is disabled in prod) */}
      {isComplete && artifacts.mp4Path && runId && (
        <div className="card p-0 overflow-hidden">
          <div className="aspect-[9/16] max-h-[600px] bg-black flex items-center justify-center mx-auto">
            <video
              controls
              className="max-h-full max-w-full"
              src={`/api/run/${runId}/artifact?path=${encodeURIComponent(artifacts.mp4Path)}`}
              poster={
                artifacts.thumbPath
                  ? `/api/run/${runId}/artifact?path=${encodeURIComponent(artifacts.thumbPath)}`
                  : undefined
              }
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}

      {/* Cover thumbnails (3 options: 0s, 3s, mid) */}
      {isComplete && runId && artifacts.thumbPaths && artifacts.thumbPaths.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-2">Cover options</h3>
          <p className="text-gray-400 text-sm mb-3">Use as cover when uploading to TikTok.</p>
          <div className="flex flex-wrap gap-4">
            {artifacts.thumbPaths.map((p, i) => (
              <a
                key={p}
                href={`/api/run/${runId}/artifact?path=${encodeURIComponent(p)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg overflow-hidden border-2 border-transparent hover:border-[var(--color-primary)] transition-colors"
                style={{ maxWidth: 180 }}
              >
                <img
                  src={`/api/run/${runId}/artifact?path=${encodeURIComponent(p)}`}
                  alt={`Cover option ${i + 1}`}
                  className="aspect-[9/16] w-full object-cover"
                />
                <span
                  className="block text-center text-sm py-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {i === 0 ? 'Start' : i === 1 ? '3s' : 'Mid'}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* TikTok metadata (caption, hashtags, title) */}
      {isComplete &&
        (artifacts.tiktokCaption ??
          artifacts.tiktokTitle ??
          (artifacts.tiktokHashtags?.length ?? 0) > 0) && (
          <div className="card">
            <h3 className="font-semibold mb-3">TikTok</h3>
            <p className="text-gray-400 text-sm mb-4">Copy and paste when publishing to TikTok.</p>
            <div className="space-y-4">
              {artifacts.tiktokCaption && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Caption</label>
                  <div className="flex gap-2">
                    <p className="flex-1 rounded-lg px-3 py-2 text-sm bg-black/30 border border-gray-700 break-words">
                      {artifacts.tiktokCaption}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(artifacts.tiktokCaption!);
                        } catch {
                          // fallback ignored
                        }
                      }}
                      className="btn btn-secondary shrink-0"
                    >
                      Copy caption
                    </button>
                  </div>
                </div>
              )}
              {artifacts.tiktokHashtags && artifacts.tiktokHashtags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Hashtags</label>
                  <div className="flex gap-2 flex-wrap items-start">
                    <p className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm bg-black/30 border border-gray-700 break-words">
                      {artifacts.tiktokHashtags
                        .map((h) => (h.startsWith('#') ? h : `#${h}`))
                        .join(' ')}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        const text = artifacts
                          .tiktokHashtags!.map((h) => (h.startsWith('#') ? h : `#${h}`))
                          .join(' ');
                        try {
                          await navigator.clipboard.writeText(text);
                        } catch {
                          // fallback ignored
                        }
                      }}
                      className="btn btn-secondary shrink-0"
                    >
                      Copy hashtags
                    </button>
                  </div>
                </div>
              )}
              {artifacts.tiktokTitle && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                  <div className="flex gap-2">
                    <p className="flex-1 rounded-lg px-3 py-2 text-sm bg-black/30 border border-gray-700 break-words">
                      {artifacts.tiktokTitle}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(artifacts.tiktokTitle!);
                        } catch {
                          // fallback ignored
                        }
                      }}
                      className="btn btn-secondary shrink-0"
                    >
                      Copy title
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* QA Failed state */}
      {isQaFailed && (
        <div className="card bg-amber-900/30 border-amber-700">
          <h3 className="font-semibold text-amber-400 mb-2">QA Failed</h3>
          <p className="text-gray-300 text-sm mb-2">
            The video did not pass quality checks (silence, file size, or resolution 1080×1920).
          </p>
          {artifacts.qaResult?.details && (
            <p className="text-gray-400 text-sm mb-4 font-mono">{artifacts.qaResult.details}</p>
          )}
          <div className="flex flex-wrap gap-3 items-center">
            {runId && (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  Retry from step:
                  <select
                    className="input py-1.5 text-sm w-44"
                    value={retryFromStep}
                    onChange={(e) => setRetryFromStep(e.target.value)}
                    aria-label="Retry from step"
                  >
                    <option value="">From beginning</option>
                    {RENDER_STEPS.map((step) => (
                      <option key={step} value={step}>
                        {step}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={async () => {
                    if (!runId) return;
                    setRetrying(true);
                    try {
                      const updated = await retryRun(runId, retryFromStep || undefined);
                      setRun(updated);
                      setError('');
                    } catch (err) {
                      setError(getErrorMessage(err));
                    } finally {
                      setRetrying(false);
                    }
                  }}
                  disabled={retrying}
                  className="btn btn-primary"
                >
                  {retrying ? 'Retrying...' : 'Retry'}
                </button>
              </>
            )}
            <Link to={`/project/${run.projectId}/plan`} className="btn btn-secondary">
              Back to Plan Studio
            </Link>
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
          <div className="flex flex-wrap gap-3 items-center">
            {runId && (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  Retry from step:
                  <select
                    className="input py-1.5 text-sm w-44"
                    value={retryFromStep}
                    onChange={(e) => setRetryFromStep(e.target.value)}
                    aria-label="Retry from step"
                  >
                    <option value="">From beginning</option>
                    {RENDER_STEPS.map((step) => (
                      <option key={step} value={step}>
                        {step}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={async () => {
                    if (!runId) return;
                    setRetrying(true);
                    try {
                      const updated = await retryRun(runId, retryFromStep || undefined);
                      setRun(updated);
                      setError('');
                    } catch (err) {
                      setError(getErrorMessage(err));
                    } finally {
                      setRetrying(false);
                    }
                  }}
                  disabled={retrying}
                  className="btn btn-primary"
                >
                  {retrying ? 'Retrying...' : 'Retry'}
                </button>
              </>
            )}
            <Link to={`/project/${run.projectId}/plan`} className="btn btn-secondary">
              Back to Plan Studio
            </Link>
          </div>
        </div>
      )}

      {/* Actions */}
      {isComplete && (
        <div className="card">
          <h3 className="font-semibold mb-4">Actions</h3>
          {artifacts.costEstimate != null && (
            <p className="text-gray-400 text-sm mb-3">
              Cost (est.): ${artifacts.costEstimate.estimatedUsd.toFixed(2)}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {/* Primary Action */}
            {artifacts.mp4Path ? (
              <a
                href={`/api/run/${runId}/download`}
                download
                className="btn btn-primary glow-primary w-full sm:w-auto"
              >
                Download MP4
              </a>
            ) : (
              <button className="btn btn-primary glow-primary w-full sm:w-auto" disabled>
                View artifacts
              </button>
            )}

            {/* More Menu */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="btn btn-secondary flex items-center gap-1"
              >
                <span>More</span>
                <svg
                  className={`w-4 h-4 transition-transform ${showMoreMenu ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showMoreMenu && (
                <div
                  className="absolute left-0 mt-2 w-48 rounded-lg shadow-lg z-10 border"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleExport();
                        setShowMoreMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                      style={{ color: 'var(--color-text)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--color-surface-2)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      Export JSON
                    </button>
                    <button
                      onClick={() => {
                        handleDuplicate();
                        setShowMoreMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                      style={{ color: 'var(--color-text)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--color-surface-2)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      Duplicate Project
                    </button>
                    <button
                      onClick={() => {
                        handleVerify();
                        setShowMoreMenu(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                      style={{ color: 'var(--color-text)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--color-surface-2)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      disabled={verifying}
                    >
                      {verifying ? 'Verifying...' : 'Verify Artifacts'}
                    </button>
                    <Link
                      to={`/project/${run.projectId}/plan`}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                      style={{ color: 'var(--color-text)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--color-surface-2)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => setShowMoreMenu(false)}
                    >
                      Edit Plan
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verification Results */}
      {verification && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Verification Results</h3>
            <span className={`badge ${verification.passed ? 'badge-success' : 'badge-error'}`}>
              {verification.passed ? 'PASS' : 'FAIL'}
            </span>
          </div>

          <div className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
            {verification.summary.passed}/{verification.summary.total} checks passed
          </div>

          {verificationLong && (
            <button
              type="button"
              onClick={() => setShowVerificationExpanded(!showVerificationExpanded)}
              className="flex items-center gap-2 text-sm mb-4"
              style={{ color: 'var(--color-primary)' }}
            >
              <svg
                className={`w-4 h-4 transition-transform ${showVerificationExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              {showVerificationExpanded
                ? 'Hide details'
                : `Show details (${verification.checks.length} checks)`}
            </button>
          )}

          {(!verificationLong || showVerificationExpanded) && (
            <div className="space-y-2">
              {verification.checks.map((check, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-2 rounded ${
                    check.passed ? 'bg-green-900/20' : 'bg-red-900/20'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      check.passed ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}
                  >
                    {check.passed ? 'P' : 'F'}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium">{check.name}</span>
                    <p className="text-sm text-gray-400">{check.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Artifacts */}
      {isComplete && Object.keys(artifacts).length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Artifacts</h3>
            {artifactsLong && (
              <button
                type="button"
                onClick={() => setShowArtifactsExpanded(!showArtifactsExpanded)}
                className="flex items-center gap-2 text-sm"
                style={{ color: 'var(--color-primary)' }}
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showArtifactsExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                {showArtifactsExpanded ? 'Hide' : `Show more (${artifactKeys.length})`}
              </button>
            )}
          </div>
          {(!artifactsLong || showArtifactsExpanded) && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {artifacts.mp4Path && (
                <ArtifactItem runId={runId!} label="Final Video" path={artifacts.mp4Path} />
              )}
              {artifacts.thumbPath && (
                <ArtifactItem runId={runId!} label="Thumbnail" path={artifacts.thumbPath} isImage />
              )}
              {artifacts.captionsPath && (
                <ArtifactItem runId={runId!} label="Captions" path={artifacts.captionsPath} />
              )}
              {artifacts.imagesDir && (
                <ArtifactItem
                  runId={runId!}
                  label="Scene Images"
                  path={artifacts.imagesDir}
                  isDir
                />
              )}
              {artifacts.audioDir && (
                <ArtifactItem runId={runId!} label="Audio Files" path={artifacts.audioDir} isDir />
              )}
              {artifacts.dryRunReportPath && (
                <ArtifactItem
                  runId={runId!}
                  label="Dry-run Report"
                  path={artifacts.dryRunReportPath}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Logs */}
      <div className="card">
        <button
          onClick={() => setShowRenderLog(!showRenderLog)}
          className="flex items-center gap-2 mb-4"
        >
          <h3 className="font-semibold">Render Log</h3>
          <svg
            className={`w-4 h-4 transition-transform ${showRenderLog ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {logs.length > 0 && !showRenderLog && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              ({logs.length})
            </span>
          )}
        </button>

        {showRenderLog && (
          <div
            className="rounded-lg p-4 max-h-64 overflow-y-auto"
            style={{ background: 'var(--color-bg)' }}
          >
            <div className="space-y-1 font-mono text-xs">
              {logs.map((log, i) => (
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
                <p style={{ color: 'var(--color-text-muted)' }}>No logs available</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ArtifactItem({
  runId,
  label,
  path,
  isImage,
  isDir,
}: {
  runId: string;
  label: string;
  path: string;
  isImage?: boolean;
  isDir?: boolean;
}) {
  const artifactUrl = `/api/run/${runId}/artifact?path=${encodeURIComponent(path)}`;
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      {isImage && (
        <img src={artifactUrl} alt={label} className="w-full h-24 object-cover rounded mb-2" />
      )}
      <p className="font-medium text-sm">{label}</p>
      <p className="text-gray-500 text-xs truncate">{path}</p>
      {isDir && <span className="badge badge-info text-xs mt-1">Directory</span>}
    </div>
  );
}
