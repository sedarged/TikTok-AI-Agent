import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNichePacks, createProject, generatePlan } from '../api/client';
import type { NichePack, ProviderStatus } from '../api/types';
import { VOICE_PRESETS } from '../api/types';

interface QuickCreateProps {
  status: ProviderStatus | null;
}

const TARGET_LENGTHS = [
  { value: 60, label: '60s' },
  { value: 90, label: '90s' },
  { value: 120, label: '2 min' },
  { value: 180, label: '3 min+' },
];

const TEMPOS = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
];

export default function QuickCreate({ status }: QuickCreateProps) {
  const navigate = useNavigate();
  const [nichePacks, setNichePacks] = useState<NichePack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    topic: '',
    nichePackId: 'facts',
    language: 'en',
    targetLengthSec: 60,
    tempo: 'normal',
    voicePreset: 'alloy',
  });

  useEffect(() => {
    getNichePacks()
      .then(setNichePacks)
      .catch((err) => setError(err.message));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoading(true);

    try {
      // Create project
      const project = await createProject(formData);

      // Generate initial plan
      await generatePlan(project.id);

      // Navigate to plan studio
      navigate(`/project/${project.id}/plan`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setLoading(false);
    }
  };

  const canGenerate = status?.providers.openai || true; // Allow template mode

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Create TikTok Video</h1>
        <p className="text-gray-400">
          Enter your topic and preferences to generate an AI video plan
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Topic */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Topic / Seed
          </label>
          <textarea
            className="textarea"
            rows={3}
            placeholder="e.g., 5 surprising facts about the deep ocean, The real story behind the Titanic..."
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            disabled={loading}
          />
        </div>

        {/* Niche Pack */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Niche Pack
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {nichePacks.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => setFormData({ ...formData, nichePackId: pack.id })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.nichePackId === pack.id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                disabled={loading}
              >
                {pack.name}
              </button>
            ))}
          </div>
        </div>

        {/* Row: Language + Target Length */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Language
            </label>
            <select
              className="select"
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              disabled={loading}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Target Length
            </label>
            <div className="flex gap-2">
              {TARGET_LENGTHS.map((len) => (
                <button
                  key={len.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, targetLengthSec: len.value })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    formData.targetLengthSec === len.value
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                  disabled={loading}
                >
                  {len.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row: Tempo + Voice */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tempo
            </label>
            <div className="flex gap-2">
              {TEMPOS.map((tempo) => (
                <button
                  key={tempo.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, tempo: tempo.value })}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    formData.tempo === tempo.value
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                  disabled={loading}
                >
                  {tempo.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Voice
            </label>
            <select
              className="select"
              value={formData.voicePreset}
              onChange={(e) => setFormData({ ...formData, voicePreset: e.target.value })}
              disabled={loading}
            >
              {VOICE_PRESETS.map((voice) => (
                <option key={voice} value={voice}>
                  {voice.charAt(0).toUpperCase() + voice.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !canGenerate}
          className="btn btn-primary w-full py-3 text-lg"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating Plan...
            </span>
          ) : (
            'Generate Plan'
          )}
        </button>

        {!status?.providers.openai && (
          <p className="text-center text-yellow-400 text-sm">
            OpenAI not configured. Using template mode.
          </p>
        )}
      </form>
    </div>
  );
}
