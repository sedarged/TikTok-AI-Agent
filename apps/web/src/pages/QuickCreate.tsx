import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getNichePacks,
  getScriptTemplates,
  createProject,
  generatePlan,
  automateProject,
  postBatch,
  getTopicSuggestions,
  type ScriptTemplate,
} from '../api/client';
import type { NichePack, ProviderStatus } from '../api/types';
import { VOICE_PRESETS } from '../api/types';
import { getErrorMessage } from '../utils/errors';

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
  const [scriptTemplates, setScriptTemplates] = useState<ScriptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAutomate, setLoadingAutomate] = useState(false);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [error, setError] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [batchTopics, setBatchTopics] = useState('');
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [formData, setFormData] = useState({
    topic: '',
    nichePackId: 'facts',
    language: 'en',
    targetLengthSec: 60,
    tempo: 'normal',
    voicePreset: 'alloy',
    scriptTemplateId: '' as string,
    seoKeywords: '',
  });

  useEffect(() => {
    getNichePacks()
      .then(setNichePacks)
      .catch((err) => setError(getErrorMessage(err)));
    getScriptTemplates()
      .then(setScriptTemplates)
      .catch(() => setScriptTemplates([]));
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
      // Create project (omit scriptTemplateId from createProject payload; seoKeywords only when non-empty)
      const { scriptTemplateId, seoKeywords, ...rest } = formData;
      const createPayload: Parameters<typeof createProject>[0] = { ...rest };
      if (seoKeywords?.trim()) createPayload.seoKeywords = seoKeywords.trim();
      const project = await createProject(createPayload);

      // Generate initial plan (optionally with script template)
      await generatePlan(project.id, scriptTemplateId ? { scriptTemplateId } : undefined);

      // Navigate to plan studio
      navigate(`/project/${project.id}/plan`);
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  const handleAutomate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoadingAutomate(true);

    try {
      const automatePayload: Parameters<typeof automateProject>[0] = {
        topic: formData.topic,
        nichePackId: formData.nichePackId,
        language: formData.language,
        targetLengthSec: formData.targetLengthSec,
        tempo: formData.tempo,
        voicePreset: formData.voicePreset,
      };
      if (formData.scriptTemplateId) automatePayload.scriptTemplateId = formData.scriptTemplateId;
      if (formData.seoKeywords?.trim()) automatePayload.seoKeywords = formData.seoKeywords.trim();
      const { runId } = await automateProject(automatePayload);
      navigate(`/run/${runId}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setLoadingAutomate(false);
    }
  };

  const handleBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const topics = batchTopics
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);
    if (topics.length === 0) {
      setError('Enter at least one topic (one per line)');
      return;
    }
    if (topics.length > 50) {
      setError('Maximum 50 topics per batch');
      return;
    }
    setLoadingBatch(true);
    try {
      const { runIds } = await postBatch({
        topics,
        nichePackId: formData.nichePackId,
        language: formData.language,
        targetLengthSec: formData.targetLengthSec,
        tempo: formData.tempo,
        seoKeywords: formData.seoKeywords.trim() || undefined,
        scriptTemplateId: formData.scriptTemplateId || undefined,
        voicePreset: formData.voicePreset,
      });
      if (runIds.length > 0) {
        navigate(`/run/${runIds[0]}`);
      } else {
        setError('No runs created');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingBatch(false);
    }
  };

  const handleSuggestTopics = async () => {
    setError('');
    setLoadingSuggestions(true);
    setSuggestions(null);
    try {
      const list = await getTopicSuggestions(formData.nichePackId, 10);
      setSuggestions(list);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const canGenerate = status?.providers.openai || true; // Allow template mode
  const isLoading = loading || loadingAutomate || loadingBatch;

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
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="topic-input" className="block text-sm font-medium text-gray-300">
              Topic / Seed
            </label>
            <button
              type="button"
              onClick={handleSuggestTopics}
              disabled={isLoading || loadingSuggestions || !status?.providers.openai}
              className="text-sm px-3 py-1 rounded-lg transition-colors"
              style={{ background: 'var(--color-surface-2)', color: 'var(--color-primary)' }}
            >
              {loadingSuggestions ? 'Loading...' : 'Suggest viral topics'}
            </button>
          </div>
          <textarea
            id="topic-input"
            className="textarea"
            rows={3}
            placeholder="e.g., 5 surprising facts about the deep ocean, The real story behind the Titanic..."
            value={formData.topic}
            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
            disabled={isLoading}
          />
          {suggestions && suggestions.length > 0 && (
            <div className="mt-2 p-3 rounded-lg" style={{ background: 'var(--color-surface-2)' }}>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Pick a topic:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, topic: t });
                      setSuggestions(null);
                    }}
                    className="text-left text-sm px-3 py-2 rounded-lg border transition-colors hover:border-[var(--color-primary)]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    {t.length > 50 ? `${t.slice(0, 50)}...` : t}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Script template */}
        {scriptTemplates.length > 0 && (
          <div>
            <label
              htmlFor="script-template-select"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Script template (optional)
            </label>
            <select
              id="script-template-select"
              className="input w-full"
              value={formData.scriptTemplateId}
              onChange={(e) => setFormData({ ...formData, scriptTemplateId: e.target.value })}
              disabled={isLoading}
            >
              <option value="">— None —</option>
              {scriptTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {formData.scriptTemplateId && (
              <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {scriptTemplates.find((t) => t.id === formData.scriptTemplateId)?.description}
              </p>
            )}
          </div>
        )}

        {/* SEO keywords */}
        <div>
          <label
            htmlFor="seo-keywords-input"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            SEO keywords (comma-separated, optional)
          </label>
          <input
            id="seo-keywords-input"
            type="text"
            className="input w-full"
            placeholder="e.g. fitness tips, morning routine"
            value={formData.seoKeywords}
            onChange={(e) => setFormData({ ...formData, seoKeywords: e.target.value })}
            disabled={isLoading}
          />
        </div>

        {/* Niche Pack */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Niche Pack</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {nichePacks.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => setFormData({ ...formData, nichePackId: pack.id })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.nichePackId === pack.id ? 'text-white' : 'text-gray-300'
                }`}
                style={{
                  background:
                    formData.nichePackId === pack.id
                      ? 'var(--color-primary)'
                      : 'var(--color-surface)',
                }}
                onMouseEnter={(e) => {
                  if (formData.nichePackId !== pack.id) {
                    e.currentTarget.style.background = 'var(--color-surface-2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (formData.nichePackId !== pack.id) {
                    e.currentTarget.style.background = 'var(--color-surface)';
                  }
                }}
                disabled={isLoading}
              >
                {pack.name}
              </button>
            ))}
          </div>
        </div>

        {/* Target Length */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Target Length</label>
          <div className="flex gap-2">
            {TARGET_LENGTHS.map((len) => (
              <button
                key={len.value}
                type="button"
                onClick={() => setFormData({ ...formData, targetLengthSec: len.value })}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.targetLengthSec === len.value ? 'text-white' : ''
                }`}
                style={{
                  background:
                    formData.targetLengthSec === len.value
                      ? 'var(--color-primary)'
                      : 'var(--color-surface)',
                  color:
                    formData.targetLengthSec === len.value ? 'white' : 'var(--color-text-muted)',
                }}
                onMouseEnter={(e) => {
                  if (formData.targetLengthSec !== len.value) {
                    e.currentTarget.style.background = 'var(--color-surface-2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (formData.targetLengthSec !== len.value) {
                    e.currentTarget.style.background = 'var(--color-surface)';
                  }
                }}
                disabled={isLoading}
              >
                {len.label}
              </button>
            ))}
          </div>
        </div>

        {/* Options (Collapsible) */}
        <div className="card">
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="w-full flex items-center justify-between text-left"
            aria-expanded={showOptions}
            aria-controls="quick-create-options"
          >
            <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
              Options
            </span>
            <svg
              className={`w-5 h-5 transition-transform ${showOptions ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: 'var(--color-text-muted)' }}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showOptions && (
            <div
              id="quick-create-options"
              className="mt-4 space-y-4 pt-4 border-t"
              style={{ borderColor: 'var(--color-border)' }}
            >
              {/* Row: Language + Tempo + Voice */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="language-select"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Language
                  </label>
                  <select
                    id="language-select"
                    className="select"
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    disabled={isLoading}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tempo</label>
                  <div className="flex gap-2">
                    {TEMPOS.map((tempo) => (
                      <button
                        key={tempo.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, tempo: tempo.value })}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          formData.tempo === tempo.value ? 'text-white' : ''
                        }`}
                        style={{
                          background:
                            formData.tempo === tempo.value
                              ? 'var(--color-primary)'
                              : 'var(--color-surface)',
                          color:
                            formData.tempo === tempo.value ? 'white' : 'var(--color-text-muted)',
                        }}
                        onMouseEnter={(e) => {
                          if (formData.tempo !== tempo.value) {
                            e.currentTarget.style.background = 'var(--color-surface-2)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (formData.tempo !== tempo.value) {
                            e.currentTarget.style.background = 'var(--color-surface)';
                          }
                        }}
                        disabled={isLoading}
                      >
                        {tempo.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="voice-select"
                    className="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Voice
                  </label>
                  <select
                    id="voice-select"
                    className="select"
                    value={formData.voicePreset}
                    onChange={(e) => setFormData({ ...formData, voicePreset: e.target.value })}
                    disabled={isLoading}
                  >
                    {VOICE_PRESETS.map((voice) => (
                      <option key={voice} value={voice}>
                        {voice.charAt(0).toUpperCase() + voice.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isLoading || !canGenerate}
            className="btn btn-primary py-3 text-lg"
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
          <button
            type="button"
            onClick={handleAutomate}
            disabled={isLoading || !canGenerate}
            className="btn btn-secondary py-3 text-lg"
          >
            {loadingAutomate ? (
              <span className="flex items-center justify-center gap-2">
                <div
                  className="w-5 h-5 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                />
                Automating...
              </span>
            ) : (
              'Automate (Generate & Render)'
            )}
          </button>
        </div>

        {!status?.providers.openai && (
          <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Tryb szablonu (bez API)
          </p>
        )}

        {/* Batch section */}
        <div className="card border-t mt-8 pt-6" style={{ borderColor: 'var(--color-border)' }}>
          <button
            type="button"
            onClick={() => setShowBatch(!showBatch)}
            className="w-full flex items-center justify-between text-left"
            aria-expanded={showBatch}
            aria-controls="batch-create-form"
          >
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>
              Batch (multiple topics)
            </span>
            <svg
              className={`w-5 h-5 transition-transform ${showBatch ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: 'var(--color-text-muted)' }}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {showBatch && (
            <form onSubmit={handleBatch} className="mt-4 space-y-3" id="batch-create-form">
              <div>
                <label
                  htmlFor="batch-topics"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Topics (one per line, max 50)
                </label>
                <textarea
                  id="batch-topics"
                  className="textarea"
                  rows={5}
                  placeholder="Topic 1&#10;Topic 2&#10;Topic 3"
                  value={batchTopics}
                  onChange={(e) => setBatchTopics(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Uses current Niche Pack and options. One render at a time; others wait in queue.
              </p>
              <button
                type="submit"
                disabled={isLoading || !canGenerate}
                className="btn btn-secondary"
              >
                {loadingBatch ? (
                  <span className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                    />
                    Starting batch...
                  </span>
                ) : (
                  'Start batch'
                )}
              </button>
            </form>
          )}
        </div>
      </form>
    </div>
  );
}
