import { Link, useLocation } from 'react-router-dom';
import type { ProviderStatus } from '../api/types';

interface LayoutProps {
  children: React.ReactNode;
  status: ProviderStatus | null;
}

export default function Layout({ children, status }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/create', label: 'Create' },
    { path: '/projects', label: 'Projects' },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="font-bold text-lg text-white">TikTok AI</span>
          </Link>

          <nav className="flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-medium transition-colors ${
                  location.pathname.startsWith(item.path)
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Provider Status */}
          <div className="flex items-center gap-2">
            <StatusIndicator
              label="OpenAI"
              active={status?.providers.openai ?? false}
            />
            <StatusIndicator
              label="FFmpeg"
              active={status?.providers.ffmpeg ?? false}
            />
          </div>
        </div>
      </header>

      {/* Warning banner if not ready */}
      {status && !status.ready && (
        <div className="bg-yellow-900/50 border-b border-yellow-700 px-4 py-2">
          <p className="text-yellow-200 text-sm text-center">
            {status.message}
          </p>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

function StatusIndicator({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <div
        className={`w-2 h-2 rounded-full ${
          active ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <span className={active ? 'text-gray-300' : 'text-gray-500'}>{label}</span>
    </div>
  );
}
