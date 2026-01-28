import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { StatusBar } from "../components/StatusBar";

type NichePack = {
  id: string;
  name: string;
};

const lengths = [
  { label: "60s", value: 60 },
  { label: "90s", value: 90 },
  { label: "120s", value: 120 },
  { label: "180s+", value: 180 }
];

export function QuickCreate() {
  const navigate = useNavigate();
  const [packs, setPacks] = useState<NichePack[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [form, setForm] = useState({
    topic: "",
    nichePackId: "facts",
    language: "English",
    targetLengthSec: 60,
    tempo: "normal",
    voicePreset: "alloy",
    visualStylePreset: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPacks().then((data) => setPacks(data.packs));
    api.getStatus().then((data) => setStatus(data));
  }, []);

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async () => {
    setError(null);
    if (!form.topic.trim()) {
      setError("Topic is required.");
      return;
    }
    setLoading(true);
    try {
      const projectRes = await api.createProject({
        topic: form.topic,
        nichePackId: form.nichePackId,
        language: form.language,
        targetLengthSec: Number(form.targetLengthSec),
        tempo: form.tempo,
        voicePreset: form.voicePreset,
        visualStylePreset: form.visualStylePreset ? form.visualStylePreset : null
      });
      const planRes = await api.createPlan(projectRes.project.id);
      navigate(`/plan/${projectRes.project.id}?planVersionId=${planRes.planVersionId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-white">TikTok AI</h1>
        <p className="text-sm text-slate-300">
          Create TikTok-style vertical videos with AI-generated visuals, script, voice, and captions.
        </p>
        {status && (
          <StatusBar
            openaiConfigured={status.providers.openaiConfigured}
            elevenlabsConfigured={status.providers.elevenlabsConfigured}
            ffmpegAvailable={status.ffmpeg.ffmpegAvailable}
          />
        )}
      </header>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid gap-4">
          <label className="text-sm text-slate-300">
            Topic / Seed
            <input
              value={form.topic}
              onChange={(e) => updateField("topic", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
              placeholder="e.g. 3 unexpected facts about deep sleep"
            />
          </label>

          <label className="text-sm text-slate-300">
            Niche Pack
            <select
              value={form.nichePackId}
              onChange={(e) => updateField("nichePackId", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
            >
              {packs.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-300">
            Language
            <input
              value={form.language}
              onChange={(e) => updateField("language", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
            />
          </label>

          <label className="text-sm text-slate-300">
            Target length
            <div className="mt-2 flex flex-wrap gap-2">
              {lengths.map((length) => (
                <button
                  key={length.value}
                  onClick={() => updateField("targetLengthSec", length.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    Number(form.targetLengthSec) === length.value
                      ? "bg-brand-500 text-white"
                      : "bg-slate-800 text-slate-200"
                  }`}
                  type="button"
                >
                  {length.label}
                </button>
              ))}
            </div>
          </label>

          <label className="text-sm text-slate-300">
            Tempo
            <div className="mt-2 flex gap-2">
              {["slow", "normal", "fast"].map((tempo) => (
                <button
                  key={tempo}
                  onClick={() => updateField("tempo", tempo)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                    form.tempo === tempo ? "bg-brand-500 text-white" : "bg-slate-800 text-slate-200"
                  }`}
                  type="button"
                >
                  {tempo}
                </button>
              ))}
            </div>
          </label>

          <label className="text-sm text-slate-300">
            Voice preset (OpenAI voice name or elevenlabs:VOICE_ID)
            <input
              value={form.voicePreset}
              onChange={(e) => updateField("voicePreset", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
            />
          </label>

          <label className="text-sm text-slate-300">
            Visual style preset (optional)
            <input
              value={form.visualStylePreset}
              onChange={(e) => updateField("visualStylePreset", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-100"
              placeholder="e.g. neon cinematic"
            />
          </label>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        {loading ? "Generating plan..." : "Generate Plan"}
      </button>
    </div>
  );
}
