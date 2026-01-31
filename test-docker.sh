#!/bin/bash

# Script to test Docker build and deployment
# Usage: ./test-docker.sh

set -e

echo "🚀 TikTok-AI-Agent Docker Build & Test Script"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker is installed${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Please edit .env and add your OPENAI_API_KEY${NC}"
        exit 1
    else
        echo -e "${RED}❌ .env.example not found${NC}"
        exit 1
    fi
fi

# Source .env file
set -a
source .env
set +a

# Check if OPENAI_API_KEY is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}❌ OPENAI_API_KEY is not set in .env file${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo ""

# Build Docker image
echo "📦 Building Docker image..."
echo "This may take several minutes on first build..."
echo ""

if docker build -t tiktok-ai-agent . ; then
    echo -e "${GREEN}✅ Docker image built successfully${NC}"
else
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi

echo ""

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data artifacts

echo ""

# Stop and remove any existing container
if docker ps -a | grep -q tiktok-ai-agent-test; then
    echo "🧹 Cleaning up existing container..."
    docker stop tiktok-ai-agent-test 2>/dev/null || true
    docker rm tiktok-ai-agent-test 2>/dev/null || true
fi

echo ""

# Run container
echo "🚀 Starting container..."
docker run -d \
    --name tiktok-ai-agent-test \
    -p 3001:3001 \
    -e OPENAI_API_KEY="$OPENAI_API_KEY" \
    -e ELEVENLABS_API_KEY="${ELEVENLABS_API_KEY:-}" \
    -v "$(pwd)/data:/app/data" \
    -v "$(pwd)/artifacts:/app/artifacts" \
    tiktok-ai-agent

echo -e "${GREEN}✅ Container started${NC}"
echo ""

# Wait for container to be ready
echo "⏳ Waiting for application to start..."
sleep 5

# Check container status
if docker ps | grep -q tiktok-ai-agent-test; then
    echo -e "${GREEN}✅ Container is running${NC}"
else
    echo -e "${RED}❌ Container failed to start${NC}"
    echo ""
    echo "Container logs:"
    docker logs tiktok-ai-agent-test
    exit 1
fi

echo ""

# Wait for health check
echo "🏥 Waiting for health check to pass..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -sf http://localhost:3001/api/health > /dev/null; then
        echo -e "${GREEN}✅ Health check passed${NC}"
        break
    fi
    
    ATTEMPT=$((ATTEMPT + 1))
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo -e "${RED}❌ Health check failed after $MAX_ATTEMPTS attempts${NC}"
        echo ""
        echo "Container logs:"
        docker logs tiktok-ai-agent-test
        docker stop tiktok-ai-agent-test
        docker rm tiktok-ai-agent-test
        exit 1
    fi
    
    echo "Attempt $ATTEMPT/$MAX_ATTEMPTS..."
    sleep 2
done

echo ""

# Test health endpoint
echo "🔍 Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:3001/api/health)
echo "Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✅ Health endpoint is responding correctly${NC}"
else
    echo -e "${RED}❌ Health endpoint response is unexpected${NC}"
    docker logs tiktok-ai-agent-test
    docker stop tiktok-ai-agent-test
    docker rm tiktok-ai-agent-test
    exit 1
fi

echo ""
echo "=============================================="
echo -e "${GREEN}🎉 All tests passed!${NC}"
echo "=============================================="
echo ""
echo "Container is running at: http://localhost:3001"
echo ""
echo "To view logs:"
echo "  docker logs -f tiktok-ai-agent-test"
echo ""
echo "To stop container:"
echo "  docker stop tiktok-ai-agent-test"
echo ""
echo "To remove container:"
echo "  docker rm tiktok-ai-agent-test"
echo ""

# Ask if user wants to keep container running
read -p "Do you want to keep the container running? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 Stopping and removing container..."
    docker stop tiktok-ai-agent-test
    docker rm tiktok-ai-agent-test
    echo -e "${GREEN}✅ Cleanup complete${NC}"
fi
