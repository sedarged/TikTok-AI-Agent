import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNichePacks, getScriptTemplates, postBatch, type ScriptTemplate } from '../api/client';
import type { NichePack, ProviderStatus } from '../api/types';
import { VOICE_PRESETS } from '../api/types';
import { getErrorMessage } from '../utils/errors';

interface BatchCreateProps {
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

export default function BatchCreate({ status }: BatchCreateProps) {
  const navigate = useNavigate();
  const [nichePacks, setNichePacks] = useState<NichePack[]>([]);
  const [scriptTemplates, setScriptTemplates] = useState<ScriptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [batchTopics, setBatchTopics] = useState('');

  const [formData, setFormData] = useState({
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

    const topics = batchTopics
      .split('\n')
      .map((t) => t.trim())
      .filter(Boolean);

    if (topics.length === 0) {
      setError('Please enter at least one topic (one per line)');
      return;
    }

    if (topics.length > 50) {
      setError('Maximum 50 topics per batch');
      return;
    }

    setLoading(true);

    try {
      const payload: Parameters<typeof postBatch>[0] = {
        topics,
        nichePackId: formData.nichePackId,
        language: formData.language,
        targetLengthSec: formData.targetLengthSec,
        tempo: formData.tempo,
        voicePreset: formData.voicePreset,
      };

      if (formData.seoKeywords?.trim()) {
        payload.seoKeywords = formData.seoKeywords.trim();
      }
      if (formData.scriptTemplateId) {
        payload.scriptTemplateId = formData.scriptTemplateId;
      }

      const { runIds } = await postBatch(payload);

      if (runIds.length > 0) {
        navigate(`/run/${runIds[0]}`);
      } else {
        setError('No runs created');
        setLoading(false);
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  };

  const canGenerate = status?.ready ?? false;
  const isLoading = loading;

  const topicCount = batchTopics
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean).length;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          Batch Create
        </h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Generate multiple videos at once. Each topic will create a separate video project.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Topics Input */}
        <div className="card">
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
            Topics (one per line, max 50)
          </label>
          <textarea
            className="textarea"
            rows={10}
            placeholder="Topic 1&#10;Topic 2&#10;Topic 3&#10;...&#10;&#10;Enter one topic per line"
            value={batchTopics}
            onChange={(e) => setBatchTopics(e.target.value)}
            disabled={isLoading}
          />
          {topicCount > 0 && (
            <p
              className="text-sm mt-2"
              style={{
                color: topicCount > 50 ? 'var(--color-danger)' : 'var(--color-text-muted)',
              }}
            >
              {topicCount} topic{topicCount !== 1 ? 's' : ''} {topicCount > 50 && '(max 50)'}
            </p>
          )}
        </div>

        {/* Niche Pack Selection */}
        <div className="card">
          <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
            Niche Pack
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {nichePacks.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => setFormData({ ...formData, nichePackId: pack.id })}
                disabled={isLoading}
                className={`p-3 rounded-lg border transition-all ${
                  formData.nichePackId === pack.id
                    ? 'border-blue-500 bg-blue-500 bg-opacity-10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
                style={{
                  borderColor:
                    formData.nichePackId === pack.id
                      ? 'var(--color-primary)'
                      : 'var(--color-border)',
                  background:
                    formData.nichePackId === pack.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                }}
              >
                <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {pack.name}
                </div>
                {pack.description && (
                  <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {pack.description}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Basic Options */}
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Options
          </h3>

          {/* Language */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-text)' }}
            >
              Language
            </label>
            <select
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

          {/* Target Length */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-text)' }}
            >
              Target Length
            </label>
            <div className="grid grid-cols-4 gap-2">
              {TARGET_LENGTHS.map((length) => (
                <button
                  key={length.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, targetLengthSec: length.value })}
                  disabled={isLoading}
                  className={`py-2 px-3 rounded-lg border transition-all ${
                    formData.targetLengthSec === length.value
                      ? 'border-blue-500 bg-blue-500 bg-opacity-10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  style={{
                    borderColor:
                      formData.targetLengthSec === length.value
                        ? 'var(--color-primary)'
                        : 'var(--color-border)',
                    background:
                      formData.targetLengthSec === length.value
                        ? 'rgba(59, 130, 246, 0.1)'
                        : 'transparent',
                    color: 'var(--color-text)',
                  }}
                >
                  {length.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tempo */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-text)' }}
            >
              Tempo
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TEMPOS.map((tempo) => (
                <button
                  key={tempo.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, tempo: tempo.value })}
                  disabled={isLoading}
                  className={`py-2 px-3 rounded-lg border transition-all ${
                    formData.tempo === tempo.value
                      ? 'border-blue-500 bg-blue-500 bg-opacity-10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                  style={{
                    borderColor:
                      formData.tempo === tempo.value
                        ? 'var(--color-primary)'
                        : 'var(--color-border)',
                    background:
                      formData.tempo === tempo.value ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    color: 'var(--color-text)',
                  }}
                >
                  {tempo.label}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Preset */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-text)' }}
            >
              Voice
            </label>
            <select
              className="select"
              value={formData.voicePreset}
              onChange={(e) => setFormData({ ...formData, voicePreset: e.target.value })}
              disabled={isLoading}
            >
              {VOICE_PRESETS.map((voice) => (
                <option key={voice} value={voice}>
                  {voice}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="card">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>
              Advanced Options
            </span>
            <svg
              className={`w-5 h-5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          {showAdvanced && (
            <div className="mt-4 space-y-4">
              {/* Script Template */}
              {scriptTemplates.length > 0 && (
                <div>
                  <label
                    className="block text-sm font-medium mb-2"
                    style={{ color: 'var(--color-text)' }}
                  >
                    Script Template (optional)
                  </label>
                  <select
                    className="select"
                    value={formData.scriptTemplateId}
                    onChange={(e) => setFormData({ ...formData, scriptTemplateId: e.target.value })}
                    disabled={isLoading}
                  >
                    <option value="">None</option>
                    {scriptTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* SEO Keywords */}
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--color-text)' }}
                >
                  SEO Keywords (optional)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="keyword1, keyword2, keyword3"
                  value={formData.seoKeywords}
                  onChange={(e) => setFormData({ ...formData, seoKeywords: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div
            className="card border-red-500 bg-red-500 bg-opacity-10"
            style={{ borderColor: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.1)' }}
          >
            <p style={{ color: 'var(--color-danger)' }}>{error}</p>
          </div>
        )}

        {/* Info Message */}
        <div
          className="card bg-blue-500 bg-opacity-5"
          style={{ background: 'rgba(59, 130, 246, 0.05)' }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            💡 <strong>Note:</strong> Videos will be queued and rendered one at a time. You can
            monitor progress in the Output page for the first video.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !canGenerate || topicCount === 0 || topicCount > 50}
          className="btn btn-primary w-full"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div
                className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: 'white', borderTopColor: 'transparent' }}
              />
              Starting batch ({topicCount} video{topicCount !== 1 ? 's' : ''})...
            </span>
          ) : (
            <span>
              Start Batch ({topicCount} video{topicCount !== 1 ? 's' : ''})
            </span>
          )}
        </button>
      </form>
    </div>
  );
}
