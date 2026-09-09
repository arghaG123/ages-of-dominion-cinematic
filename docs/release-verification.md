# Release verification checklist

- [x] Independent Git repo at `C:\dev\ages-of-dominion-cinematic`
- [x] App id `com.agesofdominion.game` in `capacitor.config.json`
- [x] v6 save fixtures migrate to schema v7
- [x] Damaged saves never create a new game
- [x] Data parity tests vs `reference/game-data.json`
- [x] Placeholder art pack + atlases validated (351 assets)
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
- [ ] Human approval of production art beyond placeholder-ship status

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

Signed AAB, physical FPS, and final human art sign-off require org/device steps outside this repo.
