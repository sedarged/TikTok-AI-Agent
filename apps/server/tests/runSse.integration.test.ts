import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { prisma } from '../src/db/client.js';

let baseUrl = '';
let server: http.Server;

async function resetDb() {
  await prisma.cache.deleteMany();
  await prisma.scene.deleteMany();
  await prisma.run.deleteMany();
  await prisma.planVersion.deleteMany();
  await prisma.project.deleteMany();
}

describe('Run SSE stream', () => {
  beforeAll(async () => {
    const module = await import('../src/index.js');
    const app = module.createApp();
    server = app.listen(0);
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    server.close();
    await prisma.$disconnect();
  });

  it('streams initial run state over SSE', async () => {
    const projectId = `sse-project-${Date.now()}`;
    const planId = `sse-plan-${Date.now()}`;
    const runId = `sse-run-${Date.now()}`;

    await prisma.project.create({
      data: {
        id: projectId,
        title: 'SSE Project',
        topic: 'SSE test topic',
        nichePackId: 'facts',
        language: 'en',
        targetLengthSec: 60,
        tempo: 'normal',
        voicePreset: 'alloy',
        status: 'PLAN_READY',
      },
    });

    await prisma.planVersion.create({
      data: {
        id: planId,
        projectId,
        hookOptionsJson: JSON.stringify(['hook']),
        hookSelected: 'hook',
        outline: 'outline',
        scriptFull: 'script',
        estimatesJson: JSON.stringify({ wpm: 150, estimatedLengthSec: 60, targetLengthSec: 60 }),
        validationJson: JSON.stringify({ errors: [], warnings: [], suggestions: [] }),
      },
    });

    await prisma.run.create({
      data: {
        id: runId,
        projectId,
        planVersionId: planId,
        status: 'queued',
        progress: 0,
        currentStep: '',
        logsJson: JSON.stringify([]),
        artifactsJson: JSON.stringify({}),
        resumeStateJson: JSON.stringify({}),
      },
    });

    const sseData = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        `${baseUrl}/api/run/${runId}/stream`,
        { headers: { Accept: 'text/event-stream' } },
        (res) => {
          const contentType = res.headers['content-type'];
          if (!contentType || !contentType.includes('text/event-stream')) {
            reject(new Error('Expected text/event-stream response'));
            return;
          }

          let buffer = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            buffer += chunk;
            if (buffer.includes('\n\n')) {
              res.destroy();
              resolve(buffer);
            }
          });
        }
      );

      req.on('error', reject);
      req.setTimeout(3000, () => {
        req.destroy();
        reject(new Error('Timed out waiting for SSE'));
      });
      req.end();
    });

    const line = sseData.split('\n').find((l) => l.startsWith('data: '));
    expect(line).toBeTruthy();
    const payload = JSON.parse((line || '').replace('data: ', ''));
    expect(payload.type).toBe('state');
    expect(payload.status).toBe('queued');
  });
});
