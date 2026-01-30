# Pełny audyt aplikacji TikTok-AI-Agent

**Data:** 2026-01-29  
**Zakres:** porównanie z rynkiem, audyt wewnętrzny (architektura, bezpieczeństwo, jakość kodu, UX/a11y), tabele napraw/dodania, lista kontrolna.

**Kontekst:** Aplikacja jest budowana **do własnego użytku** – bez użytkowników zewnętrznych. Priorytety w sekcji „Co naprawić” i „Co dodać” są dostosowane do tego scenariusza: auth, rate limiting i ochrona artifactów przed obcymi są **niskim priorytetem** (opcjonalne), dopóki tylko Ty masz dostęp (localhost / sieć domowa / VPN). Jeśli kiedyś udostępnisz aplikację innym – wtedy auth i rate limit warto podnieść do wysokiego.

---

## 1. PORÓWNANIE Z RYNKIEM

### 1.1 Podobne produkty (3–5)

| Produkt                                | Typ         | Główne funkcje                                                                           |
| -------------------------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| **Mivo**                               | SaaS        | UGC-style TikTok z AI, avatary AI, TTS, lip-sync, brak timeline; target: DTC, e‑commerce |
| **Invideo AI**                         | SaaS        | Skrypt → wideo, voiceover, napisy, muzyka, 50+ języków, avatary, szablony trendów        |
| **Quso.ai (Vidyo)**                    | SaaS        | Długie wideo/skrypt → short-form, auto-caption, jump cuts, zoomy, 4M+ użytkowników       |
| **Creatify AI**                        | SaaS        | Tekst/URL/zasoby → TikTok, 1000+ avatarów AI, batch mode, wiele formatów                 |
| **Short-Video-Maker**                  | Open source | Tekst → wideo pionowe, Kokoro TTS, Whisper.cpp, Pexels B-roll, Remotion, Docker, MCP     |
| **shortform-video-generator** (GitHub) | Open source | Tekst → TikTok/Reels, TikTok TTS, Whisper, kompozycja wideo, napisy                      |

### 1.2 Porównanie feature-by-feature (Oni vs My)

| Cecha                        | Mivo | Invideo     | Quso | Creatify   | Short-Video-Maker | **TikTok-AI-Agent** |
| ---------------------------- | ---- | ----------- | ---- | ---------- | ----------------- | ------------------- |
| Generowanie z tematu/skryptu | ✅   | ✅          | ✅   | ✅         | ✅ (tekst)        | ✅ (topic → plan)   |
| Edycja planu przed renderem  | ❌   | Ograniczona | ❌   | ❌         | ❌                | ✅ (Plan Studio)    |
| AI avatary / talking head    | ✅   | ✅          | ❌   | ✅ (1000+) | ❌                | ❌                  |
| TTS (voice-over)             | ✅   | ✅          | ✅   | ✅         | ✅ (Kokoro)       | ✅ (OpenAI TTS)     |
| Auto-caption / napisy        | ✅   | ✅          | ✅   | ✅         | ✅                | ✅ (Whisper + ASS)  |
| Generowanie obrazów AI       | ❌   | ✅          | ❌   | ✅         | ❌ (Pexels)       | ✅ (DALL-E 3)       |
| Nisze / style predefiniowane | ❌   | Szablony    | ❌   | ❌         | ❌                | ✅ (12 niche packs) |
| Walidacja planu              | ❌   | ❌          | ❌   | ❌         | ❌                | ✅                  |
| Retry / resume renderu       | ❌   | ❌          | ❌   | ❌         | ❌                | ✅                  |
| Dry-run / test bez API       | ❌   | ❌          | ❌   | ❌         | ❌                | ✅                  |
| Self-hosted / open source    | ❌   | ❌          | ❌   | ❌         | ✅                | ✅ (repo)           |
| Batch / wiele wideo          | ✅   | ✅          | ✅   | ✅         | ❌                | ❌ (po jednym)      |
| Multi-język UI               | ?    | ✅          | ?    | ?          | ❌                | ❌ (mieszany PL/EN) |
| Kolejka renderów (UI)        | ?    | ?           | ?    | ?          | ❌                | ✅                  |

