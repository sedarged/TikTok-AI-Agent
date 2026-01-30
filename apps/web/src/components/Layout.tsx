import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { ProviderStatus } from '../api/types';
import { getRun } from '../api/client';

interface LayoutProps {
  children: React.ReactNode;
  status: ProviderStatus | null;
  statusError?: string;
}

function Breadcrumb() {
  const location = useLocation();
  const params = useParams<{ projectId?: string; runId?: string }>();
  const [runProject, setRunProject] = useState<{ projectId: string; title?: string } | null>(null);

  const pathParts = location.pathname.split('/').filter(Boolean);

  if (pathParts.length === 0 || pathParts[0] === 'create') {
    return null;
  }

  const breadcrumbs: Array<{ label: string; path: string }> = [];

  useEffect(() => {
    if (pathParts[0] !== 'run' || !params.runId) {
      setRunProject(null);
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    getRun(params.runId, { signal })
      .then((run) => {
        if (signal.aborted) return;
        setRunProject({
          projectId: run.projectId,
          title: run.project?.title,
        });
      })
      .catch(() => {
        if (!signal.aborted) setRunProject(null);
      });

    return () => controller.abort();
  }, [params.runId, location.pathname]);

  if (pathParts[0] === 'projects') {
    breadcrumbs.push({ label: 'Projects', path: '/projects' });
  } else if (pathParts[0] === 'project' && params.projectId) {
    breadcrumbs.push({ label: 'Projects', path: '/projects' });
    if (pathParts[2] === 'plan') {
      breadcrumbs.push({ label: 'Plan', path: `/project/${params.projectId}/plan` });
    } else if (pathParts[2] === 'runs') {
      breadcrumbs.push({ label: 'Render Queue', path: `/project/${params.projectId}/runs` });
    }
  } else if (pathParts[0] === 'run' && params.runId) {
    breadcrumbs.push({ label: 'Projects', path: '/projects' });
    if (runProject?.projectId) {
      breadcrumbs.push({
        label: runProject.title || 'Project',
        path: `/project/${runProject.projectId}/runs`,
      });
    }
    breadcrumbs.push({ label: 'Output', path: `/run/${params.runId}` });
  }

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav
      className="mb-4 flex items-center gap-2 text-sm"
      style={{ color: 'var(--color-text-muted)' }}
    >
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.path} className="flex items-center gap-2">
          {index > 0 && <span className="text-xs">/</span>}
          {index === breadcrumbs.length - 1 ? (
            <span style={{ color: 'var(--color-text)' }}>{crumb.label}</span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:underline transition-colors"
              style={{ color: 'var(--color-primary)' }}
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export default function Layout({ children, status, statusError }: LayoutProps) {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = [
    { path: '/create', label: 'Create' },
    { path: '/projects', label: 'Projects' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/calendar', label: 'Calendar' },
  ];

  const navLink = (item: { path: string; label: string }) => (
    <Link
      key={item.path}
      to={item.path}
      onClick={() => setMobileNavOpen(false)}
      className={`text-sm font-medium transition-colors relative block py-2 md:py-0 ${
        location.pathname.startsWith(item.path) ? 'text-white' : ''
      }`}
      style={{
        color: location.pathname.startsWith(item.path)
          ? 'var(--color-primary)'
          : 'var(--color-text-muted)',
      }}
    >
      {item.label}
      {location.pathname.startsWith(item.path) && (
        <span
          className="absolute bottom-0 left-0 right-0 h-0.5 hidden md:block"
          style={{ background: 'var(--color-primary)' }}
        />
      )}
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-lg border-b"
        style={{ background: 'rgba(13, 17, 26, 0.9)', borderColor: 'var(--color-border)' }}
      >
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="font-bold text-lg" style={{ color: 'var(--color-text)' }}>
              TikTok AI
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">{navItems.map(navLink)}</nav>

          {/* Mobile: hamburger */}
          <div className="md:hidden relative">
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="p-2 rounded-lg"
              style={{ color: 'var(--color-text)' }}
              aria-label="Menu"
            >
              {mobileNavOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
            {mobileNavOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMobileNavOpen(false)}
                  aria-hidden="true"
                />
                <div
                  className="absolute right-0 top-full mt-2 w-48 rounded-lg border py-2 z-50"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  {navItems.map((item) => (
                    <div key={item.path} className="px-4">
                      {navLink(item)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Error loading status */}
      {statusError && (
        <div
          className="border-b px-4 py-2"
          style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--color-danger)' }}
        >
          <p className="text-sm text-center" style={{ color: 'var(--color-danger)' }}>
            {statusError}
          </p>
        </div>
      )}
      {/* Warning banner if not ready */}
      {status && !status.ready && !statusError && (
        <div
          className="border-b px-4 py-2"
          style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'var(--color-warning)' }}
        >
          <p className="text-sm text-center" style={{ color: 'var(--color-warning)' }}>
            {status.message}
          </p>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Breadcrumb />
        {children}
      </main>

      {/* Footer with Status */}
      <footer className="border-t mt-auto" style={{ borderColor: 'var(--color-border)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <StatusPanel status={status} />
        </div>
      </footer>
    </div>
  );
}

function StatusPanel({ status }: { status: ProviderStatus | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!status) return null;

  const hasIssues = !status.providers.openai || !status.providers.ffmpeg;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <StatusIndicator label="OpenAI" active={status.providers.openai ?? false} />
        <StatusIndicator label="FFmpeg" active={status.providers.ffmpeg ?? false} />
        {status.renderDryRun && !status.testMode && <StatusIndicator label="Dry-Run" active />}
      </div>

      {hasIssues && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      )}
    </div>
  );
}

function StatusIndicator({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div
        className="w-2 h-2 rounded-full"
        style={{
          background: active ? 'var(--color-primary)' : 'var(--color-danger)',
        }}
      />
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
    </div>
  );
}
