# Następny batch (Sesja 7+) – propozycja

**Po zrealizowanym batchu 2:** D6 (UI EN), Channel presets, Script templates, Analytics (Run views/likes/retention/postedAt + PATCH + Analytics.tsx), C3 (Vitest + Testing Library w web, test errors).

---

## Zrobione w batchu 2

- D6 – pozostałe etykiety PL → EN (Output, Layout, RenderQueue).
- Channel presets – `data/channel-presets.json`, GET `/api/channel-presets`, QuickCreate „Use preset”.
- Script templates – `scriptTemplates.ts`, GET `/api/script-templates`, `generatePlan(project, { scriptTemplateId })`, QuickCreate + automate body.
- Analytics – Prisma Run: `views`, `likes`, `retention`, `postedAt`; migracja; GET `/api/run` (lista), PATCH `/api/run/:runId`; Analytics.tsx + nav.
- C3 – Vitest + jsdom + Testing Library w `apps/web`; `utils/errors.test.ts`.

---

## Propozycja kolejnego batchu (większy)

| Krok | Zadanie | Źródło | Szacunek |
|------|---------|--------|----------|
| 1 | **Zastosować migrację** | Po batchu 2 | Uruchomić `npx prisma migrate deploy` (lub `db:migrate:dev`) w apps/server oraz `npx prisma generate` po dodaniu pól Run. |
| 2 | **Sprint 4.1 – Content calendar** | tiktok-ai-master-dev-plan | Run: `scheduledPublishAt`, `publishedAt`; PATCH run; GET `/api/runs/upcoming`; strona Calendar, Export CSV. |
| 3 | **Sprint 4.2 – SEO keywords** | tiktok-ai-master-dev-plan | Project: `seoKeywords`; planGenerator (outline, scenes) „Include these keywords”; QuickCreate pole. |
| 4 | **F3 – rozszerzenie** | DEVELOPMENT_MASTER_PLAN | Channel presets + Script templates już zrobione; ewent. Analytics rozszerzenie (dashboard per nisza). |
| 5 | **E1, E2 (opcjonalnie)** | Gdy udostępniasz app | Auth dla `/api`, rate limiting. |
| 6 | **C4** | Gdy będą nowe flow | E2E dla Analytics/Calendar. |

---

## Referencje

- [DEVELOPMENT_MASTER_PLAN.md](../../DEVELOPMENT_MASTER_PLAN.md)
- [tiktok-ai-master-dev-plan.md](tiktok-ai-master-dev-plan.md)
- [DOCUMENTATION_INDEX.md](../../DOCUMENTATION_INDEX.md)
