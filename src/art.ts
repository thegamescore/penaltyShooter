import {
  FIELD,
  aftermathPosition,
  ballPosition,
  type Shot,
  type Strike,
  type Outcome,
} from "./physics";

import { blendKeeper, keeperPose, type KeeperPose } from "./keeper";
import { immersiveQuery, pitchView } from "./viewport";

const W = 1000,
  H = 720;
function line(
  c: CanvasRenderingContext2D,
  points: number[][],
  color: string,
  width = 1,
) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function ellipse(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string | CanvasGradient,
) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}
// Artwork is drawn on a fixed 500 × 360 framebuffer and enlarged without
// smoothing. Physics stay in the original 1000 × 720 coordinate system.
function stadium(c: CanvasRenderingContext2D) {
  const rect = (x: number, y: number, w: number, h: number, color: string) => { c.fillStyle = color; c.fillRect(x, y, w, h); };
  const sky = ['#777197', '#9580a5', '#b28bab', '#d39da9', '#eeb29e', '#fac99e'];
  sky.forEach((color, i) => rect(0, i * 36, W, 36, color));
  // Stepped sunset disc and clouds, all on the same pixel grid.
  rect(770, 68, 52, 8, '#ffdfac'); rect(758, 76, 76, 12, '#ffdfac');
  rect(750, 88, 92, 44, '#ffdfac'); rect(758, 132, 76, 12, '#ffdfac'); rect(770, 144, 52, 8, '#ffdfac');
  for (const [x, y, w] of [[178, 78, 100], [560, 46, 100], [872, 130, 92], [16, 116, 128]]) {
    rect(x + 20, y, w - 48, 8, '#f8c7b3'); rect(x + 8, y + 8, w - 20, 8, '#f8c7b3');
    rect(x, y + 16, w, 8, '#f8c7b3'); rect(x + 20, y + 24, w - 20, 4, '#c08fa6');
  }
  // Skyline and stadium terraces.
  for (let i = 0; i < 32; i++) { const h = 12 + i * 17 % 42; rect(i * 34, 208 - h, 26, h, '#777087'); }
  rect(0, 204, W, 128, '#363950');
  for (let i = 0; i < 12; i++) { const y = 170 + Math.min(i, 11 - i) * 8; rect(i * 88, y, 88, 10, '#34334c'); rect(i * 88, y + 10, 88, 6, '#5b536d'); rect(i * 88, y + 16, 88, 38, '#272b43'); }
  for (let row = 0; row < 6; row++) {
    rect(0, 224 + row * 14, W, 2, '#252c42');
    for (let col = 0; col < 83; col++) {
      const x = col * 12 + row % 2 * 6, y = 212 + row * 14;
      const colors = ['#dcad98', '#92bdad', '#707193', '#eac47e', '#a180a1', '#475974'];
      rect(x + 2, y, 4, 4, '#bf97a0'); rect(x, y + 4, 8, 6, colors[(col * 7 + row * 3) % colors.length]);
    }
  }
  for (const x of [94, 906]) {
    rect(x - 4, 88, 8, 214, '#363950'); rect(x + 4, 94, 4, 210, '#77718b');
    rect(x - 42, 72, 88, 28, '#363950'); rect(x - 38, 68, 80, 4, '#c4a9b9');
    for (let i = 0; i < 7; i++) { rect(x - 36 + i * 12, 76, 8, 8, '#fff0c8'); rect(x - 36 + i * 12, 88, 8, 8, '#f8d997'); }
  }
  // Club flags and contrasting advertising hoardings.
  for (const x of [34, 186, 816, 970]) { rect(x, 157, 4, 47, '#e5baa8'); rect(x + 4, 157, 24, 16, x < 500 ? '#d71920' : '#ffffff'); rect(x + 20, 173, 8, 4, '#b06e89'); }
  rect(0, 302, W, 34, '#e4c2ac');
  ['#d71920', '#ffffff', '#d71920', '#242427'].forEach((color, i) => rect(i * 250 + 2, 304, 246, 28, color));
  c.textAlign = 'center';
  for (const [x, text, color] of [[125, 'gamesCore_', '#ffffff'], [375, 'LEVEL UP', '#d71920'], [625, 'MAKE IT COUNT', '#ffffff'], [875, 'gamesCore_', '#ffffff']] as const) {
    c.font = text === 'gamesCore_' ? '700 22px Recoleta, Georgia, serif' : '10px Pixel, monospace';
    c.fillStyle = color; c.fillText(text, x, 324);
  }
  rect(0, 336, W, H - 336, '#318d68');
  const stripes = [336, 358, 390, 434, 490, 560, 644, 740];
  stripes.slice(0, -1).forEach((y, i) => rect(0, y, W, stripes[i + 1] - y, i % 2 ? '#287e60' : '#318d68'));
  rect(0, 336, W, 6, '#8cbb80');
  for (let i = 0; i < 650; i++) {
    const x = i * 634 % 1000, y = 346 + i * 138 % 374;
    rect(x, y, 4, 2, i % 3 ? '#163e3820' : '#b5d18a25');
  }
  line(c, [[0, 554], [146, 356], [854, 356], [1000, 554]], '#a9d69b', 4);
  line(c, [[145, 354], [72, 444], [928, 444], [855, 354]], '#a9d69b', 4);
  line(c, [[0, 696], [200, 696], [232, 676], [768, 676], [800, 696], [1000, 696]], '#86bc8a', 4);
  rect(492, 602, 16, 4, '#cee4a8');
  // The goal front matches the collision bounds exactly.
  c.fillStyle = '#142f4280'; c.beginPath(); c.moveTo(248, 178); c.lineTo(752, 178); c.lineTo(780, 364); c.lineTo(220, 364); c.closePath(); c.fill();
  rect(264, 196, 472, 152, '#233e4970');
  for (let x = 264; x <= 736; x += 16) line(c, [[x, 196], [x, 348]], '#a8c8bc70', 2);
  for (let y = 196; y <= 348; y += 12) line(c, [[264, y], [736, y]], '#a8c8bc70', 2);
  for (let i = 0; i <= 14; i++) {
    const y = 178 + i * 12;
    line(c, [[248, y], [264, 196 + i * 10.8]], '#c5dbbf90', 2);
    line(c, [[752, y], [736, 196 + i * 10.8]], '#c5dbbf90', 2);
  }
  for (let x = 264; x < 750; x += 16) line(c, [[x, 178], [264 + (x - 248) * .936, 196]], '#c5dbbf90', 2);
  line(c, [[248, 352], [264, 348], [736, 348], [752, 352]], '#d1dbb3', 4);
  line(c, [[248, 354], [248, 178], [752, 178], [752, 354]], '#293448', 14);
  line(c, [[248, 352], [248, 178], [752, 178], [752, 352]], '#f5edc9', 8);
  line(c, [[252, 350], [252, 182], [748, 182]], '#a3bcac', 2);
  rect(244, 330, 8, 12, '#ed9791'); rect(748, 330, 8, 12, '#ed9791');
}

