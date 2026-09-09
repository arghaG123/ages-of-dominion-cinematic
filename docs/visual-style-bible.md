# Visual Style Bible — Ages of Dominion (Cinematic)

**Frozen for production.** Mood target: cinematic dark-fantasy strategy.
References for mood only (do not copy assets): Against the Storm (settlement atmosphere), Wartales (grounded tactical tone).

## One-line rule

> Cinematic dark-fantasy strategy: realistic materials, stylized proportions, dramatic lighting, and readable combat silhouettes.

## Prohibited

- Pixel art
- Cute / chibi / low-poly “Polytopia” direction
- Emoji as production icons or units
- Flat vector terrain
- Photographic battlegrounds beside painterly units
- Glossy cartoon plastics
- Purple-on-white UI chrome
- Accidental text / watermarks / logos from generators

## Camera & lighting (environments)

- Isometric projection contract: **2:1** diamond (tile width : tile height).
- Single light key: **upper-left**, soft cool fill from upper-right, warm ember accents low.
- Soft contact shadows under buildings and units; no hard black blobs.
- Fog / dust / embers / rain are atmospheric layers — never hide legal cells or HP numbers.

## Palette

| Role | Hex | Notes |
|---|---|---|
| Deep void | `#0B0D12` | App chrome, night |
| Charcoal metal | `#12151B` / `#2A3140` | Panels, iron |
| Worn leather | `#3A2E24` | UI accents |
| Parchment | `#C4B79A` | Secondary text surfaces |
| Oxidized iron | `#6E788A` | Inactive metal |
| Gold | `#C9A227` | Primary accent — restrained |
| Faction muted red | `#8A3A32` | Rival / danger |
| Faction muted teal | `#3A6A68` | Ally cool |

## Materials

- Stone: chalky, moss in creases, rim light on edges.
- Wood: visible grain, damp dark ends.
- Metal: brushed, not chrome; gold is tarnished, not neon.
- Cloth / banners: heavy weave, wind folds.
- Magic light: localized bloom only (spell, forge, campfire).

## Proportions & silhouettes

- Serious heroic proportions (approx. 7–7.5 heads).
- Units must read at **48 CSS px** tall: weapon outline + shoulder mass + unique headgear.
- Buildings: distinct roof silhouette per type; age kit changes materials, not footprint.

## UI materials

- Glass / metal panels with subtle gold hairlines.
- No emoji. Custom engraved SVG icons only.
- Body text ≥ 14px; secondary meaningful text ≥ 12px; tap targets ≥ 44×44 CSS px.

## Animation

- Combat: idle / move / attack / hit / death per family.
- Face east in source sheets; mirror for west with heraldry-safe rules (do not mirror text emblems).
- VFX atlases: fire, ice, arrows, melee impact, healing, smoke (+ later lightning, death, dust, rain).
- Respect `prefers-reduced-motion`.

## Benchmark gate (must pass at 375×812 before mass generation)

1. Hero portrait (Knight)
2. Isometric Town Hall (Stone Age)
3. Plains battlefield
4. Clubman combat strip (idle+attack)
5. Metal/glass resource panel

## Prompt template (production)

```
Masterpiece cinematic dark-fantasy oil painting for a premium mobile strategy game.
Realistic materials, stylized heroic proportions, dramatic rim lighting from upper-left,
desaturated midtones, high-contrast readable silhouette, soft fog and ember dust.
Isolated on solid magenta #FF00FF background. No text, no watermark, no logo, no UI.
```

## Human cleanup rubric

Reject if: broken anatomy, extra limbs, unreadable at 48px, style drift, accidental writing, watermark, cute proportions, flat shading, or camera mismatch.
