#!/bin/bash
# Full App Test Script - Tests complete workflow with real OpenAI API
# Usage: ./scripts/test-full-app.sh [API_KEY]
# If API_KEY not provided, will read from .env or environment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:3001/api"
TEST_TOPIC="5 surprising facts about the deep ocean"
NICHE_PACK="facts"
TARGET_LENGTH=60
MAX_WAIT_TIME=300  # 5 minutes max for render

# Print functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    print_error "jq is required but not installed. Install with: apt-get install jq"
    exit 1
fi

# Check if server is running
print_header "Checking Server Status"
if ! curl -s "$API_URL/health" > /dev/null 2>&1; then
    print_error "Server is not running at $API_URL"
    print_info "Start server with: npm run dev"
    exit 1
fi
print_success "Server is running"

# Check health endpoint
print_info "Checking health endpoint..."
HEALTH=$(curl -s "$API_URL/health")
STATUS=$(echo "$HEALTH" | jq -r '.status')
DB_OK=$(echo "$HEALTH" | jq -r '.database.ok')
VERSION=$(echo "$HEALTH" | jq -r '.version')

if [ "$STATUS" != "ok" ]; then
    print_error "Health check failed"
    echo "$HEALTH" | jq .
    exit 1
fi

print_success "Health check passed"
print_info "Version: $VERSION"
print_info "Database: $([ "$DB_OK" = "true" ] && echo "Connected" || echo "Disconnected")"

# Check provider status
print_info "Checking provider status..."
PROVIDER_STATUS=$(curl -s "$API_URL/status")
OPENAI_READY=$(echo "$PROVIDER_STATUS" | jq -r '.providers.openai')
FFMPEG_READY=$(echo "$PROVIDER_STATUS" | jq -r '.providers.ffmpeg')
APP_READY=$(echo "$PROVIDER_STATUS" | jq -r '.ready')
MESSAGE=$(echo "$PROVIDER_STATUS" | jq -r '.message')

echo "$PROVIDER_STATUS" | jq .

if [ "$OPENAI_READY" != "true" ]; then
    print_error "OpenAI provider not ready"
    print_warning "$MESSAGE"
    print_info "Set OPENAI_API_KEY in .env file or environment"
    exit 1
fi

if [ "$FFMPEG_READY" != "true" ]; then
    print_error "FFmpeg not available"
    print_warning "$MESSAGE"
    exit 1
fi

if [ "$APP_READY" != "true" ]; then
    print_error "Application not ready"
    print_warning "$MESSAGE"
    exit 1
fi

print_success "All providers ready (OpenAI: ✓, FFmpeg: ✓)"

# Create test project
print_header "Creating Test Project"
print_info "Topic: $TEST_TOPIC"
print_info "Niche: $NICHE_PACK"
print_info "Length: ${TARGET_LENGTH}s"

PROJECT_RESPONSE=$(curl -s -X POST "$API_URL/project" \
    -H "Content-Type: application/json" \
    -d "{
        \"topic\": \"$TEST_TOPIC\",
        \"nichePackId\": \"$NICHE_PACK\",
        \"targetLength\": $TARGET_LENGTH,
        \"tempo\": \"normal\"
    }")

PROJECT_ID=$(echo "$PROJECT_RESPONSE" | jq -r '.id')

if [ "$PROJECT_ID" = "null" ] || [ -z "$PROJECT_ID" ]; then
    print_error "Failed to create project"
    echo "$PROJECT_RESPONSE" | jq .
    exit 1
fi

print_success "Project created: $PROJECT_ID"

# Generate plan
print_header "Generating AI Plan"
print_info "This may take 10-30 seconds..."

PLAN_START_TIME=$(date +%s)
PLAN_RESPONSE=$(curl -s -X POST "$API_URL/project/$PROJECT_ID/plan")
PLAN_END_TIME=$(date +%s)
PLAN_DURATION=$((PLAN_END_TIME - PLAN_START_TIME))

# Check if plan generation succeeded
if echo "$PLAN_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    print_error "Plan generation failed"
    echo "$PLAN_RESPONSE" | jq .
    exit 1
fi

PLAN_VERSION_ID=$(echo "$PLAN_RESPONSE" | jq -r '.planVersions[0].id')
HOOK_COUNT=$(echo "$PLAN_RESPONSE" | jq -r '.planVersions[0].hookOptions | length')
SCENE_COUNT=$(echo "$PLAN_RESPONSE" | jq -r '.planVersions[0].scenes | length')

if [ "$PLAN_VERSION_ID" = "null" ] || [ -z "$PLAN_VERSION_ID" ]; then
    print_error "No plan version found in response"
    echo "$PLAN_RESPONSE" | jq .
    exit 1
fi

print_success "Plan generated in ${PLAN_DURATION}s"
print_info "Plan Version ID: $PLAN_VERSION_ID"
print_info "Hooks: $HOOK_COUNT"
print_info "Scenes: $SCENE_COUNT"

# Validate plan
print_header "Validating Plan"
VALIDATION_RESPONSE=$(curl -s -X POST "$API_URL/plan/$PLAN_VERSION_ID/validate")
IS_VALID=$(echo "$VALIDATION_RESPONSE" | jq -r '.isValid')
VALIDATION_ERRORS=$(echo "$VALIDATION_RESPONSE" | jq -r '.errors | length')

