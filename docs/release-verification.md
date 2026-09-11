# Release verification checklist

- [x] Independent Git repo at `C:\dev\ages-of-dominion-cinematic`
- [x] App id `com.agesofdominion.game` in `capacitor.config.json`
- [x] v6 save fixtures migrate to schema v7
- [x] Damaged saves never create a new game
- [x] Data parity tests vs `reference/game-data.json`
- [x] Production art pack generated via Vertex AI (gemini-2.5-flash-image) + atlases rebuilt (351 assets: 299 real painterly art, 52 hand-authored SVG icons); known touch-up: `creatures/harpy-idle.png` retains a small residual background-glow patch behind the torso (doesn't break the silhouette; a looser cleanup threshold clears it but reintroduces leaks on other creatures — see `punch_alpha` in `scripts/generate-art.py`)
- [x] Style bible + UX wireframes frozen
- [x] Visual shell: title, realm, host, map, war, battle, siege
- [x] Quests, milestones, map payoffs, hero forge/skills, army XP, rival, market
- [x] Interactive seeded battle + Resolve shortcut; siege modes + call-next-wave
- [x] Independent music / SFX / haptics prefs; bundled WAV stubs
- [x] `INTERNET` permission removed from AndroidManifest
- [x] `npm test` passing
- [x] Playwright viewport smoke (`npm run test:e2e`)
- [x] `npm run build` production bundle
- [x] `npx cap sync android` + debug APK built (`android/app/build/outputs/apk/debug/app-debug.apk`, 4.2 MB); on-device install still pending
- [ ] Signed AAB only after keystore ownership confirmed (see `android-key.properties.example`)
- [ ] Physical gesture-nav safe-area pass
- [ ] Budget-device FPS profile (realm 30 / combat 60)
- [x] Human approval of production art (player sign-off 2026-09-11); manifest status is `approved`

## Live playtest pass (2026-09-10)

Played through title → class select → realm → host → map → tactical battle →
siege → more on the dev build and fixed everything found:

- Host hero portrait drew as a text silhouette (`knight-portr…`) instead of
  the painted art — `drawFrame` was called with the wrong atlas frame id
  (missing the `hero-` namespace prefix used by every other frame in
  `hero.json`). Fixed in [src/ui/views.js](../src/ui/views.js).
- Class-selection cards (title → New Game) had no hero art at all, just a
  large empty panel above the text — now reuses the same hero-portrait
  canvas as the Host screen. [src/main.js](../src/main.js), [src/styles/shell.css](../src/styles/shell.css).
- Map node card ("readable node card ... fight verdict") was rebuilt from
  scratch by the once-a-second resource tick, so it silently closed within
  ~1s of opening — effectively unusable. Selection now survives re-render.
  [src/ui/views.js](../src/ui/views.js).
- Toast notifications rendered on top of an open bottom sheet and obscured
  its text (seen with a quest-complete toast over a tutorial sheet). Toasts
  now reposition above the sheet when one is open. [src/main.js](../src/main.js), [src/styles/shell.css](../src/styles/shell.css).
- Siege towers and enemies always drew as labelled placeholder silhouettes
  ("arrow" text box, plain red dot) — the tower/enemy atlases were never
  loaded or wired to `drawFrame`, even though the production art exists.
  Fixed in [src/scenes/siege.js](../src/scenes/siege.js).
- Realm board was pinned near the top of a nearly full-height canvas,
  leaving roughly half the primary/default screen an empty void. Board is
  now sized/centered against the actual available height.
  [src/scenes/realm.js](../src/scenes/realm.js).

All fixes verified live in the browser preview; `npm test` (34/34),
`npm run test:e2e` (4/4), `npm run assets:validate` (351/351), and
`npm run build` all still pass after the changes.

## Battle authority (2026-09-11)

Live tactical turns and the Resolve shortcut share one board engine
(`src/rules/tactical.js`). Resolve clones the current board + RNG and
auto-plays remaining turns with the same AI/damage as the live fight.
Animations only observe those events.

## Art approval (2026-09-11)

Human review of the production pack; all 351 manifest records marked `approved`.

## Commands

```bash
npm test
npm run test:e2e
npm run assets:validate
npm run build
npm run build:android
```

## Secret hygiene

Never commit: `*.keystore`, `key.properties`, `google-services.json`.

## External blockers (handoff §C)

Signed AAB and physical FPS require org/device steps outside this repo.
