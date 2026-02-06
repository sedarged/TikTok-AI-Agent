# Pełna kontrola aplikacji z UI – propozycja

## Co powinno się znaleźć w Control Panel (lista)

| Sekcja                       | Zawartość                                                                     | Źródło danych                                       | Priorytet      |
| ---------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------- | -------------- |
| **Runtime status**           | OpenAI, FFmpeg, ElevenLabs, Dry-Run, Test mode, komunikat                     | GET /api/status                                     | Już jest       |
| **Health**                   | Wersja, NODE_ENV, stan bazy, timestamp                                        | GET /api/health                                     | Już jest       |
| **Dry-run control**          | Fail step, step delay (ms), Load/Save                                         | GET+POST /api/test/dry-run-config                   | Już jest (API) |
| **Szybkie statystyki**       | Liczba projektów, liczba runów (done/failed), ostatni render                  | Nowe API (np. GET /api/stats)                       | Warto dodać    |
| **Ostatnie logi serwera**    | Ostatnie N linii stdout/stderr (np. 50)                                       | Nowe API (np. GET /api/admin/logs)                  | Warto dodać    |
| **Użycie dysku (artefakty)** | Rozmiar katalogu artifacts, liczba plików                                     | Nowe API (np. GET /api/admin/artifacts-summary)     | Warto dodać    |
| **Baza danych**              | Przycisk „Seed” (wypełnienie danymi testowymi), opcjonalnie „Migrate”         | POST /api/admin/seed (nowy)                         | Opcjonalnie    |
| **Artefakty**                | Lista katalogów runów, rozmiary, przycisk „Clear old” (np. starsze niż 7 dni) | GET /api/admin/artifacts, DELETE (z potwierdzeniem) | Opcjonalnie    |
| **Linki / skróty**           | Link do dokumentacji, .env.example, testing guide, health URL                 | Statyczne + env (np. APP_DOCS_URL)                  | Opcjonalnie    |

---

## Co mają podobne aplikacje

- **Video / encoding (api.video, JW Player, Cloudinary):** dashboard z media library, ustawienia playera, **analytics** (wyświetlenia, czas), **API keys** (lista, tworzenie, rotacja), **billing / usage** (minuty, storage).
- **SaaS / dev tools (Datadog, Tyk, Cloudflare):** **logi** (podgląd, retention), **metryki** (CPU, RAM, request count), **konfiguracja** (feature flags, env), **audit log** (kto co zmienił).
- **Content / AI tools:** **status providerów** (API keys OK / brak), **usage** (liczba wywołań, limit), **tryb test/demo** (włącz/wyłącz dry-run), **podgląd ostatnich zadań** (kolejka, failed).

Dla **TikTok AI Agent** najbardziej pasuje: status providerów, health, tryb dry-run/test + konfiguracja fail step/delay, **szybkie statystyki** (projekty, runy), **logi** (ostatnie linie), **użycie dysku** (artefakty). API keys zwykle nie edytuje się z UI ze względów bezpieczeństwa – zostają w .env.

---

## Usprawnienia i dodatki (rekomendacje)

1. **Szybkie statystyki (dashboard)**  
   Jedna karta na górze: „Projekty: X”, „Runy (done): Y”, „Runy (failed): Z”, „Ostatni render: [data]” lub „Brak”. Wymaga: GET `/api/stats` (np. count z Prisma + ostatni Run). Daje od razu obraz stanu aplikacji bez wchodzenia w Projects.

2. **Ostatnie logi serwera**  
   Sekcja „Server log (last 50 lines)” – podgląd tego, co serwer wypisuje na stdout (np. bufor ring w pamięci, GET `/api/admin/logs`). Przydatne przy debugowaniu bez zaglądania do terminala. Uwaga: w produkcji można ograniczyć do roli admin lub wyłączyć.

3. **Użycie dysku (artefakty)**  
   Jedna linijka: „Artifacts: 12 runs, ~450 MB” (GET `/api/admin/artifacts-summary` – skan katalogu lub cache). Daje kontrolę nad miejscem na dysku bez wchodzenia w system plików.

4. **Seed bazy**  
   Przycisk „Seed database” (POST `/api/admin/seed`) – wywołuje istniejący skrypt seed. Przydatne po czystej migracji lub do resetu środowiska dev. Zabezpieczenie: tylko gdy NODE_ENV=development lub osobny token/pin.

5. **Zwinięte sekcje + odświeżanie**  
   Status i Health w jednym widoku; Dry-run control, Stats, Logs, Artifacts w zwiniętych blokach („Rozwiń logi”, „Rozwiń statystyki”). Wspólny przycisk „Refresh all” odświeżający status, health, stats (i opcjonalnie dry-run config) jednym kliknięciem.

