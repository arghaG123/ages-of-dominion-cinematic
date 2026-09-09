---
name: cinematic-rebuild-handoff
overview: A self-contained execution document for rebuilding Ages of Dominion in a new repository, with the visual system and mobile UX approved before gameplay implementation. It preserves the existing product identity, tuned mechanics, offline guarantees, and v6 save compatibility while replacing the implementation and presentation.
todos:
  - id: foundation-spec
    content: Create the independent repository foundation, immutable data baseline, save fixtures, and compatibility tests.
    status: completed
  - id: visual-system
    content: Approve the dark-fantasy style bible, mobile UX wireframes, benchmark assets, and responsive UI rules.
    status: completed
  - id: asset-pipeline
    content: Build the manifest-driven atlas pipeline and complete the approved production art packs.
    status: completed
  - id: visual-slice
    content: Implement and approve the responsive Realm, Host, Map, battle, and siege visual slice using fixture state.
    status: completed
  - id: core-systems
    content: Rebuild data, rules, persistence, progression, story, tactical combat, siege, audio, and Android integration.
    status: completed
  - id: release-verify
    content: Verify compatibility, performance, accessibility, viewports, offline behavior, APK, AAB, and secret hygiene.
    status: completed
isProject: false
---

# Ages of Dominion Cinematic Rebuild Handoff

**Stack:** JavaScript ES2022 · Canvas 2D · Vite 6 · Vitest 2 · Capacitor 7 · Android API 24–36

## 1. Task Summary

Build a clean implementation in `C:\dev\ages-of-dominion-cinematic` with independent Git history. Treat [the current project](C:/dev/ages-of-dominion) only as the gameplay, balance, and compatibility specification; do not copy its Git history or implementation wholesale.

The rebuild is the same Android product: keep application ID `com.agesofdominion.game`, recognize existing `aod.slot.*` storage, and import/migrate current v6 saves and `ages-of-dominion-save` backups. Preserve the seven-age kingdom builder, hero and army progression, adventure campaign, tactical combat, siege defence, story, quests, offline progress, local saves, and fully offline runtime.

The new presentation is premium cinematic 2.5D dark fantasy: pre-rendered isometric art, painterly surfaces, dramatic lighting, grounded proportions, animated combat silhouettes, restrained glass/metal UI, and subtle gold accents. Art uses AI-generated drafts with human selection, repainting, cleanup, provenance, and final approval. Produce and approve the visual system and one playable visual slice before implementing the complete game.

Authoritative references are [BUILD-PLAN.md](C:/dev/ages-of-dominion/docs/BUILD-PLAN.md), [GAMER-REVIEW-FIX-PLAN.md](C:/dev/ages-of-dominion/docs/GAMER-REVIEW-FIX-PLAN.md), [REMAINING-WORK.md](C:/dev/ages-of-dominion/docs/REMAINING-WORK.md), [ASSET-MANIFEST.md](C:/dev/ages-of-dominion/ASSET-MANIFEST.md), [src/data](C:/dev/ages-of-dominion/src/data), and [src/save](C:/dev/ages-of-dominion/src/save).

## 2. Environment

- New root: `C:\dev\ages-of-dominion-cinematic`
- Reference root: `C:\dev\ages-of-dominion` (read-only)
- Node.js 20 LTS or newer, npm, Git, Git LFS, JDK 21, Android Studio, Android SDK 36.
- Runtime packages: Capacitor core, Android, App, Preferences, Filesystem, Share, and Haptics.
- Development packages: Vite 6, Vitest 2, Playwright, and one deterministic build-time image processor such as Sharp.
- Runtime rendering: Canvas 2D plus semantic DOM controls. No runtime 3D, WebGL, game engine, framework, CDN, web font, server, account, analytics, ads, or network request.
- Ship all art and audio locally. Cap Canvas DPR at 2 and atlases at 2048×2048.
- Performance targets: realm 30 FPS; tactical combat and siege 60 FPS on a representative budget Android device; bounded decoded-image memory with scene/age/biome lazy loading.
- Primary viewport: 375×812 portrait. Required checks: 320×568, 360×640, 360×800, 375×812, 390×844, 412×915, 440×956, 640×360, 768×1024, 1024×768, and 1280×800.
- Preserve Android gesture-navigation safe areas, font scaling, reduced motion, hardware back, app pause/resume, and background save flushing.

## 3. Inputs & Outputs

Inputs:

- Export the current immutable gameplay constants to `reference/game-data.json` without changing [src/data](C:/dev/ages-of-dominion/src/data).
- Capture healthy, backup-recovered, damaged, and newer-version v6 saves in `reference/save-fixtures/`.
- Capture the current seeded balance baseline in `reference/balance-baseline.json`.
- Use Against the Storm only for atmosphere and settlement-density reference.
- Use Wartales only for grounded tactical tone and readable silhouettes.
- Never copy reference-game assets, logos, characters, or identifiable compositions.

