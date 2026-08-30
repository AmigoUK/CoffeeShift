# Changelog

All notable changes to **Coffee Shift** are documented in this file.

## [Unreleased]

### Changed
- Par times are now derived from each order's work (shots \u00d7 27 s + milk + water + takeaway + slack) instead of a flat per-drink table; multi-shot drinks were mathematically unable to finish inside the old pars, capping time scores and blocking 3 stars.
- Tamp ramp slowed from 14 to 8 kg/s: the 15\u201320 kg release window is now 0.625 s instead of 0.36 s, making it releasable on touch.
- All in-game timers (patience, elapsed time scoring, order changes) run on a capped-delta game clock, so frame drops and main-thread stalls on weak hardware no longer eat customer patience or tank grades.
- Haptic buzz when the tamp releases inside the band.


### Fixed
- Station control rows overlapped the persistent Undo/Bin/Serve bar: taps on Wand depth or
  Empty grinder hit Bin & restart (silently wasting the drink), and row-3 actions grazed Serve.
  All stations re-laid out on a non-overlapping grid (rows 655/712/764, bottom bar 788-836).

### Changed (balance, from the playthrough bot)
- Patience floor: customers now wait at least par × 1.2 — S6-style 3-shot orders exceeded flat
  level patience on brewing time alone and were unwinnable.
- Order changes (S8+) fire on ~half of eligible orders, once, between 8-15 s — previously every
  order changed at a fixed 5 s, forcing a full redo of every drink.
- Milk foam rate 0.09 → 0.14 cm/s: cappuccino's 2.0 cm foam needed 22 s of steaming, which
  scorched the milk; depth-switching (shallow → deep) is now the taught technique per drink.
- Docker deployment: multi-stage build (node:22-alpine → nginx:alpine) with SPA fallback,
  immutable asset caching and no-cache service worker; `docker compose up -d` serves port 4180.

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

[0.1.1]: https://github.com/AmigoUK/CoffeeShift/compare/v0.1.0...v0.1.1

[Unreleased]: https://github.com/AmigoUK/CoffeeShift/compare/v0.1.1...HEAD
[0.1.0]: https://github.com/AmigoUK/CoffeeShift/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/AmigoUK/CoffeeShift/releases/tag/v0.0.1
