# Ages of Dominion (Cinematic)

Same product constraints as the prior build:

- Offline only — no network calls, no CDN, no analytics
- Application id `com.agesofdominion.game` is permanent
- Never let a failed save load fall through to a new game
- Realm canvas stays outside `#view`
- `dispatch()` is the sole gameplay mutation path
- Do not retune `src/data` without an explicit balance exception
- Sample audio is permitted and ships inside the app
- Haptics via `@capacitor/haptics` are approved

See `docs/visual-style-bible.md` for art direction.
