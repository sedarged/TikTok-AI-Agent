import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

type Run = { id: string; status: string; progress: number; currentStep?: string | null; createdAt: string; updatedAt: string }

export function RenderQueuePage() {
  const { projectId } = useParams()
  const nav = useNavigate()
  const loc = useLocation() as any
  const [project, setProject] = useState<any | null>(null)
  const [planVersionId, setPlanVersionId] = useState<string | null>(loc?.state?.planVersionId || null)
  const [runs, setRuns] = useState<Run[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [providers, setProviders] = useState<{ openai: boolean } | null>(null)

  useEffect(() => {
    if (!projectId) return
    api<{ project: any; latestPlan: any }>(`/project/${projectId}`)
      .then((d) => {
        setProject(d.project)
        setPlanVersionId((p) => p || d.latestPlan?.id || null)
      })
      .catch((e: any) => setErr(e?.error || 'Failed to load project'))
    api<{ runs: Run[] }>(`/project/${projectId}/runs`)
      .then((d) => setRuns(d.runs))
      .catch(() => {})
    api<{ providers: { openai: boolean } }>('/status')
      .then((d) => setProviders(d.providers))
      .catch(() => {})
  }, [projectId])

  const canRender = useMemo(() => {
    if (!project) return { ok: false, reason: 'Project not loaded.' }
    if (!planVersionId) return { ok: false, reason: 'No planVersionId found.' }
    if (project.status !== 'APPROVED') return { ok: false, reason: `Project status is ${project.status}. You must approve the plan first.` }
    if (!providers?.openai) return { ok: false, reason: 'OPENAI_API_KEY is not configured on the server. Rendering requires OpenAI (TTS, images, Whisper).' }
    return { ok: true as const, reason: '' }
  }, [project, planVersionId, providers])

  async function refreshRuns() {
    if (!projectId) return
    const d = await api<{ runs: Run[] }>(`/project/${projectId}/runs`)
    setRuns(d.runs)
  }

  async function onStartRender() {
    if (!planVersionId) return
    if (!canRender.ok) return
    setBusy(true)
    setErr(null)
    try {
      const r = await api<{ run: any }>(`/plan/${planVersionId}/render`, { method: 'POST' })
      await refreshRuns()
      nav(`/output/${r.run.id}`)
    } catch (e: any) {
      setErr(e?.error || 'Render failed to start.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-sm font-semibold">Render Queue / Progress</div>
        <div className="mt-2 text-xs text-zinc-400">Project: {project?.title || '…'}</div>

        {!canRender.ok ? (
          <div className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
            Start Render blocked: {canRender.reason}
          </div>
        ) : null}

        {err ? <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-200">{err}</div> : null}

        <button
          onClick={onStartRender}
          disabled={busy || !canRender.ok}
          className="mt-3 w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
        >
          {busy ? 'Starting…' : 'Start Render'}
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Runs</div>
          <button className="text-xs text-zinc-300 underline" onClick={refreshRuns}>
            refresh
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {runs.length === 0 ? <div className="text-xs text-zinc-500">No runs yet.</div> : null}
          {runs.map((r) => (
            <button
              key={r.id}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-sm hover:border-zinc-600"
              onClick={() => nav(`/output/${r.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="truncate">{r.id}</div>
                <div className="ml-2 shrink-0 text-[11px] text-zinc-500">{r.status}</div>
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">
                {r.progress}% {r.currentStep ? `• ${r.currentStep}` : ''}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

