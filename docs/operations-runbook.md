# Operations Runbook

Day-to-day operations guide for TikTok-AI-Agent: starting/stopping services, health checks, monitoring, incident response, backup/restore, and scaling.

## Table of Contents

- [Quick Reference](#quick-reference)
- [Starting Services](#starting-services)
- [Stopping Services](#stopping-services)
- [Health Checks](#health-checks)
- [Viewing Logs](#viewing-logs)
- [Monitoring](#monitoring)
- [Common Incidents](#common-incidents)
- [Backup & Restore](#backup--restore)
- [Scaling Considerations](#scaling-considerations)
- [Maintenance](#maintenance)

---

## Quick Reference

```bash
# Health Check
curl http://localhost:3001/api/health

# View Logs (Docker)
docker logs -f tiktok-ai-agent

# View Logs (PM2)
pm2 logs tiktok-ai

# Restart Service (Docker)
docker-compose restart app

# Restart Service (PM2)
pm2 restart tiktok-ai

# Database Backup
pg_dump tiktok_ai > backup_$(date +%Y%m%d).sql

# Check Disk Space
df -h /app/artifacts
```

---

## Starting Services

### Docker Compose

```bash
# Start all services
cd /path/to/TikTok-AI-Agent
docker-compose up -d

# Check status
docker-compose ps

# View startup logs
docker-compose logs -f app

# Expected output:
# app_1  | Server listening on http://localhost:3001
# app_1  | Database connected: postgresql://...
# app_1  | FFmpeg detected: v6.0
```

### PM2

```bash
# Start application
pm2 start ecosystem.config.cjs

# Or start npm script
pm2 start npm --name tiktok-ai -- start

# Check status
pm2 status

# Expected output:
# ┌─────┬──────────────┬─────────┬──────┬───────┐
# │ id  │ name         │ status  │ cpu  │ mem   │
# ├─────┼──────────────┼─────────┼──────┼───────┤
# │ 0   │ tiktok-ai    │ online  │ 5%   │ 250MB │
# └─────┴──────────────┴─────────┴──────┴───────┘
```

### systemd

```bash
# Start service
sudo systemctl start tiktok-ai

# Check status
sudo systemctl status tiktok-ai

# Expected output:
# ● tiktok-ai.service - TikTok AI Agent
#    Loaded: loaded (/etc/systemd/system/tiktok-ai.service; enabled)
#    Active: active (running) since Wed 2026-01-29 12:00:00 UTC
```

### Development

```bash
# Start both server and web
npm run dev

# Or individually
npm run dev:server  # Backend (port 3001)
npm run dev:web     # Frontend (port 5173)
```

---

## Stopping Services

### Docker Compose

```bash
# Stop services (containers still exist)
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop, remove containers, and volumes
docker-compose down -v
```

### PM2

```bash
# Stop specific app
pm2 stop tiktok-ai

# Stop all apps
pm2 stop all

# Delete app from PM2 list
pm2 delete tiktok-ai
```

### systemd

```bash
# Stop service
sudo systemctl stop tiktok-ai

# Disable auto-start on boot
sudo systemctl disable tiktok-ai
```

---

## Health Checks

### API Health Endpoint

```bash
curl http://localhost:3001/api/health
```

**Response:**

```json
{
  "status": "OK",
  "timestamp": "2026-01-29T12:00:00.000Z",
  "version": "1.0.0",
  "database": "connected",
  "artifactsDir": "/app/artifacts"
}
```

**Error Response (500):**

```json
{
  "status": "ERROR",
  "error": "Database connection failed"
}
```

### Provider Status

```bash
curl http://localhost:3001/api/status
```

**Response:**

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

**Troubleshooting:**

| Field | `false` Cause | Fix |
|-------|---------------|-----|
| `openai: false` | Missing `OPENAI_API_KEY` | Set env var and restart |
| `ffmpeg: false` | FFmpeg not installed | Install FFmpeg |
| `ready: false` | One or more providers down | Check individual providers |

### Database Connection

```bash
# Direct database check (PostgreSQL)
psql -h localhost -U tiktok_user -d tiktok_ai -c "SELECT COUNT(*) FROM \"Project\";"

# SQLite
sqlite3 /app/data/prod.db "SELECT COUNT(*) FROM Project;"
```

### Docker Health Check

```bash
# Check container health
docker ps --filter name=tiktok-ai-agent

# Expected output:
# CONTAINER ID   STATUS                    PORTS
# abc123         Up 5 minutes (healthy)    0.0.0.0:3001->3001/tcp
```

**Health check script (defined in Dockerfile):**

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1
```

---

## Viewing Logs

### Docker Logs

```bash
# View logs (last 100 lines)
docker logs tiktok-ai-agent --tail 100

# Follow logs (real-time)
docker logs -f tiktok-ai-agent

# View logs with timestamps
docker logs -t tiktok-ai-agent

# View logs from specific time
docker logs --since 2026-01-29T12:00:00 tiktok-ai-agent
```

### PM2 Logs

```bash
# View all logs
pm2 logs tiktok-ai

# View only error logs
pm2 logs tiktok-ai --err

# View only output logs
pm2 logs tiktok-ai --out

# View logs from specific time
pm2 logs tiktok-ai --lines 100

# Save logs to file
pm2 logs tiktok-ai > logs.txt
```

### systemd Logs

```bash
# View logs (last 100 lines)
sudo journalctl -u tiktok-ai -n 100

# Follow logs (real-time)
sudo journalctl -u tiktok-ai -f

# View logs from last hour
sudo journalctl -u tiktok-ai --since "1 hour ago"

# View logs with priority (errors only)
sudo journalctl -u tiktok-ai -p err
```

### Winston Logs (File-based)

Application logs are written by Winston logger:

```bash
# View application logs
tail -f /app/logs/app.log

# View error logs only
tail -f /app/logs/error.log

# Search for specific errors
grep "OpenAI rate limit" /app/logs/app.log

# View logs with context
grep -C 5 "FFmpeg timeout" /app/logs/app.log
```

**Log levels (from apps/server/src/utils/logger.ts):**

- `error` - Critical errors requiring immediate attention
- `warn` - Warnings that don't stop execution
- `info` - General information (default)
- `debug` - Detailed debugging information

**Configure log level:**

```bash
# Set in environment
LOG_LEVEL=debug

# Or in .env
LOG_LEVEL=info
```

---

## Monitoring

### Metrics to Track

| Metric | Target | Alert Threshold | How to Check |
|--------|--------|-----------------|--------------|
| API Response Time | <500ms | >2000ms | Load balancer logs |
| CPU Usage | <60% | >80% | `docker stats`, `pm2 monit` |
| Memory Usage | <1GB | >1.5GB | `docker stats`, `pm2 monit` |
| Disk Space (artifacts) | <80% | >90% | `df -h /app/artifacts` |
| Database Size | <10GB | >15GB | `SELECT pg_database_size('tiktok_ai');` |
| Render Queue Length | <5 | >10 | `GET /api/run` (count queued/running) |
| Failed Runs | <5% | >10% | Database query on Run.status |
| OpenAI API Errors | <1% | >5% | Log analysis |

### Real-time Monitoring

**Docker Stats:**

```bash
docker stats tiktok-ai-agent

# Output:
# CONTAINER ID   NAME               CPU %   MEM USAGE / LIMIT
# abc123         tiktok-ai-agent    12.5%   512MB / 2GB
```

**PM2 Monitoring:**

```bash
pm2 monit

# Or programmatic
pm2 jlist  # JSON output
```

**Resource Usage:**

```bash
# CPU and memory
top -p $(pgrep -f "node.*tiktok")

# Disk usage
df -h /app/artifacts
du -sh /app/artifacts/*

# Database size (PostgreSQL)
psql -c "SELECT pg_size_pretty(pg_database_size('tiktok_ai'));"
```

### Automated Monitoring (Optional)

**Setup Prometheus + Grafana:**

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

volumes:
  prometheus_data:
  grafana_data:
```

---

## Common Incidents

### 1. OpenAI Rate Limit Errors

**Symptoms:**

```
Error: OpenAI rate limit exceeded
```

**Cause:** Too many API requests in short period

**Diagnosis:**

```bash
# Check recent error logs
grep "rate limit" /app/logs/app.log | tail -20

# Count failed runs
curl http://localhost:3001/api/run | jq '[.[] | select(.status == "failed")] | length'
```

**Fix:**

```bash
# 1. Wait 60 seconds for rate limit reset
sleep 60

# 2. Retry failed runs
curl -X POST http://localhost:3001/api/run/{runId}/retry

# 3. Reduce concurrent renders (in code)
# Edit apps/server/src/services/render/renderPipeline.ts
# Increase delay between API calls
```

**Prevention:**

- Implement exponential backoff in OpenAI client
- Add rate limiting middleware
- Use render queue (already implemented)

### 2. FFmpeg Timeout

**Symptoms:**

```
Error: FFmpeg process timed out after 300000ms
```

**Cause:** Video encoding taking longer than 5 minutes

**Diagnosis:**

```bash
# Check run logs
curl http://localhost:3001/api/run/{runId} | jq '.logsJson'

# Check system resources
top
df -h
```

**Fix:**

```bash
# 1. Increase timeout (apps/server/src/services/ffmpeg/ffmpegUtils.ts)
const FFMPEG_TIMEOUT_MS = 600_000;  // Increase to 10 minutes

# 2. Restart service
pm2 restart tiktok-ai

# 3. Retry run
curl -X POST http://localhost:3001/api/run/{runId}/retry --json '{"fromStep":"ffmpeg_render"}'
```

**Prevention:**

- Optimize video dimensions (reduce from 1920x1080 to 1080x1920 for TikTok)
- Use faster FFmpeg presets (`-preset ultrafast`)
- Increase server resources

### 3. Disk Space Full

**Symptoms:**

```
ENOSPC: no space left on device
```

**Diagnosis:**

```bash
# Check disk usage
df -h
du -sh /app/artifacts/*

# Find largest files
find /app/artifacts -type f -exec ls -lh {} \; | sort -k5 -hr | head -20
```

**Fix:**

```bash
# 1. Delete old artifacts (older than 30 days)
find /app/artifacts -type f -mtime +30 -delete

# 2. Compress old videos
find /app/artifacts -name "*.mp4" -mtime +7 -exec gzip {} \;

# 3. Move to cloud storage (S3/GCS)
aws s3 sync /app/artifacts s3://your-bucket/artifacts --storage-class GLACIER
```

**Prevention:**

- Implement artifact cleanup job (cron)
- Store artifacts in cloud storage instead of local disk
- Set retention policy (delete after 90 days)

### 4. Database Lock (SQLite)

**Symptoms:**

```
database is locked
```

**Cause:** Concurrent writes to SQLite (SQLite doesn't support high concurrency)

**Diagnosis:**

```bash
# Check active connections
lsof /app/data/prod.db

# Check for long-running transactions
# (SQLite doesn't have transaction view)
```

**Fix:**

```bash
# Immediate fix: restart service
pm2 restart tiktok-ai

# Long-term fix: migrate to PostgreSQL
# See deployment.md#database-migration
```

**Prevention:**

- Use PostgreSQL in production (supports concurrent writes)
- Implement connection pooling
- Use write-ahead logging (WAL) mode for SQLite

### 5. Memory Leak

**Symptoms:**

- Memory usage steadily increases
- Process killed by OOM (Out of Memory)

**Diagnosis:**

```bash
# Monitor memory over time
watch -n 5 'docker stats --no-stream tiktok-ai-agent | grep tiktok'

# Check for memory leaks in Node.js
node --inspect apps/server/dist/index.js
# Connect Chrome DevTools, take heap snapshot
```

**Fix:**

```bash
# 1. Restart service immediately
pm2 restart tiktok-ai

# 2. Increase memory limit (PM2)
pm2 start ecosystem.config.cjs --max-memory-restart 1G

# 3. Increase memory limit (Docker)
# In docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 2G
```

**Prevention:**

- Close SSE connections properly
- Clear render pipeline state after completion
- Use memory profiling tools (clinic.js, heapdump)

### 6. Nginx 502 Bad Gateway

**Symptoms:**

- Frontend shows "502 Bad Gateway"
- API requests fail

**Diagnosis:**

```bash
# Check if Node.js server is running
curl http://localhost:3001/api/health

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check upstream health
sudo nginx -t
```

**Fix:**

```bash
# 1. Restart Node.js server
pm2 restart tiktok-ai

# 2. Reload Nginx config
sudo nginx -s reload

# 3. Check firewall rules
sudo ufw status
```

---

## Backup & Restore

### Database Backup

**PostgreSQL:**

```bash
# Full backup
pg_dump -U tiktok_user tiktok_ai > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump -U tiktok_user tiktok_ai | gzip > backup_$(date +%Y%m%d).sql.gz

# Schema only
pg_dump -U tiktok_user --schema-only tiktok_ai > schema.sql

# Data only
pg_dump -U tiktok_user --data-only tiktok_ai > data.sql
```

**SQLite:**

```bash
# Copy database file
cp /app/data/prod.db /backups/prod_$(date +%Y%m%d).db

# Or use .backup command
sqlite3 /app/data/prod.db ".backup '/backups/prod_$(date +%Y%m%d).db'"
```

### Artifacts Backup

```bash
# Sync to S3
aws s3 sync /app/artifacts s3://your-bucket/artifacts

# Or tar archive
tar -czf artifacts_$(date +%Y%m%d).tar.gz /app/artifacts

# Or rsync to backup server
rsync -avz /app/artifacts backup-server:/backups/artifacts/
```

### Automated Backup (Cron)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /usr/local/bin/backup-tiktok-ai.sh
```

**Backup script:**

```bash
#!/bin/bash
# /usr/local/bin/backup-tiktok-ai.sh

DATE=$(date +%Y%m%d)
BACKUP_DIR=/backups/tiktok-ai

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U tiktok_user tiktok_ai | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup artifacts (last 7 days only)
find /app/artifacts -mtime -7 -type f | tar -czf $BACKUP_DIR/artifacts_$DATE.tar.gz -T -

# Sync to S3
aws s3 sync $BACKUP_DIR s3://your-bucket/backups/

# Delete local backups older than 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Restore Procedures

**PostgreSQL:**

```bash
# Restore from backup
psql -U tiktok_user tiktok_ai < backup_20260129.sql

# Or from compressed
gunzip < backup_20260129.sql.gz | psql -U tiktok_user tiktok_ai

# Drop and recreate database first (if needed)
dropdb tiktok_ai
createdb tiktok_ai
psql -U tiktok_user tiktok_ai < backup_20260129.sql
```

**SQLite:**

```bash
# Stop service first
pm2 stop tiktok-ai

# Restore database file
cp /backups/prod_20260129.db /app/data/prod.db

# Restart service
pm2 start tiktok-ai
```

**Artifacts:**

```bash
# Restore from S3
aws s3 sync s3://your-bucket/artifacts /app/artifacts

# Or from tar archive
tar -xzf artifacts_20260129.tar.gz -C /
```

---

## Scaling Considerations

### Vertical Scaling (Single Server)

**Current Limits:**

- 1 render at a time (queue serialization)
- FFmpeg is CPU-intensive (1920x1080 encoding)
- OpenAI API rate limits (~60 req/min for images)

**Recommended Specs:**

| Usage | CPU | RAM | Disk | Cost/month |
|-------|-----|-----|------|------------|
| Dev/Test | 2 vCPU | 4GB | 50GB | $20 |
| Small Production (<10 videos/day) | 4 vCPU | 8GB | 100GB | $40 |
| Medium Production (<50 videos/day) | 8 vCPU | 16GB | 500GB | $80 |

**Scale Up:**

```bash
# Docker (increase resources)
# docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '8'
      memory: 16G

# PM2 (increase instances - NOT RECOMMENDED, render queue is serial)
pm2 start ecosystem.config.cjs -i 1  # Keep at 1 instance

# Railway (scale via dashboard)
railway up --replicas 1
```

### Horizontal Scaling (Multiple Servers)

**Challenges:**

- Render queue is in-memory (Map) - not shared across instances
- SSE connections are per-instance
- Artifacts stored locally

**Solution Architecture:**

```
┌─────────────┐
│ Load Balancer│
└─────┬───────┘
      │
      ├─────────────┬─────────────┐
      │             │             │
┌─────▼────┐  ┌─────▼────┐  ┌─────▼────┐
│ Server 1 │  │ Server 2 │  │ Server 3 │
└─────┬────┘  └─────┬────┘  └─────┬────┘
      │             │             │
      └─────────────┴─────────────┘
                    │
          ┌─────────▼─────────┐
          │ Shared PostgreSQL │
          └─────────┬─────────┘
                    │
          ┌─────────▼─────────┐
          │  Redis (Queue +   │
          │  SSE pub/sub)     │
          └─────────┬─────────┘
                    │
          ┌─────────▼─────────┐
          │ S3/GCS (Artifacts)│
          └───────────────────┘
```

**Required Changes:**

1. **Replace in-memory queue with Redis:**

```typescript
// Use Bull queue or BullMQ
import Queue from 'bull';
const renderQueue = new Queue('render', 'redis://redis:6379');
```

2. **Store artifacts in S3/GCS:**

```typescript
// Upload to S3 after render
await s3.putObject({ Bucket, Key, Body: fs.createReadStream(videoPath) });
```

3. **Use Redis for SSE pub/sub:**

```typescript
// Publish updates to Redis
redis.publish(`run:${runId}`, JSON.stringify(update));

// Subscribe on all instances
redis.subscribe(`run:${runId}`);
```

See [roadmap.md](roadmap.md) for horizontal scaling implementation plan.

---

## Maintenance

### Regular Maintenance Tasks

| Task | Frequency | Command |
|------|-----------|---------|
| Database backup | Daily | `pg_dump tiktok_ai > backup.sql` |
| Artifact cleanup | Weekly | `find /app/artifacts -mtime +30 -delete` |
| Log rotation | Weekly | `pm2 flush` or `docker logs --since 7d` |
| Security updates | Monthly | `npm audit`, `apt update && apt upgrade` |
| Dependency updates | Monthly | `npm outdated`, `npm update` |

### Maintenance Mode

**Enable maintenance:**

```bash
# Create maintenance page
cat > /var/www/html/maintenance.html <<EOF
<!DOCTYPE html>
<html>
<head><title>Maintenance</title></head>
<body>
  <h1>Down for Maintenance</h1>
  <p>We'll be back soon!</p>
</body>
</html>
EOF

# Nginx: redirect all traffic to maintenance page
sudo nano /etc/nginx/sites-available/tiktok-ai
# Add: return 503;

sudo nginx -s reload
```

**Perform maintenance:**

```bash
# Stop service
pm2 stop tiktok-ai

# Run migrations
npm run db:migrate

# Update code
git pull
npm ci
npm run build

# Start service
pm2 start tiktok-ai
```

**Disable maintenance:**

```bash
# Remove redirect in Nginx
sudo nginx -s reload
```

---

## Related Documentation

- [deployment.md](deployment.md) - Deployment procedures
- [configuration.md](configuration.md) - Environment configuration
- [troubleshooting.md](troubleshooting.md) - Detailed troubleshooting
- [security.md](security.md) - Security operations

---

**Last Updated:** 2026-01-29  
**On-Call Contact:** See [SUPPORT.md](../SUPPORT.md)
