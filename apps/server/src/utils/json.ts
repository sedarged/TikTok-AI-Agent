export function extractJson<T>(input: string): T {
  const trimmed = input.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as T;
  }
  const match = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) {
    throw new Error("No JSON object found in response.");
  }
  return JSON.parse(match[0]) as T;
}