Outputs:

- Independent Git repository and Capacitor Android project.
- Responsive application shell and reusable Canvas renderer.
- Versioned, provenance-aware art manifest and deterministic atlas pipeline.
- Approved production art, SVG icons, VFX, music, and sound effects.
- Rewritten pure data/rules, state, persistence, UI, realm, map, battle, and siege modules.
- Save schema v7 or newer with automatic migration from current v6 slots and backups.
- Vitest rule/save/layout coverage, Playwright viewport flows, deterministic screenshots, debug APK, and signed AAB.

Required public contracts, expressed with JSDoc in JavaScript:

```js
newGame(options) => GameState
dispatch(action) => ActionResult
migrateSave(rawSave) => GameState
loadSlot(slotId) => LoadResult
saveSlot(slotId, state) => Promise<void>
resolveBattle(input, rng) => BattleResult
resolveSiege(input, rng) => SiegeResult
calculateOfflineProgress(state, now) => OfflineResult
loadAtlas(atlasId) => Promise<Atlas>
renderScene(ctx, viewport, state, assets) => void
```

`LoadResult` must distinguish `empty`, `ok`, `recovered`, `damaged`, and `newer-version`. A damaged or unsupported save must never produce a new game.

Every production asset record must include: stable id, category, output file, atlas/frame rectangle, pivot, logical/source size, age, visual faction, animation name, prompt, seed, generator, human editor, license, checksum, and approval status.

## 4. Step-by-Step Instructions

### Foundation

1. Create the new root directory.
2. Initialize a new Git repository on `main`.
3. Add ignores for dependencies, builds, Android secrets, keystores, generated intermediates, and local art caches.
4. Configure Git LFS for production raster art and audio.
5. Create a vanilla Vite 6 ES-module project.
6. Configure Capacitor 7 with `com.agesofdominion.game`.
7. Export the current gameplay data into the new immutable reference fixture.
8. Capture representative current save fixtures.
9. Capture the current balance baseline.
10. Add a parity test comparing the rebuilt constants with the exported fixture.
11. Commit the empty foundation before implementation.

### Art direction and mobile UX

12. Write `docs/visual-style-bible.md` with palette, materials, proportions, camera, lighting, silhouette, animation, and prohibited-style rules.
13. Fix one 2:1 isometric camera and one upper-side lighting direction for all environment art.
14. Define charcoal metal, worn leather, oxidized iron, parchment, muted faction accents, and restrained gold as the UI material system.
15. Produce one benchmark hero portrait.
16. Produce one benchmark isometric building.
17. Produce one benchmark battlefield.
18. Produce one benchmark animated combat unit.
19. Produce one benchmark UI panel.
20. Test those assets at actual size on 375×812.
21. Freeze the style prompt and human-cleanup rubric only after all five benchmarks pass.
22. Create wireframes for title, class selection, Realm, Host, Map, War, More, battle, siege, sheets, save management, and first-session onboarding.
23. Use five primary destinations: Realm, Host, Map, War, and More.
24. Put Hero and Army behind segmented controls inside Host.
25. Make Realm the default home and expose one contextual next action: collect, build, recruit, or fight.
26. Keep title, realm, map, battle, and siege full-screen.
27. Use bottom sheets only for short contextual decisions.
28. Close sheets on navigation changes.
29. Keep notifications above all overlays and clear of navigation.
30. Enforce 44×44 CSS-pixel interactive targets, 14px body text, 12px meaningful secondary text, safe areas on four edges, system font scaling, and reduced motion.
31. Use CSS `clamp()` for spacing/type and `ResizeObserver` for every Canvas host.
32. Use CSS coordinates for hit testing and cap backing stores at DPR 2.
33. Letterbox boards when necessary instead of shrinking important cells below usable input size.

### Asset pipeline and first production pack

