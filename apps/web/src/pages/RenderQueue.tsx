import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { SectionCard } from "../components/SectionCard";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const steps = [
  "tts_generate",
  "asr_align",
  "images_generate",
  "captions_build",
  "music_build",
  "ffmpeg_render",
  "finalize_artifacts"
];

export function RenderQueue() {
  const { projectId } = useParams<{ projectId: string }>();
  const query = useQuery();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<any[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(query.get("runId"));
  const [activeStep, setActiveStep] = useState<string>("tts_generate");
  const [logs, setLogs] = useState<string[]>([]);

  const loadRuns = async () => {
    if (!projectId) return;
    const data = await api.getProjectRuns(projectId);
    setRuns(data.runs);
  };

  useEffect(() => {
    loadRuns();
  }, [projectId]);

  useEffect(() => {
    if (!activeRunId) return;
    api.getRun(activeRunId).then((data) => {
      const run = data.run;
      setRuns((prev) => prev.map((item) => (item.id === run.id ? { ...item, ...run } : item)));
      const logEntries = (run.logsJson || []).map((entry: any) => entry.message ?? String(entry));
      setLogs(logEntries);
    });
    const evtSource = new EventSource(`${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"}/run/${activeRunId}/stream`);
    evtSource.addEventListener("progress", (event: any) => {
      const data = JSON.parse(event.data);
      setRuns((prev) =>
        prev.map((run) => (run.id === activeRunId ? { ...run, progress: data.progress, currentStep: data.step } : run))
      );
    });
    evtSource.addEventListener("log", (event: any) => {
      const data = JSON.parse(event.data);
      setLogs((prev) => [...prev, data.message]);
    });
    evtSource.addEventListener("status", (event: any) => {
      const data = JSON.parse(event.data);
      setRuns((prev) =>
        prev.map((run) => (run.id === activeRunId ? { ...run, status: data.status } : run))
      );
    });
    return () => evtSource.close();
  }, [activeRunId]);

  const handleRetry = async (runId: string) => {
    await api.retryRun(runId, activeStep);
    setActiveRunId(runId);
    await loadRuns();
  };

  const handleVerify = async (runId: string) => {
    const report = await api.verifyRun(runId);
    if (report.status !== "PASS") {
      alert(`Verification failed:\n${report.issues.join("\n")}`);
    } else {
      alert("Verification PASS.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <h2 className="text-xl font-semibold">Render Queue</h2>
      <SectionCard title="Runs">
        <div className="flex flex-col gap-3">
          {runs.map((run) => (
            <div key={run.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-100">{run.id}</div>
                  <div className="text-xs text-slate-400">
                    Status: {run.status} • Step: {run.currentStep ?? "-"}
                  </div>
                  <div className="text-xs text-slate-400">Progress: {run.progress}%</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveRunId(run.id)}
                    className="rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200"
                  >
                    Follow
                  </button>
                  <button
                    onClick={() => handleRetry(run.id)}
                    className="rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => handleVerify(run.id)}
                    className="rounded-full bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200"
                  >
                    Verify Artifacts
                  </button>
                  {run.status === "done" && (
                    <button
                      onClick={() => navigate(`/output/${run.id}`)}
                      className="rounded-full bg-brand-500 px-3 py-2 text-xs font-semibold text-white"
                    >
                      View Output
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!runs.length && <div className="text-sm text-slate-400">No runs yet.</div>}
        </div>
      </SectionCard>

      <SectionCard title="Retry options">
        <div className="text-sm text-slate-400">
          Select a step to resume from when retrying.
        </div>
        <select
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
          value={activeStep}
          onChange={(e) => setActiveStep(e.target.value)}
        >
          {steps.map((step) => (
            <option key={step} value={step}>
              {step}
            </option>
          ))}
        </select>
      </SectionCard>

      <SectionCard title="Live Logs">
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200">
          {logs.length ? logs.map((line, idx) => <div key={idx}>{line}</div>) : "No logs yet."}
        </div>
      </SectionCard>
    </div>
  );
}
