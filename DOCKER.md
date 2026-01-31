# Docker Deployment Guide

This guide explains how to build and run TikTok-AI-Agent using Docker.

## Prerequisites

- Docker 20.10+ installed
- Docker Compose (optional, for easier management)
- OpenAI API key

## Quick Start

### Using Docker CLI

1. **Build the image:**
   ```bash
   docker build -t tiktok-ai-agent .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     --name tiktok-ai-agent \
     -p 3001:3001 \
     -e OPENAI_API_KEY=your_api_key_here \
     -v $(pwd)/data:/app/data \
     -v $(pwd)/artifacts:/app/artifacts \
     tiktok-ai-agent
   ```

3. **Check health:**
   ```bash
   curl http://localhost:3001/api/health
   ```

### Using Docker Compose

1. **Create `.env` file:**
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

2. **Start the application:**
   ```bash
   docker-compose up -d
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Stop the application:**
   ```bash
   docker-compose down
   ```

## Environment Variables

Required:
- `OPENAI_API_KEY` - Your OpenAI API key

Optional:
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (default: production)
- `DATABASE_URL` - Database connection string (default: file:/app/data/prod.db)
- `ARTIFACTS_DIR` - Directory for generated videos (default: /app/artifacts)
- `ELEVENLABS_API_KEY` - ElevenLabs API key for voice synthesis
- `ALLOWED_ORIGINS` - Comma-separated CORS origins for production

## Multi-Stage Build

The Dockerfile uses a multi-stage build:

### Stage 1: Builder
- Based on `node:22.12-alpine`
- Installs build dependencies (Python, make, g++, git)
- Builds frontend (React + Vite)
- Builds backend (TypeScript)
- Generates Prisma Client

### Stage 2: Runtime
- Based on `node:22.12-alpine`
- Installs only runtime dependencies (ffmpeg, curl)
- Copies built artifacts from builder stage
- Includes Prisma schema and migrations
- Runs migrations on startup
- Starts the Express server

## Health Check

The container includes a health check that:
- Runs every 30 seconds
- Checks `/api/health` endpoint
- Allows 40 seconds startup time
- Retries 3 times before marking unhealthy

## Volumes

Recommended volume mounts:
- `/app/data` - Persists SQLite database
- `/app/artifacts` - Persists generated video files

## Deployment Examples

### AWS ECS/Fargate

```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com
docker build -t tiktok-ai-agent .
docker tag tiktok-ai-agent:latest <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/tiktok-ai-agent:latest
docker push <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/tiktok-ai-agent:latest
```

### Google Cloud Run

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/<project-id>/tiktok-ai-agent
gcloud run deploy tiktok-ai-agent \
  --image gcr.io/<project-id>/tiktok-ai-agent \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY=your_api_key
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tiktok-ai-agent
spec:
  replicas: 2
  selector:
    matchLabels:
      app: tiktok-ai-agent
  template:
    metadata:
      labels:
        app: tiktok-ai-agent
    spec:
      containers:
      - name: tiktok-ai-agent
        image: tiktok-ai-agent:latest
        ports:
        - containerPort: 3001
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openai-secret
              key: api-key
        volumeMounts:
        - name: data
          mountPath: /app/data
        - name: artifacts
          mountPath: /app/artifacts
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: tiktok-ai-data-pvc
      - name: artifacts
        persistentVolumeClaim:
          claimName: tiktok-ai-artifacts-pvc
```

## Troubleshooting

### Container fails to start

Check logs:
```bash
docker logs tiktok-ai-agent
```

### Health check failing

Verify the application is responding:
```bash
docker exec tiktok-ai-agent curl http://localhost:3001/api/health
```

### Database migration issues

Run migrations manually:
```bash
docker exec tiktok-ai-agent npm run db:migrate
```

### Permission issues with volumes

Ensure the mounted directories are writable:
```bash
chmod 777 data artifacts
```

## Production Considerations

1. **Database**: Consider using PostgreSQL instead of SQLite for production:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   ```

2. **File Storage**: Use object storage (S3, GCS) for artifacts in distributed deployments

3. **Secrets**: Use secrets management (AWS Secrets Manager, Kubernetes Secrets)

4. **Monitoring**: Add logging and monitoring solutions

5. **Scaling**: For horizontal scaling, use external database and shared storage

## Security Notes

- Never commit `.env` file with API keys
- Use secrets management in production
- Review SECURITY.md for additional security recommendations
- Keep Docker images updated regularly

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t tiktok-ai-agent .
      - name: Push to registry
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker push tiktok-ai-agent
```
