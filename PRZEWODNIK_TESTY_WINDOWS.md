# 🧪 Przewodnik Testowania Lokalnego - Windows

## 📋 Wymagania wstępne

Przed rozpoczęciem upewnij się, że masz zainstalowane:

1. **Node.js** (wersja 18 lub nowsza)
   - Sprawdź: `node --version`
   - Pobierz z: https://nodejs.org/

2. **npm** (zazwyczaj instalowany razem z Node.js)
   - Sprawdź: `npm --version`

3. **Git** (opcjonalnie, do klonowania repozytorium)
   - Sprawdź: `git --version`

## 🚀 Szybki Start - Automatyczna Instalacja

### Opcja A: Interaktywny Skrypt (Zalecane dla Początkujących)

Najprostszy sposób - skrypt z menu:

```powershell
.\test-lokalnie.bat
```

Wybierz opcję 1 z menu, aby uruchomić pełną instalację.

### Opcja B: Bezpośredni Skrypt Instalacyjny

Alternatywnie możesz użyć:

```powershell
.\setup-testing.bat
```

Ten skrypt automatycznie:
1. ✅ Zainstaluje wszystkie zależności
2. ✅ Wygeneruje klienta Prisma
3. ✅ Utworzy bazę danych SQLite
4. ✅ Wypełni bazę danymi testowymi
5. ✅ Uruchomi testy backendu
6. ✅ Uruchomi serwery deweloperskie (backend + frontend)

## 📝 Instalacja Krok po Kroku (Ręczna)

Jeśli wolisz wykonać kroki ręcznie:

### Krok 1: Instalacja zależności

```powershell
npm install
```

### Krok 2: Generowanie klienta Prisma

```powershell
npm run db:generate
```

### Krok 3: Utworzenie bazy danych

```powershell
npm run db:migrate:dev
```

### Krok 4: Wypełnienie bazy danymi testowymi

```powershell
npm run db:seed
```

### Krok 5: Uruchomienie testów backendu

```powershell
npm run test
```

### Krok 6: Uruchomienie środowiska deweloperskiego

```powershell
npm run dev
```

To uruchomi jednocześnie:
- **Backend** na http://localhost:3001
- **Frontend** na http://localhost:5173

## 🌐 Dostęp do Aplikacji

Po uruchomieniu `npm run dev`, otwórz w przeglądarce:

| Komponent | URL | Opis |
|-----------|-----|------|
| **Interfejs Webowy** | http://localhost:5173 | React frontend |
| **API Backend** | http://localhost:3001/api | Express backend |
| **Baza danych** | `apps/server/app.db` | SQLite (plik) |

## 🧪 Rodzaje Testów

### 1. Testy Backendu (Unit + Integration)

```powershell
# Wszystkie testy
npm run test

# Tylko testy renderowania (dry-run)
npm run test:render

# Testy w trybie watch (automatyczne uruchamianie przy zmianach)
cd apps/server
npm run test:watch
```

### 2. Testy E2E (End-to-End)

Testy Playwright wymagają uruchomionego serwera:

```powershell
# W jednym terminalu - uruchom serwer
npm run dev

# W drugim terminalu - uruchom testy e2e
npm run test:e2e
```

## 🎯 Testowanie Ręczne w Przeglądarce

### Tworzenie Projektu

1. Otwórz http://localhost:5173
2. Kliknij "Create Project" lub "Quick Create"
3. Wypełnij formularz:
   - **Topic**: "Scary ghost stories" (przykład)
   - **Niche Pack**: Wybierz "Horror"
   - **Target Length**: 60 sekund
   - **Tempo**: "normal"
4. Kliknij "Generate Plan"
5. Poczekaj na wygenerowanie planu przez AI

### Przeglądanie i Edycja Planu

1. Na stronie Projects zobaczysz nowy projekt
2. Kliknij, aby otworzyć "Plan Studio"
3. Sprawdź:
   - ✅ Opcje hooków (wybierz jeden)
   - ✅ Strukturę outline
   - ✅ Pełny skrypt
   - ✅ Poszczególne sceny z narracją i promptami wizualnymi
   - ✅ Presety efektów (dopasowane do niche pack)
4. Edytuj narrację/wizualizacje scen
5. Kliknij "Approve Plan"

### Uruchomienie Renderowania

1. Kliknij przycisk "Render"
2. Przejdź do "Render Queue"
3. Obserwuj postęp w czasie rzeczywistym:
   - Krok 1: `tts_generate` (15%)
   - Krok 2: `asr_align` (25%)
   - Krok 3: `images_generate` (40%)
   - Krok 4: `captions_build` (60%)
   - Krok 5: `music_build` (75%)
   - Krok 6: `ffmpeg_render` (90%)
   - Krok 7: `finalize_artifacts` (100%)
