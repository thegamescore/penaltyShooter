export const FIELD = {
  width: 1000,
  height: 720,
  ballX: 500,
  ballY: 601,
  left: 248,
  right: 752,
  top: 178,
  ground: 351,
};
export type Shot = {
  x: number;
  y: number;
  power: number;
  height: number;
  duration: number;
  short: boolean;
};
export type Outcome = "goal" | "save" | "miss";
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

// All distances are in design coordinates; identical relative gestures work at every viewport size.
export function gesture(dx: number, dy: number, duration: number): Shot | null {
  const distance = Math.hypot(dx, dy);
  if (distance < 28 || dy > -16) return null;
  const power = clamp(distance / 310, 0, 1);
  const speed = distance / Math.max(110, duration);
  return makeShot(500 + (dx / -dy) * 270, 26 + speed * 74, power);
}

export function makeShot(x: number, height: number, power: number): Shot {
  power = clamp(power, 0, 1);
  height = clamp(height, 18, 270);
  return {
    x: clamp(x, 70, 930),
    y: FIELD.ground - height,
    height,
    power,
    duration: 1150 - power * 580,
    short: power < 0.26,
  };
}

export function difficulty(attempt: number) {
  // Every completed shot counts, including saves and misses. Cap the ramp so
  // powerful, well-placed corners remain beatable during long sessions.
  const progress = clamp(attempt / 24, 0, 1);
  const level = Math.min(5, Math.floor(progress * 4) + 1);
  return {
    level,
    name: ["WARM-UP", "CLUB", "PRO", "ALL-STAR", "ELITE"][level - 1],
    reaction: 0.19 - progress * 0.09,
    diveSpeed: 285 + progress * 135,
    maxReach: 195 + progress * 10,
    tracking: 0.82 + progress * 0.12,
    anticipationScale: 1 - progress * 0.75,
    highReach: 250 - progress * 28,
    lowReach: 295 + progress * 7,
  };
}

export function keeperTarget(shot: Shot, attempt: number) {
  const skill = difficulty(attempt);
  const anticipation =
    [0, -24, 26, -12, 15][attempt % 5] * skill.anticipationScale;
  const available = Math.max(0, shot.duration / 1000 - skill.reaction);
  const reach = Math.min(
    skill.maxReach,
    Math.max(0, available - 0.07) * skill.diveSpeed,
  );
  return {
    x:
      500 +
      clamp((shot.x - 500) * skill.tracking + anticipation, -reach, reach),
    y: clamp(shot.y, skill.highReach, skill.lowReach),
  };
}

export function keeperPosition(shot: Shot, attempt: number, progress: number) {
  const target = keeperTarget(shot, attempt);
  const skill = difficulty(attempt);
  const available = shot.duration / 1000 - skill.reaction;
  const time = clamp(
    (progress * shot.duration) / 1000 - skill.reaction,
    0,
    available,
  );
  const distance = (t: number) => (t < 0.14 ? (t * t) / 0.28 : t - 0.07);
  const fraction = distance(time) / distance(available);
  return {
    x: 500 + (target.x - 500) * fraction,
    y: 287 + (target.y - 287) * fraction,
    lean: ((target.x - 500) / skill.maxReach) * fraction,
  };
}

// The reachable glove contact, shared by collision detection and the articulated rig.
// The body trails this point during a dive; its legs never determine a save.
export function keeperContact(shot: Shot, attempt: number) {
  const target = keeperTarget(shot, attempt);
  const dx = shot.x - target.x, dy = shot.y - target.y;
  const reach = Math.max(1, Math.hypot(dx / 55, dy / 64));
  return { x: target.x + dx / reach, y: target.y + dy / reach };
}

export function outcome(shot: Shot, attempt: number): Outcome {
  if (
    shot.short ||
    shot.x < FIELD.left + 9 ||
    shot.x > FIELD.right - 9 ||
    shot.y < FIELD.top + 9 ||
    shot.y > FIELD.ground - 9
  )
    return "miss";
  const contact = keeperContact(shot, attempt);
  return Math.hypot(shot.x - contact.x, shot.y - contact.y) < 0.000001
    ? "save"
    : "goal";
}

export function ballPosition(shot: Shot, progress: number) {
  const t = clamp(progress, 0, 1);
  // Project depth into the pitch, so the ball gets smaller and visually slows as it recedes.
  // Weak shots lose velocity to turf friction and come to rest before the goal line.
  const depth = shot.short ? (2 * t - t * t) * (0.2 + shot.power * 1.6) : t;
  const perspective = 1 / (1 + 1.4 * depth);
  const travel = depth * 2.4 * perspective;
  const x = FIELD.ballX + (shot.x - FIELD.ballX) * travel;
  const groundY = FIELD.ballY + (FIELD.ground - FIELD.ballY) * travel;
  const height = shot.short
    ? Math.max(0, 4 * t * (0.55 - t)) * shot.height * 0.45
    : (shot.height * 2.4 * t + (100 + shot.power * 130) * t * (1 - t)) *
      perspective;
  return { x, y: groundY - height, groundY, radius: 23 * perspective };
}

// A damped bounce under gravity, used for the drop into the net and keeper parries.
export function bounceHeight(
  height: number,
  upwardVelocity: number,
  seconds: number,
) {
  const gravity = 580;
  const impactTime =
    (upwardVelocity + Math.sqrt(upwardVelocity ** 2 + 2 * gravity * height)) /
    gravity;
  if (seconds <= impactTime)
    return Math.max(
      0,
      height + upwardVelocity * seconds - 0.5 * gravity * seconds ** 2,
    );
  const reboundSpeed = (gravity * impactTime - upwardVelocity) * 0.32;
  const after = seconds - impactTime;
  return Math.max(0, reboundSpeed * after - 0.5 * gravity * after ** 2);
}

export function aftermathPosition(
  shot: Shot,
  result: Outcome,
  seconds: number,
) {
  const end = ballPosition(shot, 1);
  if (shot.short) return end;
  const parried = result === "save";
  const deceleration = 1 - Math.exp(-seconds * 2.2);
  const side = shot.x < 500 ? -1 : 1;
  const x =
    end.x + (parried ? side * 110 : (shot.x - 500) * 0.055) * deceleration;
  const groundY = end.groundY + (parried ? 120 : -12) * deceleration;
  const height = bounceHeight(shot.height, parried ? 55 : -30, seconds);
  return {
    x,
    y: groundY - height,
    groundY,
    radius: end.radius + (parried ? 5 : -1) * deceleration,
  };
}
