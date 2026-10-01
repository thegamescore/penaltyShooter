# Penalty Club · gamesCore_

A standalone football penalty game built with the workspace's TypeScript + Vite conventions. All stadium, ball and goalkeeper artwork is rendered locally with Canvas 2D; sound effects are synthesized with Web Audio. The visual theme takes its red, white and charcoal palette from [Fuksiarz](https://fuksiarz.pl/), with [gamesCore_](https://thegamescore.com/) identity, links and wordmark typography throughout. Stadium signage and the goalkeeper kit match the campaign palette, and the brand remains visible in the mobile control bar. The Recoleta Alt Bold font is sourced from gamesCore_ and bundled locally; the football favicon is a local SVG. No API, account or runtime network access is required.

## Run

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:4194**. `npm run build` creates a standalone `dist/` directory with relative asset paths. Deploy its complete contents to a static host.

## Controls

- **Tap or click a spot inside the goal to shoot.** Keep it inside the posts and under the bar.
- Power is automatic. The ball goes to the spot you choose, with a small inset at the posts to keep edge taps on target.
- Hover over the goal to preview your shot. Touch players can tap once, or hold to adjust their aim and release to shoot.
- The next ball is ready automatically 1.45 seconds after each result. Taps outside the goal do nothing. Escape, interrupted touches, window blur or resizing cancel an unfinished shot.
- Keyboard: focus the pitch, use the arrows to aim, then Space or Enter to shoot. M or the sound button toggles audio.

Practice is continuous. The scoreboard tracks goals and attempts, with the last five outcomes and the best goal streak of the current session. Arcade sound effects include a punchy kick, a rising goal jingle, distinct save and miss tones, and a next-penalty cue. Sound unlocks on the first interaction; muting immediately silences active effects, and background tabs freeze the simulation and suspend audio.

## Physics

All tuning values live in `src/tuning.ts`: shot speed, spin, ball drag and bounce, goal frame and net, keeper score chances and parry response.

The keeper plays the same at every level; only your chance to score changes. A new level starts every 6 completed shots (goals, saves and misses all count). On-target shots score 75% of the time on level 1, then 60%, 46%, 32% and 22% from level 5 onward. Each kick rolls once against that chance, and the keeper dives to match: a stretching save, or a full wrong-way dive. Canceled taps don't count toward the level, and taking the next ball doesn't reset it. Reloading starts a fresh session.

The ball is simulated in 3D meters at a fixed 240 Hz step: gravity, quadratic air drag, Magnus force from spin, turf bounces with friction, rolling resistance, round posts and crossbar, and a soft net. Power sets launch speed (12 to 22 m/s; taps use 0.9, about 21 m/s). A solver picks the launch angle and direction so the flight, including drag and curl, crosses the goal line exactly where you tapped. Wide shots carry sidespin and bend back toward the middle; high shots carry topspin and dip. Very weak shots (power below 0.26) roll out and stop before the line.

Saves happen where the simulated flight crosses the keeper's plane, 0.3 m in front of the line. The gloves reach that exact point, and the ball is parried from its real contact velocity along the glove-to-ball normal. Goals roll into and settle in the net. Shots that clip the frame show "Off the post." The camera projects the simulation onto the 2D pitch, so the preview, flight, contact and aftermath all come from one trajectory. Tap positions are mapped into normalized pitch coordinates, so the chosen spot is consistent across screen sizes.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run test:browser
```

Unit tests cover tap mapping, goal boundaries, automatic power, outcomes, exact preview endpoints, perspective, keeper reaction/reach, drag, spin, bounces, posts, net containment and center/corner shots at several powers. Browser tests launch a production preview on port 4298 using installed Google Chrome. They cover mouse clicks and Chrome-emulated touch taps, preview/release consistency, cancellation, keyboard input, mute, scoring, automatic resets and responsive layouts. Screenshots are written to `test-results/`. The `?test` URL exposes a read-only state snapshot for acceptance checks; `?test&roll=0,0.999` fixes the keeper rolls, cycling per shot (a low roll scores, a high roll is saved).

Physical touchscreen devices, Safari and audio quality on real speakers have not been tested. Landscape and short screens may require vertical scrolling; the pitch itself consumes touch gestures to prevent accidental page scrolling during a shot. Reduced-motion preferences disable decorative ball rotation while preserving gameplay flight.

## Files

- `src/tuning.ts`: every gameplay tuning value.
- `src/physics.ts`: input mapping, 3D ball simulation, launch solver, projection, keeper movement, outcomes and parries.
- `src/main.ts`: pointer/keyboard input, game lifecycle, scores and interface updates.
- `src/art.ts`: stadium, goalkeeper, ball and preview rendering.
- `src/keeper.ts`: articulated keeper poses, glove contact, dives, landings and recovery.
- `src/audio.ts`: synthesized arcade kick, goal, save, miss and next-penalty effects.
- `src/style.css`, `index.html`: responsive interface and accessible controls.
- `tests/`, `playwright.config.ts`: unit and browser checks.

This game is a separate sibling project; it does not modify or integrate with the launcher, SDK or game server.
