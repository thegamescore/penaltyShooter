import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aimShot,
  FIELD,
  makeShot,
  outcome,
  ballPosition,
  keeperPosition,
  keeperTarget,
  keeperContact,
  simulate,
  sample,
  flightOf,
  onTarget,
  toWorld,
  solveLaunch,
  aftermathPosition,
  difficulty,
  strike,
  REACTION,
} from "../src/physics";

const near = (a: number, b: number, tolerance = 0.05) =>
  assert.ok(Math.abs(a - b) <= tolerance, `${a} not within ${tolerance} of ${b}`);

test("taps outside the goal cannot shoot", () => {
  for (const [x, y] of [[500, 601], [247, 250], [753, 250], [500, 177], [500, 352]])
    assert.equal(aimShot(x, y), null);
});
test("taps select their exact spot with automatic power", () => {
  for (const [x, y] of [[290, 215], [710, 310], [500, 270]]) {
    const shot = aimShot(x, y)!;
    assert.equal(shot.x, x);
    assert.equal(shot.y, y);
    assert.equal(shot.power, 0.9);
    assert.equal(shot.short, false);
    near(ballPosition(shot, 1).x, x);
    near(ballPosition(shot, 1).y, y);
  }
});
test("taps on goal edges stay inside the posts and crossbar", () => {
  for (const x of [FIELD.left, FIELD.right]) {
    for (const y of [FIELD.top, FIELD.ground]) {
      const shot = aimShot(x, y)!;
      assert.notEqual(outcome(strike(shot, 0, 0)), "miss");
    }
  }
});
test("low roll scores, high roll is saved, off-target shots always miss", () => {
  for (let attempt = 0; attempt < 40; attempt++) {
    assert.equal(outcome(strike(makeShot(500, 80, 0.9), attempt, 0)), "goal");
    assert.equal(outcome(strike(makeShot(737, 150, 0.9), attempt, 0.999)), "save");
    for (const roll of [0, 0.999]) {
      assert.equal(outcome(strike(makeShot(820, 100, 1), attempt, roll)), "miss");
      assert.equal(outcome(strike(makeShot(650, 210, 1), attempt, roll)), "miss");
      assert.equal(outcome(strike(makeShot(650, 100, 0.2), attempt, roll)), "miss");
    }
  }
});
test("preview trajectory lands at precisely the point used to judge the shot", () => {
  for (const x of [120, 290, 500, 710, 880]) {
    const shot = makeShot(x, 110, 0.8);
    assert.equal(flightOf(shot).cross !== null, true);
    const end = ballPosition(shot, 1);
    near(end.x, shot.x);
    near(end.y, shot.y);
    const start = ballPosition(shot, 0);
    near(start.x, 500);
    near(start.y, 601);
  }
});
test("weak shots finish on the grass before the goal", () => {
  const shot = makeShot(650, 110, 0.15);
  const end = ballPosition(shot, 1);
  assert.ok(end.groundY > 351);
  assert.equal(end.y, end.groundY);
});

test("keeper reacts after 190 ms and reaches its target at arrival", () => {
  const shot = strike(makeShot(710, 105, 0.9), 0, 0.999);
  assert.deepEqual(keeperPosition(shot, (REACTION - 0.001) / (shot.duration / 1000)), {
    x: 500,
    y: 287,
    lean: 0,
  });
  const arrival = keeperPosition(shot, 1),
    target = keeperTarget(shot);
  assert.equal(arrival.x, target.x);
  assert.equal(arrival.y, target.y);
});
test("flight recedes in perspective and weak shots decelerate to rest", () => {
  const shot = makeShot(710, 105, 0.9);
  const a = ballPosition(shot, 0),
    b = ballPosition(shot, 0.5),
    c = ballPosition(shot, 1);
  assert.ok(a.groundY - b.groundY > b.groundY - c.groundY);
  assert.ok(a.radius > b.radius && b.radius > c.radius);
  const weak = makeShot(650, 80, 0.2);
  assert.ok(
    Math.abs(ballPosition(weak, 1).x - ballPosition(weak, 0.99).x) < 0.02,
  );
});
test("parries and goals follow simulated flight, settle and never fall through the turf", () => {
  const shot = makeShot(500, 80, 0.8);
  for (const roll of [0, 0.999]) {
    const struck = strike(shot, 0, roll);
    const start = aftermathPosition(struck, outcome(struck), 0), end = ballPosition(struck, 1);
    near(start.x, end.x);
    near(start.y, end.y);
    for (let t = 0; t < 2.4; t += 0.01) {
      const p = aftermathPosition(struck, outcome(struck), t);
      assert.ok(p.y <= p.groundY + 1e-9, "ball below turf");
    }
  }
  // Saved ball comes back out toward field; goal stays in net.
  const saved = strike(shot, 0, 0.999), goal = strike(shot, 0, 0);
  assert.ok(aftermathPosition(saved, "save", 0.6).groundY > 351);
  assert.ok(aftermathPosition(goal, "goal", 1).groundY < 351);
});

