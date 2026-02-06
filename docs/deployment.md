# Deployment Guide

Production deployment guide for TikTok-AI-Agent covering Docker, Docker Compose, Railway.app, manual deployment, and cloud platforms.

## Table of Contents

- [Quick Start](#quick-start)
- [Docker Deployment](#docker-deployment)
- [Docker Compose](#docker-compose)
- [Railway.app](#railwayapp)
- [Manual Deployment](#manual-deployment)
- [Cloud Platform Guides](#cloud-platform-guides)
- [Database Migration](#database-migration)
- [Post-Deployment](#post-deployment)
- [Rollback Procedures](#rollback-procedures)

---

## Quick Start

**Recommended for Production:** Railway.app (easiest) or Docker (most flexible)

```bash
# Railway.app (5 minutes)
npm install -g railway
railway login
railway up

# Docker (10 minutes)
docker-compose up -d

# Manual (15 minutes)
npm run build
npm run db:migrate
npm start
```

---

## Docker Deployment

### Multi-Stage Dockerfile

The production Dockerfile uses a multi-stage build for optimal size and security:

```dockerfile
# apps/server/Dockerfile
FROM node:22.12-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client and build
RUN npm run db:generate
RUN npm run build

#########################################
# Production Runtime
#########################################
FROM node:22.12-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache ffmpeg curl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create data directories
RUN mkdir -p /app/artifacts /app/data

# Environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_URL=file:./data/prod.db \
    ARTIFACTS_DIR=/app/artifacts

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Start server
CMD ["sh", "-c", "npm run db:migrate && npm start"]
```

### Build Docker Image

```bash
# Build image
docker build -t tiktok-ai-agent:latest .

# Verify image size (should be ~800MB)
docker images tiktok-ai-agent

# Test locally
docker run -p 3001:3001 \
  -e OPENAI_API_KEY=sk-proj-... \
  -e ALLOWED_ORIGINS=http://localhost:3001 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/artifacts:/app/artifacts \
  tiktok-ai-agent:latest
```

### Deploy to Registry

```bash
# Tag for registry
docker tag tiktok-ai-agent:latest your-registry.com/tiktok-ai-agent:1.0.0

# Push to registry
docker push your-registry.com/tiktok-ai-agent:1.0.0

# Pull on production server
docker pull your-registry.com/tiktok-ai-agent:1.0.0
```

---

## Docker Compose

### Production docker-compose.yml

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: tiktok-ai-agent
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=file:/app/data/prod.db
      - ARTIFACTS_DIR=/app/artifacts
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY:-}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    volumes:
      # Persist database
      - ./data:/app/data
      # Persist generated artifacts
      - ./artifacts:/app/artifacts
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      start_period: 40s
      retries: 3
```

### With PostgreSQL

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: tiktok-ai-db
    environment:
      - POSTGRES_USER=tiktok
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=tiktok_ai
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tiktok"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: tiktok-ai-agent
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=postgresql://tiktok:${DB_PASSWORD}@db:5432/tiktok_ai
      - ARTIFACTS_DIR=/app/artifacts
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
    volumes:
      - ./artifacts:/app/artifacts
    restart: unless-stopped

volumes:
  postgres_data:
```

### Environment File

```bash
# .env (host machine)
OPENAI_API_KEY=sk-proj-...
ELEVENLABS_API_KEY=
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
DB_PASSWORD=secure_password_here
LOG_LEVEL=info
```

### Deploy

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Check health
curl http://localhost:3001/api/health

# Stop services
docker-compose down

# Update and restart
git pull
docker-compose build
docker-compose up -d
```

---

## Railway.app

Railway provides zero-config deployment with automatic HTTPS, environment management, and scaling.

### Setup

**1. Install Railway CLI:**

```bash
npm install -g railway
railway login
```

**2. Initialize Railway Project:**

```bash
# From repository root
railway init

# Link to existing project (or create new)
railway link
```

**3. Configure Environment Variables:**

```bash
# Via CLI
railway variables set OPENAI_API_KEY=sk-proj-...
railway variables set ALLOWED_ORIGINS=https://your-app.railway.app
railway variables set NODE_ENV=production

# Or via Railway Dashboard:
# https://railway.app/project/<project-id>/settings/variables
```

**Required Variables:**

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | Required |
| `OPENAI_API_KEY` | `sk-proj-...` | Required |
| `ALLOWED_ORIGINS` | `https://your-app.railway.app` | Required for CORS |
| `DATABASE_URL` | Auto-set if using Railway Postgres | Optional |

### railway.toml Configuration

```toml
# railway.toml
[build]
builder = "nixpacks"
buildCommand = "npm install && npm run build"

[deploy]
startCommand = "npm run db:generate && npm run db:migrate && npm run start"
healthcheckPath = "/api/health"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

[nixpacks]
providers = ["node"]
```

### Deploy

```bash
# Deploy from local
railway up

# Or connect to GitHub (auto-deploy on push)
railway connect  # Link GitHub repo
git push  # Triggers automatic deployment
```

### Add PostgreSQL Database

```bash
# Via CLI
railway add --database postgresql

# Update DATABASE_URL reference
railway variables set DATABASE_URL='${{Postgres.DATABASE_URL}}'

# Redeploy
railway up
```

### View Logs

```bash
# Stream logs
railway logs

# Or view in dashboard
railway open
```

### Custom Domain

```bash
# Add custom domain
railway domain add yourdomain.com

# Configure DNS (in your domain registrar):
# Type: CNAME
# Name: @
# Value: your-app.railway.app
```

Update `ALLOWED_ORIGINS`:

```bash
railway variables set ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## Manual Deployment

### Prerequisites

- Node.js 20.19+ or 22.12+
- FFmpeg 4.4+
- PM2 or systemd for process management
- Nginx or Caddy for reverse proxy
- PostgreSQL (recommended) or SQLite

### Deployment Steps

**1. Clone Repository:**

```bash
git clone https://github.com/YOUR_USERNAME/TikTok-AI-Agent.git
cd TikTok-AI-Agent
```

**2. Install Dependencies:**

```bash
npm ci  # Use ci for production (faster, stricter)
```

**3. Configure Environment:**

```bash
cp .env.example .env
nano .env
```

```bash
# .env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/tiktok_ai
OPENAI_API_KEY=sk-proj-...
ALLOWED_ORIGINS=https://yourdomain.com
ARTIFACTS_DIR=/var/www/tiktok-ai/artifacts
```

**4. Build Application:**

```bash
npm run build
```

**5. Run Migrations:**

```bash
npm run db:migrate
```

**6. Start with PM2:**

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name tiktok-ai -- start

# Save PM2 config
pm2 save

# Auto-restart on reboot
pm2 startup
```

### PM2 Ecosystem File

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'tiktok-ai-agent',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/tiktok-ai',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
  }],
};
```

```bash
pm2 start ecosystem.config.cjs
```

### systemd Service (Alternative to PM2)

```ini
# /etc/systemd/system/tiktok-ai.service
[Unit]
Description=TikTok AI Agent
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/tiktok-ai
Environment="NODE_ENV=production"
Environment="PORT=3001"
EnvironmentFile=/var/www/tiktok-ai/.env
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable tiktok-ai
sudo systemctl start tiktok-ai

# Check status
sudo systemctl status tiktok-ai

# View logs
sudo journalctl -u tiktok-ai -f
```

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/tiktok-ai
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (use certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # SSE streaming (no buffering)
    location /api/run/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }

    # Serve artifacts (requires authentication in production)
    # See SECURITY.md for alternative authentication strategies (signed URLs, cloud storage)
    # Example using nginx basic auth:
    location /artifacts/ {
        alias /var/www/tiktok-ai/artifacts/;
        auth_basic "Restricted Access";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/tiktok-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Setup SSL with certbot
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Setup basic auth for artifacts (if using nginx auth_basic)
sudo apt-get install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd username
# Note: Use -c only for the first user; omit -c for additional users to avoid overwriting the file
# Example for adding another user later (no -c):
# sudo htpasswd /etc/nginx/.htpasswd anotheruser
```

---

## Cloud Platform Guides

### AWS (EC2 + RDS)

**1. Launch EC2 Instance:**
- AMI: Ubuntu 22.04 LTS
- Instance Type: t3.medium (2 vCPU, 4GB RAM)
- Storage: 50GB gp3 SSD
- Security Group: Allow 22 (SSH), 80 (HTTP), 443 (HTTPS)

**2. Setup RDS PostgreSQL:**
- Engine: PostgreSQL 16
- Instance: db.t4g.micro (dev) or db.t4g.small (prod)
- Storage: 20GB gp3
- Backup: Enabled (7-day retention)

**3. Configure Environment:**

```bash
# SSH to EC2
ssh ubuntu@your-ec2-ip

# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs ffmpeg nginx

# Deploy app (follow Manual Deployment steps)
# Set DATABASE_URL to RDS endpoint
DATABASE_URL=postgresql://admin:password@your-rds-endpoint:5432/tiktok_ai
```

### Google Cloud Platform (Cloud Run)

**1. Create Dockerfile** (already exists)

**2. Build and push to Container Registry:**

```bash
# Configure gcloud
gcloud init
gcloud auth configure-docker

# Build image
gcloud builds submit --tag gcr.io/your-project/tiktok-ai

# Deploy to Cloud Run
gcloud run deploy tiktok-ai \
  --image gcr.io/your-project/tiktok-ai \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,OPENAI_API_KEY=sk-proj-...,ALLOWED_ORIGINS=https://your-app.run.app \
  --memory 2Gi \
  --cpu 2 \
  --timeout 900
```

**3. Add Cloud SQL PostgreSQL:**

```bash
gcloud sql instances create tiktok-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1

gcloud run services update tiktok-ai \
  --add-cloudsql-instances your-project:us-central1:tiktok-db \
  --set-env-vars DATABASE_URL=postgresql://user:pass@/tiktok_ai?host=/cloudsql/your-project:us-central1:tiktok-db
```

### Azure (App Service + PostgreSQL)

**1. Create PostgreSQL Flexible Server:**

```bash
az postgres flexible-server create \
  --resource-group tiktok-rg \
  --name tiktok-db \
  --location eastus \
  --admin-user tiktokadmin \
  --admin-password <password> \
  --sku-name Standard_B1ms \
  --version 16
```

**2. Deploy to App Service:**

```bash
# Create App Service Plan
az appservice plan create \
  --name tiktok-plan \
  --resource-group tiktok-rg \
  --sku B2 \
  --is-linux

# Create Web App
az webapp create \
  --resource-group tiktok-rg \
  --plan tiktok-plan \
  --name tiktok-ai-agent \
  --runtime "NODE:22-lts"

# Configure environment
az webapp config appsettings set \
  --resource-group tiktok-rg \
  --name tiktok-ai-agent \
  --settings NODE_ENV=production OPENAI_API_KEY=sk-proj-... DATABASE_URL=postgresql://...

# Deploy code
az webapp deployment source config \
  --name tiktok-ai-agent \
  --resource-group tiktok-rg \
  --repo-url https://github.com/YOUR_USERNAME/TikTok-AI-Agent \
  --branch main \
  --manual-integration
```

---

## Database Migration

### SQLite to PostgreSQL

**1. Export SQLite data:**

```bash
# Install pgloader
sudo apt install pgloader  # Ubuntu
brew install pgloader      # macOS

# Export schema
sqlite3 dev.db .dump > dump.sql
```

**2. Setup PostgreSQL:**

```bash
# Create database
createdb tiktok_ai

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://user:pass@localhost:5432/tiktok_ai
```

**3. Update Prisma Schema:**

```prisma
// apps/server/prisma/schema.prisma
datasource db {
  provider = "postgresql"  // Changed from "sqlite"
  url      = env("DATABASE_URL")
}
```

**4. Run migrations:**

```bash
# Generate migration
npm run db:migrate:dev

# Or deploy existing migrations
npm run db:migrate
```

**5. Migrate data with pgloader:**

```bash
pgloader dev.db postgresql://user:pass@localhost:5432/tiktok_ai
```

**6. Verify:**

```bash
psql tiktok_ai
\dt  # List tables
SELECT COUNT(*) FROM "Project";
```

### Database Connection Pooling

The application automatically configures connection pooling based on the database type (SQLite or PostgreSQL).

**Environment Variables:**

```bash
# Optional - defaults to 10 connections
DATABASE_CONNECTION_LIMIT=10

# Optional - connection timeout in seconds, defaults to 10
DATABASE_POOL_TIMEOUT=10
```

**SQLite Configuration:**

For SQLite databases, the connection pooling is automatically configured to prevent "database is locked" errors:

```bash
DATABASE_URL=file:./prod.db
DATABASE_CONNECTION_LIMIT=5  # Lower limit for SQLite
DATABASE_POOL_TIMEOUT=10
```

**PostgreSQL Configuration:**

For PostgreSQL, connection pooling is configured and is compatible with pgbouncer:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DATABASE_CONNECTION_LIMIT=20  # Higher limit for PostgreSQL
DATABASE_POOL_TIMEOUT=10
```

**Troubleshooting:**

- **"Too many connections"** - Reduce `DATABASE_CONNECTION_LIMIT`
- **"Database is locked"** (SQLite) - Ensure `pool_timeout` is set and connection_limit is reasonable (5-10)
- **Connection timeouts** - Increase `DATABASE_POOL_TIMEOUT`
- **Performance issues** - Monitor database connections and adjust limits based on your server capacity

**Best Practices:**

- **SQLite**: Use connection_limit of 5-10 for development/small deployments
- **PostgreSQL**: Use connection_limit based on your database server capacity (typically 10-100)
- **Production**: Always set explicit DATABASE_URL with connection parameters
- **Scaling**: Monitor connection pool usage and adjust limits as needed

---

## Post-Deployment

### Health Check

```bash
curl https://yourdomain.com/api/health
```

**Expected:**

```json
{
  "status": "OK",
  "timestamp": "2026-01-29T12:00:00.000Z",
  "version": "1.0.0",
  "database": "connected",
  "artifactsDir": "/app/artifacts"
}
```

### Monitoring

```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs tiktok-ai

# systemd monitoring
sudo systemctl status tiktok-ai
sudo journalctl -u tiktok-ai -f

# Docker monitoring
docker stats tiktok-ai-agent
docker logs -f tiktok-ai-agent
```

### Performance Testing

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Load test
ab -n 100 -c 10 https://yourdomain.com/api/projects
```

---

## Rollback Procedures

### Docker Rollback

```bash
# Pull previous version
docker pull your-registry.com/tiktok-ai-agent:0.9.0

# Stop current container
docker-compose down

# Update image tag in docker-compose.yml
# image: your-registry.com/tiktok-ai-agent:0.9.0

# Start with previous version
docker-compose up -d
```

### PM2 Rollback

```bash
# Checkout previous version
git checkout v0.9.0

# Rebuild
npm ci
npm run build

# Restart PM2
pm2 restart tiktok-ai
```

### Database Rollback

```bash
# Restore from backup
pg_restore -U user -d tiktok_ai backup.dump

# Or apply reverse migration (manual)
psql tiktok_ai < reverse_migration.sql
```

---

## Related Documentation

- [configuration.md](configuration.md) - Environment variables
- [operations-runbook.md](operations-runbook.md) - Day-to-day operations
- [security.md](security.md) - Security best practices
- [troubleshooting.md](troubleshooting.md) - Common issues

---

**Last Updated:** 2026-01-29  
**Recommended Stack:** Railway.app (easiest) or Docker + PostgreSQL + Nginx (most control)
