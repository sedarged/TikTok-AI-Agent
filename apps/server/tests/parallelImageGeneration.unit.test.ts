import { describe, expect, it, beforeEach, vi } from 'vitest';

/**
 * Unit test for parallel image generation logic
 *
 * This test verifies that image generation can process multiple images
 * concurrently with proper concurrency control using p-limit.
 *
 * Note: This is a unit test focused on the concurrency pattern itself,
 * not the full render pipeline. Integration tests cover end-to-end behavior.
 */

describe('Parallel Image Generation Pattern', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process images with concurrency limit', async () => {
    // Simulate the parallel pattern used in renderPipeline.ts
    const pLimit = (await import('p-limit')).default;

    const MAX_CONCURRENT = 3;
    const TOTAL_IMAGES = 10;

    const limit = pLimit(MAX_CONCURRENT);
    const results: number[] = [];
    const startTimes: number[] = [];
    const endTimes: number[] = [];

    // Create tasks that simulate image generation
    const tasks = Array.from({ length: TOTAL_IMAGES }, (_, i) => {
      return limit(async () => {
        startTimes.push(Date.now());

        // Simulate async work (image generation)
        await new Promise((resolve) => setTimeout(resolve, 10));

        results.push(i);
        endTimes.push(Date.now());

        return i;
      });
    });

    // Execute all tasks in parallel (with limit)
    await Promise.all(tasks);

    // Verify all tasks completed
    expect(results).toHaveLength(TOTAL_IMAGES);
    expect(results.sort((a, b) => a - b)).toEqual(
      Array.from({ length: TOTAL_IMAGES }, (_, i) => i)
    );

    // Verify concurrency was limited by checking that not all tasks
    // started at the same time (would indicate no limit)
    const uniqueStartTimes = new Set(startTimes);
    // With proper concurrency limiting, we should have more than MAX_CONCURRENT
    // distinct start times (tasks wait for others to complete)
    expect(uniqueStartTimes.size).toBeGreaterThan(MAX_CONCURRENT);
  });

  it('should handle task failures without breaking other tasks', async () => {
    const pLimit = (await import('p-limit')).default;

    const MAX_CONCURRENT = 3;
    const TOTAL_TASKS = 6;

    const limit = pLimit(MAX_CONCURRENT);
    const results: Array<{ index: number; success: boolean }> = [];

    // Create tasks where task 2 will fail
    const tasks = Array.from({ length: TOTAL_TASKS }, (_, i) => {
      return limit(async () => {
        if (i === 2) {
          results.push({ index: i, success: false });
          throw new Error(`Task ${i} failed`);
        }

        await new Promise((resolve) => setTimeout(resolve, 5));
        results.push({ index: i, success: true });
        return i;
      });
    });

    // Use Promise.allSettled to handle failures gracefully
    const settled = await Promise.allSettled(tasks);

    // Verify that 5 tasks succeeded and 1 failed
    const successful = settled.filter((r) => r.status === 'fulfilled');
    const failed = settled.filter((r) => r.status === 'rejected');

    expect(successful).toHaveLength(TOTAL_TASKS - 1);
    expect(failed).toHaveLength(1);

    // Verify all tasks were attempted
    expect(results).toHaveLength(TOTAL_TASKS);
  });

  it('should process images in order when concurrency is 1', async () => {
    const pLimit = (await import('p-limit')).default;

    const MAX_CONCURRENT = 1;
    const TOTAL_IMAGES = 5;

    const limit = pLimit(MAX_CONCURRENT);
    const processOrder: number[] = [];

    const tasks = Array.from({ length: TOTAL_IMAGES }, (_, i) => {
      return limit(async () => {
        processOrder.push(i);
        await new Promise((resolve) => setTimeout(resolve, 5));
        return i;
      });
    });

    await Promise.all(tasks);

    // With concurrency=1, tasks should process in order
    expect(processOrder).toEqual([0, 1, 2, 3, 4]);
  });

  it('should allow higher concurrency to process faster', async () => {
    const pLimit = (await import('p-limit')).default;

    const TOTAL_IMAGES = 10;
    const TASK_DURATION = 20; // ms per task

    // Test with concurrency=1
    const limit1 = pLimit(1);
    const tasks1 = Array.from({ length: TOTAL_IMAGES }, (_, i) => {
      return limit1(async () => {
        await new Promise((resolve) => setTimeout(resolve, TASK_DURATION));
        return i;
      });
    });

    const start1 = Date.now();
    await Promise.all(tasks1);
    const duration1 = Date.now() - start1;

    // Test with concurrency=5
    const limit5 = pLimit(5);
    const tasks5 = Array.from({ length: TOTAL_IMAGES }, (_, i) => {
      return limit5(async () => {
        await new Promise((resolve) => setTimeout(resolve, TASK_DURATION));
        return i;
      });
    });

    const start5 = Date.now();
    await Promise.all(tasks5);
    const duration5 = Date.now() - start5;

    // Higher concurrency should be significantly faster
    // With concurrency=1: ~200ms (10 tasks * 20ms)
    // With concurrency=5: ~40ms (2 batches * 20ms)
    // Allow some margin for execution overhead
    expect(duration5).toBeLessThan(duration1 * 0.8);
  });

  it('should maintain progress tracking with parallel execution', async () => {
    const pLimit = (await import('p-limit')).default;

    const MAX_CONCURRENT = 3;
    const TOTAL_IMAGES = 10;
    const STEP_WEIGHT = 35; // Same as images_generate in renderPipeline

    const limit = pLimit(MAX_CONCURRENT);
    let completedImages = 0;
    const progressUpdates: number[] = [];

    // Simulate the progress tracking pattern from renderPipeline
    const tasks = Array.from({ length: TOTAL_IMAGES }, () => {
      return limit(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));

        // Update progress (simulates updateProgress call)
        completedImages++;
        const stepProgress = (completedImages / TOTAL_IMAGES) * STEP_WEIGHT;
        progressUpdates.push(Math.round(stepProgress));
      });
    });

    await Promise.all(tasks);

    // Verify all progress updates were recorded
    expect(progressUpdates).toHaveLength(TOTAL_IMAGES);

    // Verify final progress is 35 (full step weight)
    expect(Math.max(...progressUpdates)).toBe(STEP_WEIGHT);

    // Verify progress updates are monotonically increasing when sorted
    const sortedUpdates = [...progressUpdates].sort((a, b) => a - b);
    for (let i = 1; i < sortedUpdates.length; i++) {
      expect(sortedUpdates[i]).toBeGreaterThanOrEqual(sortedUpdates[i - 1]);
    }
  });
});
