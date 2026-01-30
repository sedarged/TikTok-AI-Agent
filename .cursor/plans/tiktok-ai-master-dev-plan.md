---
name: TikTok-AI Master Dev Plan
overview: "Pełny master plan TikTok-AI-Agent: status aplikacji, Sprint 1 (QA + Error Recovery + Export TikTok), Sprint 2 (Autonomy), Sprint 3 (Cost + Analytics + Presets + Script templates), Sprint 4 (Calendar + SEO + audyt). Zgodnie z rekomendacjami Geminiego: QA przed Batch, Cost tracking wcześnie, bez scrapingu, kolejka max 1 render."
todos: []
isProject: false
---

# Master plan rozwoju TikTok-AI-Agent (pełna wersja)

Plan łączy: audyt (AUDIT_REPORT.md), autonomię i faceless, viral topic discovery, research (TikTok export, hook 3s, batch), rekomendacje Geminiego (QA first, Cost tracking, no scraping, queue). Aplikacja = **narzędzie osobiste** (single-user).

---

## 1. Obecny stan aplikacji (aktualny check)

### 1.1 Backend

- **Express** ([apps/server/src/index.ts](apps/server/src/index.ts)): CORS (ALLOWED_ORIGINS w prod), JSON 10MB, static `/artifacts` tylko gdy `!isProduction`, SPA fallback. **Brak:** helmet, rate limit, auth. Routes: `/api/status`, `/api/niche-packs`, `/api/project`, `/api/projects`, `/api/plan`, `/api/scene`, `/api/run`; `/api/test` gdy dry-run/test.
- **Schema** ([apps/server/prisma/schema.prisma](apps/server/prisma/schema.prisma)): Project (topic, nichePackId, targetLengthSec, tempo, voicePreset, status: DRAFT_PLAN|PLAN_READY|APPROVED|RENDERING|DONE|FAILED), PlanVersion (hookOptionsJson, hookSelected, outline, scriptFull, scenes), Scene (narrationText, visualPrompt, durationTargetSec, effectPreset, isLocked), Run (status: queued|running|done|failed|canceled, artifactsJson, resumeStateJson), Cache (kind, hashKey, payloadPath). **Brak:** qa_failed, views/likes/retention/postedAt, costJson, scheduledPublishAt, seoKeywords na Project.
- **Render pipeline** ([apps/server/src/services/render/renderPipeline.ts](apps/server/src/services/render/renderPipeline.ts)): Kroki tts_generate → asr_align → images_generate → captions_build → music_build → ffmpeg_render → finalize_artifacts. `resumeStateJson` z `completedSteps`; po każdym kroku `saveResumeState`. `activeRuns` Map (cancel); **brak globalnej kolejki** – wiele `startRenderPipeline` może iść równolegle. Finalize: jedna miniatura `thumb.png` (extractThumbnail timeOffset=2), export.json **bez** tiktokCaption/hashtags/title. Status po sukcesie: `done`; **brak** `qa_failed`.
- **FFmpeg** ([apps/server/src/services/ffmpeg/ffmpegUtils.ts](apps/server/src/services/ffmpeg/ffmpegUtils.ts)): `finalComposite` – crf 20, preset fast, aac 192k; **brak** 1080x1920, bitrate 10–15M, LUFS -14, keyframe. `extractThumbnail` – jedna klatka, scale 540:960. **runFfprobe** istnieje (używany w validateVideo).
- **OpenAI** ([apps/server/src/services/providers/openai.ts](apps/server/src/services/providers/openai.ts)): callOpenAI, generateImage, generateTTS, transcribeAudio; cache (Prisma) dla images/TTS/ASR. **Brak:** p-retry przy wywołaniach; **brak** zwracania usage (tokeny) do cost tracking.
- **Plan** ([apps/server/src/services/plan/planGenerator.ts](apps/server/src/services/plan/planGenerator.ts), [planValidator.ts](apps/server/src/services/plan/planValidator.ts)): Hooks, outline, scenes z GPT; walidacja hook/outline/scenes/duration. **Brak:** ostrzeżenia „first scene &lt; 5s / hook w 3s”; **brak** jawnego promptu „hook in first 3 seconds”.
- **Run routes** ([apps/server/src/routes/run.ts](apps/server/src/routes/run.ts)): GET run, SSE stream, POST retry (z optional fromStep), POST cancel, GET verify, GET download (path traversal check), GET artifact?path=, GET export. Export zwraca project/plan/run/artifacts – **bez** tiktokCaption/hashtags/title.
- **Project/Plan routes** ([apps/server/src/routes/project.ts](apps/server/src/routes/project.ts), [plan.ts](apps/server/src/routes/plan.ts)): POST project (Zod createProjectSchema), POST project/:id/plan (generatePlan), POST plan/:id/approve (validatePlan), POST plan/:id/render (validatePlan + startRenderPipeline). **Brak:** POST /api/automate, POST /api/batch, GET /api/topic-suggestions, GET /api/channel-presets, GET /api/script-templates; **brak** walidacji UUID w params.

