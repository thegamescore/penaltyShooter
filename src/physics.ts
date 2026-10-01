import { TUNING } from "./tuning";

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
export type Vec3 = { x: number; y: number; z: number };
export type Launch = { velocity: Vec3; spin: Vec3 };
export type Shot = {
  x: number;
  y: number;
  power: number;
  height: number;
  duration: number;
  short: boolean;
  speed: number;
  launch: Launch;
};
export type Outcome = "goal" | "save" | "miss";
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

// World: x right, y up, z from spot toward goal. Ball center heights.
// Screen height 0 means ball resting on turf, so world y = screen height + radius.
const { world, ball } = TUNING;
const R = ball.radius;
export const GOAL_Z = world.distance;
export const PPM_X = (FIELD.right - FIELD.left) / 2 / world.goalHalfWidth;
export const PPM_Y = (FIELD.ground - FIELD.top) / world.barHeight;
const POST_X = world.goalHalfWidth;
const KEEPER_Z = GOAL_Z - world.keeperDepth;
const BAR_Y = world.barHeight + R;
const DT = 1 / 240;
const AREA = Math.PI * R * R;
const DRAG = (0.5 * world.airDensity * ball.dragCoefficient * AREA) / ball.mass;
// Magnus accel = MAGNUS * (spin × velocity); lift coefficient ~ r·ω/v.
const MAGNUS = (0.5 * world.airDensity * AREA * R * ball.liftScale) / ball.mass;

export const toWorld = (x: number, y: number) => ({
  x: (x - FIELD.ballX) / PPM_X,
  y: (FIELD.ground - y) / PPM_Y + R,
});

// Camera sits behind spot. Scale is 2.4 at spot, 1 at goal line.
export function project(p: Vec3) {
  const depth = Math.max(-0.5, p.z / GOAL_Z);
  const scale = 2.4 / (1 + 1.4 * depth);
  const groundY = FIELD.ballY + (FIELD.ground - FIELD.ballY) * depth * scale;
  return {
    x: FIELD.ballX + p.x * PPM_X * scale,
    y: groundY - Math.max(0, p.y - R) * PPM_Y * scale,
    groundY,
    radius: (23 * scale) / 2.4,
  };
}

export type Contact = { normal: { x: number; y: number } };
export type Flight = {
  points: Float64Array; // x, y, z per DT step
  crossTime: number | null; // center reaches goal plane
  cross: Vec3 | null;
  keeperTime: number | null; // center reaches keeper plane
  keeper: Vec3 | null;
  result: Outcome;
  resultTime: number;
  frame: boolean; // hit post or crossbar
  touched: boolean;
};
type Options = {
  stopAtGoal?: boolean;
  until?: number;
  // Glove contact on keeper plane, if keeper reaches ball.
  parry?: Contact;
};

const lerp3 = (a: Vec3, b: Vec3, f: number): Vec3 => ({
  x: a.x + (b.x - a.x) * f,
  y: a.y + (b.y - a.y) * f,
  z: a.z + (b.z - a.z) * f,
});
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

// Bounce ball off cylinder axis point, in plane given by axis a/b components.
function hitCylinder(p: Vec3, v: Vec3, a: "x" | "y", b: "z", ca: number, cb: number) {
  const da = p[a] - ca, db = p[b] - cb;
  const d = Math.hypot(da, db), min = R + world.postRadius;
  if (d >= min || d === 0) return false;
  const na = da / d, nb = db / d;
  const vn = v[a] * na + v[b] * nb;
  p[a] = ca + na * min;
  p[b] = cb + nb * min;
  if (vn < 0) {
    v[a] -= (1 + world.frameBounce) * vn * na;
    v[b] -= (1 + world.frameBounce) * vn * nb;
  }
  return true;
}

