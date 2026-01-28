import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../db/prisma.js';

export function hashKey(kind: string, obj: unknown) {
  const h = crypto.createHash('sha256');
  h.update(kind);
  h.update('\n');
  h.update(JSON.stringify(obj));
  return h.digest('hex');
}

export async function getCache(kind: string, key: string) {
  return prisma.cache.findUnique({ where: { hashKey: `${kind}:${key}` } });
}

export async function putCache(kind: string, key: string, result: unknown, payloadPath?: string | null) {
  return prisma.cache.upsert({
    where: { hashKey: `${kind}:${key}` },
    update: { resultJson: JSON.stringify(result), payloadPath: payloadPath ?? null },
    create: { kind, hashKey: `${kind}:${key}`, resultJson: JSON.stringify(result), payloadPath: payloadPath ?? null }
  });
}

export function fileExists(p: string) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function safePathJoin(root: string, ...parts: string[]) {
  return path.resolve(root, ...parts);
}