### 1.2 Frontend

- **Routes** ([apps/web/src/App.tsx](apps/web/src/App.tsx)): / → /create, /create (QuickCreate), /projects (Projects), /project/:projectId/plan (PlanStudio), /project/:projectId/runs (RenderQueue), /run/:runId (Output). **Brak:** /calendar, /analytics, batch view.
- **QuickCreate** ([apps/web/src/pages/QuickCreate.tsx](apps/web/src/pages/QuickCreate.tsx)): form topic, nichePackId, targetLengthSec, tempo, language, voicePreset; submit → createProject + generatePlan + navigate do Plan Studio. **Brak:** „Suggest viral topics”, „Generate & render (no edit)”, channel preset dropdown, batch textarea.
- **Output** ([apps/web/src/pages/Output.tsx](apps/web/src/pages/Output.tsx)): run status, logs, Verify, Download MP4, Export JSON, Duplicate. **Brak:** sekcja TikTok (caption/hashtags/title + Copy), miniatury do wyboru, status qa_failed, Cost per video.
- **API client** ([apps/web/src/api/client.ts](apps/web/src/api/client.ts)): getStatus, getNichePacks, getProject, createProject, generatePlan, getPlanVersion, updatePlanVersion, validatePlan, approvePlan, startRender, getRun, retryRun, cancelRun, verifyRun, getExportData, subscribeToRun. **Brak:** getTopicSuggestions, automateProject, postBatch, getChannelPresets, getScriptTemplates, patchRun (scheduledPublishAt / analytics).

### 1.3 Testy

- **Backend:** api.integration.test.ts, planValidator.unit.test.ts, renderDryRun.integration.test.ts, runSse.integration.test.ts, setup.ts.
- **E2E:** plan-preview-dry-run.spec.ts, render-cancel-sse.spec.ts, render-failure-retry.spec.ts, render-queue-dry-run.spec.ts.

### 1.4 Uzgodnienia z rekomendacji Geminiego

| Rekomendacja | Decyzja |
|--------------|---------|
| Scraping (TikTok/competitor) | **Pomijamy** – tylko AI Topic Suggestions + ręczne inspiracje. |
| QA przed Batch | **Sprint 1 przed Sprint 2** – QA Validator (cisza, rozmiar, rozdzielczość) + status qa_failed. |
| Cost tracking | **Sprint 3** – zaraz po Batch; tokeny per run, cost per video na Output; opcjonalnie alert miesięczny. |
| Kolejka renderów | **Max 1 render na raz** przy batchu – kolejka w renderPipeline. |
| Error recovery | **p-retry** dla OpenAI (timeout, 429); checkpoints już są (resumeStateJson, completedSteps). |

---

## 2. Sprint 1: Stabilność i fundamenty jakości (Robustness)

**Cel:** Zanim batch i masowa produkcja – render odporny, plik w standardzie TikTok, wadliwe runy = qa_failed.

### 2.1 System QA (Quality Assurance)

- **Nowy serwis** [apps/server/src/services/qa/qaValidator.ts](apps/server/src/services/qa/qaValidator.ts): wejście ścieżka do MP4 (lub runId + odczyt z artifacts). Sprawdzenia: (1) **Cisza w audio** – ffmpeg silencedetect (np. `-af silencedetect=n=-50dB:d=2`), fail jeśli cisza &gt; 2 s. (2) **Rozmiar pliku** – &lt; 287 MB. (3) **Rozdzielczość** – ffprobe width/height = 1080x1920. Zwracać `{ passed, checks: { silence, fileSize, resolution }, details? }`.
- **Integracja** w [renderPipeline.ts](apps/server/src/services/render/renderPipeline.ts): w finalize_artifacts, po wygenerowaniu final.mp4 (tylko gdy !dryRun), wywołać qaValidator; jeśli !passed → ustawić status runu na **qa_failed** (nie done), zapisać wynik QA w artifactsJson. Jeśli passed → jak dotąd status done.
- **Schema:** W Run.status dodać wartość `qa_failed`. Migracja.
- **Frontend:** W [Output.tsx](apps/web/src/pages/Output.tsx) obsłużyć status qa_failed (komunikat + szczegóły); [api/types.ts](apps/web/src/api/types.ts) RunStatus rozszerzyć o `qa_failed`.

