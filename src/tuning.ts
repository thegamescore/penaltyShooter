// All gameplay tuning in one place.
// Units: meters, seconds, m/s, rad/s.
export const TUNING = {
  shot: {
    autoPower: 0.9, // power used by taps and keyboard
    minSpeed: 12, // launch speed at power 0
    maxSpeed: 22, // launch speed at power 1
    shortPower: 0.26, // below this: scuffed roller, never reaches goal
    scuffSpeed: 16, // roller speed per unit power
    sideSpin: 34, // curl on wide shots; bends ball back toward goal center
    topSpin: 10, // dip on high shots
  },
  ball: {
    radius: 0.11,
    mass: 0.43,
    dragCoefficient: 0.25,
    liftScale: 1, // Magnus strength multiplier
    spinDecay: 0.15, // spin lost per second
    bounce: 0.55, // vertical restitution on turf
    bounceFriction: 0.18, // horizontal speed lost per bounce
    rolling: 1.3, // rolling deceleration, m/s²
  },
  world: {
    gravity: 9.81,
    airDensity: 1.2,
    distance: 11, // spot to goal line
    goalHalfWidth: 3.66,
    barHeight: 2.44,
    postRadius: 0.06,
    frameBounce: 0.65, // posts and crossbar
    netDepth: 2,
    keeperDepth: 0.3, // gloves meet ball this far in front of goal line
    netBounce: 0.12,
    netDrag: 3, // net lying on turf slows rolling ball, per second
  },
  keeper: {
    // Keeper decision is one roll per kick against level score chance.
    shotsPerLevel: 6,
    scoreChance: [0.75, 0.6, 0.46, 0.32, 0.22], // on-target goal chance per level
    reaction: 0.19, // seconds before dive starts
  },
  parry: {
    restitution: 0.22, // share of incoming speed sent back toward field
    keep: 0.3, // share of sideways/vertical speed kept through glove
    push: 4, // outward push along glove-to-ball normal
    lift: 1, // extra upward pop off gloves
    spinKeep: 0.2, // spin left after touch
  },
};
