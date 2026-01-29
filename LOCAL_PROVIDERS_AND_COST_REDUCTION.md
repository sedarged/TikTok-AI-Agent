# Lokalne zamienniki API – redukcja kosztów bez wpływu na jakość

## Cel

Użyć **Twojego komputera** (lub lokalnych bibliotek/serwisów) zamiast płatnych API tam, gdzie da się zachować jakość. Dzięki temu koszty spadają do zera (lub prawie) dla wybranych kroków pipeline’u.

---

## 1. Gdzie dziś płacisz (OpenAI)

| Krok | API | Koszt | Lokalna alternatywa |
|------|-----|--------|----------------------|
| **Plan (hooks, outline, sceny)** | Chat gpt-4o-mini | ~$0.15–0.60 / 1M tokenów | **Ollama** – model lokalnie (Llama, Mistral itd.) |
| **TTS (głos)** | tts-1 | ~$0.015 / 1K znaków | **Edge TTS** (darmowy) lub **Piper** (lokalnie) |
| **ASR (transkrypcja)** | whisper-1 | ~$0.006 / min | **Whisper lokalnie** (whisper-node / whisper.cpp) |
| **Obrazy** | DALL-E 3 | per obraz | **Stable Diffusion** (lokalnie, GPU) lub **FLUX** |

Poniżej: co konkretnie użyć, jak to podłączyć i jaki wpływ na jakość.

---

## 2. Plan (generacja tekstu – hooks, outline, sceny)

### Lokalnie: Ollama + model (np. Llama 3.2, Mistral)

