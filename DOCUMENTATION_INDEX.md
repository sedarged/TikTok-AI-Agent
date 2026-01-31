# Mapa dokumentacji – TikTok-AI-Agent

**Jeśli nie wiesz, od czego zacząć:** ten plik jest **głównym spisem** wszystkich dokumentów. Jedna strona – gdzie co leży.

---

## Główny dokument (checklist rozwoju i AI)

| Dokument                                                     | Po co                                                                                                                                                            |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[DEVELOPMENT_MASTER_PLAN.md](DEVELOPMENT_MASTER_PLAN.md)** | **Tu jest główna lista zadań.** Checklist: Cursor, lint, testy, jakość kodu, bezpieczeństwo, AI (AGENTS.md, rules). Aktualizuj statusy (✅/🔲) i „Last updated”. |

**W skrócie:** DEVELOPMENT_MASTER_PLAN = jeden główny checklist na cały projekt. Reszta albo z niego wynika, albo to pliki tematyczne.

---

## Dla ludzi – start i codzienna praca

| Dokument                                                   | Po co                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| [README.md](README.md)                                     | Opis projektu, tech stack, Quick Start (Codespaces, lokalnie). |
| [TESTING_GUIDE.md](TESTING_GUIDE.md)                       | Jak uruchamiać testy, lint, typecheck, E2E, środowisko.        |
| [PRZEWODNIK_TESTY_WINDOWS.md](PRZEWODNIK_TESTY_WINDOWS.md) | Testy na Windows (bat, PowerShell).                            |

---

## Dla AI / agentów (Cursor, Copilot)

| Dokument                                                           | Po co                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [AGENTS.md](AGENTS.md)                                             | Instrukcje dla agentów: komendy, reguły, zachowanie (nie wymyślaj, cytowania, testy, styl, git). |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | Wzorce kodu, architektura, Zod, SSE – dla GitHub Copilot.                                        |
| `.cursor/rules/*.mdc`                                              | Reguły Cursor (always-project-standards, api-routes, frontend-patterns).                         |

**Skills i commands** (Cursor): `.cursor/commands/`, `.cursor/skills/` – używane w Cursorze przy konkretnych akcjach. Skille w formacie [Agent Skills](https://agentskills.io); opcjonalnie `npx skills add <owner/repo>` z [skills.sh](https://skills.sh).

---

## Plany w `.cursor/plans/` – który do czego

W folderze **`.cursor/plans/`** są plany robocze. Żaden nie zastępuje DEVELOPMENT_MASTER_PLAN – to on jest główny.

| Plik                                                                                           | Rola                                                                                                         |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [next-steps-proposal.plan.md](.cursor/plans/next-steps-proposal.plan.md)                       | **Propozycja kolejnych kroków** (Tier 1–4): D3, H1, C1, D2, C2 itd. Użyj tego, gdy szukasz „co robić dalej”. |
| [development-setup-masterpiece.plan.md](.cursor/plans/development-setup-masterpiece.plan.md)   | Wykonany checklist setupu (cursorignore, AGENTS.md, rules) – do wglądu.                                      |
| [tiktok-ai-master-plan-ostateczny.md](.cursor/plans/tiktok-ai-master-plan-ostateczny.md)       | Plan produktowy (PL) – wizja, roadmap.                                                                       |
| [tiktok-ai-master-dev-plan.md](.cursor/plans/tiktok-ai-master-dev-plan.md)                     | Plan deweloperski – sprinty, taski.                                                                          |
| [ui-deep-blue-redesign.plan.md](.cursor/plans/ui-deep-blue-redesign.plan.md)                   | Plan redesignu UI (deep blue).                                                                               |
| [fix_input_focus_reset_1febec05.plan.md](.cursor/plans/fix_input_focus_reset_1febec05.plan.md) | Plan jednej poprawki (focus reset).                                                                          |
| [session-6-plan.plan.md](.cursor/plans/session-6-plan.plan.md)                                 | **Plan sesji 6:** Fix Playwright E2E, G3 (.env.example), opcjonalnie F1 (Hook 3s), 3 miniatury.              |

**Zasada:** Główny checklist = **DEVELOPMENT_MASTER_PLAN.md**. Plany w `.cursor/plans/` to rozpisane kroki lub propozycje; odwołują się do DEVELOPMENT_MASTER_PLAN, nie na odwrót.

---

## Tematy – koszty, bezpieczeństwo, audyt, propozycje

| Dokument                                                                       | Temat                                              |
| ------------------------------------------------------------------------------ | -------------------------------------------------- |
| [GITHUB_MARKETPLACE_SETUP.md](GITHUB_MARKETPLACE_SETUP.md)                     | **GitHub Marketplace i automatyzacja** (Qodo Merge, CI, Codecov, alternatywy). |
| [COST_ANALYSIS_60SEC_VIDEO.md](COST_ANALYSIS_60SEC_VIDEO.md)                   | Analiza kosztów 60 s wideo.                        |
| [COST_VISIBILITY_AND_REDUCTION.md](COST_VISIBILITY_AND_REDUCTION.md)           | Widoczność i redukcja kosztów.                     |
| [LOCAL_PROVIDERS_AND_COST_REDUCTION.md](LOCAL_PROVIDERS_AND_COST_REDUCTION.md) | Lokalni providerzy i obniżanie kosztów.            |
| [SECURITY.md](SECURITY.md)                                                     | Bezpieczeństwo (CORS, artefakty, rate limit, env). |
| [AUDIT_REPORT.md](AUDIT_REPORT.md)                                             | Raport audytu (jakość, testy, linter).             |
| [CONTROL_PANEL_PROPOSAL.md](CONTROL_PANEL_PROPOSAL.md)                         | Propozycja panelu sterowania.                      |

---

## Podsumowanie – „który jest główny?”

- **Jeden główny checklist:** [DEVELOPMENT_MASTER_PLAN.md](DEVELOPMENT_MASTER_PLAN.md)
- **Dla AI:** [AGENTS.md](AGENTS.md) + `.cursor/rules/`
- **Dla ludzi – start:** [README.md](README.md) i [TESTING_GUIDE.md](TESTING_GUIDE.md)
- **Co dalej robić:** [.cursor/plans/next-steps-proposal.plan.md](.cursor/plans/next-steps-proposal.plan.md)

Reszta to pliki tematyczne lub pojedyncze plany – wszystkie są wymienione powyżej.