// Fixed-step flight: gravity, quadratic drag, Magnus spin, turf bounce and roll,
// posts, crossbar, net and a keeper parry on the goal plane.
export function simulate(launch: Launch, options: Options = {}): Flight {
  const until = options.until ?? 3;
  const p: Vec3 = { x: 0, y: R, z: 0 };
  const v = { ...launch.velocity };
  const w = { ...launch.spin };
  const points: number[] = [p.x, p.y, p.z];
  let crossTime: number | null = null, crossAt: Vec3 | null = null;
  let keeperTime: number | null = null, keeperAt: Vec3 | null = null;
  let result: Outcome | null = null, resultTime = 0;
  let frame = false, frameTime = 0, touched = false, touchTime = 0, inNet = false;
  let stopTime: number | null = null;
  for (let t = 0; t < until; t += DT) {
    const rolling = p.y <= R + 1e-9 && Math.abs(v.y) < 1e-9;
    const speed = Math.hypot(v.x, v.y, v.z);
    const magnus = cross(w, v);
    v.x += (-DRAG * speed * v.x + MAGNUS * magnus.x) * DT;
    v.z += (-DRAG * speed * v.z + MAGNUS * magnus.z) * DT;
    if (rolling) {
      const flat = Math.hypot(v.x, v.z), slow = ball.rolling * DT;
      if (flat <= slow) {
        v.x = v.z = 0;
        stopTime ??= t;
      } else {
        v.x -= (v.x / flat) * slow;
        v.z -= (v.z / flat) * slow;
      }
    } else v.y += (-DRAG * speed * v.y + MAGNUS * magnus.y - world.gravity) * DT;
    const prev = { ...p };
    p.x += v.x * DT;
    p.y += v.y * DT;
    p.z += v.z * DT;
    const decay = 1 - ball.spinDecay * DT;
    w.x *= decay; w.y *= decay; w.z *= decay;

    if (p.y < R) {
      p.y = R;
      if (v.y < -0.8) {
        v.y = -v.y * ball.bounce;
        v.x *= 1 - ball.bounceFriction;
        v.z *= 1 - ball.bounceFriction;
      } else v.y = 0;
    }

    // Keeper plane: record exact crossing and parry there.
    if (keeperTime === null && prev.z < KEEPER_Z && p.z >= KEEPER_Z) {
      const f = (KEEPER_Z - prev.z) / (p.z - prev.z);
      keeperTime = t + f * DT;
      keeperAt = lerp3(prev, p, f);
      if (options.parry) {
        // Glove meets ball: send it back out along contact normal.
        const { restitution, keep, push, lift, spinKeep } = TUNING.parry;
        const n = options.parry.normal;
        const incoming = v.z;
        v.x = v.x * keep + n.x * push;
        v.y = v.y * keep + n.y * push + lift;
        v.z = -incoming * restitution;
        Object.assign(p, keeperAt, { z: KEEPER_Z - 0.01 });
        w.x *= spinKeep; w.y *= spinKeep; w.z *= spinKeep;
        touched = true;
        touchTime = keeperTime;
      }
    }
    // Goal plane: record exact crossing, then frame.
    if (crossTime === null && prev.z < GOAL_Z && p.z >= GOAL_Z) {
      const f = (GOAL_Z - prev.z) / (p.z - prev.z);
      crossTime = t + f * DT;
      crossAt = lerp3(prev, p, f);
      if (options.stopAtGoal) {
        points.push(p.x, p.y, p.z);
        break;
      }
      if (Math.abs(crossAt.x) < POST_X && crossAt.y < BAR_Y) {
        inNet = true;
        result ??= "goal";
        resultTime = crossTime;
      } else if (!result) {
        result = "miss";
        resultTime = crossTime;
      }
    }
    if (Math.abs(p.z - GOAL_Z) < 0.4) {
      let hit = false;
      if (p.y < BAR_Y) for (const x of [-POST_X, POST_X]) hit = hitCylinder(p, v, "x", "z", x, GOAL_Z) || hit;
      if (Math.abs(p.x) < POST_X) hit = hitCylinder(p, v, "y", "z", BAR_Y, GOAL_Z) || hit;
      if (hit && !frame) {
        frame = true;
        frameTime = t;
      }
    }
    if (inNet) {
      // Net soaks up speed: back, sides and roof.
      const back = GOAL_Z + world.netDepth - R, side = POST_X - R, roof = BAR_Y - R;
      if (p.z > back) { p.z = back; v.z = -Math.abs(v.z) * world.netBounce; v.x *= 0.5; v.y *= 0.5; }
      if (Math.abs(p.x) > side) { p.x = Math.sign(p.x) * side; v.x = -v.x * world.netBounce; }
      if (p.y > roof) { p.y = roof; v.y = -Math.abs(v.y) * world.netBounce; }
      if (p.y <= R + 1e-9) { const drag = Math.max(0, 1 - world.netDrag * DT); v.x *= drag; v.z *= drag; }
    } else if (p.z > GOAL_Z + 5) {
      // Advertising boards behind goal.
      p.z = GOAL_Z + 5;
      v.z = -Math.abs(v.z) * 0.3;
    }
    points.push(p.x, p.y, p.z);
    if (stopTime !== null && (options.stopAtGoal || t > stopTime + 1.5)) break;
  }
  if (!result) {
    result = touched ? "save" : "miss";
    resultTime = touched ? touchTime : frame ? frameTime : stopTime ?? until;
  }
  return {
    points: Float64Array.from(points),
    crossTime,
    cross: crossAt,
    keeperTime,
    keeper: keeperAt,
    result,
    resultTime,
    frame,
    touched,
  };
}

