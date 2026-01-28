# TikTok AI - Video Generator

A full-stack web application that generates TikTok-style vertical videos end-to-end using AI.

**Topic → PLAN & PREVIEW (editable) → APPROVE & RENDER → Real MP4 file**

## Features

- **AI-Powered Content Generation**: Uses OpenAI GPT-4 for script writing, DALL-E 3 for image generation, TTS for voice-over, and Whisper for caption timing
- **12 Niche Packs**: Pre-configured styles for horror, facts, motivation, product, story, top5, finance, health, history, gaming, science, mystery
- **Full Plan & Preview Studio**: Edit hooks, outline, script, and individual scenes before rendering
- **Real Video Output**: Generates actual MP4 files with motion effects, captions, and audio
- **Progress Tracking**: Real-time SSE updates during rendering with detailed logs
- **Retry/Resume**: Idempotent pipeline that can resume from failed steps
- **Artifact Verification**: Validates all output files before marking as complete

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite + Prisma
- **Video**: FFmpeg for rendering
- **AI**: OpenAI (GPT-4, DALL-E 3, TTS, Whisper)

## Quick Start

### 1. Prerequisites

- Node.js 18+
- FFmpeg installed on your system (or the app will use ffmpeg-static)
- OpenAI API key

### 2. Installation

```bash
# Clone and enter the directory
cd tiktok-ai

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-...

# Generate Prisma client and run migrations
npm run db:generate
npm run db:migrate

# Start development servers
npm run dev
```

### 3. Access the App

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Environment Variables

Create a `.env` file in the project root:

```env
# Required
OPENAI_API_KEY=sk-your-openai-api-key

# Optional
ELEVENLABS_API_KEY=           # For premium TTS (not yet implemented)
MUSIC_LIBRARY_DIR=./assets/music   # For background music
ARTIFACTS_DIR=./artifacts     # Output directory
DATABASE_URL="file:./dev.db"  # SQLite database path
PORT=3001                     # Server port
```

## How to Render a 60s Facts Video

1. Open http://localhost:5173
2. Enter a topic: "5 surprising facts about the deep ocean"
3. Select "Amazing Facts" niche pack
4. Keep 60s target length
5. Click "Generate Plan"
6. Review and edit the generated content:
   - Select your preferred hook
   - Edit the outline if needed
   - Review/edit scenes
   - Adjust durations if needed
7. Click "Validate" to check for issues
8. Click "Approve & Render"
9. Watch the progress in real-time
10. Download your MP4 when complete!

## Project Structure

```
/workspace
├── apps/
│   ├── server/          # Express backend
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/
│   │   │   │   ├── plan/        # Plan generation
│   │   │   │   ├── render/      # Render pipeline
│   │   │   │   ├── providers/   # OpenAI integration
│   │   │   │   ├── ffmpeg/      # Video processing
│   │   │   │   └── captions/    # Caption generation
│   │   │   └── db/          # Prisma client
│   │   └── prisma/      # Database schema
│   └── web/             # React frontend
│       └── src/
│           ├── pages/       # App screens
│           ├── components/  # UI components
│           └── api/         # API client
├── artifacts/           # Generated video files (gitignored)
├── assets/
│   └── music/          # Optional background music
├── .env                # Environment variables
└── package.json        # Root package with workspaces
```

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/project` - Create new project
- `GET /api/project/:id` - Get project with plan
- `POST /api/project/:id/plan` - Generate plan
- `POST /api/project/:id/duplicate` - Duplicate project
- `DELETE /api/project/:id` - Delete project

### Plan Editing
- `PUT /api/plan/:planVersionId` - Update plan (autosave)
- `POST /api/plan/:planVersionId/validate` - Validate plan
- `POST /api/plan/:planVersionId/autofit` - Auto-fit durations
- `POST /api/plan/:planVersionId/regenerate-hooks` - Regenerate hooks
- `POST /api/plan/:planVersionId/regenerate-outline` - Regenerate outline
- `POST /api/plan/:planVersionId/regenerate-script` - Regenerate script
- `POST /api/plan/:planVersionId/approve` - Approve plan
- `POST /api/plan/:planVersionId/render` - Start render

### Scenes
- `PUT /api/scene/:sceneId` - Update scene
- `POST /api/scene/:sceneId/lock` - Toggle lock
- `POST /api/scene/:sceneId/regenerate` - Regenerate scene

### Runs
- `GET /api/run/:runId` - Get run status
- `GET /api/run/:runId/stream` - SSE progress stream
- `POST /api/run/:runId/retry` - Retry failed run
- `POST /api/run/:runId/cancel` - Cancel run
- `GET /api/run/:runId/verify` - Verify artifacts
- `GET /api/run/:runId/download` - Download MP4
- `GET /api/run/:runId/export` - Export JSON

## Render Pipeline Steps

1. **tts_generate** - Generate voice-over for each scene using OpenAI TTS
2. **asr_align** - Transcribe audio with Whisper for word-level timestamps
3. **images_generate** - Generate scene images with DALL-E 3
4. **captions_build** - Build ASS subtitle file with TikTok styling
5. **music_build** - Mix background music (if available)
6. **ffmpeg_render** - Create video segments with motion effects and composite final video
7. **finalize_artifacts** - Extract thumbnail and create export JSON

## Troubleshooting

### FFmpeg not found
Install FFmpeg on your system:
- macOS: `brew install ffmpeg`
- Ubuntu: `sudo apt install ffmpeg`
- Windows: Download from https://ffmpeg.org/download.html

Or the app will try to use `ffmpeg-static` automatically.

### OpenAI API errors
- Check your API key is correct in `.env`
- Ensure you have sufficient credits
- Check rate limits if generating many videos

### Video rendering fails
- Check FFmpeg is properly installed: `ffmpeg -version`
- Check logs in the run progress for specific errors
- Use "Retry" to resume from the failed step

### Database issues
```bash
# Reset database
rm apps/server/dev.db
npm run db:migrate
```

## Niche Packs

| Pack | Description |
|------|-------------|
| horror | Dark, atmospheric horror content |
| facts | Mind-blowing facts and information |
| motivation | Inspirational content |
| product | Product reviews and showcases |
| story | Narrative stories |
| top5 | Countdown and ranking content |
| finance_tips | Educational financial advice |
| health_myths | Debunking health misconceptions |
| history | Historical events and stories |
| gaming | Gaming content |
| science | Scientific concepts explained |
| mystery | Unsolved mysteries |

## License

MIT
