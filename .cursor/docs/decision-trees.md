# Decision Trees

**Quick reference for common development decisions.**

## "I need to add a new API endpoint"

```
1. Do I need a new route file?
   ├─ YES → Create apps/server/src/routes/<entity>.ts
   └─ NO → Add to existing route file

2. Define Zod schema
   ├─ Reusable? → Add to apps/server/src/utils/apiSchemas.ts
   └─ One-off? → Define inline in route file

3. Add handler
   └─ Use schema.safeParse() on req.body/req.params
   └─ Return 400 with { error, details } on validation failure

4. Register route in apps/server/src/index.ts
   └─ app.use('/api/<entity>', <entity>Routes)

5. Add client function in apps/web/src/api/client.ts

6. Add test
   ├─ Integration: apps/server/tests/api.integration.test.ts
   └─ E2E: apps/web/tests/e2e/<feature>.spec.ts
```

**References:** [.cursor/skills/add-api-endpoint/](../skills/add-api-endpoint/), [.cursor/rules/api-routes.mdc](../rules/api-routes.mdc)

---

## "I want to add a batch workflow or automation feature"

```
1. Review existing implementations
   ├─ Automate route: apps/server/src/routes/automate.ts (one-click workflow)
   └─ Batch route: apps/server/src/routes/batch.ts (multi-video creation)

2. Key patterns to follow
   ├─ Rate limiting: Use express-rate-limit (see batch.ts)
   ├─ Queue protection: Check queue size before accepting
   ├─ Retry logic: Implement plan lookup retries
   └─ Error handling: Comprehensive try/catch with detailed errors

3. Frontend integration
   ├─ QuickCreate.tsx: Single video workflow
   ├─ BatchCreate.tsx: Multi-video workflow
   └─ Use automateProject() or postBatch() from api/client.ts

4. Test in dry-run mode
   └─ APP_RENDER_DRY_RUN=1 to avoid API costs
```

---

## "I need to modify the database schema"

```
1. Edit apps/server/prisma/schema.prisma

2. Create migration
   └─ npm run db:migrate:dev
   └─ Name the migration descriptively

3. Update types
   └─ npm run db:generate (auto-runs on postinstall)

4. Update affected queries
   └─ Add/remove fields in Prisma queries
   └─ Update include/select statements

5. Test
   └─ npm run test
   └─ Check affected services/routes
```

**Warning:** Migrations are irreversible. Test locally first.

---

## "I'm getting a validation error"

```
1. Is it a request body issue?
   ├─ Check Zod schema in apiSchemas.ts or route file
   ├─ Verify request matches schema (use console.log or debugger)
   └─ Check for .strict() - extra fields cause errors

2. Is it a path parameter issue?
   ├─ Check z.string().uuid() for ID params
   └─ Verify actual param is a valid UUID

3. Is it a response validation issue?
   └─ Server returns unexpected structure
   └─ Check API client type definitions
```

---

## "The render pipeline is failing"

```
1. Check Run.status and Run.logsJson
   └─ Use RenderQueue page or GET /api/run/:runId

2. Identify failing step (currentStep field)
   ├─ tts_generate → Check OpenAI TTS API, audio file creation
   ├─ asr_align → Check Whisper transcription, audio file exists
   ├─ images_generate → Check OpenAI DALL-E API, image file creation
   ├─ captions_build → Check ASS subtitle generation, word timing
   ├─ music_build → Check background music file exists
   ├─ ffmpeg_render → Check FFmpeg logs, input files exist, command syntax
   └─ finalize_artifacts → Check final MP4 and thumbnail exist

3. Use dry-run mode for testing
   └─ APP_RENDER_DRY_RUN=1 npm run test:render
   └─ Simulate failures: APP_DRY_RUN_FAIL_STEP=<step>

4. Check verifyArtifacts.ts for post-render validation
```

**References:** [apps/server/src/services/render/renderPipeline.ts](../../apps/server/src/services/render/renderPipeline.ts), [.cursor/skills/debug-render-failure/](../skills/debug-render-failure/)

