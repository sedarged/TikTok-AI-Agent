# Analiza kosztów: 60-sekundowe wideo "from scratch"

## Rzeczywiste koszty OpenAI (60s wideo)

### Plan (generacja planu)

Dla 60-sekundowego wideo średnio **~7 scen** (zależnie od niche pack: horror 6-8, facts 5-7, inne 5-7).

| Operacja            | Szacunek tokenów                        | Koszt        |
| ------------------- | --------------------------------------- | ------------ |
| **Hooks** (5 opcji) | ~500 input + 200 output = 700 tokenów   | ~$0.0005     |
| **Outline**         | ~400 input + 300 output = 700 tokenów   | ~$0.0005     |
| **Scenes** (7 scen) | ~800 input + 1200 output = 2000 tokenów | ~$0.0015     |
| **Razem (plan)**    | ~3400 tokenów                           | **~$0.0025** |

**Uwaga:** Jeśli użytkownik robi regeny (hooks, outline, script, scene), każde = +1 wywołanie chat (~700-2000 tokenów = ~$0.0005-0.0015). Przy 2-3 regenach: +$0.001-0.003.

---

### Render (pipeline wideo)

| Krok                                          | Użycie            | Koszt       |
| --------------------------------------------- | ----------------- | ----------- |
| **TTS** (7 scen × ~150 znaków)                | ~1050 znaków      | **~$0.016** |
| **Whisper** (transkrypcja 1 min audio)        | 1 minuta          | **~$0.006** |
| **DALL-E 3** (7 obrazów, 1024×1792, standard) | 7 obrazów × $0.02 | **~$0.14**  |

**Razem (render)** | | **~$0.162** |

---

### Całkowity koszt (plan + render)

| Składnik                           | Koszt           |
| ---------------------------------- | --------------- |
| Plan (hooks + outline + scenes)    | ~$0.0025        |
| Render (TTS + Whisper + DALL-E 3)  | ~$0.162         |
| **RAZEM (60s wideo from scratch)** | **~$0.16-0.17** |

**Z regenami (np. 2-3 regeny w Plan Studio):** +$0.001-0.003 → **~$0.17-0.20** total.

---

## Czy to jest "znikomy" koszt?

**Tak, $0.16-0.20 za 60-sekundowe wideo to bardzo niski koszt.**

Dla porównania:

- **Synthesia:** $18-89/mies. (limit wideo w planie) = ~$0.30-1.50+ per wideo (zależnie od planu).
- **Runway:** $12-76/mies. (limit minut) = ~$0.20-1.00+ per wideo.
- **Twoja aplikacja:** ~$0.16-0.20 per wideo (bez subskrypcji, tylko pay-per-use).

**Wniosek:** OpenAI API jest **znacznie tańsze** niż konkurencyjne SaaS z subskrypcją, jeśli generujesz kilka-kilkanaście wideo miesięcznie.

---

## Kiedy lokalne providery mają sens?

### Break-even: czas implementacji vs oszczędność

**Szacunek czasu implementacji lokalnych providerów:**

| Provider                      | Czas implementacji        | Oszczędność per wideo |
| ----------------------------- | ------------------------- | --------------------- |
| **ASR (Whisper local)**       | ~4-6h                     | ~$0.006               |
| **TTS (Edge TTS)**            | ~2-3h                     | ~$0.016               |
| **Plan (Ollama)**             | ~6-8h                     | ~$0.0025              |
| **Obrazy (Stable Diffusion)** | ~8-12h + konfiguracja GPU | ~$0.14                |
| **Razem (wszystkie)**         | ~20-29h                   | ~$0.16-0.17           |

**Break-even point:**

- **Tylko ASR + TTS:** ~$0.022 oszczędność per wideo, ~6-9h implementacji → **zwrot po ~270-410 wideo**.
- **Wszystkie (łącznie z SD):** ~$0.16-0.17 oszczędność per wideo, ~20-29h implementacji → **zwrot po ~120-180 wideo**.