- **Co to jest:** Ollama uruchamia modele LLM na Twoim PC (Windows/Mac/Linux). API kompatybilne z „chat” (wiadomości, JSON).
- **Jakość:** Dobre modele (Llama 3.2 3B+, Mistral 7B) dają sensowne hooki/outline/sceny i JSON, jeśli prompt jest jasny. Jakość finalnego wideo zależy od treści – przy sensownych promptach można uzyskać wynik **porównywalny** do gpt-4o-mini.
- **Koszt:** **$0** – tylko zużycie prądu i ewentualnie RAM/GPU.
- **Jak podłączyć:**
  1. Zainstaluj [Ollama](https://ollama.com), uruchom np. `ollama run llama3.2`.
  2. W backendzie zamiast `callOpenAI(...)` wywołać lokalne API Ollama (np. `POST http://localhost:11434/api/chat` z tym samym promptem i prośbą o JSON).
  3. Env: np. `LLM_PROVIDER=openai` vs `LLM_PROVIDER=ollama`; przy `ollama` nie używać klucza OpenAI do planu.

**Biblioteka Node:** `ollama` (npm) – oficjalny klient. Można napisać warstwę „provider”: `callLLM(prompt, format)` → wewnętrznie OpenAI albo Ollama w zależności od ustawienia.

---

## 3. TTS (text-to-speech)

### Opcja A: Edge TTS (Microsoft, darmowy)

- **Co to jest:** Usługa Microsoft Edge Read Aloud – generuje mowę z tekstu. Działa z Node.js (np. `msedge-tts` lub `edge-tts-node`). **Nie** wymaga GPU; wymaga internetu (wywołanie do serwerów MS).
- **Jakość:** Bardzo dobra, naturalne głosy, wiele języków. Dla finalnego wideo **bez wyraźnej straty** względem OpenAI TTS.
- **Koszt:** **$0** (użycie niekomercyjne; sprawdź regulamin).
- **Jak podłączyć:** W pipeline’u TTS zamiast `generateTTS(...)` z OpenAI wywołać np. `edgeTTS(text, voice, outputPath)`. Głosy mapować na nazwy Edge (np. `en-US-GuyNeural`). Env: `TTS_PROVIDER=openai` vs `TTS_PROVIDER=edge`.

### Opcja B: Piper (w pełni lokalnie)

- **Co to jest:** Silnik TTS działający lokalnie (Python lub HTTP server). Brak internetu po pobraniu modeli.
- **Jakość:** Dobra, wiele języków i głosów. Dla wielu zastosowań **wystarczająca** do finalnego wideo.
- **Koszt:** **$0**, tylko CPU/RAM.
- **Jak podłączyć:** Uruchomić Piper jako serwis (HTTP); z Node wywołać `POST /synthesize` z tekstem i głosem, zapisać plik audio. Env: `TTS_PROVIDER=piper`, `PIPER_URL=http://localhost:5000` (przykład).

**Rekomendacja:** Na start **Edge TTS** – zero kosztów, proste w Node, bardzo dobra jakość. Piper – gdy chcesz **całkowicie offline**.

---

## 4. ASR (transkrypcja – Whisper)

### Lokalnie: Whisper (ten sam model co API)

- **Co to jest:** Model Whisper OpenAI jest open-source. Można go uruchomić lokalnie (np. **whisper-node** – bindingi do whisper.cpp, lub serwer whisper.cpp z API).
- **Jakość:** **Ta sama** co Whisper w chmurze – ten sam model, te same timestampy/słowa. Brak wpływu na jakość finalnego wideo (napisy, alignment).
- **Koszt:** **$0** – tylko CPU (lub GPU, jeśli skonfigurowane).
- **Jak podłączyć:** Zainstalować np. `whisper-node`, pobrać model (np. `base` lub `small`). W pipeline’u zamiast `transcribeAudio(...)` z OpenAI wywołać lokalne `whisper(audioPath)`. Env: `ASR_PROVIDER=openai` vs `ASR_PROVIDER=local`. Cache (hash pliku audio) zostaje – nadal możesz go używać.

**Uwaga:** Na słabszym PC większe modele (large) mogą być wolne; `small` lub `base` zwykle wystarczą do jakości napisów.

---

## 5. Obrazy (generacja scen)

### Lokalnie: Stable Diffusion (np. SDXL, FLUX)

- **Co to jest:** Stable Diffusion / FLUX uruchamiane na Twoim komputerze (np. przez AUTOMATIC1111 Web UI lub ComfyUI). Często przez **API** (A1111 ma wbudowane API, ComfyUI też).
- **Jakość:** SDXL/FLUX dają **bardzo dobrą** jakość; styl może się nieznacznie różnić od DALL-E, ale dla TikTokowego wideo zwykle **bez wyraźnej straty** jakości, jeśli prompt jest dobry.
- **Koszt:** **$0** po instalacji – wymaga **GPU** (NVIDIA z kilkoma GB VRAM) dla sensownej prędkości. Bez GPU generowanie może trwać długo (CPU).
- **Jak podłączyć:** Uruchomić A1111 lub ComfyUI z włączonym API. W `generateImage` zamiast DALL-E wywołać np. `POST http://localhost:7860/sdapi/v1/txt2img` (A1111) z promptem, rozmiarem (np. 576×1024 dla 9:16), zapisać wynik. Env: `IMAGE_PROVIDER=openai` vs `IMAGE_PROVIDER=stable-diffusion`, `SD_API_URL=http://localhost:7860`. Cache (hash promptu + size) nadal można używać.

**Uwaga:** Trzeba dobrać model (np. SDXL 1.0) i ewentualnie negative prompt – Twoja aplikacja już ma `visualPrompt` i `negativePrompt`, więc mapowanie 1:1 jest proste.

---

## 6. Jak to wpleść w aplikację (bez psucia jakości)

### 6.1 Warstwa „provider” (abstrakcja)

Zamiast wywoływać bezpośrednio OpenAI w wielu miejscach, wprowadzić:

- **Plan:** `getLLMProvider()` → `OpenAIProvider` lub `OllamaProvider`; oba mają `chat(prompt, options)` zwracające tekst (i ewentualnie usage).
- **TTS:** `getTTSProvider()` → `OpenAITTS` lub `EdgeTTS` (lub `PiperTTS`); wszystkie mają `synthesize(text, voice, outputPath)`.
- **ASR:** `getASRProvider()` → `OpenAIWhisper` lub `LocalWhisper`; oba mają `transcribe(audioPath)` → `{ text, words }`.
- **Obrazy:** `getImageProvider()` → `DALLE3` lub `StableDiffusion`; oba mają `generate(prompt, outputPath, size)`.

Pipeline (render, plan) wywołuje tylko te interfejsy; wybór providera z env (np. `LLM_PROVIDER`, `TTS_PROVIDER`, `ASR_PROVIDER`, `IMAGE_PROVIDER`).

### 6.2 Zmienne env (propozycja)

```env
# Plan (hooks, outline, sceny)
LLM_PROVIDER=openai   # lub ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# TTS
TTS_PROVIDER=openai   # lub edge | piper
# Edge: głos wybierany z listy (np. en-US-GuyNeural)
# Piper: PIPER_URL=http://localhost:5000

# ASR (transkrypcja)
ASR_PROVIDER=openai   # lub local
# Local: whisper-node lub WHISPER_SERVER_URL=http://localhost:2022

# Obrazy
IMAGE_PROVIDER=openai # lub stable-diffusion
SD_API_URL=http://localhost:7860
```

Domyślnie wszystko zostaje na OpenAI; przełączasz po jednym providerze na lokalny, bez zmiany reszty pipeline’u.

### 6.3 Kolejność wdrożenia (minimalny wpływ na jakość)

| Krok | Co włączyć | Wpływ na jakość | Oszczędność |
|------|------------|------------------|-------------|
| 1 | **ASR → local (Whisper)** | Brak – ten sam model | 100% kosztu Whisper |
| 2 | **TTS → Edge TTS** | Bardzo mały lub brak | 100% kosztu TTS |
| 3 | **Plan → Ollama** | Możliwa drobna różnica w treści; dopracowanie promptów wyrównuje | 100% kosztu chat |
| 4 | **Obrazy → Stable Diffusion** | Możliwa lekka różnica stylu; dopasowanie modelu/promptów wyrównuje | 100% kosztu DALL-E |

Rekomendacja: najpierw **ASR** i **TTS** (najprostsze, zero lub minimalna różnica jakości), potem **Ollama** (jeśli masz RAM/GPU pod model), na końcu **SD** (jeśli masz GPU).

---

## 7. Podsumowanie

- **Tak** – możesz użyć swojego komputera i lokalnych bibliotek, żeby **znacznie zredukować koszty** (nawet do zera dla planu, TTS, ASR i obrazów), **bez wyraźnego wpływu na jakość** finalnego wideo, jeśli:
  - ASR: Whisper lokalnie = ta sama jakość co API.
  - TTS: Edge TTS lub Piper = bardzo dobra jakość.
  - Plan: Ollama + dobry model (Llama/Mistral) = porównywalna jakość przy dobrych promptach.
  - Obrazy: Stable Diffusion lokalnie (GPU) = bardzo dobra jakość przy sensownym modelu i promptach.
- **Jak:** Abstrakcja providerów (LLM, TTS, ASR, Image) + wybór przez env. Pipeline bez zmian logiki, tylko wywołuje wybrany provider.
- **Dokument:** Ten plik można traktować jako specyfikację rozszerzenia „local providers”; kolejnym krokiem może być dopisanie go do planu (np. Faza „Local providers”) i realizacja krok po kroku (najpierw ASR, potem TTS, potem LLM, na końcu SD).
