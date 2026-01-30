# Kolejne kroki i zadania – propozycja

**Główny checklist:** [DEVELOPMENT_MASTER_PLAN.md](../../DEVELOPMENT_MASTER_PLAN.md). **Mapa dokumentów:** [DOCUMENTATION_INDEX.md](../../DOCUMENTATION_INDEX.md).  
**Na podstawie:** stan checklisty (A, B, D1, G1–G2, H7 ✅). Ostatnia aktualizacja: 2026-01-29. **Zrealizowano:** D3, H1, C1, C2, D2, E3, D4, D5 (Zod UUID, BUGBOT, test:coverage, ffmpegUtils unit, reduce any, npm audit + CI, Helmet, Sonner toasts).

---

## Tier 1 – Szybkie wygrane / wysoki wpływ (najpierw)

| Krok | ID   | Zadanie | Priorytet | Szacunek | Uwagi |
|------|------|---------|-----------|----------|--------|
| 1    | **D3** | Walidacja Zod dla UUID w ścieżkach (runId, projectId, planVersionId itd.) | High | 1–2h | ✅ Done. run, project, plan, scene; 400 + details. |
| 2    | **H1** | Dodać `.cursor/BUGBOT.md` | Medium | 30 min | ✅ Done. No eval/exec, Zod + tests, backend tests. |
| 3    | **C1** | Skrypt `test:coverage` w serverze (Vitest `--coverage`) | Medium | 30 min | ✅ Done. `test:coverage` + @vitest/coverage-v8. |

**Dlaczego teraz:** D3 wzmacnia bezpieczeństwo i spójność API; H1 pomaga przy PR-ach; C1 daje widoczność pokrycia bez dużej pracy.

---

## Tier 2 – Jakość kodu i testy

| Krok | ID   | Zadanie | Priorytet | Szacunek | Uwagi |
|------|------|---------|-----------|----------|--------|
| 4    | **D2** | Ograniczyć `any` / `as any` (planGenerator, openai, routes) | Medium | 2–4h | ✅ Done. planGenerator, openai, plan updateData. |
| 5    | **C2** | Unit testy: ffmpegUtils, captionsBuilder, planGenerator | Medium | 2–4h | ✅ Done. ffmpegUtils (escapeConcatPath, getMotionFilter). |
| 6    | **E3** | `npm audit` + aktualizacja zależności (vite, esbuild, etc.) | Medium | 1h | ✅ Done. `npm run audit`, CI step, TESTING_GUIDE. |

**Dlaczego teraz:** D2 i C2 zmniejszają ryzyko regresji i „AI lies”; E3 to standardowa higiena bezpieczeństwa.

---

## Tier 3 – Produkt i UX (gdy będziesz rozwijać features)

| Krok | ID   | Zadanie | Priorytet | Uwagi |
|------|------|---------|-----------|--------|
| 7    | **D4** | Helmet (nagłówki bezpieczeństwa) w `apps/server/src/index.ts` | Medium | 15 min | ✅ Done. `helmet`; `contentSecurityPolicy: false` dla SPA. |
| 8    | **D5** | Toast / globalny feedback sukcesu (np. „Plan saved”, „Render started”) | Low | 1–2h | ✅ Done. Sonner; autosave + Approve & Render. |
| 9    | **G3** | Trzymać `.env.example` w sync z nowymi zmiennymi | Low | Przy każdej nowej zmiennej | Dodać wpis do G3 w checklist jako „ongoing”. |
| 10   | **F1** | Hook 3s w validatorze i promptach (planValidator, planGenerator) | Medium | Per sprint | Jeśli produktowo ważne. |
| 11   | **F2** | Cost tracking (usage → Run/Output, costJson) | Medium | Per sprint | OpenAI usage, zapis w Run lub osobnym modelu. |

---

## Tier 4 – Gdy będziesz potrzebować (opcjonalne)

| Krok | ID   | Zadanie | Kiedy |
|------|------|---------|--------|
| 12   | **H5** | Cursor @Docs (Prisma, React, Vite, Tailwind, Playwright, Express) | Gdy chcesz lepsze sugestie frameworkowe – ręcznie w Cursor Settings. |
| 13   | **H9** | Cursor ↔ GitHub + Bugbot | Gdy pracujesz na PR-ach i chcesz automatyczny review. |
| 14   | **H2** | `.github/instructions/` path-specific dla Copilot | Gdy używasz Copilot i chcesz osobnych instrukcji pod API vs frontend. |
| 15   | **E1, E2** | Auth dla `/api`, rate limiting | Gdy udostępniasz aplikację na zewnątrz. |
| 16   | **C3** | Vitest + Testing Library w `apps/web` | Gdy zaczniesz testować komponenty. |
| 17   | **C4, F3, F4, D6** | E2E nowe flow, Analytics, Calendar, i18n | Per roadmap produktu. |
| 18   | **H3, H4, H6, H8** | hooks.json, rules-cli, MCP, CLAUDE.md | Tylko jeśli naprawdę potrzebne. |

---

## Proponowana kolejność realizacji (najbliższe sesje)

1. **Sesja 1:** D3 (Zod UUID) + H1 (BUGBOT.md) — ✅ done  
2. **Sesja 2:** C1 (test:coverage) + E3 (npm audit) — ✅ done  
3. **Sesja 3:** D2 (reduce any) – wybrać 1–2 pliki — ✅ done  
4. **Sesja 4:** C2 – jeden zestaw unit testów — ✅ done  
5. **Sesja 5:** D4 (Helmet) + D5 (toast) + D2 finish (render/verify any) — ✅ done  
6. **Sesja 6:** Fix Playwright E2E + G3 (.env.example) + opcjonalnie F1 (Hook 3s), 3 miniatury (Sprint 1.3). Szczegóły: [session-6-plan.plan.md](session-6-plan.plan.md).  
7. Potem według potrzeb: F2, F3, F4, G3 ongoing.

---

## Szybki wybór „zrób tylko to”

Jeśli chcesz **minimalny zestaw na teraz**:

- **D3** – Zod UUID (bezpieczeństwo i spójność API).  
- **H1** – BUGBOT.md (przydatne przy każdym PR).  
- **C1** – test:coverage (jeden skrypt, od razu widać stan testów).

Resztę można odkładać i realizować w kolejnych iteracjach według powyższych tierów.
