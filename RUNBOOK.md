# Operations Runbook

Quick reference for running, debugging, and troubleshooting TikTok-AI-Agent in production.

**📖 For comprehensive operations guide, see [docs/operations-runbook.md](docs/operations-runbook.md)**

---

## Quick Start

### Development
```bash
npm install           # Install dependencies
npm run db:migrate    # Run database migrations
npm run dev           # Start dev servers (backend:3001 + frontend:5173)
```
**Evidence:** Root `package.json` lines 12-13, 33

### Production
```bash
npm run build         # Build both apps
npm start             # Run production server (includes db:migrate)
```
**Evidence:** Root `package.json` lines 15-17

---

## Health Checks

### Server Health
```bash
curl http://localhost:3001/api/health
```
**Expected Response (200 OK):**
```json
{
  "status": "healthy",
  "version": "1.1.1",
  "database": "connected",
  "providers": {
    "openai": true,
    "ffmpeg": true,
    "testMode": false,
    "renderDryRun": false
  }
}
```
**Evidence:** `apps/server/src/routes/status.ts` lines 13-31

### Database Check
```bash
cd apps/server
npx prisma db push --dry-run  # Check schema sync
npx prisma studio             # Open GUI browser
```
**Evidence:** `apps/server/package.json` lines 16-17

### FFmpeg Check
```bash
ffmpeg -version                # System FFmpeg
node -e "console.log(require('ffmpeg-static'))"  # Bundled FFmpeg
```
**Evidence:** `apps/server/src/services/ffmpeg/ffmpegUtils.ts` lines 15-35

---

## Viewing Logs

### Development
- Server logs print to console via Winston (`apps/server/src/utils/logger.ts`)
- Log level controlled by `LOG_LEVEL` env var (default: `info`)
- Test mode: Silent except errors (`apps/server/tests/setup.ts` line 9)

### Production (Docker)
```bash
docker logs -f tiktok-ai-agent                # Follow logs
docker logs --tail 100 tiktok-ai-agent        # Last 100 lines
```

### Production (PM2)
```bash
pm2 logs tiktok-ai                            # Follow logs
pm2 logs tiktok-ai --lines 100                # Last 100 lines
```

### Log Levels
- `error` - Only errors (recommended for production)
- `warn` - Errors + warnings
- `info` - Normal operations (default)
- `debug` - Verbose debugging

**Evidence:** `apps/server/src/env.ts` line 97, `apps/server/src/utils/logger.ts`

---

## Common Failures & Recovery

### 1. Database Connection Failed

**Symptom:** Server crashes on startup with "Database connection failed"

**Cause:** Invalid `DATABASE_URL` or database not accessible

**Fix:**
```bash
# Check DATABASE_URL
echo $DATABASE_URL

# For SQLite: Ensure file path is writable
mkdir -p apps/server
touch apps/server/dev.db

# Run migrations
npm run db:migrate
```
**Evidence:** `apps/server/src/env.ts` lines 38-41, `apps/server/src/db/client.ts`

### 2. OpenAI API Errors

**Symptom:** Plan generation or render fails with "OpenAI API error"

**Causes & Fixes:**
- **Missing API key:** Set `OPENAI_API_KEY` in `.env`
- **Invalid key:** Verify key at platform.openai.com
- **Rate limit:** Wait or reduce `MAX_CONCURRENT_IMAGE_GENERATION` (default: 3)
- **Insufficient credits:** Add credits to OpenAI account

**Dry-run mode (no API calls):**
```bash
export APP_RENDER_DRY_RUN=1
npm run dev
```
**Evidence:** `apps/server/src/env.ts` lines 44-46, `apps/server/src/services/providers/openai.ts`

### 3. FFmpeg Not Found

**Symptom:** Render fails with "FFmpeg not found"

**Fix:**
```bash
# Install system FFmpeg
brew install ffmpeg              # macOS
sudo apt install ffmpeg          # Ubuntu
# Or Windows: Download from ffmpeg.org

# Verify
ffmpeg -version

# Restart server (ffmpeg-static fallback loads automatically)
```
**Evidence:** `apps/server/package.json` (ffmpeg-static dep), `apps/server/src/services/ffmpeg/ffmpegUtils.ts`

### 4. Render Pipeline Stuck

**Symptom:** Run status shows "running" but progress stopped

**Check Active Runs:**
```bash
# Server endpoint
curl http://localhost:3001/api/run/<runId>
```

**Cancel Run:**
```bash
curl -X POST http://localhost:3001/api/run/<runId>/cancel \
  -H "Authorization: Bearer $API_KEY"
```

**Retry from Last Step:**
```bash
curl -X POST http://localhost:3001/api/run/<runId>/retry \
  -H "Authorization: Bearer $API_KEY"
```
**Evidence:** `apps/server/src/routes/run.ts` lines 80-130, 145-180

### 5. Disk Space Full

**Symptom:** Render fails with "ENOSPC: no space left on device"

**Check Disk Usage:**
```bash
du -sh ./artifacts                # Check artifacts size
df -h .                           # Check disk space
```

**Cleanup:**
```bash
# Remove old artifacts (manual)
rm -rf artifacts/project-*

# Or via API (delete project)
curl -X DELETE http://localhost:3001/api/project/<projectId> \
  -H "Authorization: Bearer $API_KEY"
```
**Evidence:** `apps/server/src/env.ts` line 91, `apps/server/src/routes/run.ts`

### 6. API Authentication Failed (401)

**Symptom:** POST/PUT/DELETE requests return "401 Unauthorized"