test("gravity, drag and spin shape flight consistently", () => {
  const still = { x: 0, y: 0, z: 0 };
  // No spin, no drag direction change: straight shot stays centered and slows down.
  const straight = simulate({ velocity: { x: 0, y: 5, z: 20 }, spin: still }, { stopAtGoal: true });
  assert.ok(Math.abs(straight.cross!.x) < 1e-9);
  const a = sample(straight, 0.1), b = sample(straight, 0.2), c = sample(straight, 0.3);
  assert.ok(b.z - a.z > c.z - b.z, "drag slows ball");
  // Sidespin curls, topspin dips.
  const curl = simulate({ velocity: { x: 0, y: 5, z: 20 }, spin: { x: 0, y: 15, z: 0 } }, { stopAtGoal: true });
  assert.ok(curl.cross!.x > 0.2);
  const dip = simulate({ velocity: { x: 0, y: 5, z: 20 }, spin: { x: 15, y: 0, z: 0 } }, { stopAtGoal: true });
  assert.ok(dip.cross!.y < straight.cross!.y - 0.1);
  // Same inputs, same flight.
  assert.deepEqual(simulate({ velocity: { x: 1, y: 3, z: 20 }, spin: { x: 5, y: 5, z: 0 } }),
    simulate({ velocity: { x: 1, y: 3, z: 20 }, spin: { x: 5, y: 5, z: 0 } }));
});

test("solver hits target through drag and curl at every power", () => {
  for (const power of [0.3, 0.6, 0.9, 1]) {
    for (const [x, y] of [[262, 192], [738, 192], [262, 333], [738, 333], [500, 270]]) {
      const shot = makeShot(x, 351 - y, power);
      const end = ballPosition(shot, 1);
      near(end.x, x);
      near(end.y, y);
      // Wide shots curl back toward center, so launch points outside target line.
      const target = toWorld(x, y);
      if (x !== 500) assert.ok(Math.abs(shot.launch.velocity.x / shot.launch.velocity.z) > Math.abs(target.x / 11));
    }
  }
});

test("more power means faster, flatter shots", () => {
  let previous = Infinity, previousPitch = Infinity;
  for (const power of [0.3, 0.5, 0.7, 0.9, 1]) {
    const shot = makeShot(710, 105, power);
    const pitch = shot.launch.velocity.y / shot.launch.velocity.z;
    assert.ok(shot.duration < previous);
    assert.ok(pitch < previousPitch);
    previous = shot.duration;
    previousPitch = pitch;
  }
  assert.ok(makeShot(710, 105, 0.9).duration > 450 && makeShot(710, 105, 0.9).duration < 750);
});

test("ball bounces lower each time, then rolls to a stop", () => {
  const flight = simulate({ velocity: { x: 0, y: 6, z: 2 }, spin: { x: 0, y: 0, z: 0 } }, { until: 6 });
  const peaks: number[] = [];
  let rising = true, last = 0;
  for (let t = 0; t < 6; t += 1 / 240) {
    const y = sample(flight, t).y;
    if (rising && y < last) peaks.push(last);
    rising = y >= last;
    last = y;
  }
  assert.ok(peaks.length >= 3);
  for (let i = 1; i < peaks.length; i++) assert.ok(peaks[i] < peaks[i - 1]);
  const end = sample(flight, 6);
  assert.ok(Math.abs(end.y - 0.11) < 1e-9);
  near(sample(flight, 5.9).z, end.z, 1e-9);
});