---

## "Should I create a new service or extend existing?"

```
1. Is the logic domain-specific?
   ├─ Plan generation → services/plan/
   ├─ Rendering → services/render/
   ├─ FFmpeg operations → services/ffmpeg/
   ├─ Captions → services/captions/
   └─ External APIs → services/providers/

2. Is it reusable utility?
   └─ Add to services/utils/ or utils/

3. Is it route-specific logic?
   └─ Keep in route file (small handler logic)
   └─ Extract to service if >50 lines or reusable
```

---

## "I need to add a new React page"

```
1. Create apps/web/src/pages/<PageName>.tsx

2. Add route in apps/web/src/App.tsx
   └─ <Route path="/page-name" element={<PageName />} />

3. Add navigation link if needed
   └─ Update Layout component or nav menu

4. Use API client for data fetching
   └─ Import from api/client.ts
   └─ Handle loading/error states

5. Add E2E test
   └─ apps/web/tests/e2e/<page>.spec.ts
```

---

## "Should I add a new npm package?"

```
1. Is it already in package.json?
   └─ Search package.json in both apps/server and apps/web
   └─ If yes, use existing version

2. Is it necessary?
   ├─ Can existing code/library handle it?
   └─ Will it add significant value?

3. Check for vulnerabilities
   └─ Run: npx npm-audit-resolver check <package>@<version>
   └─ Review GitHub Security Advisories

4. Install in correct workspace
   ├─ Server: npm install <package> -w apps/server
   └─ Web: npm install <package> -w apps/web

5. Test and commit
   └─ npm run test
   └─ npm run typecheck
   └─ Commit package.json AND package-lock.json
```

---

## "How do I debug a failing test?"

```
1. Run single test file
   └─ npm test -- <filename>
   └─ Example: npm test -- planValidator.test.ts

2. Add debug logging
   └─ Use console.log or debug breakpoints
   └─ Check test output for clues

3. Check test mode
   ├─ Unit tests: APP_TEST_MODE=1 (mocked APIs)
   └─ Render tests: APP_RENDER_DRY_RUN=1 (no paid APIs)

4. Verify test data
   └─ Check test fixtures (niche packs, scene data)
   └─ Ensure DB is in expected state (use seed data)

5. Run with coverage
   └─ npm run test:coverage (server only)
   └─ Check coverage reports in coverage/ directory
```

---

## "I need to add analytics or calendar features"

```
1. Review data model (Run model in schema.prisma)
   ├─ Analytics: views, likes, retention fields
   └─ Calendar: scheduledPublishAt, publishedAt fields

2. Backend changes
   ├─ Update run routes if needed (apps/server/src/routes/run.ts)
   ├─ Add validation for new fields
   └─ Consider indexing for performance (scheduledPublishAt index exists)

3. Frontend integration
   ├─ Analytics page: apps/web/src/pages/Analytics.tsx
   ├─ Calendar page: apps/web/src/pages/Calendar.tsx
   └─ Add API client functions in api/client.ts

4. Test with sample data
   └─ Use db:seed to populate test data
```

---

## "I need to update documentation"

```
1. User-facing docs → docs/
   ├─ API reference → docs/api.md
   ├─ Architecture → docs/architecture.md
   ├─ Deployment → docs/deployment.md
   └─ Setup → docs/setup.md

2. AI agent docs → .cursor/docs/
   ├─ Layout → .cursor/docs/project-layout.md
   ├─ Pitfalls → .cursor/docs/common-pitfalls.md
   └─ This file → .cursor/docs/decision-trees.md

3. Quick reference → .cursor/QUICKREF.md (canonical command reference)

4. Agent instructions → AGENTS.md

5. Status/priorities → STATUS.md (automated, edit manual section only)

6. Copilot instructions → .github/copilot-instructions.md
```

**Important:** Do not create new markdown files unless explicitly requested. Update existing docs instead.

**Command Reference:** Always link to [.cursor/QUICKREF.md](.cursor/QUICKREF.md#-commands) for commands instead of duplicating.