34. Separate source, review, approved, and shipped asset directories.
35. Create a machine-readable source manifest.
36. Implement deterministic WebP atlas generation with two-pixel frame extrusion, pivots, bounds, checksums, and 2048×2048 limits.
37. Keep resource/action/status/navigation icons as custom engraved-style SVG, not raster paintings or emoji.
38. Add tests for missing files, wrong dimensions, duplicate IDs, invalid atlas frames, and unapproved production assets.
39. Record prompt, seed, generator, human edits, license, and approval for every asset.
40. Create three 768×1024 hero portraits plus three idle and three turntable sheets.
41. Create 21 player unit families: melee, ranged, and heavy across seven ages.
42. Give each combat family idle, move, attack, hit, and death animations using east-facing frames mirrored safely for west-facing combat.
43. Create eight neutral-creature families, five siege-enemy families, and one persistent rival portrait/figure.
44. Create six base biome kits: lowlands, forest, swamp, desert, snow, and darklands.
45. Derive the eight gameplay terrains through hills, ruins, and wasteland dressing variants without changing their rule identities.
46. Create eight tactical battlegrounds, six campaign-map tile kits, and six siege-lane variants.
47. Create 70 buildings: ten building types across seven ages.
48. Create shared scaffold, worker, dust, and completion overlays.
49. Create 28 towers: four tower families across seven ages.
50. Create initial VFX atlases for fire, ice, arrows, melee impact, healing, and smoke.
51. Create a second VFX pass for lightning, shields, death/dissolve, dust, rain splashes, and spell light.
52. Create 48–64 custom SVG icons covering resources, navigation, buildings, actions, hero stats, combat commands, statuses, and accessibility cues.
53. Create reusable metal, leather, parchment, and glass nine-slice UI textures.
54. Verify every asset at its actual phone display size, not only enlarged on desktop.

### Approved visual slice

55. Build the responsive shell using fixture state.
56. Build the title and class-selection flow.
57. Build one-age Realm with three buildings, villagers, weather, and construction.
58. Build Host with one hero paper doll, equipment, army cards, and host power.
59. Build one map biome with current-location pulse, gold route, readable node card, reward, and fight verdict.
60. Build one complete tactical encounter with deployment, movement, damage preview, animated attacks, VFX, death, and result screen.
61. Build one siege wave with painted towers, range previews, projectile arcs, core feedback, and speed controls.
62. Capture deterministic screenshots at every required viewport.
63. Reject the slice if any surface looks sourced from a different art direction.
64. Freeze renderer contracts and UI tokens after visual approval.

### Architecture and persistence

65. Implement pure `src/data` modules from the frozen fixture.
66. Implement pure `src/rules` modules depending only on data.
67. Implement state construction, tutorial, rival, and story flags under `src/state`.
68. Implement storage, atomic slots, backup recovery, migrations, autosave, and import/export under `src/save`.
69. Implement Canvas sizing, atlases, animation, particles, and scene utilities under `src/render`.
70. Implement title, realm, map, hero, battle, and siege as separate scenes receiving state and callbacks.
71. Implement one action dispatcher as the only mutation entry point.
72. Request autosave only after successful actions.
73. Preserve current `aod.slot.*` key recognition and backup checksum format.
74. Migrate current schema v6 into the new schema.
75. Flush saves on page hide, visibility loss, Android pause, and explicit return to title.
76. Prove with tests that empty, damaged, recovered, and unsupported saves stay distinct.

### Functionality

77. Implement four-resource income, ten buildings, 3–8 second persisted construction, age-up, Bronze-age market, offline harvest, and seven ages.
78. Resolve background-completed builds before calculating offline income.
79. Implement Knight, Ranger, and Warlock with four primaries, nine secondary skills, eight spells, six equipment slots, four gear qualities, and ten artifacts.
80. Implement army capacity, recruitment, reinforcement, five ranks, three age-specific player roles, eight neutral creatures, and four tower families.
81. Implement planar map generation, linked travel, movement points, eight terrains, seven weather types, resources, dwellings, events, treasure, ambushes, garrisons, and bosses.
82. Implement seven chapters, persistent choices, three rotating quests from six templates, seven milestones, and the recurring named rival.
83. Implement the guided first session: see Realm, build Quarry, recruit one stack, move one node, and complete one easy fight.
84. Progressively unlock Hero/Army depth, War, and More when they become relevant without deleting access to unlocked systems.

### Tactical battle and siege

85. Implement the 7×10 tactical board with Tactics deployment rows, disabled Begin at zero units, Place All, initiative, move, wait, defend, melee, ranged ammunition, adjacency penalties, flying, retaliation, morale, luck, spells, enemy AI, and deterministic resolution.
86. Show Easy/Even/Risky/Deadly comparisons and expected damage before commitment.
87. Keep battle results authoritative and animations observational so skipped/reduced animations cannot change outcomes.
88. Add a short skippable resolve recap and offline shared-seed duel codes.
89. Implement the 9×15 siege board with four painted tower families, visible range/path coverage, five enemy types, fixed-step simulation, core health, speed controls, campaign/endless/skirmish/site modes, and capped call-next-wave rewards.
90. Pause siege without simulation catch-up when backgrounded.

### Audio, Android, and release verification