### 2.2 Error Recovery (p-retry + checkpoints)

- **p-retry dla OpenAI:** W [openai.ts](apps/server/src/services/providers/openai.ts) owinąć wywołania (callOpenAI, generateImage, generateTTS, transcribeAudio) w p-retry: retries 3, minTimeout 2s, retry przy 429 lub timeout. Dodać `p-retry` w [apps/server/package.json](apps/server/package.json).
- **Checkpoints:** Obecna logika (completedSteps, saveResumeState, retryRun z fromStep) zostaje. Opcjonalnie w Output UI: dropdown „Retry from step” przy Retry.

### 2.3 Export standard TikTok + miniatury

- **FFmpeg preset TikTok:** W [ffmpegUtils.ts](apps/server/src/services/ffmpeg/ffmpegUtils.ts) w finalComposite (lub finalCompositeTikTok): wymuszenie 1080x1920, 30 fps, bitrate 10–15 Mbps, `-g 30`, aac 256k, loudnorm -14 LUFS. Tylko w gałęzi !dryRun.
- **Miniatury:** W [renderPipeline.ts](apps/server/src/services/render/renderPipeline.ts) finalize_artifacts: 3 klatki (offset 0, 3, połowa długości) → thumb_0.png, thumb_3.png, thumb_mid.png; w artifacts thumbPaths: string[]. [Output.tsx](apps/web/src/pages/Output.tsx): pokazać 3 miniatury (img z /api/run/:runId/artifact?path=...), etykieta „Use as cover” (UX).

---

## 3. Sprint 2: Automatyzacja i tryb „Faceless” (Autonomy)

**Cel:** One-click, batch z kolejką (max 1 render), topic suggestions, TikTok metadata, hook 3 s.

### 3.1 One-Click Automate

- **POST /api/automate** ([apps/server/src/routes/automate.ts](apps/server/src/routes/automate.ts)): body topic, nichePackId, language?, targetLengthSec?, tempo?, voicePreset? (Zod jak createProjectSchema). Logika: create project → generatePlan → validatePlan (jeśli errors.length &gt; 0 → 400) → approve → **wstaw do kolejki** (patrz 3.2) lub startRenderPipeline. Zwrot { projectId, planVersionId, runId }.
- **Frontend:** W QuickCreate przycisk „Generate & render (no edit)” → POST /api/automate → redirect /run/:runId. [client.ts](apps/web/src/api/client.ts): automateProject(body).

### 3.2 Batch + kolejka (max 1 render na raz)

- **POST /api/batch** ([apps/server/src/routes/batch.ts](apps/server/src/routes/batch.ts)): body { topics: string[], nichePackId, ... }. Dla każdego topic: create project, generatePlan, validate (opcjonalnie pomiń przy errors), approve, **dodać run do kolejki** (nie uruchamiać N pipeline’ów naraz). Zwrot { runIds: string[] }.
- **Kolejka w renderPipeline:** W [renderPipeline.ts](apps/server/src/services/render/renderPipeline.ts) globalna kolejka: np. renderQueue: string[], currentRunningRunId: string | null. W startRenderPipeline: jeśli już running, dodać runId do kolejki; w finally po zakończeniu pipeline wyciągnąć następny z kolejki i uruchomić executePipeline. Tylko jeden render równolegle.

### 3.3 Topic Suggestions (AI)

- **GET /api/topic-suggestions?nichePackId=facts&limit=10** ([apps/server/src/routes/topicSuggestions.ts](apps/server/src/routes/topicSuggestions.ts), [apps/server/src/services/trends/topicSuggestions.ts](apps/server/src/services/trends/topicSuggestions.ts)). Prompt do OpenAI: „Dla niszy [name] podaj N tematów na TikTok o wysokim potencjale wiralowym. Zwróć tylko JSON array of strings.” QuickCreate: przycisk „Suggest viral topics” → lista → wybór ustawia formData.topic.

### 3.4 TikTok Metadata (caption, hashtagi, tytuł)

- Po finalize_artifacts wywołać **generateTikTokMeta** ([apps/server/src/services/tiktokExport.ts](apps/server/src/services/tiktokExport.ts)): topic, nichePackId, hookSelected, outline → GPT → { caption, hashtags[], title }. Zapis do export.json (tiktokCaption, tiktokHashtags, tiktokTitle). GET /api/run/:runId/export zwraca te pola. Output: sekcja „TikTok” + Copy caption / Copy hashtags / Copy title.