### 1.3 Mocne strony TikTok-AI-Agent

- **Plan Studio** – pełna edycja planu (hook, outline, sceny) przed renderem; brak tego u większości konkurentów.
- **12 niche packs** – gotowe style (horror, facts, motivation, story, top5, finance, health, history, gaming, science, mystery, product).
- **Retry/resume** – pipeline idempotentny, wznowienie od ostatniego kroku.
- **Dry-run i test mode** – rozwój i CI bez kluczy API i FFmpeg.
- **Open source** – self-hosted, kontrola kosztów i danych.
- **Walidacja planu** – błędy/ostrzeżenia/sugestie przed renderem.
- **Cache** – Prisma Cache dla TTS, ASR, obrazów (mniej wywołań API).

### 1.4 Luki (vs rynek)

- **Brak AI avatarów** – Mivo/Invideo/Creatify oferują talking head; u nas tylko voice-over + obrazy.
- **Brak batch** – jeden render na akcję; brak „wygeneruj N wideo z listy”.
- **Brak cennika / planów** – aplikacja bez monetyzacji; konkurenci SaaS mają plany.
- **Język UI** – mieszany (np. „Ostrzeżenia” w PL, reszta w EN); brak i18n.
- **Brak ElevenLabs** – w .env jest ELEVENLABS_API_KEY, ale „not yet implemented” (README).
- **Mobile** – brak dedykowanego responsive/UX pod telefon (README wspomina Codespaces do testów z telefonu).

---

## 2. AUDYT WEWNĘTRZNY

### 2.1 Architektura

| Obszar       | Stan                                             | Szczegóły                                                                                                                                                                                          |
| ------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Backend**  | Express + TypeScript, jedna aplikacja (monolit). | `apps/server/src/index.ts` – CORS, JSON 10MB, static artifacts tylko w dev/test, API routes, SPA fallback.                                                                                         |
| **Frontend** | React + Vite + TS + Tailwind.                    | `apps/web/src` – App, Layout, strony: QuickCreate, PlanStudio, Projects, RenderQueue, Output.                                                                                                      |
| **Baza**     | SQLite + Prisma.                                 | `apps/server/prisma/schema.prisma` – Project, PlanVersion, Scene, Run, Cache. Produkcja: zalecany PostgreSQL (README, SECURITY.md).                                                                |
| **Kolejki**  | Brak zewnętrznej kolejki.                        | Render w procesie: `activeRuns` Map w `renderPipeline.ts`; nowe renderowanie tworzy Run w DB i uruchamia pipeline w tle. Brak Bull/Redis – równoległe renderowanie ograniczone do jednego procesu. |
| **Cache**    | Prisma (tabela Cache).                           | `apps/server/src/services/providers/openai.ts` – getCachedResult/cacheResult dla TTS, obrazów, ASR (hashKey). Brak Redis/memcache.                                                                 |

### 2.2 Bezpieczeństwo

_Przy własnym użyciu (localhost / sieć domowa) brak auth i rate limitu jest akceptowalny; SECURITY.md opisuje zalecenia na wypadek udostępnienia aplikacji innym._

