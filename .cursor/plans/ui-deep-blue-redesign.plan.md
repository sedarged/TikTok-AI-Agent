---
name: UI Deep Blue Redesign
overview: Redesign UI – Deep Blue theme, uproszczenie UX (jeden CTA, breadcrumb, zwinięte sekcje).
todos:
  - id: mobile-nav
    content: Mobile – hamburger lub zwinięte Create|Projects; CTA pełna szerokość
    status: pending
  - id: verification-collapse
    content: Output – opcjonalnie Verification/Artifacts zwinięte gdy długie
    status: pending
isProject: true
---

# Plan: Redesign UI – Deep Blue, prosty i przyjazny

## Cel

1. **Przyjazne UI** – uprościć interfejs: mniej elementów na ekran, jasny przepływ, jeden główny CTA, przejrzysta hierarchia.
2. **Styl** – ciemny theme Deep Blue, bez emotek, delikatny kontrast i glow.

---

# Część A: Przyjazne UI (uproszczenia UX)

## A.1 Zasady ogólne

- **Jeden główny CTA na ekranie** – reszta jako przyciski drugorzędne lub w menu.
- **Jasny przepływ:** Create → Plan → Render → Output (bez zbędnych kroków).
- **Mniej przycisków w jednym rzędzie** – na mobile maks. 1–2 widoczne akcje; reszta w menu „More” / dropdown.
- **Breadcrumb lub „Wstecz”** – użytkownik zawsze wie, gdzie jest i jak wrócić.
- **Sekcje zwinięte domyślnie** – np. „Zaawansowane”, „Logi” – rozwijane po kliknięciu.

---

## A.2 Nawigacja (Layout)

**Plik:** [apps/web/src/components/Layout.tsx](apps/web/src/components/Layout.tsx)

- ✅ **Nav:** Zostawić „Create” i „Projects”. Dodać **breadcrumb** w `<main>` (np. przekazywany przez context lub route): np. `Projects > [Tytuł projektu] > Plan` – żeby było widać, gdzie jestem.
- ✅ **Status (OpenAI / FFmpeg / Dry-Run):** Przeniesiony do **stopki**; w headerze tylko logo + Create + Projects.
- ⏳ **Mobile:** Hamburger lub zwinięte „Create | Projects” w jednym pasku; status już w stopce.

---

## A.3 Create (QuickCreate)

**Plik:** [apps/web/src/pages/QuickCreate.tsx](apps/web/src/pages/QuickCreate.tsx)

- ✅ **Widoczność:** Na pierwszym ekranie: **Temat** + **Niche Pack** + **Długość** + **Generate Plan** (jeden CTA).
- ✅ **Zwinięte „Opcje”:** Language, Tempo, Voice w sekcji „Opcje” (zwinięte domyślnie).
- ✅ **Komunikat „OpenAI not configured”:** Szary tekst „Tryb szablonu (bez API)” pod CTA.

---

## A.4 Plan Studio

**Plik:** [apps/web/src/pages/PlanStudio.tsx](apps/web/src/pages/PlanStudio.tsx)

- ✅ **Header:** Lewa – tytuł + opis. Prawa – jeden przycisk „Approve & Render”; **Validate** i **Auto-fit** w menu **„Narzędzia”** (dropdown). Saving indicator + dry-run badge.
- ✅ **Panel walidacji:** Błędy zawsze widoczne; gdy tylko ostrzeżenia – zwinięty blok „Ostrzeżenia”.
- ✅ **Duration summary:** Jeden wiersz (Total / Target / Scenes / WPM + badge).
- ✅ **Zakładki:** 4 zakładki z krótkim opisem; przycisk „Regenerate …” w każdej.
- ✅ **Sceny:** Karty zwinięte domyślnie; w rozwiniętej – pola pogrupowane (Tekst, Czas i efekt, Obraz). Lock / Regen przy scenie.

---

## A.5 Projects

**Plik:** [apps/web/src/pages/Projects.tsx](apps/web/src/pages/Projects.tsx)

