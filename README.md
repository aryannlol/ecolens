# EcoLens

AR recycling game — point a marker at the camera and sort waste to restore the ecosystem.

## Setup

```bash
npm install
npm run setup   # downloads env.hdr + ground_dead.jpg into public/assets/
npm run dev     # http://localhost:5173
```

## Open on a phone

1. Run `npm run dev` on your machine.
2. Press **M** (or the QR button) — a QR code with your LAN IP appears.
3. Scan it on your phone to open the markers page, then print / show a marker.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `1` / `2` / `3` | Pick world (polluted / recovering / clean) |
| `W` | Wipe haze with open hand |
| `R` | Reset game |
| `F` | Toggle inspect / orbit mode |
| `L` | Lock / unlock marker position |
| `H` | Toggle hand skeleton overlay |
| `M` | Toggle QR modal |
| `Esc` | Close QR modal / endgame |

## Debug params

| Param | Effect |
|-------|--------|
| `?perf` | FPS / draw-call overlay |
| `?debug=haze` | Haze debug view |
| `?debug=hand` | Hand-tracking debug |

## Project structure

```
src/
  ar/          marker detection & tracking
  hands/       MediaPipe hand tracking & input
  scene/       Three.js stage, world, entities
  gameplay/    game logic, bins, recycling FX
  state/       restoration state
  ui/          HUD, haze, endgame, QR, controls
  util/        math, sound, stageMap
public/
  mediapipe/   hand model files (runtime)
  models/      GLTF models (runtime)
  assets/      env.hdr, ground_dead.jpg
reference/     eco-meters.html, ecosystem-restored.html (design refs)
```