| Obszar                          | Stan                 | Odniesienie                                                                                                                                                                                                                                                                                      |
| ------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Auth**                        | Brak.                | Nie ma logowania ani middleware auth. Wszystkie endpointy API i pliki są dostępne bez uwierzytelnienia. SECURITY.md zaleca auth dla artifactów (istotne dopiero przy wielu użytkownikach).                                                                                                       |
| **Rate limit**                  | Brak.                | Nie ma express-rate-limit ani innego limitera. SECURITY.md (linie 52–62) zaleca np. 100 req/15 min na /api/ (istotne dopiero przy udostępnieniu innym).                                                                                                                                          |
| **CORS**                        | Skonfigurowane.      | `index.ts` 54–83: development – wszystkie origin; production – whitelist ALLOWED_ORIGINS; ostrzeżenie przy braku ALLOWED_ORIGINS.                                                                                                                                                                |
| **Nagłówki bezpieczeństwa**     | Brak.                | Brak helmet.js. SECURITY.md (linie 64–68) zaleca `app.use(helmet())`.                                                                                                                                                                                                                            |
| **Dostęp do plików/artefaktów** | Częściowo.           | W produkcji `/artifacts` static jest wyłączony (`!isProduction`). Pobieranie: `GET /api/run/:runId/download` – path traversal sprawdzany (run.ts 272–280). `GET /api/run/:runId/artifact?path=...` – walidacja `..` i prefix runu (run.ts 294–333). Brak auth – kto zna runId, może pobrać plik. |
| **Zalecenia SECURITY.md**       | Częściowo spełnione. | Spełnione: CORS, walidacja Zod, path traversal przy download/artifact. Niespełnione: auth na artifacty, rate limit, helmet, HTTPS (po stronie reverse proxy).                                                                                                                                    |

### 2.3 Jakość kodu

| Obszar                   | Stan                        | Szczegóły                                                                                                                                                                                                                                         |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Testy jednostkowe**    | Tak (ograniczone).          | `apps/server/tests/planValidator.unit.test.ts` – walidator planu. Brak unitów dla np. ffmpegUtils, captionsBuilder, planGenerator.                                                                                                                |
| **Testy integracyjne**   | Tak.                        | `api.integration.test.ts` – projekt, plan, update, run; `renderDryRun.integration.test.ts` – pipeline dry-run; `runSse.integration.test.ts` – SSE. Użycie Zod do parsowania odpowiedzi.                                                           |
| **Testy E2E**            | Tak.                        | Playwright: `plan-preview-dry-run.spec.ts`, `render-cancel-sse.spec.ts`, `render-failure-retry.spec.ts`, `render-queue-dry-run.spec.ts`. CI: `ci.yml` – backend, render dry-run, Windows, E2E.                                                    |
| **Obsługa błędów**       | Spójna.                     | Backend: try/catch, 4xx/5xx, komunikaty w JSON. Frontend: `getErrorMessage()` (utils/errors.ts), setError w stronach. Brak globalnego toast/notyfikacji – błędy w miejscu (np. pod formularzem).                                                  |
| **Walidacja wejścia**    | Zod na wybranych route’ach. | project.ts: createProjectSchema; plan.ts: planUpdateSchema, sceneUpdateSchema; scene.ts: sceneUpdateSchema, sceneLockSchema; test.ts: dryRunConfigSchema. Brak jawnych schematów dla parametrów URL (np. runId, projectId) – używane jako string. |
| **Spójność nazewnictwa** | OK.                         | API: /api/project, /api/plan, /api/scene, /api/run, /api/status, /api/niche-packs. Pliki: routes odpowiadają zasobom.                                                                                                                             |
| **Język UI**             | Niespójny.                  | Większość EN (Create, Cancel, Download, Loading…). Wyjątek: „Ostrzeżenia” w PlanStudio.tsx (linia 58) – PL. Brak i18n.                                                                                                                            |

### 2.4 UX i a11y

| Obszar                             | Stan                     | Szczegóły                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flow użytkownika**               | Jasny.                   | Create → Plan Studio (edycja) → Validate → Approve & Render → Render Queue / Output → Download. Breadcrumbs w Layout.                                                                                                                  |
| **Mobile**                         | Nie zoptymalizowane.     | Layout ma menu mobilne (hamburger, aria-label="Menu"), ale brak wyraźnego responsive audit; README poleca Codespaces do testów z telefonu.                                                                                             |
| **Dostępność (aria, role, focus)** | Minimalna.               | aria-label na menu (Layout.tsx 148), „Scene menu” (PlanStudio.tsx 836), aria-hidden na overlay (Layout 162). Focus style w index.css (outline, ring). Brak role na custom kontrolek, brak skip link, brak live region dla SSE/statusu. |
| **Feedback (błędy/sukces)**        | Błędy tak, sukces słabo. | Błędy: setError + wyświetlenie w UI (QuickCreate, PlanStudio, RenderQueue, Output, Projects). Sukces: brak toastów; po udanym renderze – przycisk „Download MP4” i stan done. Brak wyraźnego „Plan saved” / „Render started”.          |

