import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getProject,
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
  const [estimates, setEstimates] = useState<{ wpm: number; estimatedLengthSec: number; targetLengthSec: number } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'hook' | 'outline' | 'script' | 'scenes'>('hook');
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load project and plan
  useEffect(() => {
    if (!projectId) return;
    
    setLoading(true);
    getProject(projectId)
      .then((proj) => {
        setProject(proj);
        
        if (proj.planVersions && proj.planVersions.length > 0) {
          const pv = proj.planVersions[0];
          setPlanVersion(pv);
          setScenes(pv.scenes || []);
          
          try {
            setHookOptions(JSON.parse(pv.hookOptionsJson || '[]'));
            setEstimates(JSON.parse(pv.estimatesJson || '{}'));
            setValidation(JSON.parse(pv.validationJson || '{}'));
          } catch {
            setHookOptions([]);
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Autosave with debounce
  const autosave = useCallback(async (data: Partial<{ hookSelected: string; outline: string; scriptFull: string; scenes: Partial<Scene>[] }>) => {
    if (!planVersion?.id) return;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    setSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const updated = await updatePlanVersion(planVersion.id, data);
        setPlanVersion(updated);
        if (updated.scenes) {
          setScenes(updated.scenes);
        }
      } catch (err) {
        console.error('Autosave failed:', err);
      } finally {
        setSaving(false);
      }
    }, 600);
  }, [planVersion?.id]);

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

  const handleSceneChange = (sceneId: string, field: keyof Scene, value: string | number | boolean) => {
    const updatedScenes = scenes.map((s) =>
      s.id === sceneId ? { ...s, [field]: value } : s
    );
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
      setError(err instanceof Error ? err.message : 'Failed to regenerate hooks');
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
      setError(err instanceof Error ? err.message : 'Failed to regenerate outline');
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
      setError(err instanceof Error ? err.message : 'Failed to regenerate script');
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
      setError(err instanceof Error ? err.message : 'Failed to regenerate scene');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleLock = async (sceneId: string, locked: boolean) => {
    try {
      const updated = await toggleSceneLock(sceneId, locked);
      setScenes(scenes.map((s) => (s.id === sceneId ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle lock');
    }
  };

  const handleValidate = async () => {
    if (!planVersion?.id) return;
    try {
      const result = await validatePlan(planVersion.id);
      setValidation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate');
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
      setError(err instanceof Error ? err.message : 'Failed to autofit');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveAndRender = async () => {
    if (!planVersion?.id) return;
    
    // Check OpenAI status
    if (!status?.providers.openai) {
      setError('Cannot render: OpenAI API key not configured. Set OPENAI_API_KEY in .env file.');
      return;
    }
    
    if (!status?.providers.ffmpeg) {
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

      // Navigate to run page
      navigate(`/run/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start render');
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
            {project.nichePackId} • {project.targetLengthSec}s target • {project.tempo} tempo
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-gray-400 text-sm flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          )}
          
          <button onClick={handleValidate} className="btn btn-secondary">
            Validate
          </button>
          
          <button onClick={handleAutofit} className="btn btn-secondary">
            Auto-fit Durations
          </button>
          
          <button
            onClick={handleApproveAndRender}
            className="btn btn-primary"
            disabled={saving || !status?.ready}
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
        <div className="card space-y-2">
          {validation.errors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-red-400 text-sm">
              <span className="w-4 h-4 rounded-full bg-red-600 flex items-center justify-center text-xs">!</span>
              {err}
            </div>
          ))}
          {validation.warnings.map((warn, i) => (
            <div key={i} className="flex items-center gap-2 text-yellow-400 text-sm">
              <span className="w-4 h-4 rounded-full bg-yellow-600 flex items-center justify-center text-xs">!</span>
              {warn}
            </div>
          ))}
          {validation.suggestions.map((sug, i) => (
            <div key={i} className="flex items-center gap-2 text-blue-400 text-sm">
              <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-xs">i</span>
              {sug}
            </div>
          ))}
        </div>
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
      <div className="border-b border-gray-800">
        <nav className="flex gap-4">
          {(['hook', 'outline', 'script', 'scenes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-green-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
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
                ? 'bg-green-900/50 border-2 border-green-500'
                : 'bg-gray-800 border-2 border-transparent hover:border-gray-600'
            }`}
            disabled={disabled}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  hookSelected === hook ? 'bg-green-500' : 'bg-gray-600'
                }`}
              >
                {hookSelected === hook ? '✓' : index + 1}
              </div>
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
        disabled={disabled}
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
        disabled={disabled}
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

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Scene Timeline ({scenes.length} scenes)</h3>

      <div className="space-y-3">
        {scenes.map((scene, index) => (
          <div
            key={scene.id}
            className={`card transition-all ${
              scene.isLocked ? 'border-yellow-600/50' : ''
            }`}
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
                {scene.isLocked && (
                  <span className="badge badge-warning">Locked</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLock(scene.id, !scene.isLocked);
                  }}
                  className="btn btn-secondary text-xs px-2 py-1"
                >
                  {scene.isLocked ? 'Unlock' : 'Lock'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRegenerate(scene.id);
                  }}
                  className="btn btn-secondary text-xs px-2 py-1"
                  disabled={disabled || scene.isLocked}
                >
                  Regen
                </button>
                <span className="text-gray-500">
                  {expandedScene === scene.id ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedScene === scene.id && (
              <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Narration</label>
                  <textarea
                    className="textarea text-sm"
                    rows={3}
                    value={scene.narrationText}
                    onChange={(e) => onChange(scene.id, 'narrationText', e.target.value)}
                    disabled={disabled || scene.isLocked}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">On-Screen Text</label>
                    <input
                      type="text"
                      className="input text-sm"
                      value={scene.onScreenText}
                      onChange={(e) => onChange(scene.id, 'onScreenText', e.target.value)}
                      disabled={disabled || scene.isLocked}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Duration (sec)</label>
                    <input
                      type="number"
                      className="input text-sm"
                      step="0.5"
                      min="3"
                      max="30"
                      value={scene.durationTargetSec}
                      onChange={(e) => onChange(scene.id, 'durationTargetSec', parseFloat(e.target.value))}
                      disabled={disabled || scene.isLocked}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Visual Prompt</label>
                  <textarea
                    className="textarea text-sm"
                    rows={2}
                    value={scene.visualPrompt}
                    onChange={(e) => onChange(scene.id, 'visualPrompt', e.target.value)}
                    disabled={disabled || scene.isLocked}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Negative Prompt</label>
                    <input
                      type="text"
                      className="input text-sm"
                      value={scene.negativePrompt}
                      onChange={(e) => onChange(scene.id, 'negativePrompt', e.target.value)}
                      disabled={disabled || scene.isLocked}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Effect</label>
                    <select
                      className="select text-sm"
                      value={scene.effectPreset}
                      onChange={(e) => onChange(scene.id, 'effectPreset', e.target.value)}
                      disabled={disabled || scene.isLocked}
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
