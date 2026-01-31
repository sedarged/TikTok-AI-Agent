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


## Plany w `.cursor/plans/`

The `.cursor/plans/` directory has been cleaned up. Historical planning documents have been removed as the current development process is tracked in **DEVELOPMENT_MASTER_PLAN.md**.

---

## Tematy – koszty, bezpieczeństwo, audyt, propozycje

| Dokument                                                                       | Temat                                              |
| ------------------------------------------------------------------------------ | -------------------------------------------------- |
| [COST_ANALYSIS_60SEC_VIDEO.md](COST_ANALYSIS_60SEC_VIDEO.md)                   | Analiza kosztów 60 s wideo.                        |
| [COST_VISIBILITY_AND_REDUCTION.md](COST_VISIBILITY_AND_REDUCTION.md)           | Widoczność i redukcja kosztów.                     |
| [LOCAL_PROVIDERS_AND_COST_REDUCTION.md](LOCAL_PROVIDERS_AND_COST_REDUCTION.md) | Lokalni providerzy i obniżanie kosztów.            |
| [SECURITY.md](SECURITY.md)                                                     | Bezpieczeństwo (CORS, artefakty, rate limit, env). |
| [CONTROL_PANEL_PROPOSAL.md](CONTROL_PANEL_PROPOSAL.md)                         | Propozycja panelu sterowania.                      |

---

## Podsumowanie – „który jest główny?”

- **Jeden główny checklist:** [DEVELOPMENT_MASTER_PLAN.md](DEVELOPMENT_MASTER_PLAN.md)
- **Dla AI:** [AGENTS.md](AGENTS.md) + `.cursor/rules/`
- **Dla ludzi – start:** [README.md](README.md) i [TESTING_GUIDE.md](TESTING_GUIDE.md)
Reszta to pliki tematyczne – wszystkie są wymienione powyżej.
