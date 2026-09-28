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
    assert.equal(outcome(makeShot(710, 105, 0.9), attempt), "goal");
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
