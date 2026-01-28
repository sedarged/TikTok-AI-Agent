# TikTok AI

Personal-use, single-user app to generate TikTok-style vertical videos end-to-end:
Topic → Plan & Preview → Approve & Render → MP4.

## Requirements
- Node.js 18+
- SQLite (bundled)
- FFmpeg (preferred via ffmpeg-static; fallback to system ffmpeg)

## Setup
```bash
npm install
cd apps/server && npm install
cd ../web && npm install
```

Create a `.env` file in the repo root (see `.env.example`):
```bash
OPENAI_API_KEY=your_key_here
ELEVENLABS_API_KEY=optional
MUSIC_LIBRARY_DIR=./assets/music
ARTIFACTS_DIR=./artifacts
DATABASE_URL="file:./dev.db"
VITE_API_URL=http://localhost:4000/api
```

Run migrations:
```bash
npm run db:migrate
```

## Dev
```bash
npm run dev
```
- Web: http://localhost:5173
- API: http://localhost:4000

## Render a 60s facts video
1. Open the web app.
2. Choose Niche Pack: **Facts**.
3. Set target length to **60s**, tempo **normal**.
4. Click **Generate Plan**.
5. Review/edit the plan and click **Approve & Render**.
6. Watch progress in **Render Queue**, then open **Output**.

## Artifacts
All outputs are stored in:
```
./artifacts/{projectId}/{runId}/
  images/
  audio/
  captions/
  final/
```

## FFmpeg Troubleshooting
- The server uses `ffmpeg-static` by default.
- If you see “FFmpeg not available”, install system ffmpeg:
  - Ubuntu: `sudo apt-get install ffmpeg`
  - macOS (brew): `brew install ffmpeg`
- Verify availability: `ffmpeg -version`

## Notes
- No stock media is used.
- All outputs are real files on disk (images, audio, captions, MP4).
- If `OPENAI_API_KEY` is missing, rendering is blocked and plan generation uses template mode.