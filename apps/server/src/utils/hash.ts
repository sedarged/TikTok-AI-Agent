import crypto from "crypto";

export function hashString(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
