# Troubleshooting Guide

Common issues and solutions for TikTok-AI-Agent.

## Setup Issues

### OPENAI_API_KEY not configured

**Symptom:** `[WARN] OPENAI_API_KEY not configured`

**Fix:**
1. Check `.env` file exists
2. Verify key format: `OPENAI_API_KEY=sk-proj-...`
3. Restart server

### FFmpeg not found

**Symptom:** `Error: ffmpeg: command not found`

**Fix:**
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt install ffmpeg

# Windows
choco install ffmpeg
```

### Port already in use

**Symptom:** `EADDRINUSE: port 3001`

**Fix:**
```bash
# Find process (macOS/Linux)
lsof -i :3001

# Find process (Windows)
netstat -ano | findstr :3001

# Change port
PORT=3002
```

## API Errors

### 400 Bad Request

**Cause:** Input validation failure

**Common Issues:**
- Empty required fields
- String exceeds max length (topic: 500 chars)
- Invalid enum value
- Number out of range

### OpenAI Rate Limit

**Symptom:** `Error: 429 rate limit exceeded`

**Fix:**
1. Wait 60 seconds
2. Retry run: `POST /api/run/{runId}/retry`
3. Upgrade OpenAI plan

### FFmpeg Timeout

**Symptom:** `FFmpeg timeout after 300000ms`

**Fix:**
1. Increase timeout in code (10 minutes)
2. Use faster preset (`-preset ultrafast`)
3. Upgrade server CPU

## Database Issues

### Database Locked (SQLite)

**Symptom:** `Error: database is locked`

**Fix:**
1. Restart server
2. Migrate to PostgreSQL for production

### Migration Failed

**Fix:**
```bash
# Development only
rm -rf apps/server/prisma/migrations
npm run db:migrate:dev
```

## Performance

### Slow API Responses

**Fix:**
1. Add database indexes
2. Reduce included relations
3. Use pagination

### High Memory Usage

**Fix:**
1. Increase memory limit (Docker/PM2)
2. Check for memory leaks
3. Close SSE connections properly

## Deployment

### Docker Build Fails

**Fix:**
```bash
docker-compose build --no-cache
```

### Railway Deployment Fails

**Fix:**
1. Check Railway logs
2. Verify environment variables
3. Test build locally: `npm run build`

### Nginx 502 Bad Gateway

**Fix:**
```bash
# Restart Node.js
pm2 restart tiktok-ai

# Reload Nginx
sudo nginx -s reload
```

---

**Related:** [operations-runbook.md](operations-runbook.md), [setup.md](setup.md)
