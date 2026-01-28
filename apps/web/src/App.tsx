import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QuickCreate } from "./pages/QuickCreate";
import { PlanStudio } from "./pages/PlanStudio";
import { RenderQueue } from "./pages/RenderQueue";
import { Output } from "./pages/Output";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<QuickCreate />} />
        <Route path="/plan/:projectId" element={<PlanStudio />} />
        <Route path="/render/:projectId" element={<RenderQueue />} />
        <Route path="/output/:runId" element={<Output />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