### 3.5 Hook 3 s (validator + prompty)

- W [planValidator.ts](apps/server/src/services/plan/planValidator.ts): jeśli pierwsza scena durationTargetSec &gt; 4 (lub 5), warning „First scene should be under 5s so the hook lands in first 3 seconds”.
- W [planGenerator.ts](apps/server/src/services/plan/planGenerator.ts) w promptach (generateHooks, generateOutline, generateScenes): „The first scene must contain the hook within the first 3 seconds; first sentence = attention grabber.”

---

## 4. Sprint 3: Inteligencja, koszty, organizacja (Pro)

**Cel:** Cost tracking, Analytics (views/likes ręcznie), Channel presets, Script templates.

### 4.1 Cost Tracking

- W [openai.ts](apps/server/src/services/providers/openai.ts) zwracać usage (prompt_tokens, completion_tokens) z odpowiedzi OpenAI. W [renderPipeline.ts](apps/server/src/services/render/renderPipeline.ts) zbierać tokeny ze wszystkich kroków; na końcu runu zapisać w Run (np. costJson: string) lub artifactsJson: { totalPromptTokens, totalCompletionTokens, estimatedCostUsd }. Szacunek kosztu: np. cena GPT-4o-mini/DALL-E/TTS za 1K tokenów.
- **Schema:** Run – pole opcjonalne costJson lub rozszerzyć artifactsJson. Migracja.
- **Frontend:** Output – po done wyświetlić „Cost (est.): $X.XX”. Opcjonalnie: ustawienie miesięcznego budżetu + alert przy przekroczeniu.

### 4.2 Analytics & Metrics (ręczne wpisywanie)

- **Schema:** Run – pola views Int?, likes Int?, retention Float?, postedAt DateTime?. Migracja.
- **Backend:** PATCH /api/run/:runId body { views?, likes?, retention?, postedAt? }. Zod.
- **Frontend:** Nowa strona [apps/web/src/pages/Analytics.tsx](apps/web/src/pages/Analytics.tsx): lista runów z polami do edycji (views, likes, retention, postedAt); zapis; prosty dashboard (suma views, które nisze najlepsze). Route /analytics w App.tsx.

### 4.3 Channel Presets

- Plik [data/channel-presets.json](data/channel-presets.json): `[{ "id": "facts-channel", "name": "Facts channel", "nichePackId": "facts", "voicePreset": "alloy", "targetLengthSec": 60, "tempo": "normal" }]`.
- **GET /api/channel-presets** (np. w nichePack lub nowy route). QuickCreate (i batch form): dropdown „Use preset” → ustawienie formData.

### 4.4 Script Templates

- [apps/server/src/services/plan/scriptTemplates.ts](apps/server/src/services/plan/scriptTemplates.ts): szablony np. top5, myth_vs_fact, storytime (opis struktury do promptu). W [planGenerator.ts](apps/server/src/services/plan/planGenerator.ts) opcjonalny parametr scriptTemplateId – w promptach „Use this structure: [opis]”. GET /api/script-templates. QuickCreate: opcjonalny dropdown „Script template”.

---

## 5. Sprint 4: Content calendar, SEO, poprawki audytu

### 5.1 Content calendar

- **Schema:** Run – scheduledPublishAt DateTime?, publishedAt DateTime?. Migracja. PATCH /api/run/:runId (scheduledPublishAt). GET /api/runs/upcoming?from=&to=. Frontend: strona Calendar/Upcoming (lista runów + date picker), Export CSV (topic, scheduledPublishAt, runId, link).

### 5.2 SEO keywords

- **Schema:** Project – seoKeywords String? (opcjonalnie). createProjectSchema + body POST /api/project i /api/automate: seoKeywords optional. W planGenerator (generateOutline, generateScenes): jeśli project.seoKeywords, dopisać do promptu „Include these keywords naturally: [keywords].” QuickCreate: pole „SEO keywords (comma-separated)”.

### 5.3 Poprawki audytu

- **Język UI:** [PlanStudio.tsx](apps/web/src/pages/PlanStudio.tsx) ~linia 58: „Ostrzeżenia” → „Warnings”.
- **Walidacja UUID:** W run.ts, project.ts, plan.ts – Zod z.string().uuid() dla req.params; 400 przy błędnym.
- **Helmet:** index.ts app.use(helmet()); apps/server/package.json dependency helmet.
- **Toast:** react-hot-toast; „Plan saved”, „Render started” w PlanStudio/QuickCreate.
- **npm audit:** Aktualizacja zależności (vite, esbuild) według SECURITY.md.

