# RAPORT AUDYTU PROJEKTU

**Projekt:** Coffee Shift — mobile-first gra przeglądarkowa PWA (Vanilla TypeScript + Phaser 4 + Vite 8)
**Data audytu:** 2026-08-31 · **Rewizja:** `0a4d994` (main) + niescommitowane poprawki z sesji audytowej
**Metoda:** osiem równoległych agentów-specjalistów; tor UI/UX oparty na realnym uruchomieniu w headless Chrome (Playwright) na pięciu viewportach, nie na czytaniu kodu.

## Podsumowanie wykonawcze

Coffee Shift to solidnie zbudowany projekt inżynieryjny z jedną, bardzo poważną wadą: **warstwa prezentacji nigdy nie działała tak, jak zakładano**. Domena jest czysta i pokryta 58 testami jednostkowymi, repozytorium nie zawiera żadnych sekretów, `npm audit` zgłasza zero podatności, a zestaw E2E przechodzi w całości. Jednocześnie arkusz stylów `src/style.css` **nie był w ogóle dołączany do bundla** od commitu `da915e0`, `index.html` nie miał `<meta name="viewport">`, a wszystkie linie statusu stacji w grze były martwym kodem — trzy defekty, które razem sprawiały, że produkcyjna instancja pokazywała nieostylowaną powłokę bez informacji zwrotnej dla gracza.

