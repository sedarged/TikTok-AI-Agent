import { Link, useLocation } from 'react-router-dom'
import { ProviderStatus } from './ProviderStatus'

export function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link to="/" className="text-sm font-semibold tracking-wide">
            TikTok AI
          </Link>
          <div className="flex items-center gap-2">
            <ProviderStatus />
          </div>
        </div>
        <div className="mx-auto flex max-w-md gap-2 px-4 pb-3 text-xs text-zinc-400">
          <span className={loc.pathname === '/' ? 'text-zinc-200' : ''}>Quick Create</span>
          <span>•</span>
          <span className={loc.pathname.startsWith('/studio') ? 'text-zinc-200' : ''}>Plan</span>
          <span>•</span>
          <span className={loc.pathname.startsWith('/render') ? 'text-zinc-200' : ''}>Render</span>
          <span>•</span>
          <span className={loc.pathname.startsWith('/output') ? 'text-zinc-200' : ''}>Output</span>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-4">{children}</main>
    </div>
  )
}

