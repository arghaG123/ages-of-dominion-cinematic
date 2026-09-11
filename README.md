# Ages of Dominion — Cinematic Rebuild

**Stack:** JavaScript ES2022 · Canvas 2D · Vite 6 · Vitest 2 · Capacitor 7  
**Application ID:** `com.agesofdominion.game` (same product; migrates v6 saves)  
**Root:** independent Git history — not a fork of the prior repo

Premium cinematic 2.5D dark-fantasy presentation of the same offline kingdom / tactical / siege game.

## Quick start

```bash
npm install
npm run export:reference
npm run assets:placeholders
npm run assets:atlas
npm run assets:validate
npm test
npm run dev          # http://localhost:5174
npm run build
npm run build:android
```

## Docs

- [Visual style bible](docs/visual-style-bible.md)
- [UX wireframes](docs/ux-wireframes.md)
- [Asset pipeline](docs/asset-pipeline.md)

## Architecture

```
src/data/     Tuned constants (parity-locked)
src/rules/    Pure economy, combat, siege, builds
src/state/    newGame, tutorial, rival, offline
src/save/     aod.slot.* atomic slots, v6→v7 migrate, backups
src/render/   Canvas DPR≤2, atlases, FX
src/scenes/   title, realm, battle, siege
src/ui/       Host/Map/War/More + SVG icons
src/game/     dispatch() — sole mutation entry
```

## Save compatibility

- Storage keys: `aod.slot.auto`, `aod.slot.0..2` (+ `.tmp` / `.bak`)
- Backup format: `ages-of-dominion-save` v1 with FNV-1a checksum
- Damaged saves never fall through to a new game

## Constraints

- Offline only — no network, CDN, analytics, ads, or accounts
- No emoji / pixel art / cute low-poly in production UI
- Art: AI draft → human cleanup; production pack approved 2026-09-11