export function sample(flight: Flight, seconds: number): Vec3 {
  const last = flight.points.length / 3 - 1;
  const at = clamp(seconds / DT, 0, last);
  const i = Math.min(Math.floor(at), Math.max(0, last - 1)), f = Math.min(1, at - i);
  const q = flight.points;
  const j = Math.min(i + 1, last);
  return {
    x: q[i * 3] + (q[j * 3] - q[i * 3]) * f,
    y: q[i * 3 + 1] + (q[j * 3 + 1] - q[i * 3 + 1]) * f,
    z: q[i * 3 + 2] + (q[j * 3 + 2] - q[i * 3 + 2]) * f,
  };
}

// Spin comes from placement: wide shots curl back toward center, high shots dip.
function spinFor(x: number, y: number, power: number): Vec3 {
  const { sideSpin, topSpin } = TUNING.shot;
  return {
    x: topSpin * power * clamp((y - R) / world.barHeight, 0, 1),
    y: -sideSpin * power * clamp(x / POST_X, -1, 1),
    z: 0,
  };
}

// Find yaw and pitch that carry ball, with drag and spin, through target at goal plane.
export function solveLaunch(x: number, y: number, speed: number, spin: Vec3): Launch {
  const flightTime = GOAL_Z / speed;
  let yaw = Math.atan2(x, GOAL_Z);
  let pitch = Math.atan2(y - R + 0.5 * world.gravity * flightTime ** 2, GOAL_Z);
  const distance = Math.hypot(GOAL_Z, x);
  let launch!: Launch;
  for (let i = 0; i < 30; i++) {
    launch = {
      velocity: {
        x: speed * Math.cos(pitch) * Math.sin(yaw),
        y: speed * Math.sin(pitch),
        z: speed * Math.cos(pitch) * Math.cos(yaw),
      },
      spin,
    };
    const hit = simulate(launch, { stopAtGoal: true }).cross;
    if (!hit) {
      pitch += 0.05;
      continue;
    }
    const ex = x - hit.x, ey = y - hit.y;
    if (Math.abs(ex) < 1e-6 && Math.abs(ey) < 1e-6) break;
    yaw += ex / distance;
    pitch += ey / distance;
  }
  return launch;
}

// Flights are cached per shot object; copies recompute the same preview flight.
const flights = new WeakMap<object, Flight>();
export function flightOf(shot: Shot): Flight {
  let flight = flights.get(shot);
  if (!flight) {
    flight = simulate(shot.launch, { stopAtGoal: true, until: 5 });
    flights.set(shot, flight);
  }
  return flight;
}

// A single tap selects the endpoint. Power is automatic; the edge inset
// keeps taps on a post or the crossbar comfortably inside the goal.
export function aimShot(x: number, y: number): Shot | null {
  if (x < FIELD.left || x > FIELD.right || y < FIELD.top || y > FIELD.ground) return null;
  return makeShot(
    clamp(x, FIELD.left + 14, FIELD.right - 14),
    FIELD.ground - clamp(y, FIELD.top + 14, FIELD.ground - 18),
    TUNING.shot.autoPower,
  );
}

export function makeShot(x: number, height: number, power: number): Shot {
  power = clamp(power, 0, 1);
  height = clamp(height, 18, 270);
  x = clamp(x, 70, 930);
  const y = FIELD.ground - height;
  const target = toWorld(x, y);
  const { shortPower, scuffSpeed, minSpeed, maxSpeed } = TUNING.shot;
  const short = power < shortPower;
  let speed: number, launch: Launch;
  if (short) {
    // Scuffed along turf: rolls out and stops before the line.
    speed = power * scuffSpeed;
    const yaw = Math.atan2(target.x, GOAL_Z);
    launch = {
      velocity: { x: speed * Math.sin(yaw), y: 0, z: speed * Math.cos(yaw) },
      spin: { x: 0, y: 0, z: 0 },
    };
  } else {
    speed = minSpeed + (maxSpeed - minSpeed) * power;
    launch = solveLaunch(target.x, target.y, speed, spinFor(target.x, target.y, power));
  }
  const shot: Shot = { x, y, height, power, duration: 0, short, speed, launch };
  const flight = flightOf(shot);
  shot.duration = ((short ? flight.resultTime : flight.crossTime ?? flight.resultTime) * 1000);
  return shot;
}

