# Asset Pipeline

## Directories

| Path | Role |
|---|---|
| `assets/source/` | Raw generator outputs + provenance sidecars |
| `assets/review/` | Awaiting human cleanup (gitignored) |
| `assets/approved/` | Human-approved masters |
| `public/assets/` | Shipped atlases + metadata consumed at runtime |
| `public/icons/` | Custom SVG icon set |
| `public/audio/` | Bundled music/SFX |

## Manifest

`assets/source/manifest.json` lists every asset with:

`id, category, file, atlas, frame, pivot, logicalSize, sourceSize, age, faction, animation, prompt, seed, generator, humanEditor, license, checksum, approvalStatus`

## Commands

```bash
npm run assets:placeholders   # deterministic dark-fantasy placeholders + SVG icons
npm run assets:atlas          # pack approved frames into ≤2048 WebP atlases (+2px extrusion)
npm run assets:validate       # fail on missing/duplicate/unapproved/oversized
```

## Runtime

- Lazy-load atlases by scene / age / biome
- Cap Canvas DPR at 2
- Dev may show labelled silhouettes; production build fails validation if any required asset is not `approved` or `placeholder-ship`

## First production pack checklist

- [x] 3 hero portraits + idle + turn sheets (placeholder-ship)
- [x] 21 unit families × anim keys
- [x] 8 creatures + 5 siege enemies + rival
- [x] 6 biomes → 8 terrains derived
- [x] 8 battlegrounds + 6 map kits + 6 siege lanes
- [x] 70 buildings + scaffolds
- [x] 28 towers
- [x] VFX: fire ice arrows melee heal smoke (+ pass-2 stubs)
- [x] 48+ SVG icons
- [x] UI nine-slice textures
