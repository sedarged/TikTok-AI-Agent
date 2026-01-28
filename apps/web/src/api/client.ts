export type ApiError = { error: string; [k: string]: unknown };

async function parseJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: `Invalid JSON response (status ${res.status}).`, raw: text };
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw data as ApiError;
  }
  return data as T;
}

