---
name: TikTok-AI Master Plan (ostateczny)
overview: "Jeden spójny plan budowy i ukończenia TikTok-AI-Agent: stan aplikacji, Sprint 1 (QA + Error Recovery + Export TikTok), Sprint 2 (Autonomy), Sprint 3 (Cost + Analytics + Presets + Script templates), Sprint 4 (Calendar + SEO + audyt). Zgodnie z rekomendacjami Geminiego i audytem."
todos: []
isProject: false
---

# TikTok-AI-Agent – Master Plan (ostateczny)

**Cel:** Jeden jednolity plan do budowy i ukończenia aplikacji. Łączy: plan v2 (Gemini), master dev plan, raport audytu (AUDIT_REPORT.md) oraz aktualny stan kodu.

**Założenie:** Aplikacja = **narzędzie osobiste** (single-user). Bez scrapingu TikTok/competitor; tylko AI Topic Suggestions + ręczne inspiracje.

---

## 1. Uzgodnienia (z planów i audytu)

| Źródło | Decyzja |
|--------|---------|
| **QA przed Batch** | Sprint 1 przed Sprint 2 – QA Validator (cisza, rozmiar, 1080x1920) + status `qa_failed`. Batch bez QA = ryzyko masy wadliwych plików. |
| **Kolejka renderów** | Max **1 render na raz** przy batchu – kolejka w `renderPipeline` (np. `renderQueue`, `currentRunningRunId`). |
| **Cost tracking** | Wdrożyć w Sprint 3 (zaraz po Batch); widoczny „Cost per video” na Output; opcjonalny alert miesięczny. |
| **Error recovery** | **p-retry** dla OpenAI (timeout, 429); checkpoints już są (`resumeStateJson`, `completedSteps`, retry z `fromStep`). |
| **Scraping** | **Pomijamy** – tylko AI Topic Suggestions + ręczne inspiracje. |
| **Audyt – auth/rate limit** | Niski priorytet przy własnym użyciu; dopiero przy udostępnieniu innym. |
| **Audyt – helmet, UUID, język UI** | Ująć w Sprint 4 (poprawki audytu). |

---

## 2. Obecny stan aplikacji (weryfikacja)

### 2.1 Backend

- **Express** (`apps/server/src/index.ts`): CORS (ALLOWED_ORIGINS w prod), JSON 10MB, static `/artifacts` tylko gdy `!isProduction`, SPA fallback. **Brak:** helmet, rate limit, auth.
- **Routes:** `/api/status`, `/api/niche-packs`, `/api/project`, `/api/projects`, `/api/plan`, `/api/scene`, `/api/run`, `/api/test` (dry-run). **Brak:** `/api/automate`, `/api/batch`, `/api/topic-suggestions`, `/api/channel-presets`, `/api/script-templates`.
- **Schema** (`schema.prisma`):
  - **Run:** `status` = queued | running | done | failed | canceled. **Brak:** `qa_failed`, `costJson`, `views`, `likes`, `retention`, `postedAt`, `scheduledPublishAt`, `publishedAt`.
  - **Project:** **Brak:** `seoKeywords`.
  - **PlanVersion:** `estimatesJson`, `validationJson` – obecne.
- **Render pipeline** (`renderPipeline.ts`): Kroki tts_generate → asr_align → images_generate → captions_build → music_build → ffmpeg_render → finalize_artifacts. `resumeStateJson` z `completedSteps`; `activeRuns` Map (cancel). **Brak:** globalna kolejka (max 1 running), QA po finalize, TikTok metadata w export, 3 miniatury (obecnie 1× thumb.png), costJson.
- **FFmpeg** (`ffmpegUtils.ts`): `finalComposite` – crf 20, preset fast, aac 192k. **Brak:** 1080x1920, bitrate 10–15 Mbps, LUFS -14, keyframe co 1 s. `extractThumbnail` – jedna klatka (2 s).
- **OpenAI** (`openai.ts`): callOpenAI, generateImage, generateTTS, transcribeAudio; cache (Prisma). **Brak:** p-retry, zwracanie usage (tokeny).
- **Plan:** planGenerator, planValidator. **Brak:** ostrzeżenie „first scene &lt; 5s / hook w 3s”, jawny prompt „hook in first 3 seconds”, scriptTemplateId, seoKeywords.
- **Serwisy brakujące:** `services/qa/qaValidator.ts`, `services/trends/topicSuggestions.ts`, `services/tiktokExport.ts`, `services/plan/scriptTemplates.ts`.