// Keeper decision, rolled once at kick. Preview shots have none.
export type Strike = Shot & { saved: boolean; result: Outcome; frame: boolean };

// Keeper skill never changes. Level only lowers score chance.
export const REACTION = TUNING.keeper.reaction;
export function difficulty(attempt: number) {
  const chances = TUNING.keeper.scoreChance;
  const level = Math.min(chances.length, Math.floor(Math.max(0, attempt) / TUNING.keeper.shotsPerLevel) + 1);
  return {
    level,
    name: ["WARM-UP", "CLUB", "PRO", "ALL-STAR", "ELITE"][level - 1],
    scoreChance: chances[level - 1],
  };
}

// On target: flight crosses goal plane clear of posts and bar.
export function onTarget(shot: Shot) {
  const hit = flightOf(shot).cross;
  if (shot.short || !hit) return false;
  const clear = R + world.postRadius;
  return Math.abs(hit.x) <= POST_X - clear && hit.y <= BAR_Y - clear;
}

// Roll in [0, 1). Off-target shots miss whatever keeper does.
// Saved shots meet the gloves where the real flight crosses the goal plane.
export function strike(shot: Shot, attempt: number, roll: number): Strike {
  const saved = onTarget(shot) && roll >= difficulty(attempt).scoreChance;
  const base = { ...shot, saved };
  let parry: Contact | undefined;
  if (saved) {
    const body = keeperTarget(base), contact = keeperContact(base);
    const dx = contact.x - body.x, dy = body.y - contact.y;
    const length = Math.hypot(dx, dy) || 1;
    parry = { normal: { x: dx / length, y: dy / length } };
  }
  const flight = simulate(shot.launch, { parry, until: shot.duration / 1000 + 2.5 });
  const struck: Strike = { ...base, result: flight.result, frame: flight.frame };
  // Saved flight ends at glove contact, not goal line.
  if (saved) struck.duration = flight.keeperTime! * 1000;
  flights.set(struck, flight);
  return struck;
}

// Save: gloves stretch to ball. Goal: keeper commits full dive to wrong side.
export function keeperTarget(shot: Shot & { saved: boolean }) {
  const dx = shot.x - 500;
  const side = dx < 0 ? -1 : 1;
  if (shot.saved)
    return {
      x: shot.x - side * Math.min(40, Math.abs(dx)),
      y: clamp(shot.y, 222, 302),
    };
  return { x: 500 - side * 140, y: clamp(shot.y, 250, 295) };
}

export function keeperPosition(shot: Shot & { saved: boolean }, progress: number) {
  const target = keeperTarget(shot);
  const available = shot.duration / 1000 - REACTION;
  const time = clamp((progress * shot.duration) / 1000 - REACTION, 0, available);
  const distance = (t: number) => (t < 0.14 ? (t * t) / 0.28 : t - 0.07);
  const fraction = distance(time) / distance(available);
  return {
    x: 500 + (target.x - 500) * fraction,
    y: 287 + (target.y - 287) * fraction,
    lean: ((target.x - 500) / 200) * fraction,
  };
}

// The reachable glove contact, shared by the articulated rig and save check.
// Saved balls: point where simulated flight crosses keeper plane.
export function keeperContact(shot: Shot & { saved: boolean }) {
  const target = keeperTarget(shot);
  // Wrong-way dive: gloves stretch past target, away from ball, so body travels too.
  if (!shot.saved)
    return { x: target.x + Math.sign(target.x - 500) * 45, y: target.y };
  const hit = project(flightOf(shot).keeper!);
  const dx = hit.x - target.x, dy = hit.y - target.y;
  const reach = Math.max(1, Math.hypot(dx / 55, dy / 64));
  return { x: target.x + dx / reach, y: target.y + dy / reach };
}

export function outcome(shot: Strike): Outcome {
  return shot.result;
}

// Screen position at progress (1 = goal plane). Past 1, follows the simulated aftermath.
export function ballPosition(shot: Shot, progress: number) {
  const flight = flightOf(shot);
  return project(sample(flight, (Math.max(0, progress) * shot.duration) / 1000));
}

export function aftermathPosition(shot: Shot, _result: Outcome, seconds: number) {
  return project(sample(flightOf(shot), shot.duration / 1000 + seconds));
}
