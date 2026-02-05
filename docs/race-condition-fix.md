# Race Condition Fix in addLog Function

## Problem Statement

The `addLog` function in `renderPipeline.ts` had a classic read-modify-write race condition:

1. Read current logs from database
2. Parse JSON and add new log entry
3. Write entire array back to database

When multiple parallel tasks (e.g., during parallel image generation) called `addLog` concurrently:
- Each task would read the same initial state
- Each would add their log entry
- Each would write back, **overwriting** the others' changes
- **Result**: Only the last write would survive, losing all other log entries

### Evidence

The test demonstrated this clearly:
- **Before fix**: 20 concurrent log writes → only 1 entry saved
- **After fix**: 20 concurrent log writes → all 20 entries saved

## Solution

Implemented a **queue-based serialization mechanism** for log writes:

### Key Components

1. **Log Queues** (`logQueues: Map<string, LogQueueItem[]>`)
   - One queue per runId
   - Queues pending log operations

2. **Processing State** (`logProcessing: Map<string, Promise<void>>`)
   - Tracks currently processing operation per runId
   - Prevents multiple concurrent processors

3. **Queue Processor** (`processLogQueue()`)
   - Processes one log entry at a time
   - Recursively processes remaining items
   - Cleans up when queue is empty

4. **Modified addLog** 
   - Creates LogEntry object
   - Adds to queue with Promise resolve/reject
   - Starts processor if not already running
   - Returns Promise that resolves when entry is saved

### How It Works

```
Concurrent addLog calls → All queued → Processed sequentially → No race condition
```

**Example with 3 concurrent calls:**

```
Time  Task 1         Task 2         Task 3         Queue State       DB
----  -------------  -------------  -------------  ----------------  --------
t1    addLog("A")    -              -              ["A"]             []
t2    addLog("A")    addLog("B")    -              ["A","B"]         []
t3    addLog("A")    addLog("B")    addLog("C")    ["A","B","C"]     []
t4    processQueue   -              -              ["B","C"]         ["A"]
t5    processQueue   -              -              ["C"]             ["A","B"]
t6    processQueue   -              -              []                ["A","B","C"]
```

## Implementation Details

### Changes Made

1. **Added queue infrastructure** (lines 1185-1201)
   - `LogEntry` interface
   - `LogQueueItem` interface
   - `logQueues` Map
   - `logProcessing` Map

2. **Added processLogQueue function** (lines 1203-1261)
   - Serializes log writes
   - Processes log entries sequentially
   - Rejects all pending items on error to prevent hanging promises

3. **Modified addLog function** (lines 1263-1286)
   - Queue-based instead of direct write
   - Returns Promise for async completion

4. **Added helper exports** (lines 1138-1145)
   - `clearLogQueues()` - For test cleanup
   - `addLogForTesting()` - For test access

### Why This Approach?

**Advantages:**
- ✅ No database schema changes needed
- ✅ Minimal code changes
- ✅ Per-run isolation (different runs don't block each other)
- ✅ Graceful error handling
- ✅ Maintains order of log entries
- ✅ No external dependencies

**Alternatives Considered:**
- ❌ Database transactions - SQLite limitations
- ❌ Dedicated log table - Requires schema migration
- ❌ File-based locks - Complex cleanup, platform-specific

## Testing

### Test Coverage

1. **Concurrent writes test**
   - 20 parallel addLog calls
   - Verifies all entries saved
   - Verifies all unique messages present

2. **Sequential writes test**
   - 10 sequential addLog calls
   - Verifies order maintained

3. **Log levels test**
   - Tests info, warn, error levels
   - Verifies correct level saved

### Test Results

```bash
✅ All 86 unit/integration tests pass
✅ All 28 render pipeline tests pass
✅ No type errors
✅ Only 1 pre-existing linter warning (unrelated)
```

## Impact

### Before Fix
- Log entries lost during parallel operations
- Debugging render issues was difficult
- No visibility into concurrent task execution

### After Fix
- All log entries preserved
- Complete audit trail of render pipeline
- Better debugging and monitoring

### Performance Impact
- Minimal: Queue operations are in-memory
- Only serialization is per-run, not global
- Database writes still happen (same as before)

## Future Improvements

While the current fix solves the race condition, potential enhancements:

1. **Batching** - Combine multiple log entries into single DB write
2. **Flush on completion** - Ensure all logs written before run completes
3. **Log rotation** - Prevent logsJson from growing too large
4. **Structured logging** - Consider dedicated log table for better querying

## Related Files

- `apps/server/src/services/render/renderPipeline.ts` - Implementation
- `apps/server/tests/addLogRaceCondition.unit.test.ts` - Test suite
- `apps/server/prisma/schema.prisma` - Database schema (unchanged)

## References

- Issue: [BUG]: Race condition in addLog: concurrent log writes can lose entries
- Lines affected: 1170-1200 (original), 1185-1286 (fixed)
- Commit: Fix race condition in addLog with queue-based serialization