4. Zobacz logi w sidebarze
5. **Uwaga**: W trybie dry-run wideo będzie puste (bez kosztów)

### Przeglądanie Wyników

1. Po zakończeniu renderowania kliknij "View Output"
2. Zobacz ścieżki artefaktów:
   - Plik MP4 wideo (pusty w dry-run)
   - Miniaturka JPG
   - Plik ASS z napisami
   - Audio MP3

## 🔍 Sprawdzanie Bazy Danych

Możesz sprawdzić dane testowe w bazie SQLite:

### Opcja 1: Prisma Studio (Graficzny Interfejs)

```powershell
npm run db:studio
```

Otworzy się przeglądarka z interfejsem graficznym do przeglądania danych.

### Opcja 2: SQLite CLI

```powershell
# Zainstaluj SQLite CLI jeśli nie masz
# Następnie:
sqlite3 apps/server/app.db
```

Przydatne zapytania SQL:

```sql
-- Zobacz liczbę projektów
SELECT COUNT(*) FROM "Project";

-- Zobacz pierwsze 3 projekty
SELECT * FROM "Project" LIMIT 3;

-- Zobacz wersje planu dla projektu
SELECT * FROM "PlanVersion" WHERE "projectId" = '<project-id>';

-- Zobacz sceny
SELECT * FROM "Scene" LIMIT 5;

-- Zobacz ostatnie renderowania
SELECT * FROM "Run" ORDER BY "createdAt" DESC LIMIT 5;

-- Wyjdź z SQLite
.exit
```

## ⚙️ Konfiguracja Środowiska

Pliki `.env.local` są już skonfigurowane:

- **apps/server/.env.local** - Tryb dry-run (bez płatnych wywołań API)
- **apps/web/.env.local** - URL API frontendu

### Kluczowe Ustawienia

```env
# Backend: Tryb dry-run (bez kosztów OpenAI API)
APP_RENDER_DRY_RUN=1        # Pełny pipeline bez płatnych API
APP_TEST_MODE=1             # Mockowane odpowiedzi OpenAI

# Frontend: Endpoint API
VITE_API_URL=http://localhost:3001/api
```

## 🐛 Rozwiązywanie Problemów

### Problem: "npm run test" nie działa na Windows

**Rozwiązanie**: Skrypty testowe używają składni Unix. Użyj `setup-testing.bat` lub zobacz sekcję "Naprawa Skryptów Testowych" poniżej.

### Problem: Port już zajęty

**Błąd**: `Error: listen EADDRINUSE: address already in use :::3001`

**Rozwiązanie**:
```powershell
# Znajdź proces używający portu
netstat -ano | findstr :3001

# Zabij proces (zamień PID na numer z poprzedniego polecenia)
taskkill /PID <PID> /F
```

### Problem: Baza danych jest zablokowana

**Rozwiązanie**: Zamknij wszystkie połączenia do bazy (Prisma Studio, inne procesy) i spróbuj ponownie.

### Problem: Testy nie przechodzą

**Rozwiązanie**:
1. Sprawdź czy baza danych istnieje: `apps/server/app.db`
2. Uruchom ponownie migracje: `npm run db:migrate:dev`
3. Uruchom seed: `npm run db:seed`
4. Sprawdź logi błędów w terminalu

## 📚 Dodatkowe Zasoby

- **TESTING_GUIDE.md** - Pełny przewodnik testowania (po angielsku)
- **README.md** - Dokumentacja projektu
- **SECURITY.md** - Informacje o bezpieczeństwie

## 💡 Wskazówki dla Początkujących

1. **Zawsze używaj `setup-testing.bat`** - to najprostszy sposób na rozpoczęcie
2. **Sprawdź czy porty są wolne** - przed uruchomieniem `npm run dev`
3. **Używaj Prisma Studio** - łatwiejsze niż SQLite CLI do przeglądania danych
4. **Tryb dry-run jest bezpieczny** - nie generuje kosztów API
5. **Czytaj logi w terminalu** - zawierają przydatne informacje o błędach

## 🎓 Następne Kroki

Po przetestowaniu podstawowych funkcji:

1. Przeczytaj `TESTING_GUIDE.md` dla zaawansowanych scenariuszy
2. Sprawdź testy e2e w `apps/web/tests/e2e/`
3. Eksperymentuj z różnymi niche packs
4. Testuj obsługę błędów (zobacz sekcję "Test Error Handling" w TESTING_GUIDE.md)

---

**Powodzenia! 🚀**

Jeśli masz pytania, sprawdź dokumentację lub utwórz issue w repozytorium.