- ✅ **Karta projektu:** Tytuł + status badge + metadane. **Akcje:** jeden przycisk primary (View Output / Edit Plan) + **menu „…”** (View Output, Edit Plan, Duplicate, Delete).
- ✅ **Empty state:** „No projects yet” + „Create Your First Video” (jedno CTA).

---

## A.6 Render Queue

**Plik:** [apps/web/src/pages/RenderQueue.tsx](apps/web/src/pages/RenderQueue.tsx)

- ✅ **Nagłówek:** Tytuł „Render Queue” + nazwa projektu + **Back to Plan**.
- ✅ **Karta runu:** Status + progress bar + przyciski View Output / Retry / Cancel. **Logi:** Domyślnie zwinięte („Pokaż logi” / „Ukryj logi”).

---

## A.7 Output

**Plik:** [apps/web/src/pages/Output.tsx](apps/web/src/pages/Output.tsx)

- ✅ **Nagłówek:** Tytuł + nazwa projektu + status badge.
- ✅ **Dry-run info / Progress:** Jedna karta każda.
- ✅ **Akcje (gdy done):** Główny CTA „Download MP4” / „View artifacts”; reszta w **„More”** (dropdown).
- ✅ **Render Log:** Domyślnie zwinięty. ⏳ **Verification / Artifacts** zwinięte gdy długie – opcjonalnie.

---

## A.8 Podsumowanie zmian UX (pliki)


| Miejsce     | Status | Zmiana                                                                                                      |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| Layout      | ✅      | Breadcrumb w main; status w stopce.                                                                         |
| QuickCreate | ✅      | Temat + Niche + Długość + CTA; „Opcje” zwinięte.                                                            |
| PlanStudio  | ✅      | Approve & Render; menu „Narzędzia”; zakładki z opisem; sceny pogrupowane; walidacja (ostrzeżenia zwinięte). |
| Projects    | ✅      | Jedna główna akcja + menu „…”.                                                                              |
| RenderQueue | ✅      | Logi zwinięte domyślnie.                                                                                    |
| Output      | ✅      | Główny CTA + „More”; Render Log zwinięty.                                                                   |


---

# Część B: Styl (Deep Blue, bez emotek)

## 1. Paleta i zmienne CSS ✅

**Plik:** [apps/web/src/styles/index.css](apps/web/src/styles/index.css)

- ✅ Zastąpiono `:root` paletą Deep Blue:
  - `--color-bg`: `#0A0D14`
  - `--color-surface`: `#121826`
  - `--color-surface-2`: `#151E2E`
  - `--color-primary`: `#3B82F6`
  - `--color-primary-hover`: `#60A5FA`
  - `--color-accent`: `#7C3AED`
  - `--color-border`: `#273246`
  - `--color-text`: `#E5E7EB`
  - `--color-text-muted`: `#9CA3AF`
  - `--color-success`: `#22C55E`
  - `--color-warning`: `#F59E0B`
  - `--color-danger`: `#EF4444`
- ✅ `body` na `background: var(--color-bg)` i `color: var(--color-text)`.
- ✅ Scrollbar zaktualizowany.

---

## 2. Komponenty globalne (index.css) ✅

**Plik:** [apps/web/src/styles/index.css](apps/web/src/styles/index.css)

- **.btn-primary**: tło `var(--color-primary)`, hover `var(--color-primary-hover)`, opcjonalnie `box-shadow: 0 0 18px rgba(59, 130, 246, 0.35)` dla CTA.
- **.btn-secondary**: tło powierzchni, obramowanie `var(--color-border)`.
- **.input, .textarea, .select**: `background: var(--color-surface)`, `border-color: var(--color-border)`, `focus:ring` w kolorze primary.
- **.card**: tło `var(--color-surface)`, border `var(--color-border)`, `border-radius: 12px` (opcjonalnie `backdrop-filter: blur(8px)` dla glassmorphism).
- **.badge-***: dostosować do nowej palety (success/warning/error/info).
- Dodać klasę użytkową `.glow-primary` dla przycisków CTA (subtelny glow).

---

## 3. Tailwind – rozszerzenie theme ✅

**Plik:** [apps/web/tailwind.config.js](apps/web/tailwind.config.js)

