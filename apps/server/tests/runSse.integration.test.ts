import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';
import { v4 as uuid } from 'uuid';
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
  });

  it('streams initial run state over SSE', async () => {
    const projectId = uuid();
    const planId = uuid();
    const runId = uuid();

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

  it('allows multiple SSE clients for the same run and both receive initial state', async () => {
    const projectId = uuid();
    const planId = uuid();
    const runId = uuid();

    await prisma.project.create({
      data: {
        id: projectId,
        title: 'SSE Multi',
        topic: 'Multi client',
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
        hookOptionsJson: '[]',
        outline: '',
        scriptFull: '',
        estimatesJson: '{}',
        validationJson: '{}',
      },
    });
    await prisma.run.create({
      data: {
        id: runId,
        projectId,
        planVersionId: planId,
        status: 'running',
        progress: 50,
        currentStep: 'ffmpeg_render',
        logsJson: JSON.stringify([
          { timestamp: new Date().toISOString(), message: 'Step', level: 'info' },
        ]),
        artifactsJson: '{}',
        resumeStateJson: '{}',
      },
    });

    const fetchOne = (): Promise<string> =>
      new Promise((resolve, reject) => {
        const req = http.request(
          `${baseUrl}/api/run/${runId}/stream`,
          { headers: { Accept: 'text/event-stream' } },
          (res) => {
            if (res.statusCode === 503) {
              reject(new Error('Unexpected 503'));
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
        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
        req.end();
      });

    const [buf1, buf2] = await Promise.all([fetchOne(), fetchOne()]);
    const parsePayload = (buf: string) => {
      const line = buf.split('\n').find((l) => l.startsWith('data: '));
      return line ? JSON.parse(line.replace('data: ', '')) : null;
    };
    const p1 = parsePayload(buf1);
    const p2 = parsePayload(buf2);
    expect(p1).toBeTruthy();
    expect(p2).toBeTruthy();
    expect(p1.type).toBe('state');
    expect(p2.type).toBe('state');
    expect(p1.status).toBe('running');
    expect(p2.status).toBe('running');
  });
});
