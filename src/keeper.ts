import { clamp, difficulty, keeperPosition, keeperTarget, keeperContact, type Shot } from "./physics";

type Point = [number, number];
export type KeeperPose = {
  x: number;
  y: number;
  rotation: number;
  leftKnee: Point;
  rightKnee: Point;
  leftFoot: Point;
  rightFoot: Point;
  leftElbow: Point;
  rightElbow: Point;
  leftHand: Point;
  rightHand: Point;
};
const smooth = (t: number) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const points = ["leftKnee", "rightKnee", "leftFoot", "rightFoot", "leftElbow", "rightElbow", "leftHand", "rightHand"] as const;

export function blendKeeper(a: KeeperPose, b: KeeperPose, t: number): KeeperPose {
  const pose = { ...b, x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), rotation: mix(a.rotation, b.rotation, t) };
  for (const key of points) pose[key] = [mix(a[key][0], b[key][0], t), mix(a[key][1], b[key][1], t)];
  return pose;
}

function readyPose(time: number, reducedMotion: boolean): KeeperPose {
  const sway = reducedMotion ? 0 : Math.sin(time * 2.6);
  const breath = reducedMotion ? 0 : Math.sin(time * 3.4) * 1.2;
  return {
    x: 500 + sway * 2.5, y: 287 + breath, rotation: sway * 0.015,
    leftKnee: [-20, 39 - breath], rightKnee: [20, 39 - breath],
    leftFoot: [-29 - sway * 2.5, 61 - breath], rightFoot: [29 - sway * 2.5, 61 - breath],
    leftElbow: [-30, -5], rightElbow: [30, -5],
    leftHand: [-39, -22 + breath], rightHand: [39, -22 + breath],
  };
}

