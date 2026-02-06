# Quick Start: Testing with Your OpenAI API Key

**Status:** ✅ App is ready - just add your API key!

## What's Been Done ✅

All infrastructure is set up and tested:

```
✅ FFmpeg 6.1.1 installed
✅ Node.js 24.13.0 ready
✅ 624 dependencies installed
✅ Database with 7 migrations
✅ All 124 tests passing
✅ Server starts without errors
✅ API endpoints working
```

## What You Need 🔑

Just one thing: **Your OpenAI API key**

Get it here: https://platform.openai.com/api-keys

## Three Ways to Test

### 🚀 Fastest: Run Locally (5 minutes)

```bash
# 1. Clone the repo
git clone https://github.com/sedarged/TikTok-AI-Agent.git
cd TikTok-AI-Agent

# 2. Install (auto-runs migrations)
npm install

# 3. Add your API key
echo "OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE" >> .env

# 4. Run the test
npm run dev &
sleep 10
./scripts/test-full-app.sh
```

**Result:** Complete E2E test in ~5 minutes, costs ~$0.50

### ☁️ Easiest: GitHub Codespaces (no local setup)

1. Open this repo in GitHub Codespaces
2. Run: `echo "OPENAI_API_KEY=sk-proj-YOUR_KEY" >> .env`
3. Run: `npm install && ./scripts/test-full-app.sh`

**Result:** Cloud-based testing, free tier available

### 🤖 CI/CD: Update Workflow

Add to `.github/workflows/ci.yml`:

```yaml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Then re-run the workflow.

## What the Test Does

The automated script tests the complete flow:

```
1. Check server health          ✓
2. Verify OpenAI API key        ✓
3. Create test project          ✓
4. Generate AI plan (GPT-4)     ~15s
5. Validate plan                ✓
6. Approve plan                 ✓
7. Render video (7 steps):
   - TTS Generate               ~10s
   - ASR Align                  ~5s
   - Images Generate (DALL-E)   ~30s
   - Captions Build             ~2s
   - Music Build                ~3s
   - FFmpeg Render              ~45s
   - Finalize Artifacts         ~2s
8. Verify MP4 created           ✓
9. Test download                ✓

Total: ~3 minutes, ~$0.50
```

## Expected Output

When successful, you'll see:

```
========================================
Test Summary
========================================

✓ All tests passed!

ℹ Project ID: abc-123-def-456
ℹ Plan Version ID: xyz-789
ℹ Run ID: run-456-789

ℹ Plan Generation Time: 18s
ℹ Render Time: 156s
ℹ Total Time: 174s

ℹ Download video: curl -O 'http://localhost:3001/api/run/...'

ℹ Estimated cost: ~$0.50

✓ Full app test completed successfully! 🎉
```

## Files Created

During testing, these artifacts will be created:

```
artifacts/
└── run-{id}/
    ├── video.mp4           # Final rendered video (9:16, 1080x1920)
    ├── thumbnail.jpg       # Extracted thumbnail
    ├── captions.ass        # Synchronized subtitles
    ├── export.json         # Metadata
    ├── audio/
    │   ├── scene-0.mp3
    │   ├── scene-1.mp3
    │   └── ...
    └── images/
        ├── scene-0.png
        ├── scene-1.png
        └── ...
```

## Cost Breakdown

For a 60-second video:

- GPT-4 (plan): $0.15
- DALL-E 3 (10 images): $0.40
- TTS (narration): $0.015
- Whisper (captions): $0.006
- **Total: ~$0.57**

## Troubleshooting

### "OpenAI API key not configured"
- Check: `cat .env | grep OPENAI`
- Verify format: `sk-proj-...` or `sk-...`
- Restart: `npm run dev`

### "Insufficient quota"
- Check: https://platform.openai.com/usage
- Add credits to your account

### "Test script not found"
- Make executable: `chmod +x scripts/test-full-app.sh`
- Or run: `bash scripts/test-full-app.sh`

## Need Help?

- 📖 Full documentation: `OPENAI_API_KEY_TESTING_INSTRUCTIONS.md`
- 📊 Test report: `FULL_APP_TEST_REPORT.md`
- 📋 Summary: `TEST_RESULTS_SUMMARY.md`
- 💬 Issues: https://github.com/sedarged/TikTok-AI-Agent/issues

## Ready? Let's Go! 🚀

```bash
git clone https://github.com/sedarged/TikTok-AI-Agent.git
cd TikTok-AI-Agent
npm install
echo "OPENAI_API_KEY=sk-proj-YOUR_KEY" >> .env
./scripts/test-full-app.sh
```

That's it! The script will handle everything else.
