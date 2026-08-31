# Changelog

All notable changes to **Coffee Shift** are documented in this file.

## [Unreleased]

_Nothing yet._

## [0.2.1] — 2026-08-31

### Fixed
- Multi-drink tickets anchored line 1 to `orders[0]` instead of the pair being worked on.
  From the second pair onwards the player saw the drink from two orders ago, marked as
  already served, while the drink they actually had to make appeared nowhere on the ticket.
  An odd order count also produced a phantom second drink on the last pair.
- The queue counter halved the customers on multi-drink levels: `generateOrders` ignores the
  `multiDrink` flag, so each order has its own customer, its own patience and its own
  lost-customer path — but the counter showed 4 people for 7 orders. Customer archetypes now
  also change per order rather than per pair.
- `docker/nginx.conf` sent no `Cache-Control` on `index.html`, despite the rule above it
  claiming the entry point always revalidates. Browsers cached the HTML heuristically, so
  returning visitors kept getting the pre-0.2.0 page — which predates the stylesheet import
  and therefore rendered as a bare background.

### Changed
- `docs/STATUS.md` rewritten. It previously recorded "S9 multi-drink 41%" as a broken level;
  that was an artefact of the measurement tool, not the game. The playthrough bot adds
  ~0.2-0.5 s of latency per state read and `SCALE` multiplies it along with the game clock
  until it eats the 12-16 s of slack a level normally leaves, so the customer expires
  mid-steam. At `SCALE=1` the same level scores 99% with no customers lost. The handoff now
  warns against judging balance from `SCALE>1` runs.

## [0.2.0] — 2026-08-31

### Fixed
- `src/style.css` never reached the bundle: the `import './style.css'` in `src/main.ts` was
  dropped in `da915e0`, so the whole DOM shell rendered unstyled — Play measured ~42×21 px and
  sat below the fold on every viewport. Restored, and now covered by an end-to-end assertion.
- `index.html` had no `<meta name="viewport">`, so phones laid the page out at 980 px and the
  `env(safe-area-inset-*)` rules in `src/style.css` always resolved to 0. Added with
  `viewport-fit=cover`; page zoom is deliberately left enabled (WCAG 1.4.4).
- Leaving a level through ☰ Menu with the feedback card open soft-locked every later level:
  Phaser reuses the scene instance, so `feedbackCard` still pointed at a destroyed container and
  both `update()` and `serve()` returned early forever. `create()` now resets the per-run state.
- Every station status line was dead code. The text objects live in the `stationView` container,
  but were looked up with `this.children.getByName()` on the scene display list, which
  `Container.add()` had already removed them from — so each lookup returned null. The same bug
  silenced the espresso brew streams and the vessel sprite.
- Station control rows overlapped the persistent Undo/Bin/Serve bar: taps on Wand depth or
  Empty grinder hit Bin & restart (silently wasting the drink), and row-3 actions grazed Serve.
  All stations re-laid out on a non-overlapping grid (rows 655/712/764, bottom bar 788-836).

### Changed
- Par times are now derived from each order's work (shots × 27 s + milk + water + takeaway + slack)
  instead of a flat per-drink table; multi-shot drinks were mathematically unable to finish inside
  the old pars, capping time scores and blocking 3 stars.
- Tamp ramp slowed from 14 to 8 kg/s: the 15–20 kg release window is now 0.625 s instead of 0.36 s,
  making it releasable on touch.
- All in-game timers (patience, elapsed time scoring, order changes) run on a capped-delta game
  clock, so frame drops and main-thread stalls on weak hardware no longer eat customer patience
  or tank grades.
- Haptic buzz when the tamp releases inside the band.
- Patience floor: customers now wait at least par × 1.2 — S6-style 3-shot orders exceeded flat
  level patience on brewing time alone and were unwinnable.
- Order changes (S8+) fire on ~half of eligible orders, once, between 8-15 s — previously every
  order changed at a fixed 5 s, forcing a full redo of every drink.
- Milk foam rate 0.09 → 0.14 cm/s: cappuccino's 2.0 cm foam needed 22 s of steaming, which
  scorched the milk; depth-switching (shallow → deep) is now the taught technique per drink.

### Added
- Docker deployment: multi-stage build (node:22-alpine → nginx:alpine) with SPA fallback,
  immutable asset caching and no-cache service worker; `docker compose up -d` serves port 4180.
- `tests/e2e/regression.spec.ts` — three end-to-end regressions covering the shell stylesheet and
  viewport meta, the station status lines, and the feedback-card soft-lock.
- `RAPORT_AUDYTU.md` — consolidated report from an eight-track project audit, including a
  browser-driven UI/UX pass over five viewports.

## [0.1.1] — 2026-08-29

### Added
- Playwright end-to-end suite (`npm run test:e2e`): guided perfect-serve flow, overheated-milk fault flow,
  shift unlock/serve/summary flow, DOM shell navigation and lock states, settings persistence,
  and PWA checks (service-worker control, manifest, icons, offline boot).


## [0.1.0] — 2026-08-29

### Added
- Full MVP of Coffee Shift, a mobile-first browser game that teaches café-quality coffee.
- Five drinks (espresso, americano, latte, cappuccino, flat white) with the House Standard as single-source recipe data.
- Three minigames: espresso extraction (grind, dose, tamp, brew with live yield), milk texturing (jug choice, fill, purge, steam with foam/temperature simulation), and drink assembly (vessels, shots, water, milk, undo, bin).
- Grading engine with order-match/recipe/technique/time/waste categories, seventeen feedback tags and British English summary sentences.
- Three customer archetypes with deterministic order lines, seeded order generation and adaptive drink weighting from fault history.
- Learn (5 guided lessons), Practise (5 modifier levels) and Shift (S1–S10 with patience, time scoring, parallel prep, order changes and multi-drink tickets) — 20 levels in total.
- Progression: stars, six-skill mastery EMAs, per-drink mastery, habit hints, unlock chain and Trainee/Barista rank.
- Local progress saving (localStorage) with graceful in-memory fallback in private browsing modes.
- Pixel-art sprite system authored in-repo as code data; no binary art assets.
- WebAudio-synthesised sound effects (extraction trickle, steam hiss that tracks wand depth, cup clink, chimes) with no audio files.
- Haptics on in-band stops and successful serves; Sound, Vibration and Reduce animations settings.
- Recipe Book rendering the House Standard with the Long Black note.
- Installable PWA: manifest, generated pixel-art icons (any + maskable), offline play via service-worker precache.

## [0.0.1] — 2026-08-29

### Added
- Initial project scaffold: Vite + vanilla TypeScript (strict), Phaser, vite-plugin-pwa, Vitest.

[Unreleased]: https://github.com/AmigoUK/CoffeeShift/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/AmigoUK/CoffeeShift/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/AmigoUK/CoffeeShift/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/AmigoUK/CoffeeShift/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/AmigoUK/CoffeeShift/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/AmigoUK/CoffeeShift/releases/tag/v0.0.1
