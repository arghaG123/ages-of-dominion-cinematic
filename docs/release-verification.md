# Release verification checklist

- [x] Independent Git repo at `C:\dev\ages-of-dominion-cinematic`
- [x] App id `com.agesofdominion.game` in `capacitor.config.json`
- [x] v6 save fixtures migrate to schema v7
- [x] Damaged saves never create a new game
- [x] Data parity tests vs `reference/game-data.json`
- [x] Placeholder art pack + atlases validated (351 assets)
- [x] Style bible + UX wireframes frozen
- [x] Visual shell: title, realm, host, map, war, battle, siege
- [x] `npm test` passing
- [x] `npm run build` production bundle
- [ ] `npx cap sync android` + debug APK on device
- [ ] Signed AAB only after keystore ownership confirmed (see `android-key.properties.example`)
- [ ] Physical gesture-nav safe-area pass
- [ ] Budget-device FPS profile (realm 30 / combat 60)

## Commands

```bash
npm test
npm run assets:validate
npm run build
npm run build:android
```

## Secret hygiene

Never commit: `*.keystore`, `key.properties`, `google-services.json`.