- ✅ W `theme.extend.colors`:
  - `primary` na odcienie niebieskie (500: `#3B82F6`, 600: `#2563EB` itd.).
  - Opcjonalnie: `surface`, `accent` (violet) jako aliasy do użycia w klasach.
- Zachować kompatybilność z istniejącymi klasami (np. `bg-gray-900` → stopniowo można zamieniać na `bg-surface` tam, gdzie chcemy spójności).

---

## 4. Layout (nagłówek i nawigacja) ✅

**Plik:** [apps/web/src/components/Layout.tsx](apps/web/src/components/Layout.tsx)

- ✅ Tło nagłówka ciemniejsze, `border-b` w `var(--color-border)`.
- ✅ Logo: gradient niebieski `from-blue-500 to-indigo-600`.
- ✅ Linki nawigacji: aktywny primary + dolna kreska.
- ✅ StatusIndicator w stopce; kolory primary/danger, tekst muted.
- ✅ Banner ostrzeżenia w palecie.

---

## 5. Usunięcie emotek i symboli ✅

### 5.1 PlanStudio.tsx ✅

- ✅ Hook: styl wizualny + „Selected", bez ✓.
- ✅ Scenes: ikona SVG (chevron) zamiast ▲/▼.
- ✅ Separator `|` zamiast `•` w metadanych.

### 5.2 Output.tsx ✅

- ✅ Verification: „P" / „F" (Pass/Fail) w kółku zamiast ✓/✗.

### 5.3 Inne pliki ✅

- ✅ Projects.tsx: separator `|`.
- ✅ App.tsx: loader w kolorze primary.

---

## 6. Strony – dopasowanie kolorów ✅

- ✅ QuickCreate, Projects, RenderQueue, Output, PlanStudio – przyciski/spinnery/karty w palecie Deep Blue (primary, surface, border). Statusy success pozostają zielone.

---

## 7. Mobile (opcjonalnie) ⏳

- ✅ `index.html` ma `viewport`.
- ✅ Layout responsywny; kolory spójne.
- ⏳ **Pozostało:** Hamburger lub zwinięte „Create | Projects" w headerze na małych ekranach; CTA `w-full sm:w-auto` gdzie potrzeba.

---

## 8. Kolejność wdrożenia

**Faza 1 – Styl (Część B)** ✅ ZAKOŃCZONA  

1. ✅ index.css – paleta, body, scrollbar, .btn/.input/.card/.badge/.glow-primary
2. ✅ tailwind.config.js – primary (niebieski), surface, accent
3. ✅ Layout.tsx – nagłówek, logo, nawigacja, status (kolory, potem w stopce)
4. ✅ PlanStudio.tsx – usunięcie ✓, ▲/▼; separator
5. ✅ Output.tsx – Pass/Fail zamiast ✓/✗
6. ✅ QuickCreate, Projects, RenderQueue, Output, App – kolory, spinnery

**Faza 2 – Przyjazne UI (Część A)** ✅ ZAKOŃCZONA  
7. ✅ Layout.tsx – breadcrumb w main; status w stopce  
8. ✅ QuickCreate.tsx – „Opcje” zwinięte  
9. ✅ PlanStudio.tsx – menu „Narzędzia”; opisy pod zakładkami; sceny pogrupowane; panel walidacji (ostrzeżenia zwinięte)  
10. ✅ Projects.tsx – jedna główna akcja + menu „…”  
11. ✅ RenderQueue.tsx – logi zwinięte domyślnie  
12. ✅ Output.tsx – główny CTA + „More”; Render Log zwinięty  

---

## 9. Pliki do zmiany (lista)


