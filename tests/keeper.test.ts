import { test } from "node:test";
import assert from "node:assert/strict";
import { keeperPose } from "../src/keeper";
import { makeShot, strike, keeperContact } from "../src/physics";

test("both gloves meet the ball on every saved shot, including low and high saves", () => {
  let saves = 0;
  {
    for (let x = 270; x <= 730; x += 10) {
      for (const height of [20, 50, 80, 110, 140, 160]) {
        const shot = strike(makeShot(x, height, 0.8), 0, 0.999);
        const pose = keeperPose(shot, 1, 0);
        const ball = keeperContact(shot);
        for (const [hx, hy] of [pose.leftHand, pose.rightHand]) {
          const gloveX = pose.x + hx * Math.cos(pose.rotation) - hy * Math.sin(pose.rotation);
          const gloveY = pose.y + hx * Math.sin(pose.rotation) + hy * Math.cos(pose.rotation);
          assert.ok(Math.hypot(gloveX - ball.x, gloveY - ball.y) <= 7.001);
        }
        saves++;
      }
    }
  }
  assert.ok(saves > 100);
});

test("dive and recovery remain continuous through every animation phase", () => {
  for (const x of [290, 500, 710]) {
    for (const height of [20, 110, 160]) {
      const shot = strike(makeShot(x, height, 0.8), 0, 0.999);
      let previous = keeperPose(shot, 0, 0);
      for (let ms = 1; ms <= shot.duration + 1450; ms++) {
        const pose = keeperPose(shot, ms / shot.duration, ms / 1000);
        assert.ok(Math.hypot(pose.x - previous.x, pose.y - previous.y) < 1);
        assert.ok(Math.abs(pose.rotation - previous.rotation) < 0.02);
        for (const key of ["leftHand", "rightHand", "leftFoot", "rightFoot"] as const) {
          assert.ok(Math.hypot(pose[key][0] - previous[key][0], pose[key][1] - previous[key][1]) < 2);
        }
        previous = pose;
      }
      const time = (shot.duration + 1450) / 1000;
      assert.deepEqual(keeperPose(shot, 1 + 1450 / shot.duration, time), keeperPose(null, 0, time));
    }
  }
});

test("reduced motion keeps the idle stance still", () => {
  assert.deepEqual(keeperPose(null, 0, 0, true), keeperPose(null, 0, 10, true));
});

test("the head and gloves lead lateral dives while both boots trail behind", () => {
  for (const x of [290, 390, 610, 710]) {
    for (const height of [20, 80, 160]) {
      const shot = strike(makeShot(x, height, 0.8), 0, 0.999);
      const side = Math.sign(x - 500);
      for (const progress of [0.55, 0.75, 1]) {
        const pose = keeperPose(shot, progress, 0);
        const worldX = ([px, py]: number[]) => pose.x + px * Math.cos(pose.rotation) - py * Math.sin(pose.rotation);
        const headX = worldX([0, -43]);
        assert.ok((headX - pose.x) * side > 0, "head must lead the torso");
        for (const foot of [pose.leftFoot, pose.rightFoot]) {
          assert.ok((headX - worldX(foot)) * side > 0, "boots must trail the head");
        }
        if (progress === 1) {
          for (const hand of [pose.leftHand, pose.rightHand]) {
            assert.ok((worldX(hand) - headX) * side > 0, "gloves must lead the head at contact");
          }
        }
      }
    }
  }
});