### 2.2 Frontend

- **Routes** (`App.tsx`): / → /create, /create, /projects, /project/:id/plan, /project/:id/runs, /run/:runId. **Brak:** /analytics, /calendar, widok batch.
- **QuickCreate:** form topic, nichePackId, targetLengthSec, tempo, language, voicePreset → createProject + generatePlan → Plan Studio. **Brak:** „Suggest viral topics”, „Generate & render (no edit)”, preset dropdown, batch textarea.
- **Output:** status, logs, Verify, Download MP4, Export JSON, Duplicate. **Brak:** sekcja TikTok (caption/hashtags/title + Copy), 3 miniatury, status qa_failed, Cost per video.
- **API client:** brak metod: getTopicSuggestions, automateProject, postBatch, getChannelPresets, getScriptTemplates, patchRun (analytics).

### 2.3 Testy

- Backend: api.integration, planValidator.unit, renderDryRun.integration, runSse.integration.
- E2E: plan-preview-dry-run, render-cancel-sse, render-failure-retry, render-queue-dry-run.

---

## 3. Sprint 1: Stabilność i fundamenty jakości (Robustness)

**Cel:** Zanim batch i masowa produkcja – render odporny, plik w standardzie TikTok, wadliwe runy = `qa_failed`.

### 3.1 System QA (Quality Assurance)

- **Nowy serwis** `apps/server/src/services/qa/qaValidator.ts`:
  - Wejście: ścieżka do MP4 (lub runId + odczyt z artifacts).
  - **Sprawdzenia (ffprobe / FFmpeg):**
    1. **Cisza w audio:** `silencedetect` (np. `-af silencedetect=n=-50dB:d=2`) – cisza &gt; 2 s → fail.
    2. **Rozmiar pliku:** &lt; 287 MB (limit TikToka ~4GB, bezpieczny próg).
    3. **Rozdzielczość:** sztywne 1080×1920 (ffprobe width/height).
  - Zwracać: `{ passed, checks: { silence, fileSize, resolution }, details? }`.
- **Integracja** w `renderPipeline.ts`: w `finalize_artifacts`, po wygenerowaniu final.mp4 (tylko gdy `!dryRun`), wywołać qaValidator; jeśli `!passed` → status runu = **qa_failed** (nie done), zapisać wynik QA w artifactsJson. Jeśli passed → jak dotąd status done.
- **Schema:** W `Run.status` dodać wartość `qa_failed`. Migracja.
- **Run routes:** retry dopuszcza też runy w statusie qa_failed.
- **Frontend:** Output.tsx – obsługa statusu qa_failed (komunikat + szczegóły); api/types.ts – RunStatus rozszerzyć o `qa_failed`.

### 3.2 Error Recovery (p-retry + checkpoints)

- **p-retry dla OpenAI:** W `openai.ts` owinąć wywołania (callOpenAI, generateImage, generateTTS, transcribeAudio) w p-retry: retries 3, minTimeout 2s, retry przy 429 lub timeout. Dodać `p-retry` w `apps/server/package.json`.
- **Checkpoints:** Obecna logika (completedSteps, saveResumeState, retryRun z fromStep) zostaje. Opcjonalnie w Output UI: dropdown „Retry from step” przy Retry.

### 3.3 Export standard TikTok + miniatury

