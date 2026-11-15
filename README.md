# EcoLens

Browser AR: show a marker to your webcam, a miniature world appears on it, and you clean it up with your hand.

## Run it

```bash
npm install
npm run setup     # downloads the hand model + optional CC0 textures/HDRI (needs internet once)
npm run dev       # open http://localhost:5173 in Chrome or Edge
```

Camera access needs `localhost` or https. Without `npm run setup` everything still runs (procedural materials), but hand tracking falls back to the mouse because the hand model is missing.

## Markers

Open `http://localhost:5173/markers.html` and print at 100% scale (10 cm square, matte paper, keep the white border).

| ID | World | Starts at |
|----|-------|-----------|
| 11 | Polluted | 5% recovered |
| 12 | Recovering | 50% |
| 13 | Clean | 95% |

Markers only pick the world and anchor it. Everything else is hand interaction. Show a different marker to switch worlds (the newest stable marker wins, with a 1.5 s cooldown). Each world remembers its own progress for the session.

## Playing

1. Litter lies in front of you. Four bins stand behind it: plastic (yellow), paper (blue), metal (grey), organic (green).
2. Hover the cursor ring over an item (it glows), then pinch thumb and index together to pick it up.
3. Keep pinching and carry it back toward the bins. The bin under the item lights up.
4. Open your fingers to drop it. Right bin: it is recycled and the ground heals. Wrong bin: it returns and the app tells you which bin it belongs in.

Keys: `1` `2` `3` pick a world without a marker (labelled "Manual selection") · `L` lock marker position in place · `F` inspect (drag to rotate, scroll to zoom) · `R` reset the current world · `H` show the hand skeleton. Mouse: drag litter into a bin when no hand is detected.

## How hand tracking works

- MediaPipe Hand Landmarker runs on every new webcam frame (about 30 Hz, GPU delegate with CPU fallback).
- The pinch is the thumb-tip to index-tip distance in real-world metres (MediaPipe world landmarks). It turns on below 2.6 cm and off above 4.2 cm for two frames in a row, so it doesn't flicker.
- The cursor is the midpoint of the two fingertips, smoothed with a One-Euro filter.
- Pointing: the cursor becomes a ray from the camera into the diorama. A held item rides the point where that ray meets a horizontal plane just above the ground, so moving your hand up the screen carries it deeper toward the bins.
- Grabbing locks onto the item you were hovering a moment before the pinch closed, so closing your fingers doesn't make you miss.
- Dropping: the item is judged by where it is in the world (distance to each bin), not by screen pixels. If the hand disappears for 300 ms the item is dropped.

## Camera angle

The world is auto-levelled to a fixed viewing elevation, whatever angle the marker lies at, so you always see the ground receding toward a horizon with sky above. Change it in `src/config.js` (`diorama.viewElevationDeg`, default 36; lower shows more sky, higher looks more from above).

## Tuning (`src/config.js`)

- `hand.grabMeters` / `hand.releaseMeters`: pinch sensitivity.
- `camera.hfovDeg`: webcam horizontal field of view (70 is typical). If the world seems to slide against the marker as you move, adjust it.
- `tracking.*`: marker switch stability and lost-marker timing.
- `worlds.*.items` / `r0`: number of litter pieces and starting recovery per world.

## Project layout

```
src/ar/        camera, ArUco detection, pose maths, marker state machine
src/hands/     MediaPipe wrapper, pinch detection, mouse/hand input
src/scene/     stage, terrain, water, grass, trees, town, sky, atmosphere, wildlife, world
src/gameplay/  waste, bins, grab controller, recycling effects, game rules
src/state/     recovery value and per-world progress, lighting/atmosphere profiles
src/ui/        HUD and styles
scripts/       copy-wasm.mjs, fetch-assets.mjs
```

One scene, three recovery states: no asset is loaded twice. Every visual (grass, trees, river, light, smog, wildlife) reads the same recovery value.

## Credits and licenses

Optional textures and the HDRI come from Poly Haven (CC0). Powered by Poly Haven. Hand model: Google MediaPipe. Marker detection: js-aruco2 (MIT). Three.js, GSAP.
