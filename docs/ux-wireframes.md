# Mobile UX Wireframes — Ages of Dominion Cinematic

Primary design viewport: **375×812** portrait. Safe areas on all four edges.

## Navigation (5 destinations)

1. **Realm** — default home. Full-screen isometric village + bottom action bar.
2. **Host** — segmented **Hero | Army**.
3. **Map** — full-screen campaign canvas + node detail card.
4. **War** — next recommended fight + duel/siege modes (no duplicate Map entry).
5. **More** — quests, chronicle, saves, settings, accessibility.

Hero and Army are **not** separate tabs.

## Screen map

### Title
- Full-bleed parallax canvas
- Brand, one tagline, Continue / New Game / Load / Saves

### Class select
- Horizontal snap carousel, one hero per screen
- Name field (max 18), pinned Choose above safe-area

### Realm
- Canvas outside `#view` (must survive render)
- Contextual **Next** card: collect → build → recruit → fight
- Age-up button always keeps title + one blocker sub-line

### Host / Hero
- Portrait / turntable, primaries, skills, paper-doll gear

### Host / Army
- Host power number, stacks, recruit/reinforce, towers

### Map
- Pinch-zoom canvas, “you are here” pulse, gold path to next story node
- Tap card: foe count · verdict · loot

### War
- One gold primary CTA (campaign siege or duel)
- Endless / skirmish secondary
- Async seed duel encode/paste

### Battle overlay
- Initiative strip, board, roster tray
- Begin disabled until ≥1 deployed; Place all available

### Siege overlay
- Core HP bar, speed, range preview on select, painted towers

### Sheets
- Short contextual only; close on tab change
- Toast z-index above all overlays

## Responsive rules

| Breakpoint | Behavior |
|---|---|
| ≤359 | Collapse rate sub-lines |
| 375–767 | Phone shell |
| ≥768 | Sidebar nav |
| ≥900 | Wider combat stage |
| Landscape phone | Letterbox boards / compact HUD |

## First session (guided)

Name+class → see Realm → build Quarry → recruit one stack → walk one map node → easy fight.
Lock War/More until first map battle or age > 0.
