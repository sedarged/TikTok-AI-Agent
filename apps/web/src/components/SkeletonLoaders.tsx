/**
 * Reusable skeleton loader components for consistent loading states
 */

export function ProjectSkeleton() {
  return (
    <div className="card animate-pulse" role="status" aria-label="Loading project">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-6 rounded w-48" style={{ background: 'var(--color-border)' }} />
            <div className="h-5 rounded w-20" style={{ background: 'var(--color-border)' }} />
          </div>
          <div className="h-4 rounded w-64" style={{ background: 'var(--color-border)' }} />
          <div className="h-3 rounded w-32" style={{ background: 'var(--color-border)' }} />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 rounded w-24" style={{ background: 'var(--color-border)' }} />
          <div className="h-9 rounded w-10" style={{ background: 'var(--color-border)' }} />
        </div>
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function ProjectListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: count }, (_, i) => (
        <ProjectSkeleton key={i} />
      ))}
    </div>
  );
}

export function RunSkeleton() {
  return (
    <div className="card animate-pulse" role="status" aria-label="Loading render">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 rounded w-32" style={{ background: 'var(--color-border)' }} />
          <div className="h-5 rounded w-20" style={{ background: 'var(--color-border)' }} />
        </div>
        <div className="h-4 rounded w-full" style={{ background: 'var(--color-border)' }} />
        <div className="flex gap-2">
          <div
            className="h-8 rounded w-20 flex-shrink-0"
            style={{ background: 'var(--color-border)' }}
          />
          <div
            className="h-8 rounded w-20 flex-shrink-0"
            style={{ background: 'var(--color-border)' }}
          />
        </div>
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function RunListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <RunSkeleton key={i} />
      ))}
    </div>
  );
}

export function SceneSkeleton() {
  return (
    <div className="card animate-pulse" role="status" aria-label="Loading scene">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 rounded w-24" style={{ background: 'var(--color-border)' }} />
          <div className="h-8 rounded w-16" style={{ background: 'var(--color-border)' }} />
        </div>
        <div className="h-4 rounded w-full" style={{ background: 'var(--color-border)' }} />
        <div className="h-4 rounded w-3/4" style={{ background: 'var(--color-border)' }} />
        <div className="flex gap-2 mt-4">
          <div className="h-8 rounded w-20" style={{ background: 'var(--color-border)' }} />
          <div className="h-8 rounded w-20" style={{ background: 'var(--color-border)' }} />
        </div>
      </div>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function SceneListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <SceneSkeleton key={i} />
      ))}
    </div>
  );
}

export function PlanSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Loading plan">
      {/* Header skeleton */}
      <div className="card space-y-3">
        <div className="h-6 rounded w-32" style={{ background: 'var(--color-border)' }} />
        <div className="h-4 rounded w-full" style={{ background: 'var(--color-border)' }} />
        <div className="h-4 rounded w-2/3" style={{ background: 'var(--color-border)' }} />
      </div>

      {/* Scenes skeleton */}
      <SceneListSkeleton count={3} />

      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Loading analytics">
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="card">
            <div className="space-y-2">
              <div className="h-4 rounded w-20" style={{ background: 'var(--color-border)' }} />
              <div className="h-8 rounded w-24" style={{ background: 'var(--color-border)' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="card">
        <div className="h-64 rounded" style={{ background: 'var(--color-border)' }} />
      </div>

      <span className="sr-only">Loading...</span>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" role="status" aria-label="Loading calendar">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <div className="h-8 rounded w-32" style={{ background: 'var(--color-border)' }} />
        <div className="flex gap-2">
          <div className="h-8 rounded w-24" style={{ background: 'var(--color-border)' }} />
          <div className="h-8 rounded w-24" style={{ background: 'var(--color-border)' }} />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="h-20 rounded" style={{ background: 'var(--color-border)' }} />
        ))}
      </div>

      <span className="sr-only">Loading...</span>
    </div>
  );
}
