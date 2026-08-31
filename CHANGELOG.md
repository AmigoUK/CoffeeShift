# Changelog

All notable changes to **Coffee Shift** are documented in this file.

## [Unreleased]

_Nothing yet._

## [0.4.0] — 2026-08-31

### Added
- `src/game/layout.ts`: the play screen's geometry, derived rather than typed out. Rows are
  computed upwards from the bottom bar, so no edit can overlap two rows or eat the gap left
  for the home indicator. The tests and the playthrough bot read the same numbers, instead
  of keeping their own copies that silently rot.
- A live region plus focus management: changing screen now moves focus to the heading rather
  than dropping it on `<body>`, the canvas identifies itself to assistive technology, and
  in-game toasts — drawn on a canvas that announces nothing — are mirrored for screen readers.
- History entries for every screen, so Android's hardware Back moves between screens instead
  of unloading the page and throwing the player out of the game.

### Fixed
- Touch targets: 13 of 13 controls were under the 44 px minimum on an iPhone SE, which scales
  the canvas by 0.79. All controls are now 56 game units tall, measured at 0 of 13 under the
  minimum across iPhone SE, iPhone 14 Pro and Pixel 7. Station tabs needed 57 — at 55 they
  landed on 43.5 px and just missed.
- The bottom row no longer touches the persistent Undo/Bin/Serve bar, and the bar clears the
  home indicator.
- The feedback card was not modal: taps passed through to Bin & restart and silently
  discarded the drink the card was reporting on.
- Bin & restart destroyed a drink on a single tap of a button sitting in the bottom row, and
  reset the assembly wholesale — taking the undo stack with it. It now arms on the first tap
  and stays undoable.
- Contrast: stars 2.21 → 5.16 : 1, the guided hint 3.64 → 5.88 : 1, and the footer now reuses
  the muted token that already clears AA. Checked by a test that measures computed styles
  across every DOM screen.

## [0.3.0] — 2026-08-31

### Added
- `VITE_BASE` build variable, so the game can be deployed under a sub-path. It rewrites asset
  URLs, the service worker registration scope and the manifest's `start_url`/`scope` together
  — previously all three assumed a domain root and a sub-path deploy broke every one of them.
- Security headers on every response: Content-Security-Policy, X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy and Permissions-Policy, plus `server_tokens off`. They are
  included per location, because nginx discards inherited `add_header` in any block that
  defines its own.
- GitHub Actions CI running typecheck, unit tests and the Playwright suite, with `engines` and
  `.nvmrc` pinning Node 22 — `vite.config.ts` uses an import attribute that older Node rejects.
- A `<noscript>` message and a guard around Phaser start-up, so a browser without WebGL or
  Canvas2D gets an explanation instead of a blank page.

### Fixed
- Holding a control while the station was torn down left the flag set for ever: `update()`
  kept acting on it regardless of the visible station, so the jug filled without end. Hold
  buttons now also handle `pointerupoutside` and `pointercancel`.
- Toggling a setting wrote back a save cached when the module loaded, rolling back every
  mastery, stat and unlock recorded since. The shell also showed stale progress after leaving
  a level; both now re-read the stored save.
- The level summary rendered mastery keys, feedback tags and habit hints straight into
  `innerHTML`, and all three come from `localStorage` — a planted key injected a live element.
  Stored values are now escaped.
- The PWA manifest was served as `application/octet-stream`, so Firefox refused it.

### Changed
- `VITE_PREVIEW_HOST` replaces the tailnet hostname that was hard-coded in `vite.config.ts`.

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

[Unreleased]: https://github.com/AmigoUK/CoffeeShift/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/AmigoUK/CoffeeShift/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/AmigoUK/CoffeeShift/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/AmigoUK/CoffeeShift/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/AmigoUK/CoffeeShift/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/AmigoUK/CoffeeShift/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/AmigoUK/CoffeeShift/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/AmigoUK/CoffeeShift/releases/tag/v0.0.1
