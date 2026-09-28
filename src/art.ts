import {
  aftermathPosition,
  ballPosition,
  keeperPosition,
  type Shot,
  type Outcome,
} from "./physics";

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
function stadium(c: CanvasRenderingContext2D) {
  // A quiet training ground keeps the goal and the aiming path in focus.
  const sky = c.createLinearGradient(0, 0, 0, 332);
  sky.addColorStop(0, "#e0e8df");
  sky.addColorStop(1, "#c5d4c5");
  c.fillStyle = sky;
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#b5c8b4";
  c.beginPath();
  c.moveTo(0, 285);
  c.quadraticCurveTo(250, 255, 520, 290);
  c.quadraticCurveTo(790, 310, 1000, 268);
  c.lineTo(1000, 340);
  c.lineTo(0, 340);
  c.fill();
  const grass = c.createLinearGradient(0, 332, 0, H);
  grass.addColorStop(0, "#799b78");
  grass.addColorStop(1, "#527656");
  c.fillStyle = grass;
  c.fillRect(0, 332, W, H - 332);
  for (let i = 0; i < 6; i++) {
    const y = 332 + Math.pow(i / 6, 1.5) * 388;
    const nextY = 332 + Math.pow((i + 1) / 6, 1.5) * 388;
    if (i % 2 === 0) {
      c.fillStyle = "#f7f8f507";
      c.fillRect(0, y, W, nextY - y);
    }
  }
  // Perspective penalty area, six-yard box and chalk spot.
  line(
    c,
    [
      [0, 554],
      [146, 356],
      [854, 356],
      [1000, 554],
    ],
    "#d9e4ba63",
    2.3,
  );
  line(
    c,
    [
      [145, 354],
      [72, 444],
      [928, 444],
      [855, 354],
    ],
    "#d9e4ba70",
    2.3,
  );
  ellipse(c, 500, 603, 9, 2.5, "#e6e8c5");
  // Net recedes into the goal. Frame sits in front of the mesh.
  c.fillStyle = "#294c3826";
  c.beginPath();
  c.moveTo(248, 178);
  c.lineTo(752, 178);
  c.lineTo(787, 354);
  c.lineTo(213, 354);
  c.closePath();
  c.fill();
  for (let i = 0; i <= 28; i++) {
    const x = 263 + i * 17;
    line(
      c,
      [
        [x, 196],
        [x, 346],
      ],
      "#edeed344",
      1,
    );
  }
  for (let y = 196; y <= 347; y += 13)
    line(
      c,
      [
        [263, y],
        [739, y],
      ],
      "#edeed344",
    );
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    line(
      c,
      [
        [248, 178 + t * 173],
        [263, 196 + t * 150],
      ],
      "#eeeccc55",
    );
    line(
      c,
      [
        [752, 178 + t * 173],
        [739, 196 + t * 150],
      ],
      "#eeeccc55",
    );
  }
  line(
    c,
    [
      [248, 351],
      [263, 346],
      [739, 346],
      [752, 351],
    ],
    "#dde3c17a",
    2,
  );
  line(
    c,
    [
      [248, 351],
      [248, 178],
      [752, 178],
      [752, 351],
    ],
    "#536f56",
    10,
  );
  line(
    c,
    [
      [248, 351],
      [248, 178],
      [752, 178],
      [752, 351],
    ],
    "#f4f6ed",
    7,
  );
  line(
    c,
    [
      [250, 349],
      [250, 180],
      [751, 180],
    ],
    "#ffffff",
    2,
  );
}

