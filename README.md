# Penalty Club

A standalone football penalty game built with the workspace's TypeScript + Vite conventions. All stadium, ball and goalkeeper artwork is rendered locally with Canvas 2D; sound effects are synthesized with Web Audio. No external assets, API, account or runtime network access are required.

## Run

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:4194**. `npm run build` creates a standalone `dist/` directory with relative asset paths. Deploy its complete contents to a static host.

## Controls

- Start a swipe or mouse drag on the ball, move toward the goal, then release.
- Direction sets the shot's horizontal placement; length sets power; speed adds height.
- The dotted trajectory and crosshair show the actual shot path and endpoint. The sidebar identifies weak shots, shots over the bar and shots outside the posts.
- Holding the endpoint keeps the current preview unchanged. Tiny movements and downward drags cannot fire. Escape, interrupted touches, window blur or resizing cancel an unfinished shot.
- The ball resets automatically 1.45 seconds after the result. Use **Next penalty** or start on the ball to reset sooner.
- Focus the pitch for keyboard controls: Left/Right aim, Up/Down adjust height, W/S adjust power, Space shoots, Escape cancels. M or the sound button toggles audio.

Practice is continuous. The scoreboard tracks goals and attempts, with the last five outcomes and the best goal streak of the current session. Sound unlocks on the first interaction; background tabs freeze the simulation and suspend audio.

## Physics

Gestures are measured in normalized pitch coordinates, giving the same relative swipe the same result at different screen sizes. The preview and animation share a single trajectory function. Power controls flight time, while swipe speed controls elevation. Perspective makes the ball shrink and visually slow as it approaches the goal. Very weak shots decelerate on the grass and stop short.

The keeper waits 190 ms before accelerating into a dive. Available flight time bounds the keeper's reach, giving powerful corner shots an advantage. The animated arrival position is also the collision position. Saved balls rebound outward, while goals drop into the net with gravity and a damped bounce. Outcomes depend on the input and attempt number, without random rolls or aim assistance after release. This is a tuned 2.5D arcade model, not a full 3D football simulation; there is no player-controlled spin or crossbar rebound simulation.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
```

Unit tests cover input thresholds, direction, power, elevation, outcomes, exact preview endpoints, perspective, friction, keeper reaction/reach and bounces. Browser tests launch a production preview on port 4298 using installed Google Chrome. They cover mouse and Chrome-emulated touch input, preview/release consistency, cancellation, keyboard input, mute, scoring, resets and responsive layouts. Screenshots are written to `test-results/`. The `?test` URL exposes a read-only state snapshot for acceptance checks.

Physical touchscreen devices, Safari and audio quality on real speakers have not been tested. Landscape and short screens may require vertical scrolling; the pitch itself consumes touch gestures to prevent accidental page scrolling during a shot. Reduced-motion preferences disable decorative ball rotation while preserving gameplay flight.

## Files

- `src/physics.ts`: input mapping, shared trajectories, keeper movement, collision outcomes and rebounds.
- `src/main.ts`: pointer/keyboard input, game lifecycle, scores and interface updates.
- `src/art.ts`: stadium, goalkeeper, ball and preview rendering.
- `src/audio.ts`: synthesized kick, goal, save and miss effects.
- `src/style.css`, `index.html`: responsive interface and accessible controls.
- `tests/`, `playwright.config.ts`: unit and browser checks.

This game is a separate sibling project; it does not modify or integrate with the launcher, SDK or game server.
