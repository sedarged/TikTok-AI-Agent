# Common Pitfalls

**Frequent mistakes and how to avoid them.**

## API Routes

### ❌ Missing Input Validation

**Don't:**
```typescript
app.post('/api/project', async (req, res) => {
  const { topic, nichePackId } = req.body;
  // No validation!
  const project = await createProject(topic, nichePackId);
  res.json(project);
});
```

**Do:**
```typescript
const schema = z.object({
  topic: z.string().min(1).max(500),
  nichePackId: z.string().min(1),
}).strict();

app.post('/api/project', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ 
      error: 'Invalid request', 
      details: parsed.error.flatten() 
    });
  }
  const { topic, nichePackId } = parsed.data;
  // Now safe to use
});
```

### ❌ Bare JSON.parse()

**Don't:**
```typescript
const logs = JSON.parse(run.logsJson); // Can throw!
```

**Do:**
```typescript
let logs = [];
try {
  logs = JSON.parse(run.logsJson);
} catch (error) {
  console.error('Failed to parse logs:', error);
  logs = []; // Sensible default
}
```

### ❌ Not Validating Path Parameters

**Don't:**
```typescript
app.get('/api/run/:runId', async (req, res) => {
  const run = await prisma.run.findUnique({ 
    where: { id: req.params.runId } 
  });
  // What if runId is not a UUID?
});
```

**Do:**
```typescript
const paramsSchema = z.object({ runId: z.string().uuid() });

app.get('/api/run/:runId', async (req, res) => {
  const parsed = paramsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid run ID' });
  }
  const { runId } = parsed.data;
  // Now safe
});
```

## Database

### ❌ Missing Relations in Queries

**Don't:**
```typescript
const project = await prisma.project.findUnique({ 
  where: { id } 
});
// project.planVersions is undefined!
```

**Do:**
```typescript
const project = await prisma.project.findUnique({ 
  where: { id },
  include: { planVersions: { include: { scenes: true } } }
});
// Now project.planVersions is populated
```

### ❌ Forgetting to Use Singleton Client

**Don't:**
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient(); // Creates new connection!
```

**Do:**
```typescript
import { prisma } from 'db/client'; // Use singleton
```

## Frontend

### ❌ Not Handling Errors

**Don't:**
```typescript
const data = await apiClient.createProject(topic, nichePackId);
// What if this fails?
setProject(data);
```

**Do:**
```typescript
try {
  const data = await apiClient.createProject(topic, nichePackId);
  setProject(data);
} catch (error) {
  setError(getErrorMessage(error)); // Show to user
}
```

### ❌ Missing Loading States

**Don't:**
```typescript
return <div>{projects.map(p => <ProjectCard key={p.id} project={p} />)}</div>
// What if projects is still loading? Or failed?
```

**Do:**
```typescript
if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {error}</div>;
if (!projects) return null;
return <div>{projects.map(p => <ProjectCard key={p.id} project={p} />)}</div>;
```

## Testing

### ❌ Not Using Test Mode Environment Variables

**Don't:**
```typescript
// Makes real OpenAI API calls in tests
const result = await generatePlan(topic);
```

**Do:**
```typescript
// Set APP_TEST_MODE=1 in test setup
// Or use APP_RENDER_DRY_RUN=1 for render tests
// Tests use mocked responses
```

### ❌ Modifying Tests to Pass

**Don't:** Change test expectations when implementation is wrong.

**Do:** Fix the implementation to match correct behavior.

## FFmpeg

### ❌ No Timeout Protection

**Don't:**
```typescript
await execAsync('ffmpeg -i input.mp4 output.mp4'); // Can hang forever
```

**Do:**
```typescript
await execAsync('ffmpeg -i input.mp4 output.mp4', { timeout: 300000 }); // 5 min
```

### ❌ Not Checking File Existence

**Don't:**
```typescript
await ffmpeg.concat([file1, file2], output);
// What if file1 or file2 don't exist?
```

**Do:**
```typescript
if (!fs.existsSync(file1)) throw new Error('Input file missing');
if (!fs.existsSync(file2)) throw new Error('Input file missing');
await ffmpeg.concat([file1, file2], output);
```

## Git & Commits

### ❌ Committing Build Artifacts

**Don't:** Commit `node_modules/`, `dist/`, `artifacts/`, `.env`

**Do:** Use `.gitignore` and verify with `git status` before committing.

### ❌ Vague Commit Messages

**Don't:** `git commit -m "fix"`

**Do:** `git commit -m "fix: validate runId UUID in GET /api/run/:runId"`

## Security

### ❌ CORS Wildcard in Production

**Don't:**
```typescript
app.use(cors({ origin: '*' })); // Allows any origin!
```

**Do:**
```typescript
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
app.use(cors({ origin: allowedOrigins }));
```

### ❌ Path Traversal in File Serving

**Don't:**
```typescript
app.get('/artifacts/:filename', (req, res) => {
  res.sendFile(`./artifacts/${req.params.filename}`); // Vulnerable!
});
```

**Do:**
```typescript
app.get('/artifacts/:filename', (req, res) => {
  const safePath = path.join(artifactsDir, path.basename(req.params.filename));
  if (!safePath.startsWith(artifactsDir)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  res.sendFile(safePath);
});
```

## General

### ❌ Adding TODOs in Finished Work

**Don't:** Leave `TODO`, `FIXME`, or placeholder comments in commits.

**Do:** Implement or remove before finishing. Create issues for future work.

### ❌ Using `any` Type

**Don't:**
```typescript
function process(data: any) { ... } // Loses type safety
```

**Do:**
```typescript
function process(data: PlanData) { ... } // Type-safe
```

### ❌ Ignoring Linter/TypeScript Errors

**Don't:** Add `eslint-disable` or `@ts-ignore` to bypass errors.

**Do:** Fix the underlying issue or add a justified comment with a ticket reference.
