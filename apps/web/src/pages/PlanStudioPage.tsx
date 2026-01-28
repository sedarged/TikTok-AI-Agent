import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

type Scene = {
  id: string
  idx: number
  narrationText: string
  onScreenText: string
  visualPrompt: string
  negativePrompt: string
  effectPreset: string
  durationTargetSec: number
  lock: boolean
}

type Payload = {
  hookOptions: string[]
  hookSelected: string
  outline: string
  scriptFull: string
  scenes: Scene[]
  estimates: { wpm: number; estimatedLengthSec: number; targetLengthSec: number }
  validation: { errors: string[]; warnings: string[]; suggestions: string[] }
}

export function PlanStudioPage() {
  const { projectId } = useParams()
  const nav = useNavigate()
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [project, setProject] = useState<any | null>(null)
  const [planVersion, setPlanVersion] = useState<any | null>(null)
  const [payload, setPayload] = useState<Payload | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimer = useRef<number | null>(null)

  async function refresh() {
    if (!projectId) return
    const d = await api<{ project: any; latestPlan: any }>(`/project/${projectId}`)
    setProject(d.project)
    setPlanVersion(d.latestPlan)
    if (d.latestPlan) setPayload(planToPayload(d.latestPlan))
  }

  useEffect(() => {
    if (!projectId) return
    setErr(null)
    refresh()
      .catch((e: any) => setErr(e?.error || 'Failed to load project'))
  }, [projectId])

  const canApprove = useMemo(() => {
    if (!project || !planVersion || !payload) return { ok: false, reason: 'No plan loaded.' }
    if (payload.validation?.errors?.length) return { ok: false, reason: 'Plan has validation errors.' }
    return { ok: true as const, reason: '' }
  }, [project, planVersion, payload])

  async function saveNow(nextPayload: Payload) {
    if (!planVersion) return
    setSaveStatus('saving')
    try {
      const updated = await api<{ planVersion: any }>(`/plan/${planVersion.id}`, {
        method: 'PUT',
        body: JSON.stringify({ payload: nextPayload }),
      })
      setPlanVersion(updated.planVersion)
      setSaveStatus('saved')
    } catch (e) {
      setSaveStatus('error')
    }
  }

  function scheduleSave(nextPayload: Payload) {
    setSaveStatus('dirty')
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => saveNow(nextPayload), 600)
  }

  async function onValidate() {
    if (!planVersion) return
    setBusy(true)
    setErr(null)
    try {
      const v = await api<{ validation: any }>(`/plan/${planVersion.id}/validate`, { method: 'POST' })
      setPayload((p) => (p ? { ...p, validation: v.validation } : p))
    } catch (e: any) {
      setErr(e?.error || 'Validate failed')
    } finally {
      setBusy(false)
    }
  }

  async function onRegenerateHooks() {
    if (!planVersion) return
    setBusy(true)
    setErr(null)
    try {
      await api(`/plan/${planVersion.id}/regenerate/hooks`, { method: 'POST' })
      await refresh()
    } catch (e: any) {
      setErr(e?.error || 'Regenerate hooks failed')
    } finally {
      setBusy(false)
    }
  }

  async function onRegenerateOutline() {
    if (!planVersion) return
    setBusy(true)
    setErr(null)
    try {
      await api(`/plan/${planVersion.id}/regenerate/outline`, { method: 'POST' })
      await refresh()
    } catch (e: any) {
      setErr(e?.error || 'Regenerate outline failed')
    } finally {
      setBusy(false)
    }
  }

  async function onRegenerateScript() {
    if (!planVersion) return
    setBusy(true)
    setErr(null)
    try {
      await api(`/plan/${planVersion.id}/regenerate/script`, { method: 'POST' })
      await refresh()
    } catch (e: any) {
      setErr(e?.error || 'Regenerate script failed')
    } finally {
      setBusy(false)
    }
  }

  async function onAutofit() {
    if (!planVersion) return
    setBusy(true)
    setErr(null)
    try {
      const r = await api<{ scenes: any[] }>(`/plan/${planVersion.id}/autofit`, { method: 'POST' })
      setPayload((p) => {
        if (!p) return p
        const scenes = r.scenes.map((s) => ({
          id: s.id,
          idx: s.idx,
          narrationText: s.narrationText,
          onScreenText: s.onScreenText,
          visualPrompt: s.visualPrompt,
          negativePrompt: s.negativePrompt,
          effectPreset: s.effectPreset,
          durationTargetSec: s.durationTargetSec,
          lock: s.isLocked,
        }))
        const next = { ...p, scenes }
        scheduleSave(next)
        return next
      })
    } catch (e: any) {
      setErr(e?.error || 'Auto-fit failed')
    } finally {
      setBusy(false)
    }
  }

  async function onRegenerateScene(sceneId: string) {
    setBusy(true)
    setErr(null)
    try {
      const r = await api<{ scene: any }>(`/scene/${sceneId}/regenerate`, { method: 'POST' })
      setPayload((p) => {
        if (!p) return p
        const scenes = p.scenes.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                narrationText: r.scene.narrationText,
                onScreenText: r.scene.onScreenText,
                visualPrompt: r.scene.visualPrompt,
                negativePrompt: r.scene.negativePrompt,
                effectPreset: r.scene.effectPreset,
                durationTargetSec: r.scene.durationTargetSec,
              }
            : s,
        )
        const next = { ...p, scenes }
        scheduleSave(next)
        return next
      })
    } catch (e: any) {
      setErr(e?.error || 'Scene regenerate failed')
    } finally {
      setBusy(false)
    }
  }

  async function onApproveAndRender() {
    if (!planVersion || !projectId) return
    if (!canApprove.ok) return
    setBusy(true)
    setErr(null)
    try {
      await api(`/plan/${planVersion.id}/approve`, { method: 'POST' })
      nav(`/render/${projectId}`, { state: { planVersionId: planVersion.id } })
    } catch (e: any) {
      setErr(e?.error || 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  async function onGeneratePlanForExisting() {
    if (!projectId) return
    setBusy(true)
    setErr(null)
    try {
      const plan = await api<{ planVersion: any }>(`/project/${projectId}/plan`, { method: 'POST' })
      setPlanVersion(plan.planVersion)
      setPayload(planToPayload(plan.planVersion))
    } catch (e: any) {
      setErr(e?.error || 'Generate plan failed')
    } finally {
      setBusy(false)
    }
  }

  if (!projectId) return null

  if (!project) {
    return <div className="text-sm text-zinc-400">Loading…</div>
  }

  if (!payload || !planVersion) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-sm font-semibold">Plan &amp; Preview Studio</div>
          <div className="mt-2 text-xs text-zinc-400">No plan exists for this project yet.</div>
          <button
            onClick={onGeneratePlanForExisting}
            disabled={busy}
            className="mt-3 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {busy ? 'Generating…' : 'Generate Plan'}
          </button>
          {err ? <div className="mt-3 text-xs text-red-200">{err}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Plan &amp; Preview Studio</div>
            <div className="text-[11px] text-zinc-400">
              Autosave: {saveStatus === 'dirty' ? 'pending…' : saveStatus === 'saving' ? 'saving…' : saveStatus === 'saved' ? 'saved' : saveStatus}
            </div>
          </div>
          <button onClick={() => nav('/')} className="text-xs text-zinc-300 underline">
            New
          </button>
        </div>

        <div className="mt-3 space-y-4">
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-200">1) Hook</div>
              <button
                disabled={busy}
                onClick={onRegenerateHooks}
                className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] disabled:opacity-50"
              >
                Regenerate Hooks
              </button>
            </div>
            <select
              value={payload.hookSelected}
              onChange={(e) => {
                const next = { ...payload, hookSelected: e.target.value }
                setPayload(next)
                scheduleSave(next)
              }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
            >
              {payload.hookOptions.map((h, i) => (
                <option key={i} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-zinc-500">Hook options (5):</div>
            <ul className="list-decimal space-y-1 pl-5 text-xs text-zinc-300">
              {payload.hookOptions.map((h, i) => (
                <li key={i} className={h === payload.hookSelected ? 'text-emerald-200' : ''}>
                  {h}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-200">2) Outline</div>
              <button
                disabled={busy}
                onClick={onRegenerateOutline}
                className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] disabled:opacity-50"
              >
                Regenerate Outline
              </button>
            </div>
            <textarea
              value={payload.outline}
              onChange={(e) => {
                const next = { ...payload, outline: e.target.value }
                setPayload(next)
                scheduleSave(next)
              }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              rows={5}
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-200">3) Full Script</div>
              <button
                disabled={busy}
                onClick={onRegenerateScript}
                className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] disabled:opacity-50"
              >
                Regenerate Script
              </button>
            </div>
            <div className="text-[11px] text-zinc-400">
              <div className="text-[11px] text-zinc-400">
                est {payload.estimates.estimatedLengthSec}s vs target {payload.estimates.targetLengthSec}s (WPM {payload.estimates.wpm})
              </div>
            </div>
            <textarea
              value={payload.scriptFull}
              onChange={(e) => {
                const next = { ...payload, scriptFull: e.target.value }
                setPayload(next)
                scheduleSave(next)
              }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              rows={7}
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-zinc-200">4) Scenes timeline</div>
              <div className="text-[11px] text-zinc-400">{payload.scenes.length} scenes</div>
            </div>
            <div className="space-y-3">
              {payload.scenes.map((s) => (
                <div key={s.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-semibold">Scene {s.idx + 1}</div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-[11px] text-zinc-300">
                        <input
                          type="checkbox"
                          checked={s.lock}
                          onChange={(e) => {
                            const scenes = payload.scenes.map((x) => (x.id === s.id ? { ...x, lock: e.target.checked } : x))
                            const next = { ...payload, scenes }
                            setPayload(next)
                            scheduleSave(next)
                          }}
                        />
                        lock
                      </label>
                      <button
                        disabled={busy || s.lock}
                        onClick={() => onRegenerateScene(s.id)}
                        className="rounded-md border border-zinc-700 px-2 py-1 text-[11px] disabled:opacity-50"
                        title={s.lock ? 'Blocked: scene is locked' : 'Regenerate this scene'}
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <div className="text-[11px] text-zinc-400">Effect</div>
                      <select
                        value={s.effectPreset}
                        onChange={(e) => {
                          const scenes = payload.scenes.map((x) => (x.id === s.id ? { ...x, effectPreset: e.target.value } : x))
                          const next = { ...payload, scenes }
                          setPayload(next)
                          scheduleSave(next)
                        }}
                        className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
                      >
                        {[
                          'slow_zoom_in',
                          'slow_zoom_out',
                          'pan_left',
                          'pan_right',
                          'tilt_up',
                          'tilt_down',
                          'flash_cut',
                          'fade',
                          'glitch',
                        ].map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-[11px] text-zinc-400">Duration (sec)</div>
                      <input
                        type="number"
                        value={s.durationTargetSec}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          const scenes = payload.scenes.map((x) => (x.id === s.id ? { ...x, durationTargetSec: v } : x))
                          const next = { ...payload, scenes }
                          setPayload(next)
                          scheduleSave(next)
                        }}
                        className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
                      />
                    </label>
                  </div>

                  <label className="mt-2 block">
                    <div className="text-[11px] text-zinc-400">Narration</div>
                    <textarea
                      value={s.narrationText}
                      onChange={(e) => {
                        const scenes = payload.scenes.map((x) => (x.id === s.id ? { ...x, narrationText: e.target.value } : x))
                        const next = { ...payload, scenes }
                        setPayload(next)
                        scheduleSave(next)
                      }}
                      className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
                      rows={3}
                    />
                  </label>

                  <label className="mt-2 block">
                    <div className="text-[11px] text-zinc-400">On-screen text</div>
                    <input
                      value={s.onScreenText}
                      onChange={(e) => {
                        const scenes = payload.scenes.map((x) => (x.id === s.id ? { ...x, onScreenText: e.target.value } : x))
                        const next = { ...payload, scenes }
                        setPayload(next)
                        scheduleSave(next)
                      }}
                      className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
                    />
                  </label>

                  <label className="mt-2 block">
                    <div className="text-[11px] text-zinc-400">Visual prompt</div>
                    <textarea
                      value={s.visualPrompt}
                      onChange={(e) => {
                        const scenes = payload.scenes.map((x) => (x.id === s.id ? { ...x, visualPrompt: e.target.value } : x))
                        const next = { ...payload, scenes }
                        setPayload(next)
                        scheduleSave(next)
                      }}
                      className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
                      rows={3}
                    />
                  </label>

                  <label className="mt-2 block">
                    <div className="text-[11px] text-zinc-400">Negative prompt</div>
                    <input
                      value={s.negativePrompt}
                      onChange={(e) => {
                        const scenes = payload.scenes.map((x) => (x.id === s.id ? { ...x, negativePrompt: e.target.value } : x))
                        const next = { ...payload, scenes }
                        setPayload(next)
                        scheduleSave(next)
                      }}
                      className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-zinc-600"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="text-xs font-semibold text-zinc-200">5) Validation</div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs">
              <div className="text-zinc-300">Errors</div>
              {payload.validation.errors.length ? (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-red-200">
                  {payload.validation.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1 text-emerald-200">None</div>
              )}

              {payload.validation.warnings.length ? (
                <>
                  <div className="mt-3 text-zinc-300">Warnings</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-200">
                    {payload.validation.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              {payload.validation.suggestions.length ? (
                <>
                  <div className="mt-3 text-zinc-300">Suggestions</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-zinc-200">
                    {payload.validation.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2">
            <button
              onClick={onValidate}
              disabled={busy}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
            >
              Validate
            </button>
            <button
              onClick={onAutofit}
              disabled={busy}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm disabled:opacity-50"
            >
              Auto-fit durations
            </button>
          </section>

          {err ? <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-200">{err}</div> : null}
        </div>
      </div>

      {!canApprove.ok ? (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
          Approve &amp; Render blocked: {canApprove.reason}
        </div>
      ) : null}
      <button
        onClick={onApproveAndRender}
        disabled={busy || !canApprove.ok}
        className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
      >
        {busy ? 'Working…' : 'Approve & Render'}
      </button>
    </div>
  )
}

function planToPayload(plan: any): Payload {
  const hookOptions = JSON.parse(plan.hookOptionsJson)
  const estimates = JSON.parse(plan.estimatesJson)
  const validation = JSON.parse(plan.validationJson)
  const scenes: Scene[] = (plan.scenes || []).map((s: any) => ({
    id: s.id,
    idx: s.idx,
    narrationText: s.narrationText,
    onScreenText: s.onScreenText,
    visualPrompt: s.visualPrompt,
    negativePrompt: s.negativePrompt,
    effectPreset: s.effectPreset,
    durationTargetSec: s.durationTargetSec,
    lock: s.isLocked,
  }))
  return {
    hookOptions,
    hookSelected: plan.hookSelected,
    outline: plan.outline,
    scriptFull: plan.scriptFull,
    scenes,
    estimates,
    validation,
  }
}

