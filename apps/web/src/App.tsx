import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import QuickCreate from './pages/QuickCreate';
import BatchCreate from './pages/BatchCreate';
import PlanStudio from './pages/PlanStudio';
import RenderQueue from './pages/RenderQueue';
import Output from './pages/Output';
import Projects from './pages/Projects';
import Analytics from './pages/Analytics';
import Calendar from './pages/Calendar';
import { getStatus } from './api/client';
import type { ProviderStatus } from './api/types';
import { getErrorMessage } from './utils/errors';

function App() {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState<string>('');

  useEffect(() => {
    getStatus()
      .then((data) => {
        setStatus(data);
        setStatusError('');
      })
      .catch((err) => {
        console.error(err);
        setStatus(null);
        setStatusError(getErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-bg)' }}
      >
        <div className="text-center">
          <div
            className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
          />
          <p style={{ color: 'var(--color-text-muted)' }}>Loading TikTok AI...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout status={status} statusError={statusError}>
      <Routes>
        <Route path="/" element={<Navigate to="/create" replace />} />
        <Route path="/create" element={<QuickCreate status={status} />} />
        <Route path="/batch-create" element={<BatchCreate status={status} />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/project/:projectId/plan" element={<PlanStudio status={status} />} />
        <Route path="/project/:projectId/runs" element={<RenderQueue />} />
        <Route path="/run/:runId" element={<Output status={status} />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/calendar" element={<Calendar />} />
      </Routes>
    </Layout>
  );
}

export default App;