function keeper(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  lean: number,
) {
  ellipse(c, x, 351, 34, 7, "#102e354c");
  c.save();
  c.translate(x, y);
  c.rotate(lean * 0.55);
  c.lineCap = "round";
  c.lineJoin = "round";
  line(
    c,
    [
      [-9, 21],
      [-16, 42],
      [-24, 59],
    ],
    "#182f32",
    13,
  );
  line(
    c,
    [
      [9, 21],
      [18, 39],
      [24, 59],
    ],
    "#182f32",
    13,
  );
  line(
    c,
    [
      [-25, 61],
      [-34, 62],
    ],
    "#f5eace",
    8,
  );
  line(
    c,
    [
      [25, 61],
      [34, 62],
    ],
    "#f5eace",
    8,
  );
  line(
    c,
    [
      [-15, -16],
      [-31, -5],
      [-42, -22],
    ],
    "#c98b65",
    13,
  );
  line(
    c,
    [
      [15, -16],
      [31, -5],
      [42, -22],
    ],
    "#c98b65",
    13,
  );
  ellipse(c, -43, -26, 8, 10, "#f4edce");
  ellipse(c, 43, -26, 8, 10, "#f4edce");
  c.fillStyle = "#c98b65";
  c.beginPath();
  c.moveTo(-17, -22);
  c.lineTo(17, -22);
  c.lineTo(14, 23);
  c.lineTo(-14, 23);
  c.closePath();
  c.fill();
  c.fillStyle = "#263f38";
  c.font = "bold 18px Arial";
  c.textAlign = "center";
  c.fillText("1", 0, 10);
  c.fillStyle = "#a66e47";
  c.fillRect(-5, -33, 10, 14);
  ellipse(c, 0, -43, 12, 15, "#bf8e64");
  c.fillStyle = "#29372e";
  c.beginPath();
  c.arc(0, -46, 12, Math.PI, Math.PI * 2);
  c.lineTo(12, -44);
  c.lineTo(-12, -47);
  c.fill();
  c.restore();
}

function ball(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rotation: number,
) {
  c.save();
  c.translate(x, y);
  c.rotate(rotation);
  const g = c.createRadialGradient(-r * 0.3, -r * 0.4, 0, 0, 0, r);
  g.addColorStop(0, "#fffdf1");
  g.addColorStop(0.75, "#eee9d9");
  g.addColorStop(1, "#a9b6a3");
  ellipse(c, 0, 0, r, r, g);
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.clip();
  const pentagon = (x: number, y: number, size: number) => {
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const xx = x + Math.cos(a) * size,
        yy = y + Math.sin(a) * size;
      i ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
    }
    c.closePath();
    c.fillStyle = "#223e37";
    c.fill();
  };
  pentagon(0, 0, r * 0.43);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    line(
      c,
      [
        [0, 0],
        [x, y],
      ],
      "#66746b",
      r * 0.035,
    );
    pentagon(x, y, r * 0.34);
  }
  c.restore();
}

export type Scene = {
  preview: Shot | null;
  shot: Shot | null;
  progress: number;
  attempt: number;
  result: Outcome | null;
  ready: boolean;
  reducedMotion: boolean;
};
export class Renderer {
  private backdrop = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.backdrop.width = W * 1.5;
    this.backdrop.height = H * 1.5;
    const context = this.backdrop.getContext("2d")!;
    context.scale(1.5, 1.5);
    stadium(context);
  }
  draw(state: Scene) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * dpr),
      height = Math.round(rect.height * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const c = this.ctx;
    c.setTransform(width / W, 0, 0, height / H, 0, 0);
    c.clearRect(0, 0, W, H);
    c.drawImage(this.backdrop, 0, 0, W, H);
    let kx = 500,
      ky = 287,
      lean = 0;
    if (state.shot) {
      const pose = keeperPosition(state.shot, state.attempt, state.progress);
      kx = pose.x;
      ky = pose.y;
      lean = pose.lean;
    }
    keeper(c, kx, ky, lean);
    if (state.preview) {
      const shot = state.preview;
      c.save();
      c.setLineDash([5, 10]);
      c.lineCap = "round";
      c.lineWidth = 3;
      c.strokeStyle = "#f9e7b8b8";
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
      c.beginPath();
      c.arc(end.x, end.y, 17, 0, Math.PI * 2);
      c.stroke();
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
        c.strokeStyle = "#f5e6bb6b";
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(500, 622, 45, 15, 0, 0, Math.PI * 2);
        c.stroke();
        line(
          c,
          [
            [500, 556],
            [500, 515],
          ],
          "#f3e7c28c",
          2,
        );
        line(
          c,
          [
            [491, 525],
            [500, 515],
            [509, 525],
          ],
          "#f3e7c28c",
          2,
        );
      }
      ball(c, 500, 601, 24, 0);
    }
  }
}