**Czyli:** Jeśli generujesz **<100-200 wideo**, czas implementacji **nie zwróci się** szybko. Jeśli generujesz **>500-1000 wideo**, lokalne providery **mają sens** (oszczędność $80-170+ vs ~20-30h pracy).

---

## Rekomendacja (praktyczna)

### Scenariusz 1: Generujesz <50-100 wideo/miesiąc

**Nie warto** implementować lokalnych providerów teraz.

- Koszt OpenAI: ~$8-20/miesiąc (50-100 wideo × $0.16-0.20).
- Czas implementacji lokalnych: ~20-30h.
- Break-even: >200-400 wideo (kilka miesięcy).

**Lepiej:** Skup się na **funkcjach, które przynoszą wartość** (lepsze UI, nowe features, optymalizacja pipeline'u). Koszt OpenAI jest **akceptowalny** przy tym wolumenie.

---

### Scenariusz 2: Generujesz >200-500 wideo/miesiąc

**Warto** rozważyć lokalne providery, ale **stopniowo**:

1. **Najpierw TTS (Edge TTS)** – najprostsze (~2-3h), największa oszczędność w renderze (~$0.016 per wideo). Przy 500 wideo/miesiąc = **$8/miesiąc oszczędności** → zwrot po ~1-2 miesiącach.
2. **Potem ASR (Whisper local)** – ta sama jakość (~4-6h), ~$0.006 per wideo. Przy 500 wideo = **$3/miesiąc** → zwrot po ~2-3 miesiącach.
3. **Na końcu Obrazy (SD)** – największa oszczędność (~$0.14 per wideo), ale najwięcej pracy (~8-12h + GPU). Przy 500 wideo = **$70/miesiąc** → zwrot po ~1-2 miesiącach, ale wymaga GPU.

**Plan (Ollama)** – najmniejsza oszczędność (~$0.0025 per wideo), można pominąć na początku.

---

### Scenariusz 3: Generujesz >1000 wideo/miesiąc lub chcesz pełną kontrolę/prywatność

**Tak, implementuj lokalne providery** – break-even jest szybki, a oszczędność znacząca ($160-200+/miesiąc).

---

## Podsumowanie

- **Koszt OpenAI:** ~$0.16-0.20 za 60-sekundowe wideo "from scratch" – **to jest znikomy koszt** w porównaniu do konkurencji (Synthesia $0.30-1.50+, Runway $0.20-1.00+).
- **Czy lokalne providery mają sens?**
  - **<100 wideo/miesiąc:** Nie – koszt OpenAI jest akceptowalny (~$16-20/miesiąc), czas implementacji nie zwróci się szybko.
  - **200-500 wideo/miesiąc:** Tak, ale **stopniowo** – najpierw TTS (Edge TTS), potem ASR (Whisper), na końcu Obrazy (SD) jeśli masz GPU.
  - **>1000 wideo/miesiąc:** Tak – wszystkie lokalne providery mają sens, break-even szybki ($160-200+/miesiąc oszczędności).

**Moja rekomendacja:**  
Dla **większości użytkowników** (generujących kilka-kilkanaście wideo miesięcznie) **koszt OpenAI jest znikomy** i **nie warto** teraz implementować lokalnych providerów. Lepiej skupić się na **funkcjach, które przynoszą wartość** (lepsze UI, wgląd w koszty, nowe features).

**Lokalne providery** mają sens jeśli:

1. Generujesz **>200-500 wideo/miesiąc** (wtedy TTS + ASR = szybki zwrot).
2. Potrzebujesz **pełnej prywatności** / offline (wtedy wszystkie lokalne).
3. Masz **GPU** i chcesz **maksymalną oszczędność** (wtedy SD = $70+/miesiąc przy 500 wideo).

**Dla Ciebie (początkujący, testowanie lokalnie):** Koszt OpenAI jest **akceptowalny** (~$0.16-0.20 per wideo). Lokalne providery można dodać **później**, gdy wolumen wzrośnie lub gdy będziesz potrzebował pełnej kontroli/prywatności.
