import type {
  Project,
  PlanVersion,
  Scene,
  Run,
  NichePack,
  ValidationResult,
  VerificationResult,
  ProviderStatus,
  SSEEvent,
} from './types';

const API_BASE = '/api';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Status
export async function getStatus(): Promise<ProviderStatus> {
  return fetchApi<ProviderStatus>('/status');
}

// Niche packs
export async function getNichePacks(): Promise<NichePack[]> {
  return fetchApi<NichePack[]>('/niche-packs');
}

export async function getNichePack(id: string): Promise<NichePack> {
  return fetchApi<NichePack>(`/niche-packs/${id}`);
}

// Projects
export async function getProjects(): Promise<Project[]> {
  return fetchApi<Project[]>('/projects');
}

export async function getProject(id: string): Promise<Project> {
  return fetchApi<Project>(`/project/${id}`);
}

export async function createProject(data: {
  topic: string;
  nichePackId: string;
  language?: string;
  targetLengthSec?: number;
  tempo?: string;
  voicePreset?: string;
  visualStylePreset?: string | null;
}): Promise<Project> {
  return fetchApi<Project>('/project', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function generatePlan(projectId: string): Promise<PlanVersion> {
  return fetchApi<PlanVersion>(`/project/${projectId}/plan`, {
    method: 'POST',
  });
}

export async function duplicateProject(projectId: string): Promise<Project> {
  return fetchApi<Project>(`/project/${projectId}/duplicate`, {
    method: 'POST',
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await fetchApi(`/project/${projectId}`, {
    method: 'DELETE',
  });
}

// Plan versions
export async function getPlanVersion(planVersionId: string): Promise<PlanVersion> {
  return fetchApi<PlanVersion>(`/plan/${planVersionId}`);
}

export async function updatePlanVersion(
  planVersionId: string,
  data: Partial<{
    hookSelected: string;
    outline: string;
    scriptFull: string;
    scenes: Partial<Scene>[];
  }>
): Promise<PlanVersion> {
  return fetchApi<PlanVersion>(`/plan/${planVersionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function validatePlan(planVersionId: string): Promise<ValidationResult> {
  return fetchApi<ValidationResult>(`/plan/${planVersionId}/validate`, {
    method: 'POST',
  });
}

export async function autofitDurations(planVersionId: string): Promise<PlanVersion> {
  return fetchApi<PlanVersion>(`/plan/${planVersionId}/autofit`, {
    method: 'POST',
  });
}

export async function regenerateHooks(planVersionId: string): Promise<{ hookOptions: string[] }> {
  return fetchApi<{ hookOptions: string[] }>(`/plan/${planVersionId}/regenerate-hooks`, {
    method: 'POST',
  });
}

export async function regenerateOutline(planVersionId: string): Promise<{ outline: string }> {
  return fetchApi<{ outline: string }>(`/plan/${planVersionId}/regenerate-outline`, {
    method: 'POST',
  });
}

export async function regenerateScript(planVersionId: string): Promise<PlanVersion> {
  return fetchApi<PlanVersion>(`/plan/${planVersionId}/regenerate-script`, {
    method: 'POST',
  });
}

export async function approvePlan(planVersionId: string): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/plan/${planVersionId}/approve`, {
    method: 'POST',
  });
}

export async function startRender(planVersionId: string): Promise<Run> {
  return fetchApi<Run>(`/plan/${planVersionId}/render`, {
    method: 'POST',
  });
}

// Scenes
export async function updateScene(sceneId: string, data: Partial<Scene>): Promise<Scene> {
  return fetchApi<Scene>(`/scene/${sceneId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function toggleSceneLock(sceneId: string, locked: boolean): Promise<Scene> {
  return fetchApi<Scene>(`/scene/${sceneId}/lock`, {
    method: 'POST',
    body: JSON.stringify({ locked }),
  });
}

export async function regenerateScene(sceneId: string): Promise<Scene> {
  return fetchApi<Scene>(`/scene/${sceneId}/regenerate`, {
    method: 'POST',
  });
}

// Runs
export async function getRun(runId: string): Promise<Run> {
  return fetchApi<Run>(`/run/${runId}`);
}

export async function retryRun(runId: string, fromStep?: string): Promise<Run> {
  return fetchApi<Run>(`/run/${runId}/retry`, {
    method: 'POST',
    body: JSON.stringify({ fromStep }),
  });
}

export async function cancelRun(runId: string): Promise<void> {
  await fetchApi(`/run/${runId}/cancel`, {
    method: 'POST',
  });
}

export async function verifyRun(runId: string): Promise<VerificationResult> {
  return fetchApi<VerificationResult>(`/run/${runId}/verify`);
}

export async function getExportData(runId: string): Promise<Record<string, unknown>> {
  return fetchApi<Record<string, unknown>>(`/run/${runId}/export`);
}

// SSE stream
export function subscribeToRun(
  runId: string,
  onEvent: (event: SSEEvent) => void,
  onError?: (error: Error) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/run/${runId}/stream`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as SSEEvent;
      onEvent(data);
    } catch (e) {
      console.error('Failed to parse SSE event:', e);
    }
  };

  eventSource.onerror = (event) => {
    console.error('SSE error:', event);
    if (onError) {
      onError(new Error('Connection lost'));
    }
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}
