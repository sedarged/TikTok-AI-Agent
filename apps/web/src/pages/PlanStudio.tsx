import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  getProject,
  getPlanVersion,
  updatePlanVersion,
  validatePlan,
  autofitDurations,
  regenerateHooks,
  regenerateOutline,
  regenerateScript,
  regenerateScene,
  toggleSceneLock,
  approvePlan,
  startRender,
} from '../api/client';
import type { Project, PlanVersion, Scene, ProviderStatus, ValidationResult } from '../api/types';
import { EFFECT_PRESETS } from '../api/types';
import { getErrorMessage } from '../utils/errors';

// Validation Panel Component
function ValidationPanel({ validation }: { validation: ValidationResult }) {
  const [expanded, setExpanded] = useState(validation.errors.length > 0);

  // Always show errors, but warnings can be collapsed
  const hasErrors = validation.errors.length > 0;
  const hasOnlyWarnings = validation.errors.length === 0 && validation.warnings.length > 0;

  return (
    <div className="card space-y-2">
      {/* Errors - always visible */}
      {hasErrors && (
        <>
          {validation.errors.map((err, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm"
              style={{ color: 'var(--color-danger)' }}
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                style={{ background: 'var(--color-danger)' }}
              >
                !
              </span>
              {err}
            </div>
          ))}
        </>
      )}

      {/* Warnings - can be collapsed */}
      {hasOnlyWarnings && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm w-full text-left"
            style={{ color: 'var(--color-warning)' }}
          >
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
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
            Warnings ({validation.warnings.length})
          </button>
          {expanded && (
            <div className="space-y-2 pl-6">
              {validation.warnings.map((warn, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: 'var(--color-warning)' }}
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                    style={{ background: 'var(--color-warning)' }}
                  >
                    !
                  </span>
                  {warn}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Warnings when errors exist - always visible */}
      {hasErrors && validation.warnings.length > 0 && (
        <>
          {validation.warnings.map((warn, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm"
              style={{ color: 'var(--color-warning)' }}
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                style={{ background: 'var(--color-warning)' }}
              >
                !
              </span>
              {warn}
            </div>
          ))}
        </>
      )}

      {/* Suggestions */}
      {validation.suggestions.length > 0 && (
        <>
          {validation.suggestions.map((sug, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm"
              style={{ color: 'var(--color-primary)' }}
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-xs"
                style={{ background: 'var(--color-primary)' }}
              >
                i
              </span>
              {sug}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

interface PlanStudioProps {
  status: ProviderStatus | null;
}

export default function PlanStudio({ status }: PlanStudioProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [planVersion, setPlanVersion] = useState<PlanVersion | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [hookOptions, setHookOptions] = useState<string[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [estimates, setEstimates] = useState<{
    wpm: number;
    estimatedLengthSec: number;
    targetLengthSec: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'hook' | 'outline' | 'script' | 'scenes'>('hook');
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount: clear pending autosave and mark unmounted
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, []);

  // Close tools menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setToolsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load project and plan (abort on unmount or projectId change)
  useEffect(() => {
    if (!projectId) return;

    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);

    getProject(projectId, { signal })
      .then(async (proj) => {
        if (signal.aborted) return;
        setProject(proj);

        const planId = proj.latestPlanVersionId || proj.planVersions?.[0]?.id;
        if (!planId) return;

        const pv = proj.latestPlanVersionId
          ? await getPlanVersion(planId, { signal })
          : (proj.planVersions?.[0] as PlanVersion);
        if (signal.aborted) return;

        setPlanVersion(pv);
        setScenes(pv.scenes || []);

        try {
          setHookOptions(JSON.parse(pv.hookOptionsJson || '[]'));
          setEstimates(JSON.parse(pv.estimatesJson || '{}'));
          setValidation(JSON.parse(pv.validationJson || '{}'));
        } catch {
          setHookOptions([]);
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
  }, [projectId]);

  // Autosave with debounce. Only set autosaving when the request runs (inside timeout),
  // not on every keystroke, to avoid re-renders that cause input focus loss.
  const autosave = useCallback(
    (
      data: Partial<{
        hookSelected: string;
        outline: string;
        scriptFull: string;
        scenes: Partial<Scene>[];
      }>
    ) => {
      if (!planVersion?.id) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;
        setAutosaving(true);
        try {
          await updatePlanVersion(planVersion.id, data);
          if (isMountedRef.current) toast.success('Plan saved');
        } catch (err) {
          if (
            isMountedRef.current &&
            typeof import.meta !== 'undefined' &&
            (import.meta as { env?: { DEV?: boolean } }).env?.DEV
          ) {
            console.error('Autosave failed:', err);
          }
        } finally {
          if (isMountedRef.current) setAutosaving(false);
        }
      }, 600);
    },
    [planVersion?.id]
  );

  // Handlers
  const handleHookSelect = (hook: string) => {
    if (!planVersion) return;
    setPlanVersion({ ...planVersion, hookSelected: hook });
    autosave({ hookSelected: hook });
  };

  const handleOutlineChange = (outline: string) => {
    if (!planVersion) return;
    setPlanVersion({ ...planVersion, outline });
    autosave({ outline });
  };

  const handleScriptChange = (scriptFull: string) => {
    if (!planVersion) return;
    setPlanVersion({ ...planVersion, scriptFull });
    autosave({ scriptFull });
  };

  const handleSceneChange = (
    sceneId: string,
    field: keyof Scene,
    value: string | number | boolean
  ) => {
    const updatedScenes = scenes.map((s) => (s.id === sceneId ? { ...s, [field]: value } : s));
    setScenes(updatedScenes);
    autosave({ scenes: [{ id: sceneId, [field]: value }] });
  };

  const handleRegenerateHooks = async () => {
    if (!planVersion?.id) return;
    setSaving(true);
    try {
      const result = await regenerateHooks(planVersion.id);
      setHookOptions(result.hookOptions);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateOutline = async () => {
    if (!planVersion?.id) return;
    setSaving(true);
    try {
      const result = await regenerateOutline(planVersion.id);
      setPlanVersion({ ...planVersion, outline: result.outline });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateScript = async () => {
    if (!planVersion?.id) return;
    setSaving(true);
    try {
      const updated = await regenerateScript(planVersion.id);
      setPlanVersion(updated);
      if (updated.scenes) {
        setScenes(updated.scenes);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateScene = async (sceneId: string) => {
    setSaving(true);
    try {
      const updated = await regenerateScene(sceneId);
      setScenes(scenes.map((s) => (s.id === sceneId ? updated : s)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async (sceneId: string, locked: boolean) => {
    try {
      const updated = await toggleSceneLock(sceneId, locked);
      setScenes(scenes.map((s) => (s.id === sceneId ? updated : s)));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleValidate = async () => {
    if (!planVersion?.id) return;
    try {
      const result = await validatePlan(planVersion.id);
      setValidation(result);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleAutofit = async () => {
    if (!planVersion?.id) return;
    setSaving(true);
    try {
      const updated = await autofitDurations(planVersion.id);
      setPlanVersion(updated);
      if (updated.scenes) {
        setScenes(updated.scenes);
      }
      setEstimates(JSON.parse(updated.estimatesJson || '{}'));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleApproveAndRender = async () => {
    if (!planVersion?.id) return;

    if (status?.testMode) {
      setError('Rendering is disabled in TEST MODE. Disable APP_TEST_MODE to render.');
      return;
    }

    const renderDryRun = status?.renderDryRun === true;

    // Check OpenAI status
    if (!renderDryRun && !status?.providers.openai) {
      setError('Cannot render: OpenAI API key not configured. Set OPENAI_API_KEY in .env file.');
      return;
    }

    if (!renderDryRun && !status?.providers.ffmpeg) {
      setError('Cannot render: FFmpeg not available.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Validate first
      const validationResult = await validatePlan(planVersion.id);
      setValidation(validationResult);

      if (validationResult.errors.length > 0) {
        setError('Please fix validation errors before rendering');
        setSaving(false);
        return;
      }

      // Approve
      await approvePlan(planVersion.id);

      // Start render
      const run = await startRender(planVersion.id);
      toast.success('Render started');

      // Navigate to run page
      setSaving(false);
      navigate(`/run/${run.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project || !planVersion) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400">Project or plan not found</p>
      </div>
    );
  }

  const totalDuration = scenes.reduce((sum, s) => sum + s.durationTargetSec, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <p className="text-gray-400 text-sm">
            {project.nichePackId} | {project.targetLengthSec}s target | {project.tempo} tempo
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(saving || autosaving) && (
            <span
              className="text-sm flex items-center gap-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <div
                className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--color-text-muted)', borderTopColor: 'transparent' }}
              />
              {saving ? 'Saving...' : 'Autosaving...'}
            </span>
          )}

          {status?.testMode && (
            <span className="text-sm" style={{ color: 'var(--color-warning)' }}>
              TEST MODE: rendering disabled
            </span>
          )}

          {status?.renderDryRun && !status?.testMode && (
            <span className="text-sm" style={{ color: 'var(--color-warning)' }}>
              DRY-RUN: no MP4 will be generated
            </span>
          )}

          {/* Tools Menu */}
          <div className="relative" ref={toolsMenuRef}>
            <button
              onClick={() => setToolsMenuOpen(!toolsMenuOpen)}
              className="btn btn-secondary flex items-center gap-1"
            >
              <span>Tools</span>
              <svg
                className={`w-4 h-4 transition-transform ${toolsMenuOpen ? 'rotate-180' : ''}`}
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

            {toolsMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-10 border"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              >
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleValidate();
                      setToolsMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                    style={{ color: 'var(--color-text)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--color-surface-2)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    Validate
                  </button>
                  <button
                    onClick={() => {
                      handleAutofit();
                      setToolsMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-opacity-50 transition-colors"
                    style={{ color: 'var(--color-text)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--color-surface-2)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    disabled={saving}
                  >
                    Auto-fit Durations
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleApproveAndRender}
            className="btn btn-primary glow-primary w-full sm:w-auto"
            disabled={saving || status?.testMode || (!status?.ready && !status?.renderDryRun)}
          >
            Approve & Render
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Validation Panel */}
      {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
        <ValidationPanel validation={validation} />
      )}

      {/* Duration Summary */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-gray-400 text-sm">Total Duration:</span>
            <span className="ml-2 font-bold">{totalDuration.toFixed(1)}s</span>
          </div>
          <div>
            <span className="text-gray-400 text-sm">Target:</span>
            <span className="ml-2 font-bold">{project.targetLengthSec}s</span>
          </div>
          <div>
            <span className="text-gray-400 text-sm">Scenes:</span>
            <span className="ml-2 font-bold">{scenes.length}</span>
          </div>
          {estimates && (
            <div>
              <span className="text-gray-400 text-sm">Est. WPM:</span>
              <span className="ml-2 font-bold">{estimates.wpm}</span>
            </div>
          )}
        </div>

        <div
          className={`badge ${
            Math.abs(totalDuration - project.targetLengthSec) <= 5
              ? 'badge-success'
              : 'badge-warning'
          }`}
        >
          {totalDuration - project.targetLengthSec > 0 ? '+' : ''}
          {(totalDuration - project.targetLengthSec).toFixed(1)}s
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b" style={{ borderColor: 'var(--color-border)' }}>
        <nav className="flex gap-4">
          {(['hook', 'outline', 'script', 'scenes'] as const).map((tab) => {
            const tabLabels: Record<typeof tab, { title: string; desc: string }> = {
              hook: { title: 'Hook', desc: 'Choose hook' },
              outline: { title: 'Outline', desc: 'See structure' },
              script: { title: 'Script', desc: 'Full text' },
              scenes: { title: 'Scenes', desc: 'Edit scenes' },
            };
            const label = tabLabels[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab ? 'text-white' : 'border-transparent'
                }`}
                style={{
                  borderBottomColor: activeTab === tab ? 'var(--color-primary)' : 'transparent',
                  color: activeTab === tab ? 'var(--color-text)' : 'var(--color-text-muted)',
                }}
              >
                <div className="text-left">
                  <div>{label.title}</div>
                  <div className="text-xs font-normal opacity-75">{label.desc}</div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'hook' && (
          <HookTab
            hookOptions={hookOptions}
            hookSelected={planVersion.hookSelected}
            onSelect={handleHookSelect}
            onRegenerate={handleRegenerateHooks}
            disabled={saving}
          />
        )}

        {activeTab === 'outline' && (
          <OutlineTab
            outline={planVersion.outline}
            onChange={handleOutlineChange}
            onRegenerate={handleRegenerateOutline}
            disabled={saving}
          />
        )}

        {activeTab === 'script' && (
          <ScriptTab
            script={planVersion.scriptFull}
            onChange={handleScriptChange}
            onRegenerate={handleRegenerateScript}
            disabled={saving}
            estimates={estimates}
            targetLengthSec={project.targetLengthSec}
          />
        )}

        {activeTab === 'scenes' && (
          <ScenesTab
            scenes={scenes}
            onChange={handleSceneChange}
            onRegenerate={handleRegenerateScene}
            onToggleLock={handleToggleLock}
            disabled={saving}
          />
        )}
      </div>
    </div>
  );
}

// Hook Tab Component
function HookTab({
  hookOptions,
  hookSelected,
  onSelect,
  onRegenerate,
  disabled,
}: {
  hookOptions: string[];
  hookSelected: string;
  onSelect: (hook: string) => void;
  onRegenerate: () => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Select Hook</h3>
        <button onClick={onRegenerate} className="btn btn-secondary" disabled={disabled}>
          Regenerate Hooks
        </button>
      </div>

      <div className="grid gap-3">
        {hookOptions.map((hook, index) => (
          <button
            key={index}
            onClick={() => onSelect(hook)}
            className={`p-4 rounded-lg text-left transition-all ${
              hookSelected === hook
                ? 'border-2'
                : 'bg-gray-800 border-2 border-transparent hover:border-gray-600'
            }`}
            style={{
              background: hookSelected === hook ? 'rgba(59, 130, 246, 0.1)' : undefined,
              borderColor: hookSelected === hook ? 'var(--color-primary)' : undefined,
            }}
            disabled={disabled}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  hookSelected === hook ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-300'
                }`}
              >
                {hookSelected === hook ? '' : index + 1}
              </div>
              {hookSelected === hook && (
                <span className="text-xs text-blue-400 ml-1">Selected</span>
              )}
              <p className="text-sm">{hook}</p>
            </div>
          </button>
        ))}
      </div>

      {hookOptions.length === 0 && (
        <p className="text-gray-400 text-center py-8">No hooks generated yet</p>
      )}
    </div>
  );
}

// Outline Tab Component
function OutlineTab({
  outline,
  onChange,
  onRegenerate,
  disabled,
}: {
  outline: string;
  onChange: (value: string) => void;
  onRegenerate: () => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Video Outline</h3>
        <button onClick={onRegenerate} className="btn btn-secondary" disabled={disabled}>
          Regenerate Outline
        </button>
      </div>

      <textarea
        className="textarea min-h-[300px]"
        value={outline}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your video outline..."
      />
    </div>
  );
}

// Script Tab Component
function ScriptTab({
  script,
  onChange,
  onRegenerate,
  disabled,
  estimates,
  targetLengthSec,
}: {
  script: string;
  onChange: (value: string) => void;
  onRegenerate: () => void;
  disabled: boolean;
  estimates: { wpm: number; estimatedLengthSec: number } | null;
  targetLengthSec: number;
}) {
  const wordCount = script.split(/\s+/).filter((w) => w.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Full Script</h3>
          <span className="text-gray-400 text-sm">{wordCount} words</span>
          {estimates && (
            <span
              className={`text-sm ${
                Math.abs(estimates.estimatedLengthSec - targetLengthSec) <= 10
                  ? 'text-green-400'
                  : 'text-yellow-400'
              }`}
            >
              ~{estimates.estimatedLengthSec}s estimated
            </span>
          )}
        </div>
        <button onClick={onRegenerate} className="btn btn-secondary" disabled={disabled}>
          Regenerate Script
        </button>
      </div>

      <textarea
        className="textarea min-h-[400px] font-mono text-sm"
        value={script}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your full script..."
      />
    </div>
  );
}

// Scenes Tab Component
function ScenesTab({
  scenes,
  onChange,
  onRegenerate,
  onToggleLock,
  disabled,
}: {
  scenes: Scene[];
  onChange: (sceneId: string, field: keyof Scene, value: string | number | boolean) => void;
  onRegenerate: (sceneId: string) => void;
  onToggleLock: (sceneId: string, locked: boolean) => void;
  disabled: boolean;
}) {
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const [sceneMenuOpen, setSceneMenuOpen] = useState<string | null>(null);

  // Close scene menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-scene-menu="true"]')) return;
      setSceneMenuOpen(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Scene Timeline ({scenes.length} scenes)</h3>

      <div className="space-y-3">
        {scenes.map((scene, index) => (
          <div
            key={scene.id}
            className={`card transition-all ${scene.isLocked ? 'border-yellow-600/50' : ''}`}
          >
            {/* Scene Header */}
            <div
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedScene(expandedScene === scene.id ? null : scene.id)}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-bold">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium truncate max-w-md">
                    {scene.narrationText.substring(0, 60)}
                    {scene.narrationText.length > 60 ? '...' : ''}
                  </p>
                  <p className="text-gray-400 text-sm">
                    {scene.durationTargetSec.toFixed(1)}s • {scene.effectPreset}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {scene.isLocked && <span className="badge badge-warning">Locked</span>}
                <div className="relative" data-scene-menu="true">
                  <button
                    type="button"
                    className="btn btn-secondary text-xs px-2 py-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSceneMenuOpen((prev) => (prev === scene.id ? null : scene.id));
                    }}
                    aria-label="Scene menu"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.5h.01M12 12h.01M12 17.5h.01"
                      />
                    </svg>
                  </button>

                  {sceneMenuOpen === scene.id && (
                    <div
                      className="absolute right-0 top-full mt-2 w-40 rounded-lg border py-1 z-50"
                      style={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm transition-colors disabled:opacity-50"
                        style={{ color: 'var(--color-text)' }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = 'var(--color-surface-2)')
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => {
                          setSceneMenuOpen(null);
                          onToggleLock(scene.id, !scene.isLocked);
                        }}
                        disabled={disabled}
                      >
                        {scene.isLocked ? 'Unlock' : 'Lock'}
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm transition-colors disabled:opacity-50"
                        style={{ color: 'var(--color-text)' }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = 'var(--color-surface-2)')
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => {
                          setSceneMenuOpen(null);
                          onRegenerate(scene.id);
                        }}
                        disabled={disabled || scene.isLocked}
                      >
                        Regenerate
                      </button>
                    </div>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 transition-transform ${expandedScene === scene.id ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedScene === scene.id && (
              <div
                className="mt-4 pt-4 space-y-6"
                style={{ borderTop: '1px solid var(--color-border)' }}
              >
                {/* Tekst */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Tekst
                  </h4>
                  <div>
                    <label
                      className="block text-sm mb-1"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Narration
                    </label>
                    <textarea
                      className="textarea text-sm"
                      rows={3}
                      value={scene.narrationText}
                      onChange={(e) => onChange(scene.id, 'narrationText', e.target.value)}
                      disabled={scene.isLocked}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm mb-1"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      On-Screen Text
                    </label>
                    <input
                      type="text"
                      className="input text-sm"
                      value={scene.onScreenText}
                      onChange={(e) => onChange(scene.id, 'onScreenText', e.target.value)}
                      disabled={scene.isLocked}
                    />
                  </div>
                </div>

                {/* Czas i efekt */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Czas i efekt
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        className="block text-sm mb-1"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Duration (sec)
                      </label>
                      <input
                        type="number"
                        className="input text-sm"
                        step="0.5"
                        min="3"
                        max="30"
                        value={scene.durationTargetSec}
                        onChange={(e) =>
                          onChange(scene.id, 'durationTargetSec', parseFloat(e.target.value))
                        }
                        disabled={scene.isLocked}
                      />
                    </div>
                    <div>
                      <label
                        className="block text-sm mb-1"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Effect
                      </label>
                      <select
                        className="select text-sm"
                        value={scene.effectPreset}
                        onChange={(e) => onChange(scene.id, 'effectPreset', e.target.value)}
                        disabled={scene.isLocked}
                      >
                        {EFFECT_PRESETS.map((effect) => (
                          <option key={effect} value={effect}>
                            {effect.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Obraz */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    Obraz
                  </h4>
                  <div>
                    <label
                      className="block text-sm mb-1"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Visual Prompt
                    </label>
                    <textarea
                      className="textarea text-sm"
                      rows={2}
                      value={scene.visualPrompt}
                      onChange={(e) => onChange(scene.id, 'visualPrompt', e.target.value)}
                      disabled={scene.isLocked}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm mb-1"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Negative Prompt
                    </label>
                    <input
                      type="text"
                      className="input text-sm"
                      value={scene.negativePrompt}
                      onChange={(e) => onChange(scene.id, 'negativePrompt', e.target.value)}
                      disabled={scene.isLocked}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {scenes.length === 0 && (
        <p className="text-gray-400 text-center py-8">No scenes generated yet</p>
      )}
    </div>
  );
}
