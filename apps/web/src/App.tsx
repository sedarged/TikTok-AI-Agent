import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { QuickCreatePage } from './pages/QuickCreatePage'
import { PlanStudioPage } from './pages/PlanStudioPage'
import { RenderQueuePage } from './pages/RenderQueuePage'
import { OutputPage } from './pages/OutputPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<QuickCreatePage />} />
        <Route path="/studio/:projectId" element={<PlanStudioPage />} />
        <Route path="/render/:projectId" element={<RenderQueuePage />} />
        <Route path="/output/:runId" element={<OutputPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

