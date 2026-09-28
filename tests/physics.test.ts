import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gesture,
  makeShot,
  outcome,
  ballPosition,
  keeperPosition,
  keeperTarget,
  bounceHeight,
  aftermathPosition,
  difficulty,
} from "../src/physics";

test("tiny, horizontal, and downward gestures never shoot", () => {
  assert.equal(gesture(3, -12, 100), null);
  assert.equal(gesture(150, 0, 100), null);
  assert.equal(gesture(0, 120, 100), null);
});
test("direction follows the swipe and length controls power", () => {
  const left = gesture(-100, -200, 500)!;
  const right = gesture(100, -200, 500)!;
  assert.ok(left.x < 500 && right.x > 500);
  assert.equal(left.power, right.power);
  assert.equal(left.height, right.height);
  const long = gesture(200, -400, 1000)!;
  assert.equal(long.x, right.x);
  assert.equal(long.height, right.height);
  assert.ok(long.power > right.power);
});
test("fast swipes add lift without changing lateral direction or power", () => {
  const slow = gesture(130, -200, 650)!;
  const fast = gesture(130, -200, 150)!;
  assert.equal(slow.x, fast.x);
  assert.equal(slow.power, fast.power);
  assert.ok(fast.y < slow.y);
});
test("goals, saves, wide, high and underpowered misses are deterministic", () => {
  for (let attempt = 0; attempt < 20; attempt++) {
    assert.equal(outcome(makeShot(737, 150, 1), attempt), "goal");
    assert.equal(outcome(makeShot(500, 80, 0.8), attempt), "save");
    assert.equal(outcome(makeShot(820, 100, 1), attempt), "miss");
    assert.equal(outcome(makeShot(650, 210, 1), attempt), "miss");
    assert.equal(outcome(makeShot(650, 100, 0.2), attempt), "miss");
  }
});
test("preview trajectory lands at precisely the point used to judge the shot", () => {
  for (const x of [120, 290, 500, 710, 880]) {
    const shot = makeShot(x, 110, 0.8);
    const end = ballPosition(shot, 1);
    assert.equal(end.x, shot.x);
    assert.equal(end.y, shot.y);
    const start = ballPosition(shot, 0);
    assert.equal(start.x, 500);
    assert.equal(start.y, 601);
  }
});
test("weak shots finish on the grass before the goal", () => {
  const shot = makeShot(650, 110, 0.15);
  const end = ballPosition(shot, 1);
  assert.ok(end.groundY > 351);
  assert.equal(end.y, end.groundY);
});

test("keeper reacts after 190 ms and reaches the collision position at arrival", () => {
  const shot = makeShot(710, 105, 0.9);
  assert.deepEqual(keeperPosition(shot, 0, 0.18 / (shot.duration / 1000)), {
    x: 500,
    y: 287,
    lean: 0,
  });
  const arrival = keeperPosition(shot, 0, 1),
    target = keeperTarget(shot, 0);
  assert.equal(arrival.x, target.x);
  assert.equal(arrival.y, target.y);
  assert.ok(keeperTarget(makeShot(710, 105, 0.3), 0).x > target.x);
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
test("bounces and parries are continuous, settle and never fall through the turf", () => {
  const shot = makeShot(500, 80, 0.8);
  assert.deepEqual(aftermathPosition(shot, "save", 0), ballPosition(shot, 1));
  assert.ok(aftermathPosition(shot, "save", 0.5).groundY > 351);
  for (let t = 0; t < 3; t += 0.01) assert.ok(bounceHeight(80, 55, t) >= 0);
  assert.equal(bounceHeight(80, 55, 3), 0);
});

test("difficulty ramps every shot, changes tiers every six, and caps after 24", () => {
  for (let attempt = 1; attempt <= 24; attempt++) {
    const before = difficulty(attempt - 1),
      after = difficulty(attempt);
    assert.ok(after.reaction < before.reaction);
    assert.ok(after.diveSpeed > before.diveSpeed);
    assert.ok(after.maxReach > before.maxReach);
    assert.ok(after.tracking > before.tracking);
  }
  assert.deepEqual(
    [0, 5, 6, 11, 12, 18, 24].map((n) => difficulty(n).level),
    [1, 1, 2, 2, 3, 4, 5],
  );
  assert.deepEqual(difficulty(10000), difficulty(24));
});

test("the same ordinary corner becomes harder while precise powerful corners remain possible", () => {
  const ordinary = makeShot(710, 105, 0.9);
  assert.equal(outcome(ordinary, 0), "goal");
  assert.equal(outcome(ordinary, 24), "save");
  for (let attempt = 0; attempt <= 100; attempt++) {
    for (const x of [263, 737])
      assert.equal(outcome(makeShot(x, 150, 1), attempt), "goal");
    const pose = keeperPosition(ordinary, attempt, 1),
      target = keeperTarget(ordinary, attempt);
    assert.equal(pose.x, target.x);
    assert.equal(pose.y, target.y);
    const reaction = difficulty(attempt).reaction;
    assert.equal(
      keeperPosition(
        ordinary,
        attempt,
        ((reaction - 0.001) * 1000) / ordinary.duration,
      ).x,
      500,
    );
  }
});

test("keeper coverage increases across difficulty levels for a representative shot grid", () => {
  let previousSaves = -1;
  for (const attempt of [0, 6, 12, 18, 24]) {
    let saves = 0;
    for (let x = 270; x <= 730; x += 20) {
      for (let height = 30; height <= 150; height += 20) {
        for (const power of [0.4, 0.7, 1]) {
          if (outcome(makeShot(x, height, power), attempt) === "save") saves++;
        }
      }
    }
    assert.ok(
      saves > previousSaves,
      `Attempt ${attempt}: ${saves} saves must exceed ${previousSaves}`,
    );
    previousSaves = saves;
  }
});