---

## 3. WYJŚCIE

### 3.1 Tabela: Co naprawić (bugi, security, tech debt)

_Priorytety przy założeniu: tylko Ty używasz aplikacji (localhost / własna sieć)._

| #   | Element                                | Priorytet                                  | Opis                                                                      | Plik / linia (gdzie możliwe)                       |
| --- | -------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | Brak uwierzytelnienia                  | **Niski** (opcjonalne przy własnym użyciu) | API i artifacty bez auth; istotne dopiero przy udostępnieniu innym.       | SECURITY.md; index.ts (brak middleware)            |
| 2   | Brak rate limitingu                    | **Niski** (opcjonalne przy własnym użyciu) | Przy jednym użytkowniku ryzyko nadużyć minimalne.                         | index.ts; SECURITY.md 52–62                        |
| 3   | Brak nagłówków bezpieczeństwa (helmet) | Średni                                     | Dobra praktyka (XSS, clickjacking); nie blokujące przy localhost.         | index.ts; SECURITY.md 64–68                        |
| 4   | Dostęp do download/artifact bez auth   | **Niski** (opcjonalne przy własnym użyciu) | Znany runId = pobranie; problem tylko gdy ktoś inny ma dostęp do sieci.   | apps/server/src/routes/run.ts 236–333              |
| 5   | Mieszany język UI (PL/EN)              | Średni                                     | „Ostrzeżenia” vs reszta EN; mylące.                                       | apps/web/src/pages/PlanStudio.tsx 58               |
| 6   | Brak walidacji runId/projectId (UUID)  | Średni                                     | Parametry z URL bez Zod; ładniejsze 400 przy złych ID.                    | run.ts (req.params.runId), project.ts (req.params) |
| 7   | Zależności z lukami (vite, esbuild)    | Średni                                     | SECURITY.md: vite@5.1.6, esbuild – moderate (gł. dev).                    | package-lock / npm audit                           |
| 8   | Brak globalnego feedbacku sukcesu      | Niski                                      | Np. „Plan saved”, „Render started” – tylko błędy są wyraźne.              | apps/web/src/pages/\*.tsx                          |
| 9   | Ograniczona a11y (role, live regions)  | Niski                                      | Brak role, brak live region dla postępu renderu.                          | PlanStudio.tsx, Output.tsx, Layout.tsx             |
| 10  | Render w jednym procesie               | Niski                                      | Przy własnym użyciu zwykle wystarczy; kolejka na później, jeśli potrzeba. | apps/server/src/services/render/renderPipeline.ts  |

### 3.2 Tabela: Co dodać (funkcje, infrastruktura)

_Przy własnym użyciu: auth i rate limit nie są pilne._

