---
name: ""
overview: ""
todos: []
isProject: false
---

# Plan: Aplikacja w 100% skończona

**Cel:** Aplikacja ma być **w pełni skończona** – nie tylko działająca, ale dokończona: bez półśrodków, bez otwartych punktów w ramach obecnego zakresu.

---

## Funkcjonalna vs skończona

- **Funkcjonalna** = działa: flow się wykonują, nie ma crashy, użytkownik może zrobić to, co ma zrobić.
- **Skończona** = wszystko w ramach zakresu jest **dokończone**: checklisty zaktualizowane, konfiguracja (np. .env.example) na miejscu, API spójne (Zod wszędzie gdzie trzeba), testy E2E dla głównych stron, UX kompletny (brak brakujących przycisków/opcji), znane bugi naprawione, dokumentacja/procedury dopisane. Żadnego „zostawiamy na później” w obrębie tego, co już jest w produkcie.

Opcjonalne (auth, rate limit, ElevenLabs itd.) = **poza** obecnym zakresem „skończonej” aplikacji; gdy je dodasz, znowu trzeba je dokończyć, żeby uznać całość za skończoną.

---

## 1. Checklist i konfiguracja (żeby wszystko dało się uruchomić)


| #   | Zadanie                                                                                                                                                                                                                                                   | Dlaczego                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1.1 | **F4 → ✅** W [DEVELOPMENT_MASTER_PLAN.md](../DEVELOPMENT_MASTER_PLAN.md) ustawić F4 na ✅ i dopisać notatkę (Calendar, SEO, audit).                                                                                                                        | Oznaczenie, że te funkcje są gotowe.                                  |
| 1.2 | **G3 – .env.example** Utworzyć `.env.example` w root z wszystkimi zmiennymi z [env.ts](../apps/server/src/env.ts) + `ALLOWED_ORIGINS` (użyte w [index.ts](../apps/server/src/index.ts)). Przy każdej nowej zmiennej w env dopisywać ją do `.env.example`. | Aplikacja musi dać się poprawnie skonfigurować na czystym środowisku. |


---

## 2. API – spójna walidacja (żeby żaden endpoint nie łamał reguł)


| #   | Zadanie                                                                                                                                                                                                                                                                                                       | Dlaczego                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 2.1 | **Zod dla body retry** W [run.ts](../apps/server/src/routes/run.ts) dla `POST /:runId/retry`: dodać schemat Zod (np. `fromStep: z.string().max(64).optional()`), `safeParse(req.body)`, przy błędzie 400 + details.                                                                                           | Spójność z resztą API; brak „gołego” `req.body`.                     |
| 2.2 | **Batch przy błędzie walidacji** W [batch.ts](../apps/server/src/routes/batch.ts) ustalić i wdrożyć jedną strategię: **(a)** fail-fast + jasny opis w kodzie/doc (że przy 400 część runów mogła już trafić do kolejki), albo **(b)** skip invalid (pomijać topic z błędem, zwracać runIds tylko dla udanych). | Jednoznaczne zachowanie; użytkownik wie, co się dzieje przy błędzie. |


---

## 3. Testy E2E – pokrycie i stabilność


| #   | Zadanie                                                                                                                                                                                | Dlaczego                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 3.1 | **E2E Analytics** Dodać [analytics.spec.ts](../apps/web/tests/e2e/) – wejście na `/analytics`, ładowanie listy, Total views, opcjonalnie edycja i zapis.                               | Potwierdzenie, że strona Analytics działa.           |
| 3.2 | **E2E Calendar** Dodać [calendar.spec.ts](../apps/web/tests/e2e/) – wejście na `/calendar`, from/to, lista upcoming, Export CSV.                                                       | Potwierdzenie, że Calendar i eksport działają.       |
| 3.3 | **Stabilność E2E** W flaky testach (np. render-failure-retry, render-queue) zastąpić ślepe `sleep` przez `expect` na stabilne stany; opisać w [TESTING_GUIDE.md](../TESTING_GUIDE.md). | Żeby E2E nie były „czasem zielone, czasem czerwone”. |