91. Add bundled title, realm, battle, and siege music plus local build/recruit/age-up/attack/spell/death/victory/defeat sounds.
92. Keep music, effects, and haptics independently configurable.
93. Pair haptics with upgrade, recruit, age-up, and killing blow.
94. Implement the Android back priority: close sheet, leave fight/siege with confirmation, return to Realm, confirm title, then exit.
95. Implement native save export/import and achievement sharing without network access.
96. Run data parity, rule, migration, corruption, deterministic battle, deterministic siege, atlas, accessibility, and viewport tests.
97. Run complete first-session checks at 320×568 and 375×812.
98. Run complete battle/siege checks at 412×915 and on a physical gesture-navigation device.
99. Profile frame pacing, decoded-image memory, loading spikes, and audio voices on a representative budget Android phone.
100. Build the Vite production bundle, sync Capacitor, produce a debug APK, and produce a signed AAB only after verifying release-key ownership.
101. Verify Git tracks no keystore, `key.properties`, `google-services.json`, generated secret, or signing password.

## 5. Edge Cases & Failure Modes

- Corrupt, empty, recovered, and newer-version saves are different states; only truly empty storage may offer immediate new-game creation.
- Clock rollback or extreme clock jumps must not produce negative income or permanently stuck construction; clamp safely and resolve short builds.
- Background-completed construction resolves before offline production so the correct rates apply.
- Empty armies and exhausted rosters require explicit UI states rather than silent no-ops.
- Deployment and siege hit areas must remain usable at 320px width even if visual cells are smaller than 44px.
- Resizing, rotation, keyboard changes, and roster growth must recompute Canvas geometry without redrawing from stale backing-store dimensions.
- Missing art may show labelled development silhouettes, but production builds must fail asset validation.
- Mirroring must not reverse readable text, heraldry, asymmetric weapons, or shield emblems incorrectly.
- Weather, fog, particles, and VFX must not hide legal cells, selected units, damage previews, or core health.
- Reduced-motion mode removes parallax, shake, flashing, long travel, and animated camera easing while preserving state feedback.
- Atlas and scene caches must release obsolete age/biome assets to avoid unbounded decoded-image memory.
- Audio decode failure must not block startup or game actions.
- Every AI-generated asset must be checked for anatomy, accidental writing, watermarks, inconsistent gear, copied identities, and silhouette failure.
- Phone landscape must remain functional through compact layout or letterboxing; tablets must not expose different rules.

## 6. Acceptance Criteria

- [ ] Separate folder and independent Git history exist.
- [ ] Application ID remains `com.agesofdominion.game`.
- [ ] Current v6 slots and backup files migrate without loss.
- [ ] Damaged saves never create a fresh realm.
- [ ] Rebuilt gameplay data passes parity against the current export.
- [ ] Seven ages, ten buildings, hero, army, map, story, quests, combat, and siege are complete.
- [ ] Production contains no emoji, pixel art, cute low-poly art, photographic battleground mismatch, or flat vector terrain.
- [ ] All production art follows one approved camera, lighting, material, palette, and silhouette system.
- [ ] Hero, unit, biome, building, tower, VFX, UI texture, and SVG icon packs are complete and provenance-recorded.
- [ ] Every primary control is at least 44×44 CSS pixels and every mandatory viewport has accessible primary actions.
- [ ] Safe areas, font scaling, hardware back, background save flush, reduced motion, and independent haptics work on Android.
- [ ] Realm sustains 30 FPS and combat/siege sustain acceptable 60 FPS pacing on the target budget device.
- [ ] No atlas exceeds 2048×2048 and decoded-image memory stays bounded across age/biome changes.
- [ ] Runtime performs no network request and requests no unapproved permission.
- [ ] Automated tests, production build, debug APK, and release AAB pass.
- [ ] Signing secrets remain outside Git.

## 7. Do NOT

- Do not alter the existing project, copy its Git history, or port its implementation wholesale.
- Do not retune frozen gameplay constants during the visual rebuild.
- Do not change the Android application ID.
- Do not replace an existing release key if the package has already been signed or uploaded.
- Do not copy assets, characters, logos, or identifiable compositions from reference games.
- Do not use runtime 3D, WebGL, an engine, a UI framework, emoji, pixel art, cute low-poly characters, or flat terrain.
- Do not accept raw AI output without human cleanup and provenance.
- Do not generate the entire inventory before benchmark art passes at actual phone size.
- Do not load every age and biome atlas at startup.
- Do not derive input coordinates from physical Canvas pixels.
- Do not hide missing production art behind silent fallbacks.
- Do not add a backend, CDN, analytics, account, ad, cloud save, battle pass, gacha, or runtime network dependency.
- Do not couple simulation outcomes to animation timing.
- Do not begin full functionality until the visual slice is approved.
