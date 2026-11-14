# Vector Strike

A love letter to the 1983 colour-vector arcade space shooters: a three-phase
attack run (dogfight → surface → trench) rendered as glowing wireframe, built
to eventually run in a home-made arcade cabinet with a flight-yoke controller.

## Run it

```bash
npm install
npm run build      # -> dist/index.html (single self-contained file)
open dist/index.html
npm run dev        # rebuilds on every save; refresh the browser
```

`dist/index.html` has no dependencies and no server requirement, so it can be
loaded directly by a kiosk-mode browser on the cabinet PC.

## Controls

| Input | Steer | Fire |
|---|---|---|
| Mouse | crosshair follows pointer | click / hold |
| Keyboard | arrows or WASD | Space / J / Enter |
| Phone tilt | turn the phone like a wheel; pull top towards you to climb (quick tap = re-centre) | FIRE button |
| Touch | drag anywhere (virtual stick; overrides tilt) | FIRE button, bottom-right |
| Gamepad / yoke | axis 0 (X), axis 1 (Y) | any button |

Tilt needs the game served over https (e.g. GitHub Pages): sandboxed viewers such as
the Claude artifact page block motion sensors, and the game falls back to drag steering.
Tilt tuning lives in `TILT` in `src/tilt.js`.

Pull back on the yoke = crosshair up (arcade default). Flip
`CONFIG.gamepadInvertY` in `src/input.js` if your hardware reports the other way.

## How a wave plays

1. **Dogfight** — rotate to track interceptors, shoot them and their fireballs.
2. **Surface run** (wave 2+) — weave between towers, shoot the magenta caps.
3. **Trench run** — dodge catwalks, shoot turrets, hit the exhaust port when
   "PORT IN RANGE" shows. Fire nothing else in the trench for the
   **Pure Instinct** bonus. Miss the port and you go round again.

Each cleared wave adds a shield and makes everything faster and meaner.

## Code map

```
src/
  main.js        loop
  game.js        state machine, shooting, fireballs, explosions, HUD
  config.js      tuning numbers (points, shields, cooldowns)
  renderer.js    fake vector monitor: batched glow lines, phosphor trail
  camera.js      yaw/pitch camera, world -> camera space
  input.js       mouse / keys / touch / Gamepad API
  audio.js       synthesised WebAudio sound effects
  models.js      wireframe models
  phases/        space.js, surface.js, trench.js
scripts/build.mjs  esbuild bundle inlined into dist/index.html
```

## Roadmap

- [ ] Boss interceptor with its own attack pattern
- [ ] Vector-font HUD (draw text as line segments, not a system font)
- [ ] Attract mode + high-score initials table
- [ ] Optional speech/sample hooks for a personal build
- [ ] Yoke: Arduino Leonardo/Pro Micro firmware (2 pots + 4 buttons as HID joystick) in `hardware/`
- [ ] Cabinet: kiosk boot script for a mini PC