---

## 4. UX – wszystko, co użytkownik widzi, ma działać


| #   | Zadanie                                                                                                                                                                                                                                                                                                                                         | Dlaczego                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 4.1 | **Retry from step w UI** W [Output.tsx](../apps/web/src/pages/Output.tsx): przy Retry (qa_failed i **failed**) dodać opcjonalny dropdown „Retry from step” z listą kroków (tts_generate, asr_align, …); przekazywać `fromStep` do `retryRun(runId, fromStep)`. Dla stanu **failed** dodać przycisk Retry (obecnie tylko „Back to Plan Studio”). | Backend już obsługuje fromStep; UI ma to udostępniać.        |
| 4.2 | **Batch: seoKeywords + scriptTemplateId** Rozszerzyć [batch.ts](../apps/server/src/routes/batch.ts) (schema + logika) i [QuickCreate](../apps/web/src/pages/QuickCreate.tsx) (sekcja batch) + [client.ts](../apps/web/src/api/client.ts) (postBatch) o `seoKeywords` i `scriptTemplateId`.                                                      | Batch ma być równie kompletny co pojedynczy Create/Automate. |
| 4.3 | **regenerateOutline + SEO** Zweryfikować: [regenerateOutline](../apps/server/src/services/plan/planGenerator.ts) dostaje `planVersion.project` z Prisma (include project: true), więc `project.seoKeywords` jest dostępne w `generateOutline`. Brak zmiany kodu – tylko potwierdzenie.                                                          | SEO ma działać także przy „Regenerate outline”.              |


---

## 5. Weryfikacja „wszystko działa” (obowiązkowa)

Żeby uznać aplikację za **w pełni skończoną**, poniższe scenariusze muszą przejść bez błędów:


| #   | Scenariusz                        | Co sprawdzić                                                                                                                                             |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | **Pełny flow (prawdziwy render)** | Create → Plan → Approve & Render → Output (done): MP4, QA/done, TikTok meta, Cost, miniatury, Download, Export. Bez dry-run.                             |
| 7.2 | **Flow dry-run**                  | To samo z `APP_RENDER_DRY_RUN=1`: brak crashy, suchy raport, brak prawdziwego MP4.                                                                       |
| 7.3 | **Batch + kolejka**               | Batch kilku tematów → tylko jeden render równolegle, reszta w kolejce; po zakończeniu jednego startuje następny. Render Queue / Output – poprawne stany. |
| 7.4 | **Analytics + Calendar**          | Ustawienie `scheduledPublishAt` w Analytics; Calendar (from/to) pokazuje runy; Export CSV – poprawne kolumny i linki.                                    |
| 7.5 | **Czysta baza i start**           | `npx prisma migrate deploy` (+ generate), `npm run dev` – create, render, analytics, calendar bez błędów migracji i bez 500.                             |


---

## 6. Opcjonalne – tylko gdy udostępniasz / później

- **E1 (auth), E2 (rate limit)** – gdy udostępniasz aplikację innym; doprecyzować w [SECURITY.md](../SECURITY.md).
- **ElevenLabs TTS, cost alert, Analytics per nisza, A11y, E3 (vite/esbuild)** – rozszerzenia na później; nie wchodzą w zakres „aplikacja skończona” w obecnej wersji.

---

## Kolejność realizacji

1. **Konfiguracja i checklist:** 1.1 (F4 ✅), 1.2 (.env.example + procedura).
2. **API:** 2.1 (Zod retry), 2.2 (strategia batch).
3. **E2E:** 3.1 (Analytics), 3.2 (Calendar), 3.3 (stabilność).
4. **UX:** 4.1 (Retry from step), 4.2 (Batch seo/script), 4.3 (weryfikacja SEO).
5. **Weryfikacja:** 7.1–7.5 – przynajmniej raz przejście każdego scenariusza (real + dry-run, batch, Analytics, Calendar, migracje).