- **FFmpeg preset TikTok:** W `ffmpegUtils.ts` w finalComposite (lub finalCompositeTikTok): wymuszenie 1080×1920, 30 fps, bitrate 10–15 Mbps, keyframe co 1 s (`-g 30`), aac 256 kbps, loudnorm -14 LUFS. Tylko w gałęzi `!dryRun`.
- **Miniatury:** W `renderPipeline.ts` finalize_artifacts: generować 3 klatki (offset 0 s, 3 s, połowa długości) → thumb_0.png, thumb_3.png, thumb_mid.png; zapisać ścieżki w artifacts (np. thumbPaths: string[]). W Output.tsx pokazać 3 miniatury z etykietą „Use as cover” (URL przez /api/run/:runId/artifact?path=...).

---

## 4. Sprint 2: Automatyzacja i tryb „Faceless” (Autonomy)

**Cel:** One-click, batch z kolejką (max 1 render), topic suggestions, TikTok metadata, hook 3 s.

### 4.1 One-Click Automate

- **POST /api/automate** (`apps/server/src/routes/automate.ts`): body topic, nichePackId, language?, targetLengthSec?, tempo?, voicePreset? (Zod jak createProjectSchema). Logika: create project → generatePlan → validatePlan (jeśli errors.length &gt; 0 → 400) → approve → wstaw do kolejki renderów (patrz 4.2) lub startRenderPipeline. Zwrot { projectId, planVersionId, runId }.
- **Frontend:** QuickCreate – przycisk „Generate & render (no edit)” → POST /api/automate → redirect /run/:runId. API client: automateProject(body).

### 4.2 Batch + kolejka (max 1 render na raz)

- **POST /api/batch** (`apps/server/src/routes/batch.ts`): body { topics: string[], nichePackId, ... }. Dla każdego topic: create project, generatePlan, validate (opcjonalnie pomiń przy errors), approve, **dodać run do kolejki** (nie uruchamiać N pipeline’ów naraz). Zwrot { runIds: string[] }.
- **Kolejka w renderPipeline:** W `renderPipeline.ts` wprowadzić np. `renderQueue: string[]`, `currentRunningRunId: string | null`. W startRenderPipeline: jeśli już running, dodać runId do kolejki i nie uruchamiać executePipeline; w `finally` po zakończeniu pipeline wyciągnąć następny z kolejki i uruchomić executePipeline. Tylko jeden render równolegle.
- **Frontend:** Sekcja „Batch” w QuickCreate lub osobna strona – textarea (jedna linia = jeden topic), wybór niche → POST /api/batch → przekierowanie na Render Queue z listą runIds.

### 4.3 Topic Suggestions (AI)

- **GET /api/topic-suggestions?nichePackId=facts&limit=10**: nowy route + serwis `apps/server/src/services/trends/topicSuggestions.ts`. Prompt do OpenAI: „Dla niszy [name] podaj N tematów na TikTok o wysokim potencjale wiralowym. Zwróć tylko JSON array of strings.”
- **Frontend:** QuickCreate – przycisk „Suggest viral topics” → lista do wyboru → ustawienie formData.topic.

### 4.4 TikTok Metadata (caption, hashtagi, tytuł)

- Po finalize_artifacts wywołać **generateTikTokMeta** (nowy `apps/server/src/services/tiktokExport.ts`): wejście topic, nichePackId, hookSelected, outline → GPT → { caption, hashtags[], title }. Zapis do export.json (tiktokCaption, tiktokHashtags, tiktokTitle). GET /api/run/:runId/export zwraca te pola.
- **Frontend:** Output – sekcja „TikTok” z caption, hashtagami, tytułem i przyciskami „Copy caption”, „Copy hashtags”, „Copy title”.

### 4.5 Hook 3 s (validator + prompty)

- W `planValidator.ts`: jeśli pierwsza scena ma durationTargetSec &gt; 4 (lub 5), dodać warning „First scene should be under 5s so the hook lands in first 3 seconds”.
- W `planGenerator.ts` w promptach (generateHooks, generateOutline, generateScenes): zdanie „The first scene must contain the hook within the first 3 seconds; first sentence = attention grabber.”

---

## 5. Sprint 3: Inteligencja, koszty, organizacja (Pro)

**Cel:** Cost tracking, Analytics (views/likes ręcznie), Channel presets, Script templates.

### 5.1 Cost Tracking

