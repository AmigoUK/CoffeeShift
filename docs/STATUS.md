# Coffee Shift — stan pracy (sesja 2026-08-31)

Punkt startowy dla następnej sesji. Repo: **AmigoUK/CoffeeShift**.

## Gotowe i wypchnięte

- **v0.2.0** — MVP + balans z playthrough-bota + cztery naprawy krytyczne z audytu
  (arkusz stylów, meta viewport, soft-lock sceny, martwe linie statusu). Wdrożone na Dockera.
- **v0.2.1** — naprawy multi-drink: ticket kotwiczony na bieżącej parze, liczniki klientów
  bez dzielenia przez 2.
- **Audyt projektu** — `RAPORT_AUDYTU.md` (8 torów, w tym UI/UX na realnej przeglądarce).
  Pliki robocze agentów w `.audit/` (ignorowane przez git).
- Testy: 58 jednostkowych + 15 E2E (`tests/e2e/regression.spec.ts` chroni naprawy z audytu).
- Docker: `docker compose up -d --build` → nginx na porcie **4180** (kontener `coffeeshift-web`);
  port zmienia `APP_PORT`, dev-server `VITE_PORT`, preview dla testów `PREVIEW_PORT`.
- Tailscale: `serve` 443 i 8444 → 127.0.0.1:4180.

## SPROSTOWANIE — „S9 multi-drink 41%" NIE było defektem poziomu

Poprzedni handoff zapisał S9 jako zepsuty poziom („bot gubi fazę mleka, `milk.fill=0`").
**To był artefakt narzędzia pomiarowego, nie gry.** Dowód — ten sam bot, ten sam poziom:

| skala zegara | wynik | rozegrane | utraceni klienci |
|---|---|---|---|
| `SCALE=3` | 68% | 4 z 7 | 3 |
| `SCALE=1`, przebieg A | **99%, 3 gwiazdki** | 7 z 7 | **0** |
| `SCALE=1`, przebieg B | 69% | 6 z 7 | 1 |
| `SCALE=1`, S10 | 88%, 2 gwiazdki | 7 z 7 | 0 |

Uwaga o wariancji: `generateOrders` losuje zamówienia przez `Math.random()`, więc każdy
przebieg gra inny zestaw napojów i pojedynczy wynik nie jest miarodajny. Rozstrzygająca
jest liczba utraconych klientów: przy `SCALE=3` było ich 3 na 7, przy `SCALE=1` — 0 i 1.
Do wniosków o balansie potrzeba serii przebiegów, nie jednego.

Mechanizm: bot dokłada ~0,2–0,5 s latencji na każdy odczyt stanu, a `SCALE` mnoży ten narzut
razem z zegarem gry, aż zjada zapas 12–16 s, który poziom normalnie daje. Klient wygasał
w trakcie parowania mleka, `loseCustomer()` po 1600 ms wywoływał `startDrink()` z `freshMilk()`,
a bot — którego `waitState(!steaming)` świeże mleko spełnia natychmiast — odczytywał wyzerowany
stan i serwował pusty kubek następnemu klientowi. Stąd `milk.fill=0` i `WRONG_SHOT_COUNT`.

**Wniosek dla przyszłych sesji: wyniki bota przy `SCALE>1` nie nadają się do oceny balansu
poziomów z cierpliwością klienta.** Do strojenia używać `SCALE=1`, albo najpierw usunąć
narzut latencji z pomiaru.

## Do zrobienia (kolejność, wg RAPORT_AUDYTU.md)

1. **`base` w `vite.config.ts`** — jedyne otwarte znalezisko krytyczne. Bez niego wdrożenie
   pod podścieżką zrywa assety, service worker i manifest naraz.
2. **nginx** — nagłówki bezpieczeństwa (CSP, `frame-ancestors`, `nosniff`), `Cache-Control`
   dla `index.html`, typ MIME dla `manifest.webmanifest`.
3. **Ergonomia dotykowa** — 18 z 18 celów poniżej 44 px na iPhone SE; priorytet: „☰ Menu"
   (jedyne wyjście z poziomu) i zakładki stacji. Zerowy odstęp między rzędem y=764 a paskiem
   Undo/Bin/Serve.
4. **Zawieszone flagi trzymanych przycisków** — `switchStation()` nie czyści `tampHeld`,
   `filling`, `pouringWater`; brak `pointerupoutside`/`pointercancel`.
5. **Przestarzała kopia zapisu w `screens.ts:25`** — kasuje postęp z bieżącej sesji.
6. **Linter + CI** — przyczyna źródłowa długu konwencyjnego: ~48 literałów UI poza `copy.ts`,
   `domain/grading.ts` importujący `../ui/copy`, recepty zduplikowane w kodzie sceny.

## Środowisko

- Dev: `npm run dev` (5173, `VITE_PORT`). Testy: `npm test`, `npm run test:e2e`, lint: `npm run lint`.
- Bot: `LEVELS=S9 SCALE=1 node scripts/playthrough.mjs clean` (patrz sprostowanie wyżej).
- Gra na żywo: Docker 4180 + tailscale serve. Service worker wymaga HTTPS —
  bez TLS przed aplikacją PWA nie działa offline i nie zgłasza tego w UI.