Po wykonaniu 1–5 i pozytywnej weryfikacji 7.1–7.5 aplikacja jest **w pełni skończona** w obecnym zakresie – nic nie jest niedokończone ani pozostawione w połowie.

---

## Deep audit – pełna lista (stan vs plan)

Porównanie planu ze stanem kodu. Każdy punkt to coś do **dokończenia** lub **naprawy**, żeby aplikacja była w pełni **skończona** (nie tylko działająca).

### 1. Checklist i konfiguracja


| ID  | Zadanie                          | Stan            | Szczegóły                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | F4 → ✅ w DEVELOPMENT_MASTER_PLAN | **Niezrobione** | F4 nadal ma status 🔲 (linia ~84). Trzeba ustawić ✅ i dopisać notatkę (Calendar, SEO, audit).                                                                                                                                                                                                                                                                                                                                                               |
| 1.2 | .env.example                     | **Brak pliku**  | W repo nie ma `.env.example`. README i devcontainer odwołują się do `cp .env.example .env`. Trzeba utworzyć plik w root z: PORT, NODE_ENV, DATABASE_URL, OPENAI_API_KEY, ELEVENLABS_API_KEY, MUSIC_LIBRARY_DIR, ARTIFACTS_DIR, APP_TEST_MODE, APP_RENDER_DRY_RUN, APP_DRY_RUN_FAIL_STEP, APP_DRY_RUN_STEP_DELAY_MS, APP_VERSION (z env.ts) + ALLOWED_ORIGINS (używane w index.ts). G3 w checklist = procedura „przy nowej zmiennej dopisz do .env.example”. |


### 2. API – walidacja i zachowanie


| ID  | Zadanie                      | Stan                 | Szczegóły                                                                                                                                                                                                                                                                 |
| --- | ---------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Zod dla body retry           | **Brak walidacji**   | W `run.ts` (POST `/:runId/retry`) jest `const { fromStep } = req.body;` bez Zod. Trzeba dodać schemat (np. `fromStep: z.string().max(64).optional()`), `safeParse(req.body)`, przy błędzie 400 + details.                                                                 |
| 2.2 | Batch przy błędzie walidacji | **Niedoprecyzowane** | Przy `validation.errors.length > 0` batch zwraca 400 i kończy pętlę; wcześniejsze topic mogły już dodać runy do kolejki. Brak opisu w kodzie/doc. Trzeba: (a) zostawić fail-fast i dodać komentarz/doc, albo (b) wdrożyć skip invalid i zwracać runIds tylko dla udanych. |


### 3. Testy E2E


| ID  | Zadanie        | Stan                  | Szczegóły                                                                                                                                                                                |
| --- | -------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | E2E Analytics  | **Brak**              | Nie ma pliku `analytics.spec.ts`. Trzeba dodać: wejście na `/analytics`, ładowanie listy, Total views, opcjonalnie edycja i zapis.                                                       |
| 3.2 | E2E Calendar   | **Brak**              | Nie ma pliku `calendar.spec.ts`. Trzeba dodać: wejście na `/calendar`, from/to, lista upcoming, Export CSV.                                                                              |
| 3.3 | Stabilność E2E | **OK, można dopisać** | Obecne E2E używają pollingu (np. waitForRunStatus z 200 ms), nie ślepego długiego sleep. W TESTING_GUIDE dopisać: preferować `expect` na stabilne stany i polling zamiast długich sleep. |


### 4. UX – brakujące / niespójne