| #   | Element                                        | Priorytet                                    | Uzasadnienie                                                    | Sugerowane miejsce                          |
| --- | ---------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| 1   | Auth (JWT/session) + ochrona /api i artifactów | **Niski** (dopiero przy udostępnieniu innym) | SECURITY.md; na teraz zbędne.                                   | Nowy middleware; index.ts, run.ts           |
| 2   | Rate limiting (express-rate-limit)             | **Niski** (dopiero przy udostępnieniu innym) | Przy jednym użytkowniku zbędne.                                 | index.ts przed routes                       |
| 3   | Helmet (security headers)                      | Średni                                       | Dobra praktyka; mały nakład.                                    | index.ts                                    |
| 4   | i18n (jedno źródło prawdy, EN/PL)              | Średni                                       | Spójny język UI; na szybko: zamiana „Ostrzeżenia” → „Warnings”. | apps/web (react-i18next lub pliki JSON)     |
| 5   | ElevenLabs TTS (wspomniane w .env)             | Średni                                       | Lepsza jakość głosu; już placeholder w env.                     | apps/server env.ts, services/providers      |
| 6   | Batch render (N wideo z listy tematów)         | Średni                                       | Wygodne przy wielu tematach; opcjonalne.                        | Nowe endpointy/UI; renderPipeline (kolejka) |
| 7   | Toast/notyfikacje (sukces + błąd)              | Średni                                       | Lepszy feedback; „Plan saved”, „Render started”.                | apps/web (np. react-hot-toast)              |
| 8   | Walidacja UUID dla :runId, :projectId          | Średni                                       | Czystsze błędy przy złych linkach.                              | routes: Zod schema dla params               |
| 9   | Skip link + live region dla postępu            | Niski                                        | Lepsza a11y.                                                    | Layout.tsx, Output.tsx                      |
| 10  | Redis (lub inna kolejka) dla renderów          | Niski                                        | Przy własnym użyciu zwykle niepotrzebne.                        | Opcjonalnie; renderPipeline                 |

### 3.3 Lista kontrolna (checkboxy) przy wdrażaniu

**Dla własnego użytku (localhost / sieć domowa):**

- [ ] **CORS:** Przy zdalnym dostępie ustawić `ALLOWED_ORIGINS` (np. przy deployu).
- [ ] **Baza:** Przy deployu ustawić `DATABASE_URL`; lokalnie SQLite wystarczy.
- [ ] **Język UI:** Ujednolicić (np. „Ostrzeżenia” → „Warnings” w PlanStudio.tsx:58).
- [ ] **Walidacja parametrów:** Opcjonalnie – Zod dla `req.params` (runId, projectId itd.).
- [ ] **npm audit:** Od czasu do czasu `npm audit` i aktualizacje zależności.
- [ ] **Helmet:** Opcjonalnie – `app.use(helmet())` w index.ts (dobra praktyka).

**Dopiero gdy udostępnisz aplikację innym użytkownikom:**

- [ ] **Auth:** Dodać uwierzytelnianie i chronić `/api` oraz download/artifact.
- [ ] **Rate limit:** Dodać limiter na `/api` (np. express-rate-limit).
- [ ] **HTTPS:** Wymusić HTTPS (reverse proxy / hosting).
- [ ] **Artifacts:** Nie serwować `/artifacts` static; tylko `/api/run/:id/download` (i ewent. artifact) z auth.
- [ ] **Backupy:** Automatyczne backupy bazy.
- [ ] **Monitoring:** Logi i alerty (opcjonalnie).

### 3.4 Konkretne odwołania do plików i linii

| Temat                               | Plik                                         | Linie / fragment                                            |
| ----------------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| CORS                                | apps/server/src/index.ts                     | 54–83                                                       |
| Static artifacts tylko dev/test     | apps/server/src/index.ts                     | 86–90                                                       |
| Brak rate limit / helmet            | apps/server/src/index.ts                     | (brak – dodać)                                              |
| Download run – path traversal check | apps/server/src/routes/run.ts                | 272–280                                                     |
| Serve artifact – walidacja path     | apps/server/src/routes/run.ts                | 294–333                                                     |
| Zod: create project                 | apps/server/src/routes/project.ts            | 10–17, 46                                                   |
| Zod: plan update                    | apps/server/src/routes/plan.ts               | 12–27, 57                                                   |
| „Ostrzeżenia” (PL)                  | apps/web/src/pages/PlanStudio.tsx            | 58                                                          |
| aria-label menu                     | apps/web/src/components/Layout.tsx           | 148                                                         |
| aria-label Scene menu               | apps/web/src/pages/PlanStudio.tsx            | 836                                                         |
| getErrorMessage                     | apps/web/src/utils/errors.ts                 | 1–9                                                         |
| Cache TTS/images/ASR                | apps/server/src/services/providers/openai.ts | 62–68, 105–106, 119–124, 147–148, 159–165, 189–190, 195–231 |
| SECURITY.md zalecenia               | SECURITY.md                                  | 40–68, 117–134                                              |

