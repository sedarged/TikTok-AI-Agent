import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { prisma } from '../src/db/client.js';
import { addLogForTesting, clearLogQueues } from '../src/services/render/renderPipeline.js';

/**
 * Unit test for addLog race condition
 *
 * This test verifies that concurrent calls to addLog don't lose log entries
 * due to read-modify-write race conditions.
 */

interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

describe('addLog Race Condition', () => {
  let testRunId: string;

  beforeEach(async () => {
    // Clear log queues before each test
    clearLogQueues();

    // Create a test project
    const project = await prisma.project.create({
      data: {
        title: 'Test Project for addLog Race',
        topic: 'Test topic',
        nichePackId: 'facts',
        status: 'DRAFT_PLAN',
      },
    });

    // Create a test plan version
    const planVersion = await prisma.planVersion.create({
      data: {
        projectId: project.id,
        hookSelected: 'Test hook',
      },
    });

    // Create a test run
    const run = await prisma.run.create({
      data: {
        projectId: project.id,
        planVersionId: planVersion.id,
        status: 'running',
        logsJson: '[]',
      },
    });

    testRunId = run.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testRunId) {
      const run = await prisma.run.findUnique({
        where: { id: testRunId },
        include: { project: true },
      });

      if (run) {
        await prisma.run.delete({ where: { id: testRunId } });
        await prisma.planVersion.deleteMany({ where: { projectId: run.projectId } });
        await prisma.project.delete({ where: { id: run.projectId } });
      }
    }

    // Clear log queues after each test
    clearLogQueues();
  });

  it('should not lose log entries when addLog is called concurrently', async () => {
    const NUM_CONCURRENT_LOGS = 20;
    const logMessages = Array.from(
      { length: NUM_CONCURRENT_LOGS },
      (_, i) => `Concurrent log entry ${i + 1}`
    );

    // Execute all log writes concurrently using the fixed addLog function
    await Promise.all(logMessages.map((message) => addLogForTesting(testRunId, message)));

    // Verify the results
    const finalRun = await prisma.run.findUnique({
      where: { id: testRunId },
    });

    expect(finalRun).toBeDefined();

    const finalLogs = JSON.parse(finalRun!.logsJson) as LogEntry[];

    // With the queue-based fix, all 20 entries should be present
    console.log(`Expected ${NUM_CONCURRENT_LOGS} logs, got ${finalLogs.length}`);

    expect(finalLogs.length).toBe(NUM_CONCURRENT_LOGS);

    // Verify all unique messages are present
    const messages = finalLogs.map((log) => log.message);
    const uniqueMessages = new Set(messages);
    expect(uniqueMessages.size).toBe(NUM_CONCURRENT_LOGS);

    // Verify each expected message is present
    logMessages.forEach((expectedMessage) => {
      expect(messages).toContain(expectedMessage);
    });
  });

  it('should maintain correct log order with sequential writes', async () => {
    const NUM_LOGS = 10;
    const logMessages = Array.from({ length: NUM_LOGS }, (_, i) => `Sequential log entry ${i + 1}`);

    // Write logs sequentially using the fixed addLog function
    for (const message of logMessages) {
      await addLogForTesting(testRunId, message);
    }

    // Verify the results
    const finalRun = await prisma.run.findUnique({
      where: { id: testRunId },
    });

    expect(finalRun).toBeDefined();

    const finalLogs = JSON.parse(finalRun!.logsJson) as LogEntry[];
    expect(finalLogs.length).toBe(NUM_LOGS);

    // Verify order is maintained
    finalLogs.forEach((log, index: number) => {
      expect(log.message).toBe(logMessages[index]);
    });
  });

  it('should handle different log levels correctly', async () => {
    const logs = [
      { message: 'Info message', level: 'info' as const },
      { message: 'Warning message', level: 'warn' as const },
      { message: 'Error message', level: 'error' as const },
    ];

    // Add logs with different levels
    await Promise.all(logs.map((log) => addLogForTesting(testRunId, log.message, log.level)));

    // Verify the results
    const finalRun = await prisma.run.findUnique({
      where: { id: testRunId },
    });

    expect(finalRun).toBeDefined();

    const finalLogs = JSON.parse(finalRun!.logsJson) as LogEntry[];
    expect(finalLogs.length).toBe(3);

    // Verify each log has the correct level
    const infoLog = finalLogs.find((log) => log.message === 'Info message');
    const warnLog = finalLogs.find((log) => log.message === 'Warning message');
    const errorLog = finalLogs.find((log) => log.message === 'Error message');

    expect(infoLog?.level).toBe('info');
    expect(warnLog?.level).toBe('warn');
    expect(errorLog?.level).toBe('error');
  });
});