function sprite(c: CanvasRenderingContext2D, rows: string[], palette: Record<string, string>, x: number, y: number, size: number) {
  rows.forEach((row, iy) => [...row].forEach((pixel, ix) => {
    if (palette[pixel]) { c.fillStyle = palette[pixel]; c.fillRect(Math.round(x + ix * size), Math.round(y + iy * size), Math.ceil(size), Math.ceil(size)); }
  }));
}
const keeperSprite = [
  '..........hhhhhh..........',
  '.........hhhhhhhh.........',
  '.........hssssssh.........',
  '.........ssessess.........',
  '..........ssnsss..........',
  '..........sdddds..........',
  '..ww......ddssdd......ww..',
  '.wwww...tttyyttttt...wwww.',
  '.wwww..tttyyyyyyttt..wwww.',
  '..tttttttyyyyyyyytttttt..',
  '...ttttttyyyyyyyyttttt...',
  '....tttttyyyhyyyytttt....',
  '........tyyhhyyyyt........',
  '........tyyyhyyyyt........',
  '........tyyyhyyyyt........',
  '........tyyhhhyyyt........',
  '........tttttttttt........',
  '........hhhhhhhhhh........',
  '........hhhhhhhhhh........',
  '........hhhh..hhhh........',
  '.......hhhh....hhhh.......',
  '.......hhhh....hhhh.......',
  '......dddd......dddd......',
  '......dddd......dddd......',
  '.....wwww........wwww.....',
  '.....wwww........wwww.....',
  '....hhhhhh......hhhhhh....',
  '...hhhhhhh......hhhhhhh...',
  '...wwwwwww......wwwwwww...',
];
const keeperBody = keeperSprite.slice(0, 19).map((row, index) =>
  index < 6 ? row : [...row].map((pixel, x) => x >= 8 && x <= 17 ? pixel : ".").join(""),
);
// Eyes have their own dark color; the nose sits a row lower in soft skin shading.
const keeperPalette = {
  h: '#252a43', e: '#252a43', s: '#edb18a', n: '#d99a7c',
  d: '#b7746c', t: '#a70e18', y: '#f04449', w: '#f2eac9',
};
function keeper(c: CanvasRenderingContext2D, pose: KeeperPose) {
  const { x, y, rotation } = pose;
  const width = 64 + Math.abs(rotation) * 24;
  c.fillStyle = y < 270 ? '#183a4633' : '#183a4655';
  c.fillRect(Math.round(x - width / 2), 348, width, 8);
  c.save();
  c.translate(Math.round(x / 2) * 2, Math.round(y / 2) * 2);
  c.rotate(rotation);
  c.lineCap = "square";
  c.lineJoin = "bevel";
  for (const [hip, knee, foot, side] of [
    [[-9, 21], pose.leftKnee, pose.leftFoot, -1],
    [[9, 21], pose.rightKnee, pose.rightFoot, 1],
  ] as const) {
    line(c, [[...hip], knee, foot], "#252a43", 13);
    line(c, [[foot[0], foot[1] - 12], foot], "#b7746c", 10);
    line(c, [[foot[0], foot[1] - 5], foot], "#f2eac9", 10);
    line(c, [foot, [foot[0] + side * 8, foot[1]]], "#252a43", 8);
    line(c, [[foot[0] - 4, foot[1] + 3], [foot[0] + side * 8, foot[1] + 3]], "#f2eac9", 3);
  }
  // Keep the gloves in front of the torso so central saves show hand contact.
  sprite(c, keeperBody, keeperPalette, -52, -54, 4);
  for (const [shoulder, elbow, hand] of [
    [[-15, -16], pose.leftElbow, pose.leftHand],
    [[15, -16], pose.rightElbow, pose.rightHand],
  ] as const) {
    line(c, [[...shoulder], elbow, hand], keeperPalette.t, 12);
    line(c, [[...shoulder], elbow], keeperPalette.y, 5);
    c.fillStyle = "#f2eac9";
    c.fillRect(hand[0] - 7, hand[1] - 8, 14, 16);
    c.fillStyle = "#a9bbaf";
    c.fillRect(hand[0] - 7, hand[1] + 4, 14, 4);
  }
  c.restore();
}
// Bake the spinning panels into pixel frames; the silhouette and stadium
// lighting stay still, avoiding the wobble of rotating a square bitmap.
const BALL_PIXELS = 28;
const BALL_FRAMES = 32;
type PanelPoint = readonly [number, number];
const pentagon = (x: number, y: number, radius: number, angle: number): PanelPoint[] =>
  Array.from({ length: 5 }, (_, i) => [
    x + Math.cos(angle + i * Math.PI * 2 / 5) * radius,
    y + Math.sin(angle + i * Math.PI * 2 / 5) * radius,
  ]);