- W `openai.ts` zwracać usage (prompt_tokens, completion_tokens) z odpowiedzi OpenAI. W `renderPipeline.ts` zbierać tokeny ze wszystkich kroków; na końcu runu zapisać w Run (np. pole `costJson`) lub w artifactsJson: { totalPromptTokens, totalCompletionTokens, estimatedCostUsd }. Szacunek: ceny GPT-4o-mini / DALL-E / TTS za 1K tokenów.
- **Schema:** Run – pole opcjonalne `costJson String?`. Migracja.
- **Frontend:** Output – po done wyświetlić „Cost (est.): $X.XX”. Opcjonalnie: ustawienie miesięcznego budżetu + alert przy przekroczeniu.

### 5.2 Analytics & Metrics (ręczne wpisywanie)

- **Schema:** Run – pola views Int?, likes Int?, retention Float?, postedAt DateTime?. Migracja.
- **Backend:** PATCH /api/run/:runId body { views?, likes?, retention?, postedAt? }. Zod.
- **Frontend:** Nowa strona `apps/web/src/pages/Analytics.tsx`: lista runów z polami do edycji (views, likes, retention, postedAt); zapis; prosty dashboard (suma views, które nisze najlepsze). Route /analytics w App.tsx.

### 5.3 Channel Presets

- Plik `data/channel-presets.json`: `[{ "id": "facts-channel", "name": "Facts channel", "nichePackId": "facts", "voicePreset": "alloy", "targetLengthSec": 60, "tempo": "normal" }, ... ]`.
- **GET /api/channel-presets** (nowy route lub w nichePack). QuickCreate (i form batch): dropdown „Use preset” → ustawienie formData.

### 5.4 Script Templates

- **Serwis** `apps/server/src/services/plan/scriptTemplates.ts`: szablony np. top5, myth_vs_fact, storytime (opis struktury do promptu). W `planGenerator.ts` opcjonalny parametr scriptTemplateId – w promptach „Use this structure: [opis]”.
- **API:** GET /api/script-templates. W POST /api/project i /api/automate opcjonalne pole scriptTemplateId.
- **Frontend:** QuickCreate – opcjonalny dropdown „Script template”.

---

## 6. Sprint 4: Content calendar, SEO, poprawki audytu

### 6.1 Content calendar

- **Schema:** Run – scheduledPublishAt DateTime?, publishedAt DateTime?. Migracja. PATCH /api/run/:runId (scheduledPublishAt). GET /api/runs/upcoming?from=&to=.
- **Frontend:** Strona Calendar/Upcoming – lista runów + date picker, Export CSV (topic, scheduledPublishAt, runId, link).

### 6.2 SEO keywords

- **Schema:** Project – seoKeywords String? (opcjonalnie). createProjectSchema + POST /api/project i /api/automate: seoKeywords optional. W planGenerator (generateOutline, generateScenes): jeśli project.seoKeywords, dopisać do promptu „Include these keywords naturally: [keywords].” QuickCreate: pole „SEO keywords (comma-separated)”.

### 6.3 Poprawki audytu

- **Język UI:** PlanStudio.tsx – „Ostrzeżenia” → „Warnings”.
- **Walidacja UUID:** W run.ts, project.ts, plan.ts – Zod z.string().uuid() dla req.params; 400 przy błędnym.
- **Helmet:** index.ts app.use(helmet()); dependency helmet w package.json.
- **Toast:** react-hot-toast; „Plan saved”, „Render started” w PlanStudio/QuickCreate.
- **npm audit:** Aktualizacja zależności (vite, esbuild) według SECURITY.md.

---

## 7. Postęp (aktualizowane na bieżąco)

| # | Zadanie | Status |
|---|---------|--------|
| 1 | Sprint 1.1: QA Validator (qaValidator.ts, pipeline, status qa_failed) | ✅ Zrobione |
| 2 | Sprint 1.2: p-retry w openai.ts | ✅ Zrobione |
| 3 | Sprint 1.3: FFmpeg TikTok preset + 3 miniatury | ✅ Zrobione |
| 4 | Sprint 2.1: POST /api/automate + QuickCreate one-click | ✅ Zrobione |
| 5 | Sprint 2.2: Kolejka (max 1) + POST /api/batch + UI batch | ✅ Zrobione |
| 6 | Sprint 2.3: Topic suggestions (GET + QuickCreate) | ✅ Zrobione |
| 7 | Sprint 2.4: TikTok metadata (tiktokExport, finalize, Output Copy) | ✅ Zrobione |
| 8–13 | Sprint 2.5–4 | 🔲 Do zrobienia |

