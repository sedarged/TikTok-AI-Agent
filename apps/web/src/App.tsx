import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import QuickCreate from './pages/QuickCreate';
import PlanStudio from './pages/PlanStudio';
import RenderQueue from './pages/RenderQueue';
import Output from './pages/Output';
import Projects from './pages/Projects';
import { getStatus } from './api/client';
import type { ProviderStatus } from './api/types';

function App() {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStatus()
      .then(setStatus)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading TikTok AI...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout status={status}>
      <Routes>
        <Route path="/" element={<Navigate to="/create" replace />} />
        <Route path="/create" element={<QuickCreate status={status} />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/project/:projectId/plan" element={<PlanStudio status={status} />} />
        <Route path="/project/:projectId/runs" element={<RenderQueue />} />
        <Route path="/run/:runId" element={<Output status={status} />} />
      </Routes>
    </Layout>
  );
}

export default App;