6. **Breadcrumb / kontekst**  
   Na górze strony: „Control” lub „Control > Runtime”. Spójne z resztą aplikacji (plan redesignu).

7. **Opcjonalnie: eksport konfiguracji**  
   Przycisk „Export config (read-only)” – pobiera JSON z aktualnym status + health + dry-run config (bez kluczy API). Przydatne do raportów lub zgłaszania problemów.

---

## Cel

Jedno miejsce w aplikacji (strona **Control**), z którego możesz:

- **Widzieć** stan serwera (OpenAI, FFmpeg, tryb dry-run, baza, wersja).
- **Sterować** zachowaniem renderu w trybie dry-run (symulacja błędu, opóźnienie kroków).
- **Opcjonalnie** w przyszłości: seed bazy, lista artefaktów, czyszczenie – po dodaniu odpowiednich API i zabezpieczeń.

---

## Co backend już udostępnia (bez zmian w kodzie serwera)

| Endpoint                   | Metoda | Opis                                                                                                                                              |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/status`              | GET    | Stan: OpenAI, FFmpeg, ElevenLabs, dry-run, test mode, komunikat.                                                                                  |
| `/api/health`              | GET    | Wersja, NODE_ENV, stan bazy (ok/error), timestamp.                                                                                                |
| `/api/test/dry-run-config` | GET    | Obecna konfiguracja dry-run: **fail step** (np. `ffmpeg_render`), **step delay (ms)**. Działa tylko gdy APP_RENDER_DRY_RUN=1 lub APP_TEST_MODE=1. |
| `/api/test/dry-run-config` | POST   | Ustawia **fail step** i **step delay** na bieżącej sesji serwera (do restartu). Body: `{ failStep?: string, stepDelayMs?: number }`.              |

Czyli: **już dziś** możesz z UI odczytywać status i health oraz w trybie dry-run/test **ustawiać**, w którym kroku pipeline ma się „wywalić” i z jakim opóźnieniem między krokami – bez restartu serwera (do restartu ustawienia są w pamięci; po restarcie wracają z pliku .env).

---

## Jak to wygląda w praktyce

### 1. Nowa strona: **Control** (np. `/control`)

W nawigacji (Layout): obok **Create** i **Projects** dodajesz link **Control**. Dostęp do niej ma każdy, kto ma dostęp do aplikacji (na razie bez osobnej autoryzacji).

### 2. Układ strony (bloki od góry do dołu)

**A) Runtime status (tylko odczyt)**

- Karty lub lista: **OpenAI** (skonfigurowany / brak), **FFmpeg** (dostępny / brak), **Dry-Run** (włączony / wyłączony), **Test mode** (włączony / wyłączony).
- Jedna linia z komunikatem z `/api/status` (np. „All providers configured and ready” albo „APP_RENDER_DRY_RUN enabled…”).
- Źródło: `GET /api/status`. Odświeżanie: przy wejściu na stronę + opcjonalnie przycisk „Refresh”.

**B) Health (tylko odczyt)**

- Wersja aplikacji, tryb (development/test/production), stan bazy (OK / błąd), timestamp ostatniego sprawdzenia.
- Źródło: `GET /api/health`. Odświeżanie jak wyżej.

**C) Dry-run control (widoczny tylko gdy status.renderDryRun === true lub status.testMode === true)**

- **Simulate fail at step:** dropdown (None, tts_generate, asr_align, images_generate, captions_build, music_build, ffmpeg_render, finalize_artifacts).
- **Step delay (ms):** pole liczbowe 0–5000 (opóźnienie przed każdym krokiem w dry-run).
- Przyciski: **Load** (GET `/api/test/dry-run-config` → uzupełnia formularz), **Save** (POST `/api/test/dry-run-config` z wartościami z formularza).
- Krótka informacja: „Zmiany obowiązują do restartu serwera. Po restarcie wracają ustawienia z .env.”

**D) Opcjonalnie – miejsce na przyszłe sekcje**

- Np. „Data”: przycisk **Seed database** (wymaga `POST /api/admin/seed`).
- Np. „Artifacts”: lista katalogów/plików i **Clear old** (wymaga API + potwierdzenie).
- Te bloki można dodać w kolejnych iteracjach, gdy pojawią się odpowiednie endpointy i zasady bezpieczeństwa.

### 3. Przepływ użytkownika (przykład)

1. Wchodzisz na **Control**.
2. Widzisz status (OpenAI, FFmpeg, Dry-Run, Test mode) i health (wersja, baza).
3. Jeśli jest włączony dry-run lub test mode, widzisz blok **Dry-run control**.
4. Ustawiasz np. „Simulate fail at step” = `ffmpeg_render`, „Step delay” = 500, klikasz **Save**.
5. Idziesz do Create → tworzysz projekt → Plan Studio → Approve & Render.
6. Render w dry-run przejdzie kroki z opóźnieniem 500 ms i „wywali się” na `ffmpeg_render` – w UI zobaczysz błąd i status failed.
7. Wracasz do Control, ustawiasz „Simulate fail at step” = None, **Save** – kolejne renderowanie może przejść do końca (w granicach dry-run).

Dzięki temu masz **pełną kontrolę nad zachowaniem pipeline’u z poziomu UI**, bez edycji .env i restartu (w ramach jednej sesji serwera).

---

## Co trzeba zrobić w kodzie

### Frontend

1. **Routing** – w `App.tsx` dodać trasę np. `/control` → komponent `Control` (lub `ControlPanel`).
2. **Nawigacja** – w `Layout.tsx` dodać link „Control” obok Create i Projects.
3. **API client** – w `apps/web/src/api/client.ts`:
   - `getHealth()` → `GET /api/health`,
   - `getDryRunConfig()` → `GET /api/test/dry-run-config`,
   - `updateDryRunConfig({ failStep?, stepDelayMs? })` → `POST /api/test/dry-run-config`.
4. **Strona Control** – nowy plik `apps/web/src/pages/Control.tsx`:
   - sekcja Status (dane z istniejącego `getStatus()`),
   - sekcja Health (`getHealth()`),
   - sekcja Dry-run control (formularz + `getDryRunConfig` / `updateDryRunConfig`), widoczna tylko gdy `status.renderDryRun || status.testMode`.
   - Styl spójny z resztą aplikacji (np. Deep Blue jak w planie UI).

### Backend

- **Bez zmian** – endpointy `/api/status`, `/api/health` i `/api/test/dry-run-config` już istnieją.
- Ewentualnie: jawna dokumentacja lub komentarz w kodzie, że `/api/test/*` służy do kontroli z UI w trybie dry-run/test.

---

## Ograniczenia i bezpieczeństwo

- **Dry-run config** – zmiana przez POST dotyczy tylko **bieżącego procesu** (process.env). Po restarcie serwera wracają wartości z pliku .env.
- **Dostęp** – strona Control jest dostępna dla każdego, kto ma dostęp do aplikacji. Jeśli kiedyś dodasz logowanie, Control można zabezpieczyć osobną rolą (np. admin).
- **Niebezpieczne operacje** (seed, reset bazy, usuwanie artefaktów) – **nie** są w tej propozycji; jeśli je dodamy, potrzebne będą osobne endpointy, potwierdzenie w UI i (w produkcji) ochrona przed przypadkowym wywołaniem.

---

## Podsumowanie

- **Jedna nowa strona:** Control (`/control`) z blokami Status, Health i (gdy dry-run/test) Dry-run control.
- **Pełna kontrola nad pipeline’em w dry-run** bez restartu: wybór kroku do symulacji błędu i opóźnienia między krokami.
- **Rozszerzenia na przyszłość:** seed, artefakty, itd. – po dodaniu odpowiednich API i zasad bezpieczeństwa.

Jeśli ta propozycja Ci pasuje, kolejnym krokiem może być dopisanie jej do planu redesignu (np. jako „Faza 3 – Control Panel”) i realizacja: routing + Layout + client + strona Control.

---

## Podsumowanie rekomendacji (co wdrożyć w jakiej kolejności)

| Faza                | Zawartość Control Panel                                     | Backend                                               | Frontend                                                  |
| ------------------- | ----------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| **1 (minimum)**     | Runtime status, Health, Dry-run control (fail step + delay) | Brak zmian (API istnieją)                             | Nowa strona Control, client, Layout                       |
| **2 (warte)**       | + Szybkie statystyki (projekty, runy, ostatni render)       | GET /api/stats                                        | Karta „Stats” na górze                                    |
| **3 (przydatne)**   | + Ostatnie logi serwera, użycie dysku (artefakty)           | GET /api/admin/logs, GET /api/admin/artifacts-summary | Zwinięte sekcje „Logs”, „Storage”                         |
| **4 (opcjonalnie)** | + Seed bazy, Clear old artifacts                            | POST /api/admin/seed, DELETE z potwierdzeniem         | Przyciski w sekcjach „Data” / „Artifacts” + potwierdzenie |

Faza 1 daje pełną kontrolę nad dry-run z UI. Fazy 2–3 dodają przegląd stanu aplikacji i ułatwiają debug bez terminala. Faza 4 – tylko jeśli potrzebujesz resetu danych / czyszczenia z poziomu UI (z zachowaniem zabezpieczeń).
