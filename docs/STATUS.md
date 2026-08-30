# Coffee Shift — stan pracy (sesja 2026-08-30)

Punkt startowy dla następnej sesji. Repo: **AmigoUK/CoffeeShift** (stare `coffeshift` czeka na ręczne
usunięcie — token gh nie ma scope `delete_repo`).

## Gotowe i wypchnięte (main = 116676e)

- MVP gry kompletne (v0.1.1): 5 napojów, 3 minigry, Learn/Practise/Shift (20 poziomów), zapisy lokalne, PWA offline.
- Playwright E2E (10 testów, `npm run test:e2e`) + 58 testów jednostkowych — wszystko zielone.
- Docker: `docker compose up -d --build` → nginx na porcie **4180** (kontener `coffeeshift-web`,
  restart unless-stopped — działa i ma działać).
- Tailscale: `serve` 443 i 8444 → 127.0.0.1:4180 (https://linuxserv1.tailc29352.ts.net/).
- README + screenshoty + opis repo na GitHubie.

## W locie — CHANGELOG [Unreleased], cel: release v0.2.0

Balans z playthrough-bota (`scripts/playthrough.mjs`, dane `/tmp/playthrough-*.json`):

- ✅ par-czas liczony z zamówienia, rampa tampera 8 kg/s, zegar gry odporny na stutter,
  patience floor = par×1.2, foam rate 0.14 (cappuccino osiągalne), order-change 50%/8–15 s,
  **naprawiona kolizja przycisków stacji z paskiem Undo/Bin/Serve** (tapy „Wand depth" binowały drink),
  exit-menu w grze, siatka przycisków 655/712/764.
- ✅ Clean-bot: L1–P5, S1, S4 = 98–100%.

## Do zrobienia (kolejność)

1. **S9 multi-drink (41%)** — bot gubi fazę mleka na ~1 z 5 drinków (sygnatura: `milk.fill=0`);
   najpierw zinstrumentowany run samego S9.
2. **S8 po tuningu order-change + S10** (padły na timeout 3500 s — podnieść lub dzielić LEVELS).
3. **Run sloppy** (średni gracz) — akceptacja: S1–S6 ≥ 70%.
4. Cel całej tabeli clean ≥ 95% → wtedy **release v0.2.0** (bump, CHANGELOG, tag, gh release).
5. UI/UX backlog: linie targetu przy nalewaniu, safe-area dolnego rzędu na notch, highlight
   aktualnego napoju w multi-drink ticket.
6. Drobiazgi: E2E L3 ma wąskie okno steam (70–75 °C) — jeśli flaknie, poszerzyć próg o 0,5 °C;
   ikony PWA nie przeszły inspekcji wizualnej (brak modelu vision w harness).

## Środowisko

- Dev: `npm run dev` (5173, wygaszone na noc), testy: `npm test` / `npm run test:e2e`.
- Gra na żywo: Docker 4180 + tailscale serve (443/8444). ERR_SSL_PROTOCOL_ERROR u klienta =
  DNS omija MagicDNS (Private Relay / DoH) → patrz notatka w historii sesji; opcja `tailscale funnel 443 on`
  czeka na decyzję właściciela.