// Gloves lead toward the shared collision point; the torso and boots follow behind.
export function keeperPose(shot: Shot | null, attempt: number, progress: number, time: number, reducedMotion = false): KeeperPose {
  if (!shot) return readyPose(time, reducedMotion);
  const seconds = Math.max(0, progress * shot.duration / 1000);
  const duration = shot.duration / 1000;
  const reaction = difficulty(attempt).reaction;
  const rest = readyPose(0, true);
  const crouch: KeeperPose = {
    ...rest, y: 294,
    leftKnee: [-25, 32], rightKnee: [25, 32],
    leftFoot: [-31, 54], rightFoot: [31, 54],
    leftElbow: [-31, -1], rightElbow: [31, -1],
    leftHand: [-40, -12], rightHand: [40, -12],
  };
  // Compress against planted feet before committing to either side.
  if (seconds < reaction) return blendKeeper(rest, crouch, smooth(seconds / reaction));
  const target = keeperTarget(shot, attempt);
  const direction = target.x < 500 ? -1 : 1;
  const lateral = smooth(Math.abs(target.x - 500) / 100);
  const extension = smooth((seconds - reaction) / Math.min(0.24, duration - reaction));
  const travel = clamp((seconds - reaction) / (duration - reaction), 0, 1);
  const anchor = keeperPosition(shot, attempt, Math.min(progress, 1));
  const contact = keeperContact(shot, attempt);
  const high = clamp((287 - target.y) / 55, 0, 1);
  const bodyX = contact.x - direction * 62 * lateral;
  const bodyY = mix(Math.min(contact.y + 62, 310), Math.min(contact.y + 25, 305), lateral);
  const fraction = Math.abs(target.x - 500) > 0.01 ? (anchor.x - 500) / (target.x - 500) : smooth(travel);
  const rootX = mix(500, bodyX, fraction);
  // Ballistic lift between push-off and interception, then gravity into the landing.
  const rootY = mix(294, bodyY, travel) - 4 * 16 * lateral * travel * (1 - travel);
  const diveAngle = direction * Math.atan2(62, bodyY - contact.y) * lateral;
  const dive: KeeperPose = {
    ...rest, x: rootX, y: rootY,
    rotation: diveAngle * extension,
    leftKnee: [-25, 39], rightKnee: [25, 31],
    leftFoot: [-37, 53], rightFoot: [21, 59],
    leftElbow: [-24, -43], rightElbow: [31, -43],
    leftHand: [-10, -65 - high * 5], rightHand: [19, -69 - high * 5],
  };
  // Central saves stay square to the ball, with hands gathering at its height.
  const gather = clamp(shot.y - target.y, -57, 26);
  const square: KeeperPose = {
    ...rest, x: rootX, y: dive.y,
    leftKnee: [-20, Math.min(39, (348 - rootY) * 0.6)],
    rightKnee: [20, Math.min(39, (348 - rootY) * 0.6)],
    leftFoot: [-29, Math.min(61, 348 - rootY)],
    rightFoot: [29, Math.min(61, 348 - rootY)],
    leftElbow: [-27, gather * 0.45 - 10], rightElbow: [27, gather * 0.45 - 10],
    leftHand: [-10, gather], rightHand: [10, gather],
  };
  if (direction < 0) {
    for (const [left, right] of [["leftKnee", "rightKnee"], ["leftFoot", "rightFoot"], ["leftElbow", "rightElbow"], ["leftHand", "rightHand"]] as const) {
      const a = dive[left], b = dive[right];
      dive[left] = [-b[0], b[1]];
      dive[right] = [-a[0], a[1]];
    }
  }
  const extended = blendKeeper(square, dive, lateral);
  const flight = blendKeeper({ ...crouch, x: rootX, y: dive.y }, extended, extension);
  // Reach toward the actual ball, bounded by the same ellipse used for saves.
  // Transform the contact point into the rotated body's local coordinates so
  // the gloves, rather than the boots or torso, meet every saved shot.
  const cos = Math.cos(flight.rotation), sin = Math.sin(flight.rotation);
  const localX = (contact.x - flight.x) * cos + (contact.y - flight.y) * sin;
  const localY = -(contact.x - flight.x) * sin + (contact.y - flight.y) * cos;
  const reachBlend = smooth(travel);
  for (const [hand, elbow, side] of [["leftHand", "leftElbow", -1], ["rightHand", "rightElbow", 1]] as const) {
    const glove: Point = [localX + side * 7, localY];
    const bend: Point = [mix(side * 15, glove[0], 0.5) + side * 12, mix(-16, glove[1], 0.5) + 7];
    flight[hand] = [mix(flight[hand][0], glove[0], reachBlend), mix(flight[hand][1], glove[1], reachBlend)];
    flight[elbow] = [mix(flight[elbow][0], bend[0], reachBlend), mix(flight[elbow][1], bend[1], reachBlend)];
  }
  if (progress <= 1) return flight;

  const after = seconds - duration;
  const landing: KeeperPose = {
    ...flight, x: flight.x + direction * 14 * lateral,
    y: mix(294, 309, lateral), rotation: direction * 1.38 * lateral,
    leftKnee: [-21, 30], rightKnee: [22, 32],
    leftFoot: [-30, 46], rightFoot: [19, 48],
  };
  const landed = blendKeeper(flight, landing, smooth(after / 0.3));
  landed.y = mix(flight.y, landing.y, clamp(after / 0.3, 0, 1) ** 2);
  // A brief compression on impact, then plant a glove and tuck the knees to stand.
  landed.y += Math.sin(clamp((after - 0.22) / 0.18, 0, 1) * Math.PI) * 3 * lateral;
  if (after < 0.4) return landed;
  const planted: KeeperPose = {
    ...crouch, x: landing.x, y: 302, rotation: direction * 0.22 * lateral,
    leftKnee: [-20, 23], rightKnee: [20, 23],
    leftFoot: [-27, 44], rightFoot: [27, 44],
    leftElbow: [-26, 7], rightElbow: [26, 7],
    leftHand: [-31, 34], rightHand: [31, 34],
  };
  if (after < 0.7) return blendKeeper(landing, planted, smooth((after - 0.4) / 0.3));
  if (after < 0.9) return blendKeeper(planted, { ...rest, x: landing.x }, smooth((after - 0.7) / 0.2));
  const returnProgress = smooth((after - 0.9) / 0.5);
  const returning = blendKeeper({ ...rest, x: landing.x }, rest, returnProgress);
  const step = Math.sin((after - 0.9) * Math.PI * 12) * Math.sin(returnProgress * Math.PI) * lateral;
  returning.y -= Math.abs(step) * 2;
  returning.leftKnee = [-20 + step * 5, 39];
  returning.rightKnee = [20 - step * 5, 39];
  returning.leftFoot = [-29 + step * 8, 61 - Math.max(0, step) * 6];
  returning.rightFoot = [29 - step * 8, 61 - Math.max(0, -step) * 6];
  return blendKeeper(returning, readyPose(time, reducedMotion), smooth((after - 1.35) / 0.1));
}