test("posts and crossbar rebound; ball inside net stays inside", () => {
  const still = { x: 0, y: 0, z: 0 };
  const post = solveLaunch(3.66, 1, 20, still);
  const off = simulate(post);
  assert.ok(off.frame, "hits post");
  const bar = simulate(solveLaunch(0, 2.55, 20, still));
  assert.ok(bar.frame, "hits bar");
  assert.notEqual(bar.result, "goal");
  const goal = simulate(solveLaunch(1, 1, 20, still), { until: 3 });
  assert.equal(goal.result, "goal");
  for (let t = goal.crossTime! + 0.02; t < 3; t += 0.01) {
    const p = sample(goal, t);
    assert.ok(p.z > 11 && p.z <= 13 && Math.abs(p.x) <= 3.66 && p.y <= 2.55, "ball escaped net");
  }
});

test("center and corners at different powers score, save or miss as rolled", () => {
  const targets = { center: [500, 270], topLeft: [262, 192], topRight: [738, 192], lowLeft: [262, 333], lowRight: [738, 333] };
  for (const power of [0.3, 0.6, 0.9, 1]) {
    for (const [name, [x, y]] of Object.entries(targets)) {
      const shot = makeShot(x, 351 - y, power);
      assert.ok(onTarget(shot), `${name} @ ${power} off target`);
      const goal = strike(shot, 0, 0), save = strike(shot, 0, 0.999);
      assert.equal(outcome(goal), "goal", `${name} @ ${power}`);
      assert.equal(outcome(save), "save", `${name} @ ${power}`);
      // Parry leaves goal mouth back toward field.
      assert.ok(aftermathPosition(save, "save", 1.2).groundY > 351, `${name} @ ${power} parry went in`);
    }
  }
});

test("level rises every six shots, caps at five, and lowers score chance", () => {
  assert.deepEqual(
    [0, 5, 6, 11, 12, 18, 24, 10000].map((n) => difficulty(n).level),
    [1, 1, 2, 2, 3, 4, 5, 5],
  );
  for (const attempt of [6, 12, 18, 24])
    assert.ok(difficulty(attempt).scoreChance < difficulty(attempt - 6).scoreChance);
  assert.ok(difficulty(24).scoreChance > 0);
});

test("roll decides result wherever shot is placed; gloves reach only saved balls", () => {
  for (const attempt of [0, 6, 12, 18, 24]) {
    const chance = difficulty(attempt).scoreChance;
    for (let x = 262; x <= 738; x += 17) {
      for (let y = 192; y <= 333; y += 13) {
        const shot = makeShot(x, 351 - y, 0.9);
        const goal = strike(shot, attempt, chance - 0.001);
        const save = strike(shot, attempt, chance);
        assert.equal(outcome(goal), "goal");
        assert.equal(outcome(save), "save");
        const miss = keeperContact(goal), reach = keeperContact(save);
        assert.ok(Math.hypot(miss.x - x, miss.y - y) > 10, `keeper touches goal at ${x},${y}`);
        const ball = ballPosition(save, 1);
        assert.ok(Math.hypot(reach.x - ball.x, reach.y - ball.y) < 0.25, `keeper misses save at ${x},${y}`);
        assert.ok(Math.hypot(ball.x - x, ball.y - y) < 12, "contact far from aim");
      }
    }
  }
});

test("random rolls match level score chance", () => {
  for (const attempt of [0, 12, 24]) {
    let goals = 0;
    const shot = makeShot(600, 120, 0.9);
    for (let i = 0; i < 1000; i++)
      if (outcome(strike(shot, attempt, (i + 0.5) / 1000)) === "goal") goals++;
    assert.equal(goals / 1000, difficulty(attempt).scoreChance);
  }
});