---

## 4. Walidacja repozytorium (run 2026-01-30)

Przebieg: lint, typecheck, format, test, test:render, test:e2e.

| Krok                   | Wynik    | Uwagi                                                                                   |
| ---------------------- | -------- | --------------------------------------------------------------------------------------- |
| `npm run lint`         | **ok**   | ESLint bez błędów.                                                                      |
| `npm run typecheck`    | **ok**   | TypeScript (server + web) bez błędów.                                                   |
| `npm run format:check` | **ok**   | Po `npm run format` – Prettier OK (25 plików poprawionych w tej sesji).                 |
| `npm run test`         | **fail** | EPERM przy `prisma generate` (Windows: rename query_engine DLL). Testy nie uruchomione. |
| `npm run test:render`  | **fail** | Ten sam EPERM przy `prisma generate`.                                                   |
| `npm run test:e2e`     | **fail** | Port 5173 zajęty (dev już działa) – Playwright nie startuje webServer.                  |

**Audit: fail** – kroki niezaliczone: test, test:render, test:e2e.

**Naprawy wprowadzone po audicie:**

- **test / test:render (EPERM):** Dodane skrypty `test:only` i `test:render:only` – pomijają `prisma generate`, uruchamiają tylko migrate + vitest. Użycie po co najmniej jednym udanym `npx prisma generate` (np. w osobnym terminalu). Zob. TESTING_GUIDE §6 (Windows EPERM).
- **test:e2e (port zajęty):** W Playwright ustawione `reuseExistingServer: process.env.CI !== 'true'` – lokalnie E2E korzysta z już działającego serwera na 5173; w CI uruchamiany jest nowy serwer.
- **TESTING_GUIDE:** Dopisane §6 (Windows EPERM, test:only, test:render:only) oraz informacja o reuseExistingServer dla E2E.

**Weryfikacja po naprawach:** `npm run test:only` – 20 testów OK; `npm run test:render:only` – 4 testy OK. E2E wymagają `npx playwright install` (brak przeglądarek w środowisku).

### Środowisko

- **Windows**, Node (wersja z PATH). Znany problem: `prisma generate` może rzucać EPERM przy podmianie `query_engine-windows.dll.node` (antywirus / inny proces / Node 24). Rozwiązanie: zamknąć inne procesy używające repo, uruchomić terminal jako Administrator, albo użyć Node 20 LTS; przed testami wykonać `npx prisma generate` raz w czystym terminalu.
- **E2E:** Przy już działającym `npm run dev` uruchomić E2E z `reuseExistingServer: true` albo zatrzymać dev i dać `npm run test:e2e` (Playwright sam startuje serwer).

### Pliki testowe w repo

**Backend (Vitest):**

- `apps/server/tests/api.integration.test.ts` – API (project, plan, run)
- `apps/server/tests/planValidator.unit.test.ts` – walidator planu
- `apps/server/tests/ffmpegUtils.unit.test.ts` – ffmpeg utils
- `apps/server/tests/renderDryRun.integration.test.ts` – pipeline dry-run
- `apps/server/tests/runSse.integration.test.ts` – SSE run
- `apps/server/tests/setup.ts` – setup testów

**Frontend (Vitest):**

- `apps/web/src/utils/errors.test.ts` – getErrorMessage
- `apps/web/src/test/setup.ts` – setup

**E2E (Playwright):**

- `apps/web/tests/e2e/plan-preview-dry-run.spec.ts`
- `apps/web/tests/e2e/render-queue-dry-run.spec.ts`
- `apps/web/tests/e2e/render-cancel-sse.spec.ts`
- `apps/web/tests/e2e/render-failure-retry.spec.ts`
- `apps/web/tests/e2e/analytics.spec.ts`
- `apps/web/tests/e2e/calendar.spec.ts`

---

_Koniec raportu audytu._
