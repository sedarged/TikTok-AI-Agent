# API Reference

Complete REST API documentation for TikTok-AI-Agent.

## Table of Contents

- [Base URL](#base-url)
- [Authentication](#authentication)
- [Error Codes](#error-codes)
- [Health & Status](#health--status)
- [Projects](#projects)
- [Plans](#plans)
- [Scenes](#scenes)
- [Runs](#runs)
- [Niche Packs](#niche-packs)
- [SSE Streaming](#sse-streaming)

---

## Base URL

```
Development: http://localhost:3001/api
Production: https://yourdomain.com/api
```

## Authentication

**Status:** ✅ Implemented (as of 2026-02-04)

All state-changing API endpoints (POST, PUT, PATCH, DELETE) now require authentication when `API_KEY` is configured.

### Configuration

Set the `API_KEY` environment variable to enable authentication:

```bash
# Generate a secure random key
openssl rand -hex 32

# Set in .env file
API_KEY=your-secure-api-key-here
```

### Usage

Include the API key in the `Authorization` header for all state-changing requests:

```bash
# Using curl
curl -X POST http://localhost:3001/api/project \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"topic":"My topic","nichePackId":"facts"}'
```

```typescript
// Using fetch
const response = await fetch('http://localhost:3001/api/project', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ topic: 'My topic', nichePackId: 'facts' }),
});
```

### Behavior

- **When API_KEY is set:** Write operations (POST, PUT, PATCH, DELETE) require authentication
- **When API_KEY is not set:** All endpoints are accessible without authentication (development mode)
- **Read operations (GET):** Always accessible without authentication for backward compatibility

See [SECURITY.md](../SECURITY.md) for more details on authentication and security best practices.

## Error Codes

| Status | Meaning | Example |
|--------|---------|---------|
| 200 | Success | GET request successful |
| 201 | Created | POST created resource |
| 400 | Bad Request | Invalid input validation |
| 401 | Unauthorized | Missing or invalid API key |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Error | Server error |

**Error Response Format:**

```json
{
  "error": "Invalid project payload",
  "details": {
    "fieldErrors": {
      "topic": ["String must contain at least 1 character(s)"]
    }
  }
}
```

---

## Health & Status

### GET /api/health

Health check endpoint.

**Response 200:**

```json
{
  "status": "OK",
  "timestamp": "2026-01-29T12:00:00.000Z",
  "version": "1.0.0",
  "database": "connected",
  "artifactsDir": "/app/artifacts"
}
```

### GET /api/status

Provider status check.

**Response 200:**

```json
{
  "providers": {
    "openai": true,
    "elevenlabs": false,
    "ffmpeg": true
  },
  "ready": true,
  "testMode": false,
  "renderDryRun": false,
  "message": "All providers configured and ready."
}
```

---

## Projects

### GET /api/projects

List all projects.

**Response 200:**

```json
[
  {
    "id": "uuid",
    "title": "Horror Video 1",
    "topic": "5 haunted houses",
    "nichePackId": "horror",
    "status": "PLAN_READY",
    "targetLengthSec": 60,
    "createdAt": "2026-01-29T12:00:00.000Z"
  }
]
```

### POST /api/projects

Create new project.

**Request Body:**

```json
{
  "topic": "5 scariest haunted houses in America",
  "nichePackId": "horror",
  "targetLengthSec": 60,
  "tempo": "normal",
  "voicePreset": "alloy",
  "language": "en",
  "visualStylePreset": null,
  "seoKeywords": "haunted, scary, ghost"
}
```

**Validation (Zod):**

```typescript
const createProjectSchema = z.object({
  topic: z.string().min(1).max(500),           // Required
  nichePackId: z.string().min(1),              // Required
  targetLengthSec: z.number().int().positive().max(600).optional(),
  tempo: z.enum(['slow', 'normal', 'fast']).optional(),
  voicePreset: z.string().min(1).max(50).optional(),
  language: z.string().min(1).max(10).optional(),
  visualStylePreset: z.string().nullable().optional(),
  seoKeywords: z.string().max(500).optional(),
}).strict();
```

**Response 201:**

```json
{
  "id": "uuid",
  "topic": "5 scariest haunted houses in America",
  "nichePackId": "horror",
  "status": "DRAFT_PLAN",
  "createdAt": "2026-01-29T12:00:00.000Z"
}
```

### GET /api/projects/:id

Get project with relations.

**Response 200:**

```json
{
  "id": "uuid",
  "topic": "...",
  "planVersions": [
    {
      "id": "uuid",
      "hookSelected": "Did you know...",
      "outline": "...",
      "scriptFull": "...",
      "scenes": [ /* scene objects */ ]
    }
  ],
  "runs": [
    {
      "id": "uuid",
      "status": "done",
      "progress": 100
    }
  ]
}
```

### POST /api/projects/:id/plan

Generate AI plan for project.

**Request Body:**

```json
{
  "scriptTemplateId": "top5"  // Optional
}
```

**Response 200:**

```json
{
  "planVersionId": "uuid",
  "hookOptions": [
    "Hook option 1",
    "Hook option 2",
    "Hook option 3",
    "Hook option 4",
    "Hook option 5"
  ],
  "outline": "Detailed outline...",
  "scriptFull": "Full script...",
  "scenes": [ /* 6-8 scene objects */ ]
}
```

### DELETE /api/projects/:id

Delete project (cascades to plans, scenes, runs).

**Response 200:**

```json
{ "message": "Project deleted" }
```

---

## Plans

### PUT /api/plan/:planVersionId

Update plan (hook selection, outline, script).

**Request Body:**

```json
{
  "hookSelected": "Did you know these 5 haunted houses...",
  "outline": "Updated outline...",
  "scriptFull": "Updated script..."
}
```

**Response 200:**

```json
{
  "id": "uuid",
  "hookSelected": "...",
  "outline": "...",
  "scriptFull": "..."
}
```

### POST /api/plan/:planVersionId/approve

Approve plan and unlock rendering.

**Response 200:**

```json
{
  "project": {
    "id": "uuid",
    "status": "APPROVED"
  }
}
```

### POST /api/plan/:planVersionId/render

Start render pipeline.

**Response 200:**

```json
{
  "runId": "uuid",
  "status": "queued",
  "progress": 0
}
```

---

## Scenes

### GET /api/scene/:sceneId

Get single scene.

**Response 200:**

```json
{
  "id": "uuid",
  "idx": 0,
  "narrationText": "Welcome to the scariest haunted house...",
  "visualPrompt": "Dark, eerie mansion with fog...",
  "effectPreset": "slow_zoom_in",
  "durationTargetSec": 7.5,
  "startTimeSec": 0.0,
  "endTimeSec": 7.5
}
```

### PUT /api/scene/:sceneId

Update scene.

**Request Body:**

```json
{
  "narrationText": "Updated narration...",
  "visualPrompt": "Updated visual prompt...",
  "effectPreset": "slow_zoom_out",
  "durationTargetSec": 8.0
}
```

**Response 200:**

```json
{
  "id": "uuid",
  "narrationText": "Updated narration...",
  "updatedAt": "2026-01-29T12:05:00.000Z"
}
```

---

## Runs

### GET /api/run

List all runs (for analytics).

**Response 200:**

```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "status": "done",
    "progress": 100,
    "views": 12500,
    "likes": 450,
    "createdAt": "2026-01-29T12:00:00.000Z",
    "project": {
      "topic": "5 haunted houses",
      "nichePackId": "horror"
    }
  }
]
```

### GET /api/run/:runId

Get run details.

**Response 200:**

```json
{
  "id": "uuid",
  "status": "running",
  "progress": 45,
  "currentStep": "images_generate",
  "logsJson": "[{\"timestamp\":\"...\",\"level\":\"info\",\"message\":\"...\"}]",
  "artifactsJson": "{}",
  "createdAt": "2026-01-29T12:00:00.000Z"
}
```

### GET /api/run/:runId/stream

Server-Sent Events stream for real-time progress.

**Response (text/event-stream):**

```
data: {"type":"state","status":"running","progress":15,"currentStep":"tts_generate"}

data: {"type":"progress","step":"tts_generate","progress":20,"message":"Generating voice-over..."}

data: {"type":"progress","step":"images_generate","progress":50,"message":"Generating images (3/6)..."}

data: {"type":"complete","finalStatus":"done","progress":100,"artifacts":{"mp4Path":"..."}}
```

See [SSE Streaming](#sse-streaming) section.

### PATCH /api/run/:runId

Update run analytics.

**Request Body:**

```json
{
  "views": 15000,
  "likes": 500,
  "retention": 0.75,
  "postedAt": "2026-01-29T12:00:00.000Z"
}
```

**Response 200:**

```json
{
  "id": "uuid",
  "views": 15000,
  "likes": 500
}
```

### POST /api/run/:runId/retry

Retry failed run.

**Request Body:**

```json
{
  "fromStep": "ffmpeg_render"  // Optional: resume from specific step
}
```

**Response 200:**

```json
{
  "runId": "uuid",
  "status": "queued",
  "message": "Run retrying from step: ffmpeg_render"
}
```

### POST /api/run/:runId/cancel

Cancel running render.

**Response 200:**

```json
{
  "runId": "uuid",
  "status": "canceled"
}
```

---

## Niche Packs

### GET /api/niche-packs

List all available niche packs.

**Response 200:**

```json
[
  {
    "id": "horror",
    "name": "Horror & Mystery",
    "description": "Dark, suspenseful, and terrifying stories",
    "effectsProfile": {
      "allowedEffects": ["slow_zoom_in", "slow_zoom_out", "glitch"],
      "defaultEffect": "slow_zoom_in"
    }
  },
  {
    "id": "facts",
    "name": "Facts & Trivia",
    "description": "Interesting facts and trivia"
  }
]
```

### GET /api/niche-packs/:id

Get specific niche pack details.

**Response 200:**

```json
{
  "id": "horror",
  "name": "Horror & Mystery",
  "description": "Dark, suspenseful, and terrifying stories",
  "effectsProfile": { /* ... */ },
  "scenePacing": {
    "60": {
      "minScenes": 6,
      "maxScenes": 8,
      "minDurationSec": 5,
      "maxDurationSec": 12
    }
  },
  "styleBiblePrompt": "Dark, eerie, cinematic horror style...",
  "captionStyle": {
    "fontFamily": "Arial Black",
    "fontSize": 48,
    "primaryColor": "#FFFFFF",
    "highlightColor": "#FFD700"
  }
}
```

---

## SSE Streaming

### Overview

Server-Sent Events (SSE) provide real-time render progress updates.

**Endpoint:** `GET /api/run/:runId/stream`

**Connection:**

```typescript
// Frontend
const eventSource = new EventSource(`/api/run/${runId}/stream`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};

eventSource.onerror = () => {
  eventSource.close();
};

// Cleanup
return () => eventSource.close();
```

### Message Types

#### 1. Initial State

Sent immediately on connection.

```json
{
  "type": "state",
  "status": "running",
  "progress": 15,
  "currentStep": "tts_generate",
  "logs": [
    {
      "timestamp": "2026-01-29T12:00:00.000Z",
      "level": "info",
      "message": "Starting render pipeline..."
    }
  ]
}
```

#### 2. Progress Update

Sent after each pipeline step.

```json
{
  "type": "progress",
  "step": "images_generate",
  "progress": 50,
  "message": "Generating images (3/6)...",
  "timestamp": "2026-01-29T12:01:30.000Z"
}
```

#### 3. Completion

Sent when render finishes.

```json
{
  "type": "complete",
  "finalStatus": "done",
  "progress": 100,
  "artifacts": {
    "mp4Path": "/artifacts/abc123/final.mp4",
    "thumbPath": "/artifacts/abc123/thumb.jpg"
  }
}
```

#### 4. Error

Sent on render failure.

```json
{
  "type": "error",
  "message": "FFmpeg process timed out after 300000ms",
  "step": "ffmpeg_render",
  "timestamp": "2026-01-29T12:05:00.000Z"
}
```

#### 5. Heartbeat

Sent every 25 seconds to keep connection alive.

```
: heartbeat
```

### Connection Management

**Server Side (apps/server/src/routes/run.ts):**

```typescript
const sseConnections = new Map<string, Set<Response>>();

runRoutes.get('/:runId/stream', async (req, res) => {
  const runId = req.params.runId;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Track connection
  if (!sseConnections.has(runId)) {
    sseConnections.set(runId, new Set());
  }
  sseConnections.get(runId)!.add(res);

  // Send initial state
  res.write(`data: ${JSON.stringify({ type: 'state', /* ... */ })}\n\n`);

  // Cleanup on disconnect
  req.on('close', () => {
    sseConnections.get(runId)?.delete(res);
  });
});

// Broadcast to all connections
export function broadcastRunUpdate(runId: string, data: any) {
  const connections = sseConnections.get(runId);
  if (connections) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    for (const res of connections) {
      try {
        res.write(message);
      } catch {
        connections.delete(res);
      }
    }
  }
}
```

---

## CORS Configuration

**Development:** Allows all origins

**Production:** Set `ALLOWED_ORIGINS` environment variable

```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**Code (apps/server/src/index.ts):**

```typescript
import cors from 'cors';

const allowedOrigins = env.ALLOWED_ORIGINS;
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  credentials: true,
}));
```

---

## Rate Limiting

**Currently:** Not implemented

**Recommended (Production):**

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
});

app.use('/api/', limiter);
```

---

## Related Documentation

- [data-model.md](data-model.md) - Database schemas
- [security.md](security.md) - Authentication & authorization
- [development.md](development.md) - Adding new endpoints

---

**Last Updated:** 2026-01-29  
**API Version:** 1.0.0