---

## 6. Opcjonalne / później

- Cron + lista tematów (plik/DB, endpoint /api/cron/next-video z API key).
- i18n (EN lub react-i18next).
- ElevenLabs TTS (env.ELEVENLABS_API_KEY, wybór providera).
- A11y (skip link, live region, role).
- Auth / rate limit (gdy udostępnisz aplikację innym).

---

## 7. Kolejność wdrożenia (dla agenta)

1. **Sprint 1.1** – QA Validator (qaValidator.ts, integracja w pipeline, status qa_failed).
2. **Sprint 1.2** – p-retry w openai.ts; ewent. Retry from step w UI.
3. **Sprint 1.3** – FFmpeg TikTok preset + 3 miniatury.
4. **Sprint 2.1** – POST /api/automate + QuickCreate (one-click).
5. **Sprint 2.2** – Kolejka w renderPipeline (max 1 running) + POST /api/batch + UI batch.
6. **Sprint 2.3** – Topic suggestions (GET + QuickCreate).
7. **Sprint 2.4** – TikTok metadata (tiktokExport, finalize, Output Copy).
8. **Sprint 2.5** – Hook 3 s (validator + prompty).
9. **Sprint 3.1** – Cost tracking (usage w openai, zapis w run, Output).
10. **Sprint 3.2** – Analytics (Run views/likes/retention/postedAt, PATCH, Analytics.tsx).
11. **Sprint 3.3** – Channel presets (plik + GET + QuickCreate).
12. **Sprint 3.4** – Script templates (scriptTemplates.ts, planGenerator, GET + QuickCreate).
13. **Sprint 4** – Calendar, SEO keywords, poprawki audytu.

---

## 8. Pliki do utworzenia / zmiany

| Plik | Opis |
|------|------|
| apps/server/src/services/qa/qaValidator.ts | QA: cisza, rozmiar, 1080x1920 |
| apps/server/src/services/trends/topicSuggestions.ts | AI topic suggestions |
| apps/server/src/services/tiktokExport.ts | generateTikTokMeta (caption, hashtags, title) |
| apps/server/src/services/plan/scriptTemplates.ts | Szablony top5, myth_vs_fact, storytime |
| apps/server/src/routes/topicSuggestions.ts | GET /api/topic-suggestions |
| apps/server/src/routes/automate.ts | POST /api/automate |
| apps/server/src/routes/batch.ts | POST /api/batch |
| data/channel-presets.json | Presety kanału |
| apps/web/src/pages/Analytics.tsx | Dashboard + edycja views/likes/retention/postedAt |
| apps/web/src/pages/Calendar.tsx (lub Upcoming) | Widok kalendarza, Export CSV |
| Migracje Prisma | qa_failed w Run.status; Run: costJson?, views?, likes?, retention?, postedAt?, scheduledPublishAt?, publishedAt?; Project: seoKeywords? |

Zmiany w istniejących plikach: index.ts (rejestracja route’ów), renderPipeline.ts (QA, kolejka, finalize + tiktok meta + thumbPaths), ffmpegUtils.ts (TikTok preset, extractThumbnail wielokrotnie), openai.ts (p-retry, zwrot usage), planValidator.ts (hook 3s warning), planGenerator.ts (hook 3s prompt, scriptTemplate, seoKeywords), run.ts (export z tiktok polami, PATCH run), project.ts (seoKeywords w schema), client.ts (nowe API), QuickCreate.tsx (Suggest topics, One-click, preset, batch), Output.tsx (TikTok Copy, miniatury, qa_failed, Cost), App.tsx (route /analytics, /calendar), api/types.ts (RunStatus qa_failed, Artifacts thumbPaths).

---

## 9. Instrukcje dla agenta

1. Zacznij od analizy stanu: schema.prisma, renderPipeline.ts.
2. Wykonuj Sprint po Sprincie. Nie przechodź do Sprintu 2, dopóki Sprint 1 nie działa (QA i retry są krytyczne).
3. Przy zmianie schema.prisma: zawsze `npx prisma migrate dev`.
4. Nowe paczki (p-retry, helmet): sprawdzać wersje w package.json.
5. Nie hardcodować kluczy API; walidacja wejścia (Zod). Aplikacja lokalna – bez auth.

**Rozpocznij od Sprintu 1: System QA (2.1) i Error Recovery (2.2).**