---

## 8. Kolejność wdrożenia (dla agenta)

1. **Sprint 1.1** – QA Validator (qaValidator.ts, integracja w pipeline, status qa_failed).
2. **Sprint 1.2** – p-retry w openai.ts; opcjonalnie Retry from step w UI.
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

## 9. Pliki do utworzenia / zmiany

| Plik | Opis |
|------|------|
| apps/server/src/services/qa/qaValidator.ts | QA: cisza, rozmiar, 1080×1920 |
| apps/server/src/services/trends/topicSuggestions.ts | AI topic suggestions |
| apps/server/src/services/tiktokExport.ts | generateTikTokMeta (caption, hashtags, title) |
| apps/server/src/services/plan/scriptTemplates.ts | Szablony top5, myth_vs_fact, storytime |
| apps/server/src/routes/automate.ts | POST /api/automate |
| apps/server/src/routes/batch.ts | POST /api/batch |
| apps/server/src/routes/topicSuggestions.ts | GET /api/topic-suggestions |
| data/channel-presets.json | Presety kanału |
| apps/web/src/pages/Analytics.tsx | Dashboard + edycja views/likes/retention/postedAt |
| apps/web/src/pages/Calendar.tsx (lub Upcoming) | Widok kalendarza, Export CSV |
| **Migracje Prisma** | Run.status + qa_failed; Run: costJson?, views?, likes?, retention?, postedAt?, scheduledPublishAt?, publishedAt?; Project: seoKeywords? |

**Zmiany w istniejących plikach:**  
index.ts (rejestracja route’ów, helmet), renderPipeline.ts (QA, kolejka, finalize + tiktok meta + thumbPaths), ffmpegUtils.ts (TikTok preset, extractThumbnail ×3), openai.ts (p-retry, zwrot usage), planValidator.ts (hook 3s warning), planGenerator.ts (hook 3s prompt, scriptTemplate, seoKeywords), run.ts (export z tiktok polami, PATCH run, retry qa_failed), project.ts (seoKeywords w schema), client.ts (nowe API), QuickCreate.tsx (Suggest topics, One-click, preset, batch), Output.tsx (TikTok Copy, miniatury, qa_failed, Cost), App.tsx (route /analytics, /calendar), api/types.ts (RunStatus qa_failed, Artifacts thumbPaths).

---

## 10. Instrukcje dla agenta

1. Zacznij od analizy stanu: schema.prisma, renderPipeline.ts.
2. Wykonuj Sprint po Sprincie. **Nie przechodź do Sprintu 2, dopóki Sprint 1 nie działa** (QA i retry są krytyczne).
3. Przy zmianie schema.prisma: zawsze `npx prisma migrate dev`.
4. Nowe paczki (p-retry, helmet): sprawdzać wersje w package.json.
5. Nie hardcodować kluczy API; walidacja wejścia (Zod). Aplikacja lokalna – bez auth.

**Rozpocznij od Sprintu 1: System QA (3.1) i Error Recovery (3.2).**

---

## 11. Odniesienia

- **Plan v2 (Gemini):** `tiktok-ai_master_plan_v2_gemini_1c3b4260.plan.md` – kolejność QA przed Batch, cost po batchu, brak scrapingu, kolejka max 1.
- **Master dev plan:** `.cursor/plans/tiktok-ai-master-dev-plan.md` – stan aplikacji, tabele plików.
- **Audyt:** AUDIT_REPORT.md – porównanie z rynkiem, bezpieczeństwo, jakość kodu, UX; tabele „Co naprawić” i „Co dodać”; lista kontrolna.

*Koniec master planu.*
