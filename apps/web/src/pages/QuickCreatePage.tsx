import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type ApiError } from '../api/client'

type Pack = { id: string; title: string; config: any }
type PacksResp = { packs: Pack[] }
type ProjectsResp = { projects: Array<{ id: string; title: string; status: string; updatedAt: string }> }

export function QuickCreatePage() {
  const nav = useNavigate()
  const [packs, setPacks] = useState<Pack[]>([])
  const [projects, setProjects] = useState<ProjectsResp['projects']>([])
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [topic, setTopic] = useState('')
  const [nichePackId, setNichePackId] = useState('facts')
  const [language, setLanguage] = useState('English')
  const [targetLengthSec, setTargetLengthSec] = useState(60)
  const [tempo, setTempo] = useState<'slow' | 'normal' | 'fast'>('normal')
  const [voicePreset, setVoicePreset] = useState('alloy')
  const [visualStylePreset, setVisualStylePreset] = useState<string>('') // optional

  useEffect(() => {
    api<PacksResp>('/packs')
      .then((d) => setPacks(d.packs))
      .catch((e: ApiError) => setErr(e.error || 'Failed to load niche packs'))
    api<ProjectsResp>('/projects')
      .then((d) => setProjects(d.projects))
      .catch(() => {})
  }, [])

  const canGenerate = useMemo(() => {
    if (!topic.trim()) return { ok: false, reason: 'Topic is required.' }
    if (!nichePackId) return { ok: false, reason: 'Niche Pack is required.' }
    if (!language.trim()) return { ok: false, reason: 'Language is required.' }
    if (!voicePreset.trim()) return { ok: false, reason: 'Voice preset is required.' }
    if (!targetLengthSec || targetLengthSec < 20) return { ok: false, reason: 'Target length must be at least 20s.' }
    return { ok: true as const, reason: '' }
  }, [topic, nichePackId, language, voicePreset, targetLengthSec])

  async function onGeneratePlan() {
    if (!canGenerate.ok) return
    setBusy(true)
    setErr(null)
    try {
      const project = await api<{ project: any }>('/project', {
        method: 'POST',
        body: JSON.stringify({
          topic,
          nichePackId,
          language,
          targetLengthSec,
          tempo,
          voicePreset,
          visualStylePreset: visualStylePreset.trim() ? visualStylePreset.trim() : null,
        }),
      })
      const plan = await api<{ planVersion: any; templateMode: boolean }>(`/project/${project.project.id}/plan`, { method: 'POST' })
      nav(`/studio/${project.project.id}`, { state: { planVersionId: plan.planVersion.id } })
    } catch (e: any) {
      setErr(e?.error || 'Failed to generate plan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-sm font-semibold">Quick Create</div>
        <div className="mt-3 space-y-3">
          <label className="block">
            <div className="text-xs text-zinc-400">Topic / Seed</div>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              rows={3}
              placeholder="e.g., Why procrastination feels good (and how to break it)"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs text-zinc-400">Niche Pack</div>
              <select
                value={nichePackId}
                onChange={(e) => setNichePackId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              >
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="text-xs text-zinc-400">Language</div>
              <input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs text-zinc-400">Target length</div>
              <select
                value={targetLengthSec}
                onChange={(e) => setTargetLengthSec(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              >
                <option value={60}>60</option>
                <option value={90}>90</option>
                <option value={120}>120</option>
                <option value={180}>180+</option>
              </select>
            </label>
            <label className="block">
              <div className="text-xs text-zinc-400">Tempo</div>
              <select
                value={tempo}
                onChange={(e) => setTempo(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              >
                <option value="slow">slow</option>
                <option value="normal">normal</option>
                <option value="fast">fast</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs text-zinc-400">Voice preset (TTS)</div>
              <input
                value={voicePreset}
                onChange={(e) => setVoicePreset(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                placeholder="e.g., alloy"
              />
            </label>
            <label className="block">
              <div className="text-xs text-zinc-400">Visual style preset (optional)</div>
              <input
                value={visualStylePreset}
                onChange={(e) => setVisualStylePreset(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
                placeholder="e.g., neon, minimal"
              />
            </label>
          </div>

          {err ? <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-200">{err}</div> : null}
          {!canGenerate.ok ? (
            <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
              Action blocked: {canGenerate.reason}
            </div>
          ) : null}

          <button
            onClick={onGeneratePlan}
            disabled={busy || !canGenerate.ok}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {busy ? 'Generating…' : 'Generate Plan'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="text-sm font-semibold">Recent Projects</div>
        <div className="mt-3 space-y-2">
          {projects.length === 0 ? <div className="text-xs text-zinc-500">None yet.</div> : null}
          {projects.slice(0, 8).map((p) => (
            <button
              key={p.id}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-sm hover:border-zinc-600"
              onClick={() => nav(`/studio/${p.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="truncate">{p.title}</div>
                <div className="ml-2 shrink-0 text-[11px] text-zinc-500">{p.status}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

