import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import { prisma } from '../src/db/client.js';

describe('Graceful Shutdown', () => {
  let server: Server;
  let module: typeof import('../src/index.js');

  beforeAll(async () => {
    module = await import('../src/index.js');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should export startServer function', () => {
    expect(module.startServer).toBeDefined();
    expect(typeof module.startServer).toBe('function');
  });

  it('should set up SIGTERM handler when server starts', async () => {
    const originalListeners = process.listeners('SIGTERM');

    // Start server
    server = module.startServer();

    // Wait a bit for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that SIGTERM handler was added
    const newListeners = process.listeners('SIGTERM');
    expect(newListeners.length).toBeGreaterThan(originalListeners.length);

    // Clean up
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });

    // Remove added signal handlers to avoid interference with other tests
    const addedListeners = newListeners.filter(
      (listener) => !originalListeners.includes(listener)
    );
    addedListeners.forEach((listener) => {
      process.removeListener('SIGTERM', listener as NodeJS.SignalsListener);
    });
  });

  it('should set up SIGINT handler when server starts', async () => {
    const originalListeners = process.listeners('SIGINT');

    // Start server
    server = module.startServer();

    // Wait a bit for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check that SIGINT handler was added
    const newListeners = process.listeners('SIGINT');
    expect(newListeners.length).toBeGreaterThan(originalListeners.length);

    // Clean up
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });

    // Remove added signal handlers to avoid interference with other tests
    const addedListeners = newListeners.filter(
      (listener) => !originalListeners.includes(listener)
    );
    addedListeners.forEach((listener) => {
      process.removeListener('SIGINT', listener as NodeJS.SignalsListener);
    });
  });

  it('should have exports for SSE cleanup', async () => {
    const runModule = await import('../src/routes/run.js');
    expect(runModule.drainSseConnections).toBeDefined();
    expect(typeof runModule.drainSseConnections).toBe('function');
  });

  it('should have exports for render pipeline cleanup', async () => {
    const renderModule = await import('../src/services/render/renderPipeline.js');
    expect(renderModule.getActiveRuns).toBeDefined();
    expect(renderModule.cancelAllActiveRuns).toBeDefined();
    expect(typeof renderModule.getActiveRuns).toBe('function');
    expect(typeof renderModule.cancelAllActiveRuns).toBe('function');
  });

  it('drainSseConnections should be callable without errors', async () => {
    // Import the function
    const runModule = await import('../src/routes/run.js');

    // Should not throw even if there are no connections
    expect(() => {
      runModule.drainSseConnections();
    }).not.toThrow();
  });

  it('getActiveRuns should return an array', async () => {
    const renderModule = await import('../src/services/render/renderPipeline.js');
    const activeRuns = renderModule.getActiveRuns();
    expect(Array.isArray(activeRuns)).toBe(true);
  });
});