| Plik                                 | Zmiany                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `apps/web/src/styles/index.css`      | Paleta, body, scrollbar, .btn, .input, .textarea, .select, .card, .badge |
| `apps/web/tailwind.config.js`        | theme.extend.colors (primary, opcjonalnie surface/accent)                |
| `apps/web/src/components/Layout.tsx` | Kolory nagłówka, logo, nav, StatusIndicator                              |
| `apps/web/src/pages/PlanStudio.tsx`  | Usunięcie ✓, ▲/▼; ewentualnie • →                                        |
| `apps/web/src/pages/Output.tsx`      | Zamiana ✓/✗ na Pass/Fail lub tylko styl                                  |
| `apps/web/src/pages/QuickCreate.tsx` | Klasy kolorów spójne z paletą                                            |
| `apps/web/src/pages/Projects.tsx`    | Klasy kolorów; opcjonalnie separator                                     |
| `apps/web/src/pages/RenderQueue.tsx` | Klasy kolorów, spinner                                                   |
| `apps/web/src/App.tsx`               | Kolor loadera                                                            |


Zmiany **UX (Część A)** dla Layout, QuickCreate, PlanStudio, Projects, RenderQueue, Output – opisane w sekcji A.2–A.7 (breadcrumb, zwinięte sekcje, jeden CTA, menu „…” / „Narzędzia” / „More”).

---

## 10. Kryteria zakończenia

**Styl (Część B)**  

- Aplikacja w ciemnym theme Deep Blue (tło, karty, obramowania).  
- Primary CTA w niebieskim z ewentualnym subtelnym glow.  
- Żadnych emotek ani symboli Unicode (✓, ✗, ▲, ▼) w interfejsie – zastąpione tekstem lub prostymi kształtami/SVG.  
- Spójna paleta na wszystkich stronach (Create, Projects, Plan Studio, Render Queue, Output).  
- Loader i spinnery w kolorze primary.

**Przyjazne UI (Część A)**  

- Na każdym ekranie jeden wyraźny główny CTA; reszta w menu / zwinięte.  
- Breadcrumb lub jasna ścieżka „Wstecz” w kontekście projektu.  
- Create: temat + niche + długość + CTA na wierzchu; Language/Tempo/Voice w zwiniętych „Opcjach”.  
- Plan Studio: header z jednym przyciskiem „Approve & Render”; Validate i Auto-fit w menu „Narzędzia”; zakładki z krótkim opisem; sceny z pogrupowanymi polami.  
- Projects: jedna główna akcja na kartę + menu „…” (View Output, Edit Plan, Duplicate, Delete).  
- Output: główny CTA (Download / View); pozostałe akcje w „More”; Render Log zwinięty.  
- Render Queue: logi zwinięte domyślnie („Pokaż logi”).  
- Status (OpenAI / FFmpeg / Dry-Run) w stopce lub zwiniętym panelu – mniej szumu w headerze.

---

# Pozostało do zrobienia

## Priorytet 1 (opcjonalne, UX na mobile)


| #   | Zadanie                | Plik                                      | Opis                                                                                  |
| --- | ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | **Mobile – nawigacja** | Layout.tsx                                | Na małych ekranach: hamburger menu lub zwinięte „Create                               |
| 2   | **Mobile – CTA**       | QuickCreate, Projects, PlanStudio, Output | Przyciski głównego CTA: `w-full sm:w-auto`, żeby na telefonie były pełnej szerokości. |


## Priorytet 2 (opcjonalne, dopracowanie)


| #   | Zadanie                             | Plik           | Opis                                                                                                                |
| --- | ----------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| 3   | **Output – Verification/Artifacts** | Output.tsx     | Sekcje Verification i Artifacts zwinięte domyślnie gdy długie (np. > 5 pozycji), z przyciskiem „Pokaż więcej".      |
| 4   | **Plan Studio – Regen w menu**      | PlanStudio.tsx | Opcjonalnie: przy każdej scenie przenieść „Regen" do menu „…" (Lock, Regenerate) zamiast dwóch osobnych przycisków. |


## Podsumowanie

- **Zrobione:** Faza 1 (Styl) i Faza 2 (Przyjazne UI) wg planu – Deep Blue, jeden CTA, breadcrumb, zwinięte sekcje, status w stopce, brak emotek.
- **Do zrobienia:** Tylko opcjonalne usprawnienia mobile (hamburger/zwinięta nawigacja, pełna szerokość CTA) oraz opcjonalnie zwinięte Verification/Artifacts i Regen w menu przy scenie.

