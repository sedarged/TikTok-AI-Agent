# Plan sesji 6 – kolejna sesja

**Główny checklist:** [DEVELOPMENT_MASTER_PLAN.md](../../DEVELOPMENT_MASTER_PLAN.md). **Mapa dokumentów:** [DOCUMENTATION_INDEX.md](../../DOCUMENTATION_INDEX.md).  
**Kontekst:** Sesje 1–5 ✅ (D3, H1, C1, C2, D2, E3, D4, D5). E2E nie uruchamia się (Playwright config – `exports is not defined` w ES module).

---

## Cel sesji 6

1. **Odblokować E2E** ✅ – `playwright.config.ts` zastąpiony przez `playwright.config.mjs` (ESM); `npm run test:e2e` uruchamia się (przeglądarki: `npx playwright install`).
2. **G3 – .env.example** ✅ – dodany `.env.example` wg `env.ts` (PORT, DATABASE_URL, OPENAI_*, APP_*, itd.); trzymać w sync (ongoing).
3. **F1 – Hook 3s** (opcjonalnie) – planValidator: ostrzeżenie „first scene &lt; 5s”; planGenerator: prompty „hook in first 3 seconds”.
4. **Sprint 1.3 – 3 miniatury** (opcjonalnie) – `thumb_0`, `thumb_3`, `thumb_mid` w finalize; Output „Use as cover”.

---

## Kolejność realizacji (Sesja 6)

| Krok | Zadanie | Szacunek | Uwagi |
|------|---------|----------|--------|
| 1 | **Fix Playwright E2E config** | 30–60 min | `playwright.config.ts`: błąd „exports is not defined in ES module scope”. Sprawdzić `package.json` type, eksport ESM vs CJS, ewentualnie `playwright.config.mjs` lub zmiana ładowania. Po fixie: `npm run test:e2e` przechodzi. |
| 2 | **G3 – .env.example** | 15–30 min | Utworzyć `.env.example` w repo root (lub `apps/server`). Zmienne z `env.ts`: PORT, NODE_ENV, DATABASE_URL, OPENAI_API_KEY, ELEVENLABS_API_KEY, MUSIC_LIBRARY_DIR, ARTIFACTS_DIR, APP_TEST_MODE, APP_RENDER_DRY_RUN, APP_DRY_RUN_FAIL_STEP, APP_DRY_RUN_STEP_DELAY_MS, APP_VERSION. Krótki komentarz przy każdej. G3 w checklist = „ongoing” przy nowych zmiennych. |
| 3 | **F1 – Hook 3s** | 1–2 h | **planValidator:** jeśli pierwsza scena `durationTargetSec` &gt; 4 (lub 5), dodać warning: „First scene should be under 5s so the hook lands in first 3 seconds”. **planGenerator:** w promptach (hooks, outline, scenes) dopisać: „The first scene must contain the hook within the first 3 seconds; first sentence = attention grabber.” |
| 4 | **Sprint 1.3 – 3 miniatury** | 1–2 h | **renderPipeline** finalize: zamiast jednej `thumb.png` (offset 2s) – wyciągać 3 klatki: offset 0 → `thumb_0.png`, 3 → `thumb_3.png`, połowa długości → `thumb_mid.png`. W `artifacts` dodać `thumbPaths: string[]`. **Output.tsx:** pokazać 3 miniatury (`/api/run/:id/artifact?path=...`), etykieta „Use as cover” (UX). **verifyArtifacts:** uwzględnić `thumbPaths` jeśli używane. |

---

## „Zrób tylko to” (minimalna sesja)

1. **Fix Playwright** – odblokować E2E.
2. **G3 – .env.example** – szybka wygrana, dobra dla DX.

F1 i 3 miniatury można zostawić na późniejszą sesję.

---

## Referencje

- [next-steps-proposal.plan.md](next-steps-proposal.plan.md) – Tier 3–4, F1, F2, G3.
- [tiktok-ai-master-dev-plan.md](tiktok-ai-master-dev-plan.md) – Sprint 1.3 (miniatury), 3.5 (Hook 3s).
- [apps/server/src/env.ts](../../apps/server/src/env.ts) – zmienne do `.env.example`.
- [TESTING_GUIDE.md](../../TESTING_GUIDE.md) – E2E, `test:e2e`.
