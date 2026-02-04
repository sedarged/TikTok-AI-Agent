# API Authentication

This document describes the authentication system added to protect API endpoints from unauthorized access.

## Overview

As of 2026-02-04, all state-changing API endpoints (POST, PUT, PATCH, DELETE) require authentication when the `API_KEY` environment variable is configured. Read-only endpoints (GET) remain accessible without authentication for backward compatibility.

## Quick Start

### 1. Generate an API Key

Generate a secure random key:

```bash
openssl rand -hex 32
```

### 2. Configure the API Key

Add the key to your `.env` file:

```bash
API_KEY=your-secure-api-key-here
```

### 3. Use the API Key

Include the API key in the `Authorization` header with the `Bearer` scheme:

```bash
curl -X POST http://localhost:3001/api/project \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"topic":"My video topic","nichePackId":"facts"}'
```

## Client Examples

### JavaScript/TypeScript

```typescript
const apiKey = process.env.API_KEY;

const response = await fetch('http://localhost:3001/api/project', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    topic: 'My video topic',
    nichePackId: 'facts',
  }),
});

if (!response.ok) {
  if (response.status === 401) {
    console.error('Authentication failed - check your API key');
  }
  throw new Error(`HTTP ${response.status}`);
}

const project = await response.json();
console.log('Created project:', project.id);
```

### Python

```python
import os
import requests

api_key = os.environ['API_KEY']

response = requests.post(
    'http://localhost:3001/api/project',
    headers={
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    },
    json={
        'topic': 'My video topic',
        'nichePackId': 'facts',
    },
)

if response.status_code == 401:
    print('Authentication failed - check your API key')
    exit(1)

response.raise_for_status()
project = response.json()
print(f"Created project: {project['id']}")
```

### curl

```bash
# Set your API key
export API_KEY="your-api-key-here"

# Create a project
curl -X POST http://localhost:3001/api/project \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "My video topic",
    "nichePackId": "facts",
    "language": "en",
    "targetLengthSec": 60
  }'

# List projects (no auth required for GET)
curl http://localhost:3001/api/project

# Generate plan
curl -X POST "http://localhost:3001/api/project/{PROJECT_ID}/plan" \
  -H "Authorization: Bearer $API_KEY"
```

## Protected Endpoints

### Endpoints Requiring Authentication (when API_KEY configured)

All POST, PUT, PATCH, and DELETE operations require authentication:

- `POST /api/project` - Create project
- `POST /api/project/:id/plan` - Generate plan
- `POST /api/project/:id/duplicate` - Duplicate project
- `DELETE /api/project/:id` - Delete project
- `PUT /api/plan/:planVersionId` - Update plan
- `POST /api/plan/:planVersionId/validate` - Validate plan
- `POST /api/plan/:planVersionId/autofit` - Auto-fit plan timing
- `POST /api/plan/:planVersionId/regenerate-hooks` - Regenerate hooks
- `PUT /api/scene/:sceneId` - Update scene
- `POST /api/scene/:sceneId/lock` - Lock scene
- `POST /api/scene/:sceneId/regenerate` - Regenerate scene
- `POST /api/automate` - Start automation
- `POST /api/batch` - Batch operations
- `POST /api/run/:runId/retry` - Retry render
- `POST /api/run/:runId/cancel` - Cancel render
- `PATCH /api/run/:runId` - Update run metadata

### Endpoints NOT Requiring Authentication

All GET operations and read-only endpoints work without authentication:

- `GET /api/project` - List projects
- `GET /api/project/:id` - Get project
- `GET /api/project/:id/runs` - List runs for project
- `GET /api/plan/:planVersionId` - Get plan
- `GET /api/scene/:sceneId` - Get scene
- `GET /api/run` - List runs
- `GET /api/run/upcoming` - List upcoming runs
- `GET /api/run/:runId` - Get run
- `GET /api/run/:runId/stream` - SSE stream for run progress
- `GET /api/status` - System status
- `GET /api/niche-packs` - List niche packs
- `GET /api/niche-packs/:id` - Get niche pack
- `GET /api/topic-suggestions` - Get topic suggestions
- `GET /api/script-templates` - List script templates
- `GET /api/health` - Health check

## Error Responses

### 401 Unauthorized - Missing Authorization Header

```json
{
  "error": "Unauthorized",
  "message": "Missing Authorization header. Expected: Authorization: Bearer <API_KEY>"
}
```

### 401 Unauthorized - Invalid Header Format

```json
{
  "error": "Unauthorized",
  "message": "Invalid Authorization header format. Expected: Authorization: Bearer <API_KEY>"
}
```

### 401 Unauthorized - Invalid API Key

```json
{
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

## Development Mode

When `API_KEY` is **not** set in the environment, authentication is disabled and all endpoints work without authentication. This is useful for:

- Local development
- Testing
- CI/CD pipelines
- Development environments

**⚠️ WARNING:** Never deploy to production without setting `API_KEY`.

## Production Deployment

### Security Checklist

- [x] Generate a strong API key: `openssl rand -hex 32`
- [x] Set `API_KEY` in production environment
- [x] Use HTTPS (TLS/SSL) to encrypt traffic
- [x] Set `NODE_ENV=production`
- [x] Configure `ALLOWED_ORIGINS` for CORS
- [x] Monitor logs for authentication failures
- [x] Rotate API keys regularly
- [x] Store API keys securely (e.g., AWS Secrets Manager, HashiCorp Vault)

### Key Rotation

To rotate the API key:

1. Generate a new key: `openssl rand -hex 32`
2. Update the `API_KEY` environment variable
3. Restart the server
4. Update clients with the new key
5. Monitor logs to ensure all clients updated successfully

### Multiple API Keys (Future Enhancement)

The current implementation supports a single API key. For multiple users or services, consider:

- Upgrading to JWT authentication with user accounts
- Using an API gateway (e.g., Kong, AWS API Gateway)
- Implementing database-backed API keys with per-key permissions

See [docs/roadmap.md](roadmap.md) for JWT implementation plans.

## Testing

Run the authentication tests:

```bash
npm run test -- apps/server/tests/auth.integration.test.ts
```

The test suite includes:

- Authentication with and without API_KEY configured
- All HTTP methods (GET, POST, DELETE)
- Invalid/missing Authorization headers
- Security properties (timing-safe comparison)

## Troubleshooting

### "Unauthorized" Error

**Problem:** Getting 401 errors when making requests

**Solutions:**
1. Check that `API_KEY` is set correctly in `.env`
2. Verify the Authorization header format: `Authorization: Bearer <API_KEY>`
3. Ensure no extra spaces or quotes around the API key
4. Check server logs for authentication failure details

### GET Requests Requiring Authentication

**Problem:** GET requests failing with 401

**Solution:** GET requests should NOT require authentication. If they do, there may be an issue with the middleware configuration. Check that `requireAuthForWrites` is used, not `requireAuth`.

### Development Mode Not Working

**Problem:** Authentication required even without API_KEY set

**Solution:** 
1. Verify `API_KEY` is not set: `echo $API_KEY` (should be empty)
2. Check `.env` file doesn't have `API_KEY` defined
3. Restart the server after removing `API_KEY`

## References

- [SECURITY.md](../SECURITY.md) - Security best practices
- [docs/api.md](api.md) - Complete API documentation
- [docs/roadmap.md](roadmap.md) - Future authentication enhancements