if [ "$IS_VALID" != "true" ]; then
    print_error "Plan validation failed"
    echo "$VALIDATION_RESPONSE" | jq .
    exit 1
fi

print_success "Plan is valid (0 errors)"

# Approve plan
print_header "Approving Plan"
APPROVE_RESPONSE=$(curl -s -X POST "$API_URL/plan/$PLAN_VERSION_ID/approve")
IS_APPROVED=$(echo "$APPROVE_RESPONSE" | jq -r '.isApproved')

if [ "$IS_APPROVED" != "true" ]; then
    print_error "Plan approval failed"
    echo "$APPROVE_RESPONSE" | jq .
    exit 1
fi

print_success "Plan approved"

# Start render
print_header "Starting Render"
print_info "This will take several minutes..."
RENDER_START_TIME=$(date +%s)

RENDER_RESPONSE=$(curl -s -X POST "$API_URL/plan/$PLAN_VERSION_ID/render")
RUN_ID=$(echo "$RENDER_RESPONSE" | jq -r '.run.id')

if [ "$RUN_ID" = "null" ] || [ -z "$RUN_ID" ]; then
    print_error "Failed to start render"
    echo "$RENDER_RESPONSE" | jq .
    exit 1
fi

print_success "Render started: $RUN_ID"

# Monitor render progress
print_info "Monitoring render progress..."
ELAPSED=0
LAST_STEP=""
LAST_PROGRESS=0

while [ $ELAPSED -lt $MAX_WAIT_TIME ]; do
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    
    RUN_STATUS=$(curl -s "$API_URL/run/$RUN_ID")
    STATUS=$(echo "$RUN_STATUS" | jq -r '.status')
    CURRENT_STEP=$(echo "$RUN_STATUS" | jq -r '.currentStep')
    PROGRESS=$(echo "$RUN_STATUS" | jq -r '.progress')
    ERROR=$(echo "$RUN_STATUS" | jq -r '.error')
    
    # Show progress if changed
    if [ "$CURRENT_STEP" != "$LAST_STEP" ] || [ "$PROGRESS" != "$LAST_PROGRESS" ]; then
        print_info "Step: $CURRENT_STEP | Progress: ${PROGRESS}%"
        LAST_STEP=$CURRENT_STEP
        LAST_PROGRESS=$PROGRESS
    fi
    
    # Check if completed
    if [ "$STATUS" = "completed" ]; then
        RENDER_END_TIME=$(date +%s)
        RENDER_DURATION=$((RENDER_END_TIME - RENDER_START_TIME))
        print_success "Render completed in ${RENDER_DURATION}s"
        break
    fi
    
    # Check if failed
    if [ "$STATUS" = "failed" ]; then
        print_error "Render failed: $ERROR"
        echo "$RUN_STATUS" | jq .
        exit 1
    fi
    
    # Check if cancelled
    if [ "$STATUS" = "cancelled" ]; then
        print_error "Render was cancelled"
        exit 1
    fi
done

if [ $ELAPSED -ge $MAX_WAIT_TIME ]; then
    print_error "Render timed out after ${MAX_WAIT_TIME}s"
    exit 1
fi

# Verify artifacts
print_header "Verifying Artifacts"
ARTIFACTS_RESPONSE=$(curl -s "$API_URL/run/$RUN_ID/verify")
VIDEO_EXISTS=$(echo "$ARTIFACTS_RESPONSE" | jq -r '.artifacts.video.exists')
THUMBNAIL_EXISTS=$(echo "$ARTIFACTS_RESPONSE" | jq -r '.artifacts.thumbnail.exists')
CAPTIONS_EXISTS=$(echo "$ARTIFACTS_RESPONSE" | jq -r '.artifacts.captions.exists')

if [ "$VIDEO_EXISTS" != "true" ]; then
    print_error "Video file not found"
    echo "$ARTIFACTS_RESPONSE" | jq .
    exit 1
fi

print_success "Video file exists"
print_success "Thumbnail exists: $([ "$THUMBNAIL_EXISTS" = "true" ] && echo "✓" || echo "✗")"
print_success "Captions exist: $([ "$CAPTIONS_EXISTS" = "true" ] && echo "✓" || echo "✗")"

# Test download endpoint
print_header "Testing Download"
DOWNLOAD_URL="$API_URL/run/$RUN_ID/download"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DOWNLOAD_URL")

if [ "$HTTP_CODE" != "200" ]; then
    print_error "Download failed (HTTP $HTTP_CODE)"
    exit 1
fi

print_success "Download endpoint working"
print_info "Download URL: $DOWNLOAD_URL"

# Summary
print_header "Test Summary"
print_success "All tests passed!"
echo ""
print_info "Project ID: $PROJECT_ID"
print_info "Plan Version ID: $PLAN_VERSION_ID"
print_info "Run ID: $RUN_ID"
echo ""
print_info "Plan Generation Time: ${PLAN_DURATION}s"
print_info "Render Time: ${RENDER_DURATION}s"
print_info "Total Time: $((PLAN_DURATION + RENDER_DURATION))s"
echo ""
print_info "Download video: curl -O '$DOWNLOAD_URL'"
echo ""

# Estimate cost (approximate)
ESTIMATED_COST=$(echo "scale=2; 0.50 * $TARGET_LENGTH / 60" | bc)
print_info "Estimated cost: ~\$${ESTIMATED_COST} (GPT-4 + DALL-E 3 + TTS + Whisper)"

print_success "Full app test completed successfully! 🎉"
