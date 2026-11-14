# Vector Strike — notes for Claude Code

Browser-based 1983-style colour vector shooter, destined for a home-built
arcade cabinet with a DIY flight yoke (Arduino as USB HID joystick).

## Ground rules
- Plain ES modules in `src/`, bundled by esbuild into ONE self-contained
  `dist/index.html`. No runtime dependencies, no asset files: graphics are
  lines, sound is synthesised in `src/audio.js`.
- Keep it all original: no film names, logos, character designs or audio in
  the repo. (A personal themed build can live in a gitignored folder.)
- Everything is drawn through `Renderer` (`line`, `line3`, `wire`) so the glow
  look stays consistent. Batch by colour; don't call ctx.stroke per line.
- Coordinates: x right, y up, z forward. `cam.toCam()` then `r.project()`.
- Tuning numbers go in `src/config.js`.
- Must stay playable with mouse, keyboard, touch AND gamepad. The gamepad
  path is the one the real yoke uses — never break it.

## Phase contract (`src/phases/*.js`)
A phase class gets `(game, opts)` and implements:
`update(dt)`, `draw(r)`, `targets() -> [{pos, radius, hit()}]`, optional `hud(r)`,
`camVel` (used to lead enemy fireballs), and `title`/`subtitle` for the banner.
Switch phases with `game.goto(name, opts)`; finish a wave with `game.nextWave()`.

## Commands
- `npm run build` — build dist/index.html
- `npm run dev` — watch + rebuild
- Debug in the browser console via `window.__game`
  (e.g. `__game.wave = 3; __game.goto('trench')`).
