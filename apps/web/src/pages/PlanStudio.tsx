import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { SectionCard } from "../components/SectionCard";
import { StatusBar } from "../components/StatusBar";

const effectPresets = [
  "slow_zoom_in",
  "slow_zoom_out",
  "pan_left",
  "pan_right",
  "tilt_up",
  "tilt_down",
  "flash_cut",
  "fade",
  "glitch"
];

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function PlanStudio() {
  const { projectId } = useParams<{ projectId: string }>();
  const query = useQuery();
  const navigate = useNavigate();
  const [planVersionId, setPlanVersionId] = useState<string | null>(query.get("planVersionId"));
  const [project, setProject] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const readyRef = useRef(false);
  const skipSaveRef = useRef(false);

  useEffect(() => {
    api.getStatus().then((data) => setStatus(data));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    api.getProject(projectId).then((data) => {
      setProject(data.project);
      if (data.plan) {
        skipSaveRef.current = true;
        setPlan(data.plan);
      }
      if (data.project?.latestPlanVersionId) {
        setPlanVersionId(data.project.latestPlanVersionId);
      }
      readyRef.current = true;
    });
  }, [projectId]);

  useEffect(() => {
    if (!planVersionId || !plan || !readyRef.current) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        const res = await api.updatePlan(planVersionId, plan);
        skipSaveRef.current = true;
        setPlan(res.plan);
        setLastSaved(new Date().toLocaleTimeString());
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    }, 600);
  }, [planVersionId, plan]);

  const updatePlan = (patch: any) => {
    setPlan((prev: any) => ({ ...prev, ...patch }));
  };

  const updateScene = (idx: number, patch: any) => {
    setPlan((prev: any) => ({
      ...prev,
      scenes: prev.scenes.map((scene: any, i: number) => (i === idx ? { ...scene, ...patch } : scene))
    }));
  };

  const handleRegenerateScene = async (sceneId: string) => {
    if (!planVersionId) return;
    try {
      const res = await api.regenerateScene(sceneId);
      setPlan((prev: any) => ({
        ...prev,
        scenes: prev.scenes.map((scene: any) => (scene.id === sceneId ? { ...scene, ...res.scene } : scene))
      }));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRegenerateHooks = async () => {
    if (!planVersionId) return;
    try {
      const res = await api.regenerateHooks(planVersionId);
      updatePlan({ hookOptions: res.hookOptions, hookSelected: res.hookSelected });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRegenerateOutline = async () => {
    if (!planVersionId) return;
    try {
      const res = await api.regenerateOutline(planVersionId);
      updatePlan({ outline: res.outline });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRegenerateScript = async () => {
    if (!planVersionId) return;
    try {
      const res = await api.regenerateScript(planVersionId);
      updatePlan({ scriptFull: res.scriptFull, scenes: res.scenes });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAutofit = async () => {
    if (!planVersionId) return;
    try {
      const res = await api.autofitPlan(planVersionId);
      setPlan(res.plan);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleApproveAndRender = async () => {
    if (!planVersionId || !projectId) return;
    setError(null);
    try {
      await api.approvePlan(planVersionId);
      const run = await api.renderPlan(planVersionId);
      navigate(`/render/${projectId}?runId=${run.runId}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!plan || !project) {
    return <div className="p-6 text-slate-300">Loading plan...</div>;
  }

  const est = plan.estimates || { wpm: 0, estimatedLengthSec: 0, targetLengthSec: 0 };
  const validation = plan.validation || { errors: [], warnings: [], suggestions: [] };
  const renderBlocked =
    !status?.providers?.openaiConfigured || validation.errors?.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Plan & Preview Studio</h2>
        <div className="text-xs text-slate-400">Project: {project.title}</div>
        {status && (
          <StatusBar
            openaiConfigured={status.providers.openaiConfigured}
            elevenlabsConfigured={status.providers.elevenlabsConfigured}
            ffmpegAvailable={status.ffmpeg.ffmpegAvailable}
          />
        )}
        {saving && <div className="text-xs text-slate-400">Autosaving...</div>}
        {lastSaved && <div className="text-xs text-slate-500">Last saved at {lastSaved}</div>}
      </header>

      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

      <SectionCard
        title="Hook"
        actions={
          <button
            onClick={handleRegenerateHooks}
            className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200"
          >
            Regenerate Hooks
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="text-sm text-slate-300">
            Hook selected
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
              rows={2}
              value={plan.hookSelected}
              onChange={(e) => updatePlan({ hookSelected: e.target.value })}
            />
          </label>
          <div className="grid gap-2 text-sm text-slate-300">
            {plan.hookOptions.map((hook: string, idx: number) => (
              <input
                key={idx}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
                value={hook}
                onChange={(e) =>
                  updatePlan({
                    hookOptions: plan.hookOptions.map((item: string, i: number) =>
                      i === idx ? e.target.value : item
                    )
                  })
                }
              />
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Outline"
        actions={
          <button
            onClick={handleRegenerateOutline}
            className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200"
          >
            Regenerate Outline
          </button>
        }
      >
        <textarea
          className="min-h-[120px] w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
          value={plan.outline}
          onChange={(e) => updatePlan({ outline: e.target.value })}
        />
      </SectionCard>

      <SectionCard
        title="Full Script"
        actions={
          <button
            onClick={handleRegenerateScript}
            className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200"
          >
            Regenerate Script
          </button>
        }
      >
        <textarea
          className="min-h-[160px] w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
          value={plan.scriptFull}
          onChange={(e) => updatePlan({ scriptFull: e.target.value })}
        />
        <div className="mt-2 text-xs text-slate-400">
          WPM: {est.wpm} • Estimated length: {est.estimatedLengthSec}s • Target: {est.targetLengthSec}s
        </div>
      </SectionCard>

      <SectionCard
        title={`Scenes Timeline (${plan.scenes.length})`}
        actions={
          <button
            onClick={handleAutofit}
            className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200"
          >
            Auto-fit durations
          </button>
        }
      >
        <div className="flex flex-col gap-4">
          {plan.scenes.map((scene: any, idx: number) => (
            <div key={scene.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <div>Scene {idx + 1}</div>
                <label className="flex items-center gap-2">
                  <span>Lock</span>
                  <input
                    type="checkbox"
                    checked={scene.lock}
                    onChange={(e) => updateScene(idx, { lock: e.target.checked })}
                  />
                </label>
              </div>
              <div className="grid gap-2">
                <textarea
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
                  rows={2}
                  value={scene.narrationText}
                  onChange={(e) => updateScene(idx, { narrationText: e.target.value })}
                  placeholder="Narration text"
                />
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
                  value={scene.onScreenText}
                  onChange={(e) => updateScene(idx, { onScreenText: e.target.value })}
                  placeholder="On-screen text"
                />
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
                  value={scene.visualPrompt}
                  onChange={(e) => updateScene(idx, { visualPrompt: e.target.value })}
                  placeholder="Visual prompt"
                />
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
                  value={scene.negativePrompt}
                  onChange={(e) => updateScene(idx, { negativePrompt: e.target.value })}
                  placeholder="Negative prompt"
                />
                <div className="flex flex-wrap gap-2">
                  <select
                    className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
                    value={scene.effectPreset}
                    onChange={(e) => updateScene(idx, { effectPreset: e.target.value })}
                  >
                    {effectPresets.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    className="w-24 rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
                    value={scene.durationTargetSec}
                    onChange={(e) => updateScene(idx, { durationTargetSec: Number(e.target.value) })}
                  />
                  <button
                    type="button"
                    onClick={() => handleRegenerateScene(scene.id)}
                    disabled={scene.lock}
                    className="rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200"
                  >
                    Regenerate Scene
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Validation">
        <div className="grid gap-2 text-sm">
          <div>
            <div className="text-xs uppercase text-slate-400">Errors</div>
            {validation.errors.length ? (
              <ul className="list-disc pl-5 text-rose-300">
                {validation.errors.map((err: string) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : (
              <div className="text-slate-500">No errors.</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Warnings</div>
            {validation.warnings.length ? (
              <ul className="list-disc pl-5 text-amber-300">
                {validation.warnings.map((err: string) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : (
              <div className="text-slate-500">No warnings.</div>
            )}
          </div>
          <div>
            <div className="text-xs uppercase text-slate-400">Suggestions</div>
            {validation.suggestions.length ? (
              <ul className="list-disc pl-5 text-emerald-300">
                {validation.suggestions.map((err: string) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : (
              <div className="text-slate-500">No suggestions.</div>
            )}
          </div>
        </div>
      </SectionCard>

      {renderBlocked && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          {validation.errors.length
            ? "Render blocked: resolve validation errors first."
            : "Render blocked: OpenAI API key missing."}
        </div>
      )}

      <button
        onClick={handleApproveAndRender}
        disabled={renderBlocked}
        className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        Approve & Render
      </button>
    </div>
  );
}
