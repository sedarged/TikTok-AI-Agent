# TikTok AI

Personal-use, single-user web app that generates TikTok-style vertical videos end-to-end:

Topic → **Plan & Preview (editable)** → **Approve & Render** → real `.mp4` + real artifacts on disk.

## Requirements

- Node.js 20+ (this repo works on Node 22)
- FFmpeg + FFprobe available either via:
  - `ffmpeg-static` (preferred, included), or
  - system `ffmpeg`/`ffprobe`
- OpenAI API key for full rendering (TTS, images, Whisper)

## Setup

```bash
cp .env.example .env
```

Edit `.env` and set:

- `OPENAI_API_KEY=...` (**required for rendering**)

Install dependencies:

```bash
npm install
cd apps/server && npm install
cd ../web && npm install
```

Initialize DB (SQLite + Prisma) and seed niche packs:

```bash
npm run db:migrate
npm run db:seed
```

## Run dev

```bash
npm run dev
```

- Web: `http://localhost:5173`
- Server: `http://localhost:5179`

## Render a 60s Facts video (end-to-end)

1. Open the web app.
2. In **Quick Create**:
   - Niche Pack: **Facts**
   - Target length: **60**
   - Enter any topic (e.g. “3 surprising facts about sleep”)
   - Click **Generate Plan**
3. In **Plan & Preview Studio**:
   - Fix validation errors (if any)
   - Click **Approve & Render**
4. In **Render Queue**:
   - Click **Start Render**
5. In **Output**:
   - Click **Verify Artifacts** (Output only counts as “Ready” after PASS)
   - Click **Download MP4**

## Artifacts on disk

Artifacts are written to:

`./artifacts/{projectId}/{runId}/`

Including:

- `images/scene_XX.png`
- `audio/scene_XX.wav`, `audio/vo_full.wav`
- `captions/timestamps.json`, `captions/captions.ass`
- `final/final.mp4`, `final/thumb.png`, `final/export.json`

## Troubleshooting FFmpeg

- If the UI shows **FFmpeg: not available**, rendering is blocked until FFmpeg is available.
- Try installing system FFmpeg:

```bash
sudo apt-get update && sudo apt-get install -y ffmpeg
```

Or rely on the included `ffmpeg-static` dependency.