const ballPanels = [pentagon(0, -.06, .37, -Math.PI / 2)];
for (let i = 0; i < 5; i++) {
  const angle = -Math.PI / 2 + i * Math.PI * 2 / 5;
  ballPanels.push(pentagon(Math.cos(angle) * .97, Math.sin(angle) * .97, .32, angle + Math.PI));
}
function insidePanel(x: number, y: number, panel: PanelPoint[]) {
  let inside = false;
  for (let i = 0, j = panel.length - 1; i < panel.length; j = i++) {
    const [ax, ay] = panel[i], [bx, by] = panel[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
const ballFrames = Array.from({ length: BALL_FRAMES }, (_, frame) => {
  const bitmap = document.createElement('canvas');
  bitmap.width = bitmap.height = BALL_PIXELS;
  const c = bitmap.getContext('2d')!;
  const angle = frame / BALL_FRAMES * Math.PI * 2;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let py = 0; py < BALL_PIXELS; py++) {
    for (let px = 0; px < BALL_PIXELS; px++) {
      const x = (px + .5) / BALL_PIXELS * 2 - 1;
      const y = (py + .5) / BALL_PIXELS * 2 - 1;
      const radius = Math.hypot(x, y);
      if (radius > 1) continue;
      const tx = x * cos + y * sin, ty = -x * sin + y * cos;
      const dark = ballPanels.some(panel => insidePanel(tx, ty, panel));
      const light = -.38 * x - .5 * y + .72 * Math.sqrt(1 - radius * radius);
      // Discrete shades keep the light readable without smooth gradients.
      const whites = ['#899baa', '#bcc9ce', '#e1e7e3', '#fff9e8'];
      const blacks = ['#151d31', '#202b42', '#34415a', '#465570'];
      const shade = light > .65 ? 3 : light > .3 ? 2 : light > 0 ? 1 : 0;
      c.fillStyle = radius > .94 ? '#172238' : (dark ? blacks : whites)[shade];
      c.fillRect(px, py, 1, 1);
    }
  }
  return bitmap;
});
function ball(c: CanvasRenderingContext2D, x: number, y: number, r: number, rotation: number) {
  const frame = ((Math.round(rotation / (Math.PI * 2) * BALL_FRAMES) % BALL_FRAMES) + BALL_FRAMES) % BALL_FRAMES;
  c.drawImage(ballFrames[frame], Math.round(x - r), Math.round(y - r), r * 2, r * 2);
}

export type Scene = {
  preview: Shot | null;
  shot: Strike | null;
  progress: number;
  result: Outcome | null;
  ready: boolean;
  reducedMotion: boolean;
  time: number;
};
export class Renderer {
  private backdrop = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private lastShot: Shot | null = null;
  private lastPose: KeeperPose | null = null;
  private transitionPose: KeeperPose | null = null;
  private transitionTime = 0;
  private immersive = matchMedia(immersiveQuery);
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.backdrop.width = W / 2;
    this.backdrop.height = H / 2;
    const context = this.backdrop.getContext("2d")!;
    context.scale(.5, .5);
    stadium(context);
    void Promise.all([document.fonts.load("10px Pixel"), document.fonts.load("700 22px Recoleta")]).then(() => stadium(context));
  }
  draw(state: Scene) {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width / 2)), height = Math.max(1, Math.round(rect.height / 2));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    const view = pitchView(rect.width, rect.height, this.immersive.matches);
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.setTransform(view.scaleX * width / rect.width, 0, 0, view.scaleY * height / rect.height, view.x * width / rect.width, view.y * height / rect.height);
    const left = -view.x / view.scaleX, top = -view.y / view.scaleY;
    const visibleWidth = rect.width / view.scaleX, visibleHeight = rect.height / view.scaleY;
    // Extend the sky and turf when a screen reveals more than the original scene.
    c.fillStyle = "#777197";
    c.fillRect(left, top, visibleWidth, visibleHeight);
    c.fillStyle = "#287e60";
    c.fillRect(left, 336, visibleWidth, Math.max(0, top + visibleHeight - 336));
    if (left < 0) c.drawImage(this.backdrop, 0, 0, 1, H / 2, left, 0, -left, H);
    if (left + visibleWidth > W) c.drawImage(this.backdrop, W / 2 - 1, 0, 1, H / 2, W, 0, left + visibleWidth - W, H);
    c.drawImage(this.backdrop, 0, 0, W, H);
    let pose = keeperPose(state.shot, state.progress, state.time, state.reducedMotion);
    if (this.lastShot !== state.shot) {
      this.transitionPose = this.lastPose;
      this.transitionTime = state.time;
      this.lastShot = state.shot;
    }
    // Manual next-shot resets also move smoothly out of the previous pose.
    if (this.transitionPose) {
      const t = Math.min(1, (state.time - this.transitionTime) / 0.16);
      pose = blendKeeper(this.transitionPose, pose, t * t * (3 - 2 * t));
      if (t === 1) this.transitionPose = null;
    }
    this.lastPose = pose;
    keeper(c, pose);
    if (state.preview) {
      const shot = state.preview;
      c.save();
      c.setLineDash([6, 12]);
      c.lineCap = "butt";
      c.lineWidth = 3;
      c.strokeStyle = "#ffffff";
      c.beginPath();
      for (let i = 0; i <= 30; i++) {
        const p = ballPosition(shot, i / 30);
        i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
      }
      c.stroke();
      c.setLineDash([]);
      const end = ballPosition(shot, 1);
      const outside =
        shot.short || shot.x < 257 || shot.x > 743 || shot.y < 187;
      c.strokeStyle = outside ? "#ffb58b" : "#fff5d9";
      c.lineWidth = 2.5;
      c.strokeRect(Math.round(end.x - 16), Math.round(end.y - 16), 32, 32);
      line(
        c,
        [
          [end.x - 25, end.y],
          [end.x - 10, end.y],
        ],
        c.strokeStyle,
      );
      line(
        c,
        [
          [end.x + 10, end.y],
          [end.x + 25, end.y],
        ],
        c.strokeStyle,
      );
      line(
        c,
        [
          [end.x, end.y - 25],
          [end.x, end.y - 10],
        ],
        c.strokeStyle,
      );
      line(
        c,
        [
          [end.x, end.y + 10],
          [end.x, end.y + 25],
        ],
        c.strokeStyle,
      );
      c.restore();
    }
    if (state.shot) {
      const p =
        state.progress > 1 && state.result
          ? aftermathPosition(
              state.shot,
              state.result,
              ((state.progress - 1) * state.shot.duration) / 1000,
            )
          : ballPosition(state.shot, state.progress);
      ellipse(
        c,
        p.x,
        p.groundY + 5,
        p.radius * 1.2,
        p.radius * 0.28,
        "#102d384a",
      );
      ball(
        c,
        p.x,
        p.y,
        p.radius,
        state.progress * (state.reducedMotion ? 0 : 8),
      );
    } else {
      ellipse(c, 500, 622, 29, 7, "#0d2e3766");
      if (state.ready && !state.preview) {
        // Persistent corner cues make the goal itself the obvious tap target.
        c.save();
        c.strokeStyle = "#fff5d9";
        c.fillStyle = "#d7192060";
        c.lineWidth = 3;
        for (const x of [290, 710]) {
          for (const y of [215, 310]) {
            c.beginPath();
            c.arc(x, y, 18, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.fillStyle = "#fff5d9";
            c.fillRect(x - 3, y - 3, 6, 6);
            c.fillStyle = "#d7192060";
          }
        }
        c.restore();
      }
      ball(c, 500, 601, 24, 0);
    }
  }
}