Cztery znaleziska krytyczne zostały naprawione i zweryfikowane w trakcie audytu (szczegóły w sekcji „Naprawione w trakcie audytu"). Pozostaje jedno krytyczne ryzyko migracyjne — brak konfiguracji `base` w Vite — oraz 41 znalezisk wysokiej wagi, z których największe skupiska to ergonomia dotykowa (18 z 18 celów poniżej normy 44 px na iPhone SE), higiena wdrożenia (brak nagłówków bezpieczeństwa i cache w nginx) oraz dług konwencyjny w `GameScene.ts`.

| Krytyczność | Liczba (surowo) | Unikalne po deduplikacji | Status |
|---|---|---|---|
| 🔴 Krytyczne | 5 | 4 | 3 naprawione, 1 otwarte |
| 🟠 Wysokie | 41 | ~36 | 1 naprawione, reszta otwarta |
| 🟡 Średnie | 63 | ~58 | otwarte |
| 🟢 Niskie | 40 | ~38 | otwarte |
| **Razem** | **149** | **~136** | |

Różnica między liczbą surową a unikalną wynika z tego, że część problemów wykryło niezależnie kilku agentów — te korelacje są najcenniejszą częścią raportu i zostały oznaczone poniżej.

## Naprawione w trakcie audytu

Cztery defekty naprawiono w tej samej sesji, każdy z dowodem regresyjnym (test pada na kodzie sprzed naprawy, przechodzi po niej):

| Defekt | Lokalizacja | Dowód |
|---|---|---|
| 🔴 Brak `<meta name="viewport">` | `index.html:5` | layout viewport spadł z 980 px do rzeczywistej szerokości urządzenia na 5 viewportach |
| 🔴 `src/style.css` nieimportowany | `src/main.ts:1` | `document.styleSheets.length` 0 → 1; „Play" z ~42×21 px poza ekranem → 343–448×48 px na pierwszym ekranie |
| 🔴 Soft-lock po wyjściu z otwartą kartą oceny | `src/game/GameScene.ts`, `create()` | `feedbackCard` po ponownym wejściu: zniszczony kontener (`isDestroyed: true`) → `null` |
| 🟠 Martwe linie statusu stacji | `src/game/GameScene.ts`, 5 miejsc | `ext/milk/asm-status`: `""` → pełny tekst aktualizujący się przy zmianie stanu |

Dodano `tests/e2e/regression.spec.ts` (3 testy). Stan po naprawach: `tsc --noEmit` czysty, 58/58 testów jednostkowych, 12/12 E2E, zero błędów konsoli.

**Uwaga wdrożeniowa:** poprawki są w drzewie roboczym, ale **nie zostały scommitowane ani wdrożone** — działający kontener `coffeeshift-web` na porcie 4180 nadal serwuje build z defektami.

## Wyniki według agentów

### 1. Walidacja Linków → `.audit/links.md`
`Krytyczne: 1 · Wysokie: 0 · Średnie: 4 · Niskie: 2`

Warstwa odwołań jest zdrowa: zestaw ikon PWA w manifeście `vite.config.ts` dokładnie odpowiada temu, co generuje `scripts/generate-icons.mjs` i co leży w `public/icons/`; wszystkie linki do repozytorium wskazują już na `AmigoUK/CoffeeShift` po migracji; zero zerwanych zasobów lokalnych i importów.

Jedyne znalezisko krytyczne — brak `<meta name="viewport">` — zostało naprawione. Pozostają braki metadanych: `<meta name="description">`, Open Graph / Twitter Card (brak podglądu przy udostępnianiu linku), `<link rel="apple-touch-icon">` (plik `icon-192.png` już istnieje). `package.json` i `package-lock.json` zachowały starą nazwę `"coffeshift"` — jedyne miejsce nietknięte przez migrację repo.

### 2. Analiza Błędów → `.audit/errors.md`
`Krytyczne: 1 · Wysokie: 7 · Średnie: 8 · Niskie: 5`

Najbogatszy w treść raport. Punkt wyjścia był zielony (typecheck, 58/58 unit, `node --check`), więc wszystkie znaleziska to błędy **semantyczne**, których typy nie wychwytują — a `GameScene.ts` (843 linie maszyny stanu) nie ma ani jednego testu jednostkowego.

Poza dwoma naprawionymi defektami pozostają otwarte m.in.:

- **Zawieszone flagi trzymanych przycisków** (`GameScene.ts:437-447` + `216-236`): `switchStation()` niszczy kontrolki bez czyszczenia `ext.tampHeld`, `milk.filling`, `asm.pouringWater`, a zniszczony obiekt nie wyemituje już `pointerup`. Pętla `update()` tyka na tych flagach niezależnie od aktywnej stacji → mleko leje się w nieskończoność, tamp rośnie do 25 kg. Brak obsługi `pointerupoutside` i `pointercancel`; `fillMl`/`waterMl` nie mają górnej klamry.
- **Ticket multi-drink pokazuje niewłaściwy napój** (`:322-336`) — wyświetla `orders[0]` zamiast napoju bieżącej pary; poziom S9 (`orderCount: 7`) generuje fantomowy drugi napój. To bezpośrednio dotyka otwartego problemu S9 (41 % skuteczności bota), dla którego postawiono trzy hipotezy oznaczone `[WYMAGA WERYFIKACJI]` — główna to wyścig `loseCustomer()` → `startDrink()` resetujący stan mleka w trakcie fazy mleka.
- **Przestarzała modułowa kopia zapisu** (`screens.ts:25`, `:320-330`) — przełączenie ustawienia po wyjściu z poziomu nadpisuje i kasuje postęp z bieżącej sesji.
- `buildPreparedDrink` używa `milk.used` zamiast `asm.milkPoured`; dźwięk ekstrakcji nie jest zatrzymywany poza `stopPull()`.

Raport zawiera też sekcję „Zweryfikowane i odrzucone" z pięcioma obalonymi tropami — dobra praktyka, która podnosi zaufanie do reszty ustaleń.

### 3. Hard-Coded Values → `.audit/hardcoded.md`
`Krytyczne: 0 · Wysokie: 2 · Średnie: 7 · Niskie: 2`

**Zero sekretów w repozytorium** — brak kluczy API, tokenów, haseł i kluczy prywatnych, potwierdzone także w historii gita.

Ryzyko koncentruje się w konfiguracji: nazwa hosta Tailscale wpisana na sztywno w `vite.config.ts:27` (`preview` odrzuci ruch z nowej domeny po migracji), bezwzględna ścieżka `/tmp/` w `scripts/playthrough.mjs:19`, oraz porty powielone bez jednego źródła prawdy — `4180` w 7 plikach, `5173` w 6. Klucz zapisu `'coffee-shift.save.v1'` jest przepisany ręcznie w 4 testach E2E zamiast importowany ze stałej `SAVE_KEY` (`src/domain/save.ts:11`) — przy bumpie schematu to cichy rozjazd.

### 4. Martwy Kod → `.audit/dead-code.md`
`Krytyczne: 0 · Wysokie: 2 · Średnie: 2 · Niskie: 9`

Projekt jest wyjątkowo czysty: zero plików backup, zero komentarzy `TODO`/`FIXME`/`HACK`, `tsc --noUnusedLocals` bez uwag, każda zależność z `package.json` faktycznie używana.

Znaleziony martwy kod to ślady po dwóch rundach balansowania rozgrywki: pole `Recipe.parSeconds` (`recipes.ts:18`) jest ustawiane dla każdego przepisu, ale przestało być czytane po zastąpieniu go funkcją `parFor()`; `masteryBefore` jest przechwytywane i emitowane w payloadzie, ale nigdy nieodczytywane w `main.ts`. Dalej: cała gałąź per-skill mastery (liczona i zapisywana, ale UI pokazuje tylko wpisy `drink:*`), sprite'y klientów z sufiksem `-2` (nigdy nierysowane), 7 zarejestrowanych, ale nierenderowanych ikon UI i kilkanaście osieroconych kluczy w `copy.ts`. Agent zweryfikował każdy przypadek pod kątem dostępu dynamicznego (`GAME_COPY[key]`) przed oznaczeniem jako martwy.

### 5. Kompatybilność Platformowa → `.audit/platform.md`
`Krytyczne: 1 · Wysokie: 8 · Średnie: 12 · Niskie: 4`

Najpoważniejszy blok ryzyka migracyjnego i jedyne otwarte znalezisko krytyczne.

- 🔴 **Brak `base` w `vite.config.ts`** — potwierdzone w `dist/`: assety linkowane jako `/assets/…`, `registerSW.js` rejestruje `('/sw.js', {scope:'/'})`, manifest deklaruje `"start_url":"/"` i `"scope":"/"`. Wdrożenie pod podścieżką (`/coffeeshift/`, GitHub Pages w trybie project page, reverse proxy z prefiksem) zrywa **wszystkie trzy warstwy naraz**. Jedna zmiana — `base: process.env.VITE_BASE ?? '/'` — naprawia komplet.
- 🟠 `manifest.webmanifest` serwowany jako `application/octet-stream` — zweryfikowane `curl`-em na żywym kontenerze; `nginx:alpine` nie ma tego typu w `mime.types`, Firefox odrzuca taki manifest.
- 🟠 `index.html` bez `Cache-Control` → cache heurystyczny przeglądarki; po redeployu stary HTML wskazuje na nieistniejące już hashe assetów. To samo dotyczy `/workbox-*.js` i `/icons/*.png`.
- 🟠 **Zależność od TLS Tailscale**: service worker wymaga secure context, a nginx nasłuchuje wyłącznie na porcie 80 bez wymuszenia HTTPS i bez komunikatu w UI, gdy rejestracja SW się nie powiedzie. To bezpośrednie tło błędu `ERR_SSL_PROTOCOL_ERROR` odnotowanego w `docs/STATUS.md`.
- 🟠 **Zombie service worker** — `registerType: 'autoUpdate'` bez kill-switcha; po migracji stary origin serwuje z precache stary build w nieskończoność.
- 🟠 Brak `engines`, `.nvmrc` i CI, przy jednoczesnym użyciu `import … with { type: 'json' }` w `vite.config.ts:2` — na platformie ze starszym Node build wywali się `SyntaxError` przed bundlingiem.
- 🟠 Brak fallbacku WebGL/Canvas i brak `<noscript>`: `new Phaser.Game` na poziomie modułu bez `try/catch` → biała strona bez komunikatu.

Pozytywnie: `src/domain/save.ts` wzorcowo obsługuje niedostępny lub rzucający `localStorage`, `navigator.vibrate?.()` jest bezpieczne, a `generate-icons.mjs` w pełni przenośny.

### 6. Bezpieczeństwo → `.audit/security.md`
`Krytyczne: 0 · Wysokie: 3 · Średnie: 3 · Niskie: 4`

Model zagrożeń jest wąski — statyczny frontend bez backendu, bazy, sesji i formularzy uwierzytelniania. Klasy podatności SQLi, CSRF, kontroli dostępu, SSRF i uploadu plików **nie dotyczą** tego projektu i nie zostały sztucznie zgłoszone.

- 🟠 `docker/nginx.conf` **nie ma ani jednego nagłówka bezpieczeństwa**: brak CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- 🟠 Brak `X-Frame-Options` / `frame-ancestors` → realny clickjacking na przycisk „Reset progress".
- 🟠 Wstrzyknięcie HTML z `localStorage`: `save.ts:38-48` przepisuje `mastery` wprost ze sparsowanego JSON-a → `main.ts:42` → `screens.ts:280-286` renderuje surowy klucz do `innerHTML`. Ładunek trwały, odpalany przy każdym podsumowaniu poziomu. Sklasyfikowane jako wysokie, nie krytyczne — brak zdalnego wektora dostarczenia, atakujący musi już mieć wykonanie kodu na originie.
- 🟡 Brak walidacji schematu przy deserializacji zapisu i brak limitu rozmiaru (pozytyw: wszystko w `try/catch`, każda ścieżka błędu prowadzi do `defaultSave()`, prototype pollution nie zachodzi).
- 🟡 Hardening kontenera: brak `USER`, ruchome tagi obrazów bez digestu, brak `read_only`/`cap_drop`/`no-new-privileges`.

Aplikacja nie ładuje niczego z zewnętrznych CDN-ów i nie wysyła nic na zewnątrz — brak `fetch`, `XHR`, `sendBeacon` i telemetrii.

### 7. Jakość Kodu → `.audit/quality.md`
`Krytyczne: 0 · Wysokie: 9 · Średnie: 12 · Niskie: 6`

Audyt prowadzony wobec norm spisanych w `CLAUDE.md`. Projekt spełnia większość własnych reguł — sprite'y jako moduły danych, dobre docbloki na kluczowych funkcjach, kompletny README, zagnieżdżenie nigdzie nieprzekraczające 4 poziomów — ale trzy reguły są łamane systemowo:

- 🟠 **„Teksty UI wyłącznie w `copy.ts`" — ~48 naruszeń** w `GameScene.ts`: etykiety wszystkich przycisków stacji, sześć toastów, trzy pełne linie statusu i cały 16-krokowy samouczek guided, plus 6 literałów w `screens.ts`. Symptomatyczne: `'Next'` (linia 411) jest wpisane ręcznie mimo zaimportowanego `MENU.next`.
- 🟠 **„Domena to czysty TypeScript" — złamane**: `src/domain/grading.ts:4` importuje `../ui/copy`, czyli warstwa domenowa zależy od UI (inwersja warstw).
- 🟠 **„Recepty tylko w `recipes.ts`" — złamane**: wartości `18 g`, `24–31 s`, `15–20 kg`, `150 ml`, `3` shoty zduplikowane w kodzie sceny mimo istniejących stałych.

Dalej: `GameScene.ts` to God Object (843 linie: maszyna stanu + trzy minigry + render + wejście + ekran wyników) — agent wskazał 5 konkretnych szwów podziału, z których najcenniejszy to wyciągnięcie symulacji z `update()` do `src/domain/stations.ts`, co uczyniłoby ją testowalną jednostkowo. Współrzędne layoutu to 20+ gołych literałów w trzech funkcjach `render*`, a `buildBottomRow` ma zupełnie niezależny zestaw liczb — nic nie wiąże obu układów, więc regresja nachodzących przycisków naprawiona w `cc86a4f` jest w pełni odtwarzalna.

**Przyczyna źródłowa większości powyższego: brak lintera, formattera i CI.** Żaden mechanizm nie egzekwuje konwencji spisanych w `CLAUDE.md`.

Usterki dokumentacji: `CHANGELOG.md` ma dwa nagłówki `### Changed` w tej samej sekcji `[Unreleased]`, Docker wpisany pod `Changed` zamiast `Added`, rozjechaną kolejność linków i brak deklaracji Keep a Changelog / SemVer. `docs/STATUS.md` jest po polsku wbrew własnej regule „technical docs are British English". Agent zgłosił też, że sama reguła „Exported symbols: PascalCase" jest źle sformułowana — kod stosuje standardową konwencję TypeScript i to normę należy poprawić, nie kod.

### 8. UI/UX (headless Chrome + Playwright) → `.audit/uiux.md`
`Krytyczne: 2 · Wysokie: 10 · Średnie: 15 · Niskie: 8`

Jedyny agent pracujący na realnym renderze: 5 viewportów (iPhone SE, iPhone 14 Pro, Pixel 7, iPad, desktop), 51 zrzutów ekranu, pomiary w pikselach CSS, obliczone współczynniki kontrastu WCAG. Oba znaleziska krytyczne (nieimportowany CSS, brak meta viewport) zostały naprawione.

Otwarte znaleziska wysokiej wagi:

- **Ergonomia dotykowa**: na iPhone SE **18 z 18 celów dotykowych jest poniżej normy 44 px** (przyciski stacji 94,8 × 37,9 px). Przycisk „☰ Menu" — jedyne wyjście z poziomu — ma 44,3 × 17,4 do 67,9 × 26,7 px, czyli **poniżej normy na każdym urządzeniu**. Zakładki stacji: 26,9–41,3 px wysokości.
- **Zerowy odstęp** między rzędem przycisków y=764 a paskiem Undo/Bin/Serve — „Pour milk" styka się z „Serve". To dokładnie ta klasa błędu, którą naprawiano w `cc86a4f`, tyle że w innym miejscu siatki.
- **Karta oceny nie blokuje wejścia** — zweryfikowane: tapnięcie „Bin & restart" przy otwartej karcie skasowało stan montażu.
- **„Bin & restart" niszczy napój bez potwierdzenia i czyści `undoStack`**, więc Undo niczego nie cofa.
- Pasek dolny wchodzi 24,4 px pod home indicator iPhone 14 Pro — potwierdza otwarty punkt backlogu ze `STATUS.md`.
- **Rozgrywka jest całkowicie niedostępna z klawiatury i technologii asystujących**: canvas bez `role`, `aria-label` i `tabindex`, Tab prowadzi do `BODY`.
- **Sprzętowy przycisk Wstecz na Androidzie wychodzi z aplikacji** (`about:blank`) — brak obsługi History API.
- Kontrast gwiazdek `#d4a017` wynosi 2,21 : 1 (norma 3:1 dla dużego tekstu).

Średnie: kontrast teal 3,64 : 1 (przyciski hold i podpowiedź Learn), stopka 3,86 : 1, `.chip--good` 4,41 : 1; zero regionów `aria-live`; fokus po zmianie ekranu wraca do `BODY`; „⏱ Patience" (y=246) nachodzi na panel Ticket (159–251); przeładowanie strony w trakcie poziomu gubi postęp bez ostrzeżenia; bundle 1 444 kB / **365 kB gzip** z longtaskiem 469 ms przy spowolnieniu CPU 4×.

Konsola czysta we wszystkich przepływach: 0 błędów JS, 0 wyjątków, 0 nieudanych żądań.

## Matryca ryzyka migracyjnego

Pozycje, które **muszą** zostać rozwiązane przed wdrożeniem na nowej platformie:

| Lokalizacja | Ryzyko | Agenci | Rekomendacja |
|---|---|---|---|
| `vite.config.ts` — brak `base` | 🔴 Deploy pod podścieżką zrywa assety, service worker i manifest jednocześnie | 5 + 3 | `base: process.env.VITE_BASE ?? '/'`; zweryfikować `dist/` po zmianie |
| `docker/nginx.conf` — typ MIME manifestu | 🟠 Firefox odrzuca manifest → PWA nieinstalowalna | 5 | `types { application/manifest+json webmanifest; }` |
| `docker/nginx.conf` — brak `Cache-Control` na `index.html` | 🟠 Po redeployu stary HTML wskazuje na usunięte hashe → biała strona | 5 | `location = /index.html { add_header Cache-Control "no-cache"; }` |
| `docker/nginx.conf` — zero nagłówków bezpieczeństwa | 🟠 Brak CSP, clickjacking na „Reset progress" | 6 + 5 | Dodać CSP, `X-Content-Type-Options`, `frame-ancestors`, `Referrer-Policy` |
| Service worker bez kill-switcha | 🟠 Stary origin serwuje stary build w nieskończoność | 5 | Opublikować SW unregistrujący się na starym originie przed przełączeniem |
| SW wymaga HTTPS; nginx tylko na :80 | 🟠 Bez TLS przed aplikacją PWA nie działa offline, bez żadnego komunikatu | 5 | Wymusić HTTPS na nowej platformie; dodać komunikat w UI przy nieudanej rejestracji |
| Brak `engines`/`.nvmrc` + `import … with { type: 'json' }` | 🟠 Build wywali się `SyntaxError` na starszym Node | 5 + 7 | `"engines": { "node": ">=22" }` + `.nvmrc` + pipeline CI |
| `vite.config.ts:27` — host Tailscale | 🟠 `vite preview` odrzuci ruch z nowej domeny | 3 + 5 | Przenieść do zmiennej środowiskowej |
| `scripts/playthrough.mjs:19` — `/tmp/` | 🟠 Skrypt nie działa poza Linuksem | 3 + 5 | `os.tmpdir()` |
| Ruchome tagi obrazów Docker | 🟡 Niereprodukowalny build; `nginx:alpine` może zmienić zachowanie między buildami | 5 + 6 | Przypiąć digesty |
| Brak fallbacku WebGL i `<noscript>` | 🟠 Biała strona bez komunikatu na słabym urządzeniu | 5 | `try/catch` wokół `new Phaser.Game` + komunikat |

## Plan naprawczy — priorytety

### 1. Krytyczne (zrób natychmiast)

- ✅ ~~Przywrócić `import './style.css'` w `src/main.ts`~~ — **zrobione i zweryfikowane**
- ✅ ~~Dodać `<meta name="viewport">` do `index.html`~~ — **zrobione i zweryfikowane**
- ✅ ~~Zresetować stan sceny w `GameScene.create()` (soft-lock)~~ — **zrobione i zweryfikowane**
- ✅ ~~Przepiąć wyszukiwanie obiektów stacji na `stationView.getByName()`~~ — **zrobione i zweryfikowane**
- ✅ ~~Scommitować i wdrożyć powyższe~~ — **v0.2.0**, wdrożone
- ✅ ~~Ustawić `base` w `vite.config.ts` na wartość konfigurowalną~~ — **v0.3.0**. Zweryfikowane buildem pod podścieżką: assety, scope service workera i `start_url` manifestu przestawiają się razem

**Wszystkie znaleziska krytyczne są zamknięte.**

### 2. Wysokie (przed wdrożeniem)

- ✅ ~~Wyczyścić flagi `tampHeld`/`filling`/`pouringWater` w `switchStation()`; dodać `pointerupoutside` i `pointercancel`~~ — **v0.3.0**
- ✅ ~~Naprawić ticket multi-drink~~ — **v0.2.1**. Instrumentowany przebieg S9 wykazał, że wynik „41%" był artefaktem pomiaru, nie defektem poziomu (patrz `docs/STATUS.md`)
- ✅ ~~Usunąć przestarzałą modułową kopię zapisu w `screens.ts`~~ — **v0.3.0**
- ✅ ~~nginx: nagłówki bezpieczeństwa, `Cache-Control` dla `index.html`, typ MIME manifestu~~ — **v0.2.1** i **v0.3.0**
- ✅ ~~Sanityzować klucze `mastery` przed renderowaniem do `innerHTML`~~ — **v0.3.0**
- ✅ ~~Dodać `engines`, `.nvmrc` i pipeline CI~~ — **v0.3.0**
- ✅ ~~Podnieść cele dotykowe do minimum 44 × 44 px~~ — **v0.4.0**. Zmierzone: 0 z 13 poniżej normy na iPhone SE, iPhone 14 Pro i Pixelu 7 (było 13 z 13 na SE). Układ wyliczany w `src/game/layout.ts` w górę od paska dolnego, więc rzędy nie mogą na siebie nachodzić ani zjeść marginesu na home indicator
- ✅ ~~Zablokować wejście pod kartą oceny; dodać potwierdzenie dla „Bin & restart"~~ — **v0.4.0**. Karta ma warstwę przechwytującą, a binowanie wymaga drugiego tapnięcia i jest odwracalne przez Undo
- ✅ ~~Naprawić kontrast gwiazdek i dodać obsługę przycisku Wstecz na Androidzie~~ — **v0.4.0**. Gwiazdki 2,21 → 5,16 : 1; nawigacja przez History API
- ✅ ~~`aria-live`, zarządzanie fokusem i alternatywa tekstowa dla canvasu~~ — **v0.4.0**
- ⬜ Ograniczyć `fillMl`/`waterMl` górną klamrą

### 3. Średnie (pierwszy sprint po wdrożeniu)

- Wprowadzić ESLint/Prettier lub Biome — bez tego naruszenia konwencji będą wracać
- Przenieść ~48 literałów tekstowych z `GameScene.ts` do `copy.ts`
- Odwrócić zależność `domain/grading.ts` → `ui/copy`
- Usunąć zduplikowane wartości receptur z kodu sceny
- Wydzielić nazwane stałe layoutu (`ROW_Y`, `BTN`, `COL_X`) i powiązać z nimi `buildBottomRow`
- Sparametryzować porty `4180`/`5173`; zaimportować `SAVE_KEY` w testach E2E
- Uporządkować `CHANGELOG.md` zgodnie z Keep a Changelog
- Dodać `aria-live`, zarządzanie fokusem i alternatywę tekstową dla canvasu
- Rozważyć code splitting Phasera (365 kB gzip, longtask 469 ms)

### 4. Niskie (długi ogon)

- Usunąć `Recipe.parSeconds`, `masteryBefore`, sprite'y `*-2`, nieużywane ikony i osierocone klucze `copy.ts`
- Dodać `<meta name="description">`, Open Graph, `apple-touch-icon`
- Poprawić nazwę `"coffeshift"` w `package.json`
- Poprawić „Learn to make **a** espresso" (`levels.ts:36`)
- Hardening kontenera: `USER`, `cap_drop`, `no-new-privileges`, digesty obrazów

## Metryki jakości projektu

- **Ogólna ocena: 64 / 100** (przed naprawami z tej sesji: 52 / 100)

- **Uzasadnienie:** Fundament inżynieryjny jest mocny — czysta warstwa domenowa z 58 testami, brak sekretów i podatności w zależnościach, przemyślana obsługa błędów w warstwie zapisu, kompletny zestaw E2E i dobra dokumentacja. Ocenę ciągnie w dół warstwa prezentacji i wdrożenia: trzy defekty krytyczne sprawiały, że gra nigdy nie wyglądała i nie działała tak, jak zaprojektowano, a nikt tego nie wychwycił, bo **istniejące testy E2E asertowały zawartość DOM i stan sceny, ale nigdy wyglądu, wymiarów ani obecności arkusza stylów**. Ergonomia dotykowa nie spełnia norm na docelowej klasie urządzeń, mimo że projekt deklaruje się jako mobile-first. Brak lintera i CI jest przyczyną źródłową długu konwencyjnego: reguły z `CLAUDE.md` są dobrze pomyślane, ale nic ich nie egzekwuje, więc erodują przy każdym refaktorze.

- **Rozkład wg dziedzin:** Linki: 85/100 · Błędy: 58/100 · Hard-coded: 75/100 · Martwy kod: 88/100 · Platforma: 48/100 · Bezpieczeństwo: 72/100 · Jakość: 55/100 · UI/UX: 42/100

---

*Stan na 2026-08-31, po wydaniach v0.2.0, v0.2.1, v0.3.0 i v0.4.0. Wszystkie znaleziska
krytyczne i wysokie są zamknięte poza jednym (`fillMl`/`waterMl` bez górnej klamry).
Otwarta pozostaje grupa „higiena kodu" — świadoma decyzja, nie przeoczenie.*

*Pliki robocze poszczególnych agentów: `.audit/*.md`. Zrzuty ekranu i dane pomiarowe toru UI/UX: katalog scratch sesji (`shots/`, `*.json`).*
