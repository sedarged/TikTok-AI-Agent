# Koszty generacji i pipeline – wgląd oraz redukcja bez wpływu na jakość

## 1. Skąd biorą się koszty (obecny pipeline)

### Plan (generacja planu – OpenAI Chat, model `gpt-4o-mini`)

| Operacja                                   | Wywołania API | Uwagi                                                                    |
| ------------------------------------------ | ------------- | ------------------------------------------------------------------------ |
| **Generate Plan** (Create → Generate Plan) | 3× chat       | Hooks (1), Outline (1), Scenes (1 – wszystkie sceny w jednym wywołaniu). |
| **Regenerate Hooks**                       | 1× chat       | Tylko gdy użytkownik klika „Regenerate Hooks”.                           |
| **Regenerate Outline**                     | 1× chat       | Tylko gdy „Regenerate Outline”.                                          |
| **Regenerate Script**                      | 1× chat       | Tylko gdy „Regenerate Script”.                                           |
| **Regenerate Scene** (jedna scena)         | 1× chat       | Za każdym „Regen” na jednej scenie.                                      |

Szacunkowo: **jedno pełne wygenerowanie planu ≈ 3 wywołania chat** (hooks + outline + scenes). Każde regen = +1 wywołanie.  
Koszt: **gpt-4o-mini** – ok. $0.15/1M tokenów wejście, $0.60/1M wyjście (ceny orientacyjne; sprawdź [OpenAI Pricing](https://platform.openai.com/docs/pricing)).

---

### Render (pipeline wideo – OpenAI TTS, Whisper, DALL-E 3)

| Krok                   | API         | Jednostka kosztu               | Uwagi                                                                                                                           |
| ---------------------- | ----------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **TTS** (głos)         | `tts-1`     | ~$0.015 / 1K znaków            | Jedno wywołanie na scenę (tekst narracji). **Cache:** ten sam tekst+voice = brak ponownego wywołania.                           |
| **ASR** (transkrypcja) | `whisper-1` | ~$0.006 / minuta audio         | Jedno wywołanie na cały plik audio. **Cache:** ten sam plik (hash) = brak ponownego wywołania.                                  |
| **Obrazy**             | `dall-e-3`  | Zależnie od rozmiaru i quality | Jedno wywołanie na scenę. Rozmiar: `1024x1792`, quality: `standard`. **Cache:** ten sam prompt+size = brak ponownego wywołania. |

Szacunkowo na jeden render (np. 7 scen, 60 s):

- TTS: 7 scen × ~200 znaków ≈ 1.4K znaków → ~$0.02
- Whisper: 1 min → ~$0.006
- DALL-E 3: 7 obrazów (standard 1024×1792) – największy koszt (sprawdź aktualne ceny DALL-E 3).

**Cache** (model `Cache` w Prisma – images, tts, asr) **już redukuje koszty** przy powtarzanych scenariuszach / tych samych tekstach.

---

## 2. Co jest dziś (brak wglądu w koszty)

- **Brak zapisu usage** – odpowiedzi OpenAI (chat) zawierają `usage: { prompt_tokens, completion_tokens }`, ale kod tego nie zapisuje.
- **Brak szacowania kosztu** – nigdzie w aplikacji nie ma wyliczenia $/run ani $/projekt.
- **Brak ustawień „oszczędności”** – nie ma wyboru modelu (np. tańszy chat), rozmiaru obrazu ani quality DALL-E w UI.

Dlatego **wgląd** i **redukcja kosztów** wymagają: (A) zbierania usage i ewentualnie szacowania kosztu, (B) opcjonalnych ustawień oszczędności (bez pogorszenia jakości finalnego wideo, gdzie to możliwe).

---

## 3. Wgląd w koszty – co dodać

### 3.1 Zbieranie usage (backend)

- **Chat (plan):** W `callOpenAI` po `client.chat.completions.create` odczytać `response.usage` (prompt_tokens, completion_tokens) i zwracać razem z contentem (np. `{ content, usage }`). W miejscach wywołania (planGenerator) zapisywać usage do bazy.
- **TTS / Whisper / Images:** OpenAI nie zwraca tokenów w tych samych jednostkach; TTS jest per znak, Whisper per minuta, DALL-E per obraz. Można:
  - **Opcja A:** Zbierać tylko to, co API zwraca (np. dla chat – tokeny; dla TTS – liczba znaków wejścia; dla Whisper – długość pliku w sekundach; dla DALL-E – liczba wywołań) i trzymać w strukturze „usage” (np. per run).
  - **Opcja B:** Dodać **szacowanie kosztu** po stronie serwera (tabela cen per model/jednostka, mnożnik × usage) i zapisywać np. `estimatedCostUsd` per run (i opcjonalnie per plan).

Propozycja: **Opcja A** jako pierwszy krok (surowe dane: tokeny, znaki, minuty, liczba obrazów), potem **Opcja B** (szacunek w $) w Control Panel lub na stronie Run/Project.

### 3.2 Gdzie przechowywać

- **Per run (render):** W tabeli `Run` dodać pole np. `usageJson` (JSON: `{ ttsChars, whisperSeconds, imageCount, chatTokens }`) oraz opcjonalnie `estimatedCostUsd`.
- **Per plan (generacja planu):** W `PlanVersion` dodać np. `usageJson` (tokeny z każdego wywołania: hooks, outline, scenes, regen) oraz opcjonalnie `estimatedCostUsd`.  
  Alternatywa: osobna tabela `UsageRecord` (runId / planVersionId, step, tokens/chars/seconds, estimatedCostUsd) – daje elastyczność, więcej kodu.

Propozycja: na początek **rozszerzenie Run + PlanVersion** o `usageJson` (+ opcjonalnie `estimatedCostUsd`) – mniej zmian, szybki wgląd per run i per plan.

### 3.3 Gdzie pokazać w UI

| Miejsce                           | Co pokazać                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Control Panel**                 | Podsumowanie: suma kosztów (szac.) po ostatnich N runach / wszystkich projektach; opcjonalnie wykres „Koszty w czasie”. Sekcja „Usage & cost” (zwinięta domyślnie).             |
| **Strona Run (Output)**           | Dla danego runu: usage (tokeny, znaki TTS, minuty Whisper, liczba obrazów) + szac. koszt w $ (jeśli wdrożone).                                                                  |
| **Strona projektu / Plan Studio** | Dla ostatniego planu: usage generacji planu (tokeny) + szac. koszt (jeśli wdrożone). Opcjonalnie: „Szac. koszt renderu” na podstawie liczby scen (bez uruchomienia pipeline’u). |

Dzięki temu masz **wgląd** na poziomie: (1) całej aplikacji (Control), (2) pojedynczego runu, (3) pojedynczego planu/projektu.

---

## 4. Redukcja kosztów bez wpływu na jakość finalnego wideo

Poniższe opcje **nie pogarszają** odbioru finalnego wideo (lub pogarszają minimalnie), a zmniejszają koszt.

### 4.1 Już zaimplementowane

- **Cache (TTS, ASR, images)** – przy powtarzanych tekstach / tych samych promptach nie ma ponownych wywołań API. Warto w UI (np. Control) pokazać statystykę: „Cache hits: X” (np. liczba odczytów z Cache w ostatnich runach), żeby było widać, że oszczędzasz.

### 4.2 Proste zmiany (konfiguracja / backend)

| Obszar           | Opcja                                                   | Wpływ na jakość                      | Wpływ na koszt             |
| ---------------- | ------------------------------------------------------- | ------------------------------------ | -------------------------- |
| **Plan – model** | Zostawić `gpt-4o-mini` (już tańszy od gpt-4)            | Brak                                 | Już zoptymalizowane        |
| **TTS**          | Zostawić `tts-1` (zamiast `tts-1-hd`)                   | Minimalna różnica w jakości głosu    | tts-1 tańszy               |
| **Obrazy**       | Zostawić `quality: standard` (zamiast `hd`)             | Mniejsza rozdzielczość detali        | Standard tańszy            |
| **Obrazy**       | Rozmiar `1024x1792` – odpowiedni do 9:16; nie zwiększać | –                                    | Unikasz zbędnego rozmiaru  |
| **Sceny**        | Mniej scen przy tej samej długości (np. dłuższe ujęcia) | Mniej cięć = często spójniejszy film | Mniej wywołań DALL-E i TTS |

Rekomendacja: **nie zmieniać** modeli/quality na jeszcze tańsze kosztem wyraźnej jakości; **opcjonalnie** w projekcie dodać ustawienie „Maks. liczba scen” (cap), żeby ograniczyć koszt przy bardzo długich filmach.

### 4.3 Ustawienia „economy” (opcjonalnie w Control Panel)

- **Plan:** Wybór modelu chat (np. `gpt-4o-mini` vs jeszcze tańszy, gdy będzie dostępny). Domyślnie: `gpt-4o-mini`.
- **Render:**
  - **TTS:** wybór `tts-1` (domyślnie) vs `tts-1-hd` (lepsza jakość, wyższy koszt) – **domyślnie tts-1 = oszczędność bez wyraźnej straty jakości**.
  - **Obrazy:** wybór `standard` (domyślnie) vs `hd` – **domyślnie standard**.
  - **Cap scen:** „Maks. liczba scen w renderze” (np. 10) – ogranicza skrajne przypadki (bardzo długi skrypt → mniej obrazów/TTS).

Te opcje można trzymać w **env** (np. `APP_TTS_MODEL=tts-1`, `APP_DALLE_QUALITY=standard`) lub w przyszłości w **ustawieniach w DB** eksponowanych w Control Panel. Wtedy w UI: sekcja „Cost & quality” z opisem: „Obecne ustawienia minimalizują koszt przy zachowaniu jakości; możesz włączyć HD jeśli potrzebujesz”.

### 4.4 Redukcja „manualna” (bez zmian w kodzie)

- Ograniczać **regen** (hooks/outline/script/scene) do koniecznego minimum – każde regen = dodatkowe wywołanie chat.
- Przy długich filmach – **krótszy skrypt / mniej scen** (np. target 60 s zamiast 3 min) – mniej TTS i mniej obrazów.
- Wykorzystywać **cache**: podobne projekty (ten sam niche, podobny tekst) będą zużywać mniej API po pierwszym renderze.

---

## 5. Propozycja wdrożenia (kolejność)

| Faza  | Co zrobić                                                                                                                                                                                                                                                                                                                                                                             | Efekt                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **1** | W `callOpenAI` zbierać `usage` (prompt_tokens, completion_tokens) i przekazywać do wywołujących; w planGenerator zapisywać usage do `PlanVersion.usageJson` (np. suma po hooks+outline+scenes). W renderze (openai.ts): po TTS/Whisper/DALL-E zapisywać do `Run.usageJson` (znaki TTS, sekundy Whisper, liczba obrazów). Rozszerzyć schema: `PlanVersion.usageJson`, `Run.usageJson`. | Surowe dane usage per plan i per run.                                           |
| **2** | W Control Panel (i ewentualnie na stronie Run/Output) wyświetlać **usage** (tokeny, znaki, minuty, liczba obrazów) z `usageJson`. Sekcja „Usage” w Control: np. suma z ostatnich 30 runów.                                                                                                                                                                                            | Wgląd w zużycie bez szacunku $.                                                 |
| **3** | Dodać na backendzie **szacowanie kosztu** (tabela cen dla gpt-4o-mini, tts-1, whisper-1, dall-e-3; mnożnik × usage). Zapis w `Run.estimatedCostUsd` i `PlanVersion.estimatedCostUsd`. W UI pokazać „Szac. koszt: ~$X” przy runie i przy planie. W Control: „Suma szac. kosztów (ostatnie N runów)”.                                                                                   | Wgląd w koszty w $.                                                             |
| **4** | (Opcjonalnie) W Control Panel sekcja „Cost & quality”: wybór TTS model (tts-1 / tts-1-hd), DALL-E quality (standard / hd), opcjonalnie cap scen. Zapis w env lub w DB; pipeline czyta i stosuje.                                                                                                                                                                                      | Możliwość redukcji kosztów z UI przy zachowaniu jakości (domyślne = oszczędne). |

---

## 6. Podsumowanie

- **Koszty** pochodzą z **planu** (chat gpt-4o-mini: hooks, outline, sceny, regeny) oraz **renderu** (TTS, Whisper, DALL-E 3). Cache już ogranicza powtórzenia.
- **Wgląd:** zbieranie usage (tokeny, znaki, minuty, liczba obrazów) w `PlanVersion` i `Run`, potem szacunek kosztu w $; wyświetlanie w Control Panel, na stronie Run i przy planie.
- **Redukcja bez straty jakości:** zostawić tts-1, standard DALL-E, gpt-4o-mini; opcjonalnie cap scen i ustawienia „economy” w Control (TTS/DALL-E quality); ograniczać regeny; wykorzystywać cache.

Po wdrożeniu faz 1–3 będziesz miał **pełny wgląd w koszty generacji i pipeline’u**; faza 4 daje **możliwość redukcji kosztów z poziomu UI** przy zachowaniu jakości finalnego wideo.
