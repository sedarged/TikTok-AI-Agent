# Roadmap

Technical debt, future enhancements, and implementation priorities for TikTok-AI-Agent.

## Table of Contents

- [Critical Priority (S)](#critical-priority-s)
- [High Priority (M)](#high-priority-m)
- [Low Priority (L)](#low-priority-l)
- [Infrastructure](#infrastructure)
- [Features](#features)
- [Cost Optimization](#cost-optimization)

---

## Critical Priority (S)

### 1. Authentication & Authorization

**Current:** Open API (no authentication)  
**Risk:** High - anyone can create projects and render videos

**Implementation:**

```typescript
// JWT-based authentication
import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.use('/api', authMiddleware);
```

**Effort:** 1-2 weeks  
**Dependencies:** User model, registration flow, session management

### 2. Rate Limiting

**Current:** No rate limiting  
**Risk:** Medium - abuse potential, cost explosion

**Implementation:**

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const renderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,  // 10 renders per hour per IP
});

app.use('/api/plan/:planVersionId/render', renderLimiter);
```

**Effort:** 1 day  
**Dependencies:** None

### 3. Artifact Access Control

**Current:** Static file serving (no authentication)  
**Risk:** Medium - unauthorized access to generated videos

**Options:**

**A. Authentication Middleware:**

```typescript
app.use('/artifacts', authMiddleware, express.static(env.ARTIFACTS_DIR));
```

**B. Move to Cloud Storage (S3/GCS):**

```typescript
// Upload to S3
await s3.putObject({
  Bucket: 'tiktok-ai-artifacts',
  Key: `${runId}/final.mp4`,
  Body: fs.createReadStream(videoPath),
});

// Generate signed URL (expires in 1 hour)
const signedUrl = await s3.getSignedUrlPromise('getObject', {
  Bucket: 'tiktok-ai-artifacts',
  Key: `${runId}/final.mp4`,
  Expires: 3600,
});
```

**Effort:** 3-5 days  
**Dependencies:** AWS S3 or GCS setup

---

## High Priority (M)

### 4. PostgreSQL Migration

**Current:** SQLite (development only)  
**Risk:** Medium - database locks in production

**Implementation:**

```prisma
// apps/server/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/tiktok_ai
npm run db:migrate:dev
```

**Effort:** 1-2 days  
**Dependencies:** PostgreSQL server setup

See [deployment.md#database-migration](deployment.md#database-migration)

### 5. Queue System (Redis/BullMQ)

**Current:** In-memory queue (Map) - not shared across instances  
**Risk:** Medium - can't scale horizontally

**Implementation:**

```bash
npm install bull
```

```typescript
// apps/server/src/services/render/renderQueue.ts
import Queue from 'bull';

const renderQueue = new Queue('render', {
  redis: {
    host: 'localhost',
    port: 6379,
  },
});

renderQueue.process(async (job) => {
  const { runId } = job.data;
  await executePipeline(runId);
});

export async function enqueueRender(runId: string) {
  await renderQueue.add({ runId });
}
```

**Effort:** 3-5 days  
**Dependencies:** Redis server

### 6. CDN for Artifacts

**Current:** Static file serving from app server  
**Risk:** Low - bandwidth costs, slow downloads

**Implementation:**

```typescript
// Upload to S3 with CloudFront
const cdnUrl = `https://d123456.cloudfront.net/${runId}/final.mp4`;
```

**Effort:** 2-3 days  
**Dependencies:** AWS CloudFront or Cloudflare setup

### 7. Redis for SSE Pub/Sub

**Current:** In-memory SSE connections - doesn't work across instances  
**Risk:** Medium - can't scale horizontally

**Implementation:**

```typescript
import Redis from 'ioredis';

const redis = new Redis();
const pub = new Redis();

// Publish update
export function broadcastRunUpdate(runId: string, data: any) {
  pub.publish(`run:${runId}`, JSON.stringify(data));
}

// Subscribe on all instances
redis.subscribe(`run:${runId}`);
redis.on('message', (channel, message) => {
  const data = JSON.parse(message);
  // Broadcast to connected SSE clients
});
```

**Effort:** 2-3 days  
**Dependencies:** Redis server

---

## Low Priority (L)

### 8. Kubernetes Deployment

**Current:** Docker Compose (single server)  
**Goal:** Multi-server orchestration

**Implementation:**

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiktok-ai
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        image: tiktok-ai:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: url
```

**Effort:** 1-2 weeks  
**Dependencies:** Kubernetes cluster, Helm charts

### 9. Local AI Providers

**Current:** OpenAI only (paid, rate-limited)  
**Goal:** Support Ollama, LocalAI, LM Studio

**Implementation:**

```typescript
// apps/server/src/services/providers/local.ts
export async function generateTextLocal(prompt: string): Promise<string> {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      model: 'llama2',
      prompt,
    }),
  });
  return response.json();
}
```

**Effort:** 2-3 weeks  
**Dependencies:** Ollama/LocalAI setup, model selection

See [LOCAL_PROVIDERS_AND_COST_REDUCTION.md](../LOCAL_PROVIDERS_AND_COST_REDUCTION.md)

### 10. Webhook Notifications

**Current:** Client must poll or use SSE  
**Goal:** Push notifications to external systems

**Implementation:**

```typescript
// apps/server/src/services/webhooks.ts
export async function notifyRenderComplete(runId: string, webhookUrl: string) {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'render.complete',
      runId,
      status: 'done',
      artifacts: { mp4Path: '...' },
    }),
  });
}
```

**Effort:** 1 week  
**Dependencies:** Webhook configuration in UI

---

## Infrastructure

### 11. Monitoring & Alerting

**Current:** Basic logs  
**Goal:** Prometheus + Grafana + Alertmanager

**Implementation:**

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
  
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
```

**Metrics to track:**
- API response times
- Render success/failure rate
- OpenAI API costs
- Database query performance
- Memory/CPU usage

**Effort:** 1-2 weeks

### 12. Logging Aggregation

**Current:** File-based Winston logs  
**Goal:** Centralized logging (ELK/Loki)

**Implementation:**

```yaml
# docker-compose.logging.yml
services:
  loki:
    image: grafana/loki
  
  promtail:
    image: grafana/promtail
    volumes:
      - /var/log:/var/log
```

**Effort:** 1 week

---

## Features

### 13. Multi-Language Support

**Current:** English only  
**Goal:** Spanish, French, German, Portuguese

**Implementation:**

```typescript
// Add language parameter to all AI prompts
const prompt = `Generate a horror video script in ${language}...`;
```

**Effort:** 2-3 weeks  
**Dependencies:** Translation of niche pack templates

### 14. Video Templates

**Current:** AI-generated from scratch  
**Goal:** Pre-built templates for common formats

**Examples:**
- Top 5 listicles
- Before/After comparisons
- Myth vs Fact
- Q&A format

**Effort:** 2-3 weeks

### 15. Scheduled Publishing

**Current:** Manual publish  
**Goal:** Schedule future publish times

**Implementation:**

```typescript
// Add cron job
import cron from 'node-cron';

cron.schedule('*/5 * * * *', async () => {
  const dueRuns = await prisma.run.findMany({
    where: {
      scheduledPublishAt: { lte: new Date() },
      publishedAt: null,
    },
  });
  
  for (const run of dueRuns) {
    await publishToTikTok(run);
  }
});
```

**Effort:** 1 week

---

## Cost Optimization

### 16. Response Caching

**Current:** Cache table exists but not fully utilized  
**Goal:** Cache all OpenAI responses

**Implementation:**

```typescript
// Check cache before API call
const cacheKey = hash(prompt);
const cached = await prisma.cache.findUnique({ where: { hashKey: cacheKey } });
if (cached) {
  return JSON.parse(cached.resultJson);
}

// Make API call and cache
const response = await openai.chat.completions.create({ /* ... */ });
await prisma.cache.create({
  data: {
    kind: 'llm',
    hashKey: cacheKey,
    resultJson: JSON.stringify(response),
  },
});
```

**Savings:** ~30% reduction in OpenAI costs

**Effort:** 1 week

### 17. Image Compression

**Current:** DALL-E images used as-is (1024x1024 PNG)  
**Goal:** Optimize for TikTok format (1080x1920 JPEG)

**Implementation:**

```typescript
import sharp from 'sharp';

await sharp(imagePath)
  .resize(1080, 1920, { fit: 'cover' })
  .jpeg({ quality: 85 })
  .toFile(optimizedPath);
```

**Savings:** ~50% reduction in storage costs

**Effort:** 2 days

### 18. Batch Rendering

**Current:** Serial queue (1 at a time)  
**Goal:** Batch similar operations

**Implementation:**

```typescript
// Batch DALL-E requests
const imagePrompts = scenes.map(s => s.visualPrompt);
const images = await generateImagesBatch(imagePrompts);
```

**Savings:** ~20% reduction in API latency

**Effort:** 1 week

---

## Summary

| Priority | Task | Effort | Risk Mitigation | Cost Impact |
|----------|------|--------|-----------------|-------------|
| **S** | Authentication | 1-2 weeks | Eliminates abuse | Prevents cost overruns |
| **S** | Rate Limiting | 1 day | Prevents abuse | Caps API costs |
| **S** | Artifact Access | 3-5 days | Data security | None |
| **M** | PostgreSQL | 1-2 days | Production stability | None |
| **M** | Redis Queue | 3-5 days | Enables scaling | Minimal |
| **M** | CDN | 2-3 days | Faster downloads | Reduces bandwidth |
| **L** | Kubernetes | 1-2 weeks | Enterprise scale | Higher infrastructure |
| **L** | Local AI | 2-3 weeks | Cost reduction | -80% API costs |
| **L** | Webhooks | 1 week | Integration | None |

**Total Effort (Critical):** 2-3 weeks  
**Total Effort (All):** 3-4 months

---

## Related Documentation

- [DEVELOPMENT_MASTER_PLAN.md](../DEVELOPMENT_MASTER_PLAN.md) - Original master plan
- [LOCAL_PROVIDERS_AND_COST_REDUCTION.md](../LOCAL_PROVIDERS_AND_COST_REDUCTION.md) - Cost optimization
- [COST_ANALYSIS_60SEC_VIDEO.md](../COST_ANALYSIS_60SEC_VIDEO.md) - Current costs

---

**Last Updated:** 2026-01-29  
**Next Review:** 2026-02-29
