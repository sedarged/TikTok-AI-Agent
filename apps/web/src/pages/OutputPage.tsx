import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/client'

type Run = {
  id: string
  status: string
  progress: number
  currentStep?: string | null
  logsJson: string
  artifactsJson: string
  projectId: string
  planVersionId: string
}

export function OutputPage() {
  const { runId } = useParams()
  const nav = useNavigate()
  const [run, setRun] = useState<Run | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [verify, setVerify] = useState<any | null>(null)
  const pollRef = useRef<number | null>(null)

  async function load() {
    if (!runId) return
    const r = await api<{ run: Run }>(`/run/${runId}`)
    setRun(r.run)
    // Auto-verify once we reach terminal states.
    if (r.run.status === 'done' || r.run.status === 'failed') {
      try {
        const v = await api<any>(`/run/${runId}/verify`)
        setVerify(v)
      } catch {}
    }
  }

  useEffect(() => {
    if (!runId) return
    setErr(null)
    load().catch((e: any) => setErr(e?.error || 'Failed to load run'))
    pollRef.current = window.setInterval(() => {
      load().catch(() => {})
    }, 1200)
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [runId])

  const logs = useMemo(() => {
    if (!run) return []
    try {
      return JSON.parse(run.logsJson) as Array<{ ts: string; msg: string }>
    } catch {
      return []
    }
  }, [run])

  const isReady = Boolean(verify?.pass)

  async function onVerify() {
    if (!runId) return
    setErr(null)
    try {
      const v = await api<any>(`/run/${runId}/verify`)
      setVerify(v)
    } catch (e: any) {
      setErr(e?.error || 'Verify failed')
    }
  }

  if (!runId) return null

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Output</div>
            <div className="text-[11px] text-zinc-400">
              {run
                ? `${run.status} • ${run.progress}% ${run.currentStep ? `• ${run.currentStep}` : ''}${isReady ? ' • Ready' : ''}`
                : 'Loading…'}
            </div>
          </div>
          {run ? (
            <button className="text-xs text-zinc-300 underline" onClick={() => nav(`/render/${run.projectId}`)}>
              back
            </button>
          ) : null}
        </div>

        {verify ? (
          <div
            className={`mt-3 rounded-lg border p-3 text-xs ${
              verify.pass ? 'border-emerald-900/60 bg-emerald-950/20 text-emerald-200' : 'border-amber-900/60 bg-amber-950/20 text-amber-200'
            }`}
          >
            <div className="font-semibold">{verify.pass ? 'Verification PASS' : 'Verification FAIL'}</div>
            {verify.issues?.length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {verify.issues.map((x: string, i: number) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {err ? <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-200">{err}</div> : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onVerify} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
            Verify Artifacts
          </button>
          {isReady ? (
            <a
              className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-sm font-semibold text-zinc-950"
              href={`/api/run/${runId}/download`}
            >
              Download MP4
            </a>
          ) : (
            <button
              disabled
              className="rounded-lg bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-400 opacity-70"
              title="Blocked: not verified PASS yet."
            >
              Download MP4
            </button>
          )}
        </div>

        {isReady ? (
          <video className="mt-3 w-full rounded-lg" controls src={`/api/run/${runId}/download`} />
        ) : (
          <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
            MP4 not ready yet. This will only show “Ready” after Verification PASS.
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-sm font-semibold">Step Logs</div>
        <div className="mt-3 max-h-72 space-y-2 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px]">
          {logs.length === 0 ? <div className="text-zinc-500">No logs yet.</div> : null}
          {logs.map((l, i) => (
            <div key={i} className="text-zinc-300">
              <span className="text-zinc-500">{l.ts}</span> {l.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