**Cause:** Missing or invalid `Authorization: Bearer <API_KEY>` header in production

**Fix:**
```bash
# Set API_KEY in production
export API_KEY=$(openssl rand -hex 32)

# Include in requests
curl -X POST http://localhost:3001/api/project \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"topic":"Test","nichePackId":"facts"}'
```
**Evidence:** `apps/server/src/env.ts` lines 49-51, `apps/server/src/middleware/auth.ts`

---

## Monitoring

### Key Metrics to Watch

1. **Health Endpoint:** `GET /api/health`
   - Returns 200 if healthy, includes provider status
   - **Evidence:** `apps/server/src/routes/status.ts`

2. **Database Size:**
   ```bash
   ls -lh apps/server/dev.db  # SQLite file size
   ```

3. **Artifacts Disk Usage:**
   ```bash
   du -sh artifacts/
   ```

4. **Active Render Runs:**
   - Query database: `SELECT COUNT(*) FROM Run WHERE status='running'`
   - **Evidence:** `apps/server/prisma/schema.prisma` lines 65-87

5. **Memory Usage:**
   ```bash
   ps aux | grep node    # Process memory
   ```

6. **OpenAI API Costs:**
   - Monitor usage at platform.openai.com/usage
   - See `docs/cost/` for cost analysis
   - **Evidence:** `docs/cost/COST_ANALYSIS_60SEC_VIDEO.md`

---

## Environment-Specific Commands

### Docker
```bash
# Start
docker-compose up -d

# Logs
docker-compose logs -f

# Restart
docker-compose restart

# Stop
docker-compose down

# Rebuild
docker-compose up -d --build
```
**Evidence:** `docker-compose.yml`, `Dockerfile`

### Railway
```bash
# Deploy
railway up

# Logs
railway logs

# Environment variables
railway variables
```
**Evidence:** `railway.toml`, `Procfile`

### PM2
```bash
# Start
pm2 start ecosystem.config.cjs

# Restart
pm2 restart tiktok-ai

# Stop
pm2 stop tiktok-ai

# Logs
pm2 logs tiktok-ai
```
**Evidence:** Common PM2 usage pattern (no ecosystem file in repo - users create)

---

## Backup & Restore

### SQLite (Development/Small Deployments)
```bash
# Backup
cp apps/server/dev.db backup_$(date +%Y%m%d_%H%M%S).db

# Restore
cp backup_20260206_120000.db apps/server/dev.db
npm run db:migrate  # Ensure schema is up-to-date
```

### PostgreSQL (Production)
```bash
# Backup
pg_dump -h localhost -U user tiktok_ai > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U user tiktok_ai < backup_20260206.sql
```
**Evidence:** `apps/server/prisma/schema.prisma` (supports both SQLite and PostgreSQL)

### Artifacts
```bash
# Backup artifacts directory
tar -czf artifacts_backup_$(date +%Y%m%d).tar.gz artifacts/

# Restore
tar -xzf artifacts_backup_20260206.tar.gz
```
**Evidence:** `apps/server/src/env.ts` line 91

---

## Test Modes

### APP_TEST_MODE (No Rendering)
```bash
export APP_TEST_MODE=1
npm run dev
```
- ✅ Plan generation uses deterministic templates (no OpenAI API calls)
- ✅ Render endpoints return 403 forbidden
- ✅ Health endpoint skips FFmpeg/OpenAI checks
- **Use for:** Unit/integration tests, CI/CD
- **Evidence:** `apps/server/src/env.ts` line 92, `apps/server/tests/setup.ts`

### APP_RENDER_DRY_RUN (No API Calls, No MP4)
```bash
export APP_RENDER_DRY_RUN=1
npm run dev
```
- ✅ Render pipeline runs all 7 steps
- ✅ No OpenAI API calls (simulated)
- ✅ No FFmpeg execution (simulated)
- ❌ No MP4 output (download returns 409)
- **Use for:** Testing render logic without costs
- **Evidence:** `apps/server/src/env.ts` line 93, `apps/server/tests/renderDryRun.integration.test.ts`

---

## Production Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Set `API_KEY` (required - server fails without it)
- [ ] Set `ALLOWED_ORIGINS` (CORS whitelist)
- [ ] Set `DATABASE_URL` (PostgreSQL recommended)
- [ ] Set `OPENAI_API_KEY` (required for AI features)
- [ ] Use HTTPS (configure reverse proxy or platform)
- [ ] Run `npm run build` before `npm start`
- [ ] Run database migrations: `npm run db:migrate`
- [ ] Configure log retention (Winston file transport or external service)
- [ ] Set up monitoring (health checks, disk space, API costs)
- [ ] Configure backups (database + artifacts directory)
- [ ] Review `SECURITY.md` for hardening steps

**Evidence:** `apps/server/src/env.ts` lines 34-78, `SECURITY.md`

---

## Additional Resources

- **Comprehensive Operations Guide:** [docs/operations-runbook.md](docs/operations-runbook.md)
- **Deployment Guides:** [docs/deployment.md](docs/deployment.md)
- **Troubleshooting:** [docs/troubleshooting.md](docs/troubleshooting.md)
- **Security Best Practices:** [SECURITY.md](SECURITY.md)
- **API Reference:** [docs/api.md](docs/api.md)
- **Repository Reality Check:** [docs/REPO_REALITY.md](docs/REPO_REALITY.md)

---

**Last Updated:** 2026-02-06  
**Evidence-Based:** All commands and file paths verified in codebase