| ID  | Zadanie                               | Stan          | Szczegóły                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | Retry from step + Retry dla failed    | **Częściowo** | **Output:** Retry jest tylko przy `qa_failed`; przy `failed` nie ma przycisku Retry (tylko „Back to Plan Studio”). Nigdzie nie ma dropdown „Retry from step”. Trzeba: (1) dodać przycisk Retry także dla stanu `failed` w Output; (2) dodać opcjonalny dropdown z krokami (tts_generate, asr_align, …) i przekazywać `fromStep` do `retryRun(runId, fromStep)`. RenderQueue też wywołuje `retryRun(runId)` bez fromStep – opcjonalnie dropdown i tam. |
| 4.2 | Batch: seoKeywords + scriptTemplateId | **Brak**      | **Backend:** `batchSchema` i pętla w batch.ts nie mają `seoKeywords` ani `scriptTemplateId`. Tworzenie projektu bez seoKeywords; `generatePlan(project)` bez options. **Frontend:** Sekcja Batch w QuickCreate nie ma pól SEO keywords ani Script template; `postBatch` w client.ts nie przyjmuje tych pól. Trzeba: rozszerzyć batch (schema + create + generatePlan), QuickCreate (pola w batch), client postBatch.                                  |
| 4.3 | regenerateOutline + SEO               | **OK**        | `regenerateOutline(project, hook)` wywołuje `generateOutline(project, hook, pack)`; project z Prisma (include project: true) zawiera `seoKeywords`; `generateOutline` używa `project.seoKeywords` w promptach. Brak zmiany.                                                                                                                                                                                                                           |


### 5. Błędy / bugi (poza planem)


| ID  | Problem                                   | Lokalizacja                                         | Działanie                                                                                                                                                                 |
| --- | ----------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | **JSON.parse bez try/catch**              | `apps/web/src/pages/Output.tsx` ok. 173             | `const artifacts: Artifacts = JSON.parse(run.artifactsJson                                                                                                                |
| 5.2 | **RenderQueue: brak stylu dla qa_failed** | `apps/web/src/pages/RenderQueue.tsx` getStatusBadge | W `getStatusBadge` nie ma wpisu dla `qa_failed`; używany jest fallback `badge-info`. Dla spójności z Output (qa_failed = warning) dodać np. `qa_failed: 'badge-warning'`. |


### 6. Weryfikacja „wszystko działa” (7.1–7.5)

Te scenariusze **muszą** przejść po zakończeniu zadań powyżej:

- **7.1** Pełny flow (prawdziwy render): Create → Plan → Approve & Render → Output (done): MP4, QA/done, TikTok meta, Cost, miniatury, Download, Export.
- **7.2** Flow dry-run: to samo z `APP_RENDER_DRY_RUN=1`; brak crashy, suchy raport.
- **7.3** Batch + kolejka: kilka tematów → jeden render równolegle, reszta w kolejce; Render Queue / Output – poprawne stany.
- **7.4** Analytics + Calendar: ustawienie `scheduledPublishAt` w Analytics; Calendar (from/to); Export CSV – poprawne kolumny i linki.
- **7.5** Czysta baza: `npx prisma migrate deploy` (+ generate), `npm run dev` – create, render, analytics, calendar bez błędów migracji i bez 500.

---

## Podsumowanie – co musi zostać zakończone

**Konfiguracja:** 1.1 (F4 ✅), 1.2 (.env.example + procedura).  
**API:** 2.1 (Zod retry body), 2.2 (strategia batch + opis/doc).  
**Testy:** 3.1 (analytics.spec.ts), 3.2 (calendar.spec.ts), 3.3 (dopisać w TESTING_GUIDE).  
**UX:** 4.1 (Retry dla failed + dropdown „Retry from step”), 4.2 (Batch seoKeywords + scriptTemplateId).  
**Bugi:** 5.1 (Output JSON.parse), 5.2 (RenderQueue qa_failed badge).  
**Weryfikacja:** 7.1–7.5 – przejście każdego scenariusza po wdrożeniu powyższych.

Po wykonaniu wszystkich punktów i pozytywnej weryfikacji 7.1–7.5 aplikacja jest **w pełni skończona** w obecnym zakresie – nic nie jest niedokończone ani niedziałające.