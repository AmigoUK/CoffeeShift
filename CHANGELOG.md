# Changelog

All notable changes to **Coffee Shift** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

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

[Unreleased]: https://github.com/AmigoUK/coffeshift/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AmigoUK/coffeshift/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/AmigoUK/coffeshift/releases/tag/v0.0.1
