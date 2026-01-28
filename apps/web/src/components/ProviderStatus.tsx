import { useEffect, useState } from 'react'
import { api } from '../api/client'

type Status = { ok: boolean; providers: { openai: boolean; elevenlabs: boolean }; ffmpeg?: { available: boolean; source: string } }

export function ProviderStatus() {
  const [status, setStatus] = useState<Status | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    api<Status>('/status')
      .then((s) => mounted && setStatus(s))
      .catch((e) => mounted && setErr(e?.error || 'Failed to load status'))
    return () => {
      mounted = false
    }
  }, [])

  if (err) return <span className="text-[11px] text-red-300">status error</span>
  if (!status) return <span className="text-[11px] text-zinc-500">checking…</span>

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-zinc-400">OpenAI:</span>
      <span className={status.providers.openai ? 'text-emerald-300' : 'text-amber-300'}>
        {status.providers.openai ? 'configured' : 'not configured'}
      </span>
      <span className="text-zinc-600">•</span>
      <span className="text-zinc-400">FFmpeg:</span>
      <span className={status.ffmpeg?.available ? 'text-emerald-300' : 'text-amber-300'}>
        {status.ffmpeg?.available ? status.ffmpeg.source : 'not available'}
      </span>
    </div>
  )
}

