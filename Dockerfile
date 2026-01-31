# TikTok-AI-Agent Production Dockerfile
# Multi-stage build for frontend and backend

#########################################
# Stage 1: Build Stage
#########################################
FROM node:22.12-alpine AS builder

# Update Alpine repository mirrors and install build dependencies
RUN apk update && apk add --no-cache \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npm run db:generate

# Build both frontend and backend
RUN npm run build

#########################################
# Stage 2: Production Runtime
#########################################
FROM node:22.12-alpine AS runtime

# Update Alpine repository mirrors and install runtime dependencies
RUN apk update && apk add --no-cache \
    ffmpeg \
    curl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Copy Prisma schema and migrations (needed for prisma migrate deploy)
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma

# Copy generated Prisma Client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create directories for runtime data
RUN mkdir -p /app/artifacts /app/data

# Set environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_URL=file:./data/prod.db \
    ARTIFACTS_DIR=/app/artifacts

# Expose application port
EXPOSE 3001

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Run migrations and start server
CMD ["sh", "-c", "npm run db:migrate && npm start"]
