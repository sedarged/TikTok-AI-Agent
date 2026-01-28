const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    },
    ...options
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Request failed");
  }
  return (await response.json()) as T;
}

export const api = {
  getStatus: () => request<{ providers: { openaiConfigured: boolean; elevenlabsConfigured: boolean }; ffmpeg: any }>("/status"),
  getPacks: () => request<{ packs: any[] }>("/packs"),
  createProject: (payload: any) =>
    request<{ project: any }>("/project", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getProject: (id: string) => request<{ project: any; plan: any | null }>(`/project/${id}`),
  duplicateProject: (id: string, topic: string) =>
    request<{ project: any; planVersionId: string | null }>(`/project/${id}/duplicate`, {
      method: "POST",
      body: JSON.stringify({ topic })
    }),
  createPlan: (projectId: string) =>
    request<{ planVersionId: string; plan: any }>(`/project/${projectId}/plan`, {
      method: "POST"
    }),
  updatePlan: (planVersionId: string, payload: any) =>
    request<{ plan: any }>(`/plan/${planVersionId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  validatePlan: (planVersionId: string) =>
    request<{ validation: any }>(`/plan/${planVersionId}/validate`, { method: "POST" }),
  autofitPlan: (planVersionId: string) =>
    request<{ plan: any }>(`/plan/${planVersionId}/autofit`, { method: "POST" }),
  approvePlan: (planVersionId: string) =>
    request<{ status: string }>(`/plan/${planVersionId}/approve`, { method: "POST" }),
  renderPlan: (planVersionId: string) =>
    request<{ runId: string }>(`/plan/${planVersionId}/render`, { method: "POST" }),
  regenerateScene: (sceneId: string) =>
    request<{ scene: any }>(`/scene/${sceneId}/regenerate`, { method: "POST" }),
  regenerateHooks: (planVersionId: string) =>
    request<{ hookOptions: string[]; hookSelected: string }>(`/plan/${planVersionId}/regenerate/hooks`, { method: "POST" }),
  regenerateOutline: (planVersionId: string) =>
    request<{ outline: string }>(`/plan/${planVersionId}/regenerate/outline`, { method: "POST" }),
  regenerateScript: (planVersionId: string) =>
    request<{ scriptFull: string; scenes: any[] }>(`/plan/${planVersionId}/regenerate/script`, { method: "POST" }),
  getRun: (runId: string) => request<{ run: any }>(`/run/${runId}`),
  retryRun: (runId: string, fromStep?: string) =>
    request<{ status: string }>(`/run/${runId}/retry`, {
      method: "POST",
      body: JSON.stringify({ fromStep })
    }),
  verifyRun: (runId: string) => request<{ status: string; issues: string[] }>(`/run/${runId}/verify`),
  getProjectRuns: (projectId: string) => request<{ runs: any[] }>(`/project/${projectId}/runs`)
};
