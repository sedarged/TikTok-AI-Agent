import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { SectionCard } from "../components/SectionCard";

export function Output() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<any>(null);
  const [verify, setVerify] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    api
      .getRun(runId)
      .then((data) => setRun(data.run))
      .catch((err) => setError((err as Error).message));
    api
      .verifyRun(runId)
      .then((data) => setVerify(data))
      .catch((err) => setError((err as Error).message));
  }, [runId]);

  if (!run) {
    return <div className="p-6 text-slate-300">Loading output...</div>;
  }

  const ready = verify?.status === "PASS";
  const handleDuplicate = async () => {
    if (!run?.projectId) return;
    const topic = window.prompt("New topic for duplicated project?");
    if (!topic) return;
    try {
      const res = await api.duplicateProject(run.projectId, topic);
      if (res.project?.id) {
        navigate(`/plan/${res.project.id}?planVersionId=${res.planVersionId ?? ""}`);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <h2 className="text-xl font-semibold">Output</h2>
      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}
      <SectionCard title="Verification">
        {verify ? (
          verify.status === "PASS" ? (
            <div className="text-sm text-emerald-300">Verification PASS. Ready to download.</div>
          ) : (
            <div className="text-sm text-rose-300">
              Verification FAIL:
              <ul className="list-disc pl-5">
                {verify.issues?.map((issue: string) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )
        ) : (
          <div className="text-sm text-slate-400">Running verification...</div>
        )}
      </SectionCard>

      <SectionCard title="MP4 Preview">
        {ready ? (
          <video
            controls
            className="w-full rounded-lg border border-slate-800"
            src={`${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"}/run/${runId}/download`}
          />
        ) : (
          <div className="text-sm text-slate-400">MP4 locked until verification passes.</div>
        )}
      </SectionCard>

      <SectionCard title="Thumbnail">
        {ready ? (
          <img
            className="w-full rounded-lg border border-slate-800"
            src={`${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"}/run/${runId}/thumb`}
            alt="Thumbnail"
          />
        ) : (
          <div className="text-sm text-slate-400">Thumbnail locked until verification passes.</div>
        )}
      </SectionCard>

      <SectionCard title="Downloads">
        {ready ? (
          <div className="flex flex-wrap gap-3">
            <a
              className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white"
              href={`${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"}/run/${runId}/download`}
            >
              Download MP4
            </a>
            <a
              className="rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200"
              href={`${import.meta.env.VITE_API_URL ?? "http://localhost:4000/api"}/run/${runId}/export`}
            >
              Export JSON
            </a>
          </div>
        ) : (
          <div className="text-sm text-slate-400">Downloads locked until verification passes.</div>
        )}
      </SectionCard>

      <SectionCard title="Next Actions">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/")}
            className="rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200"
          >
            Create new project
          </button>
          <button
            onClick={handleDuplicate}
            className="rounded-full bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200"
          >
            Duplicate project
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
