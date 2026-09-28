import "./style.css";
import { Renderer } from "./art";
import { MatchAudio } from "./audio";
import { immersiveQuery, pitchView } from "./viewport";
import {
  FIELD,
  gesture,
  makeShot,
  outcome,
  type Shot,
  type Outcome,
} from "./physics";

const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>("pitch");
const renderer = new Renderer(canvas);
const audio = new MatchAudio();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const immersive = matchMedia(immersiveQuery);
const next = element<HTMLButtonElement>("next");
const history: Outcome[] = [];
let phase: "ready" | "aiming" | "flying" | "result" = "ready";
let preview: Shot | null = null,
  shot: Shot | null = null,
  result: Outcome | null = null;
let goals = 0,
  shots = 0,
  streak = 0,
  best = 0,
  elapsed = 0,
  attempt = 0;
let drag: {
  id: number;
  x: number;
  y: number;
  time: number;
  lastX: number;
  lastY: number;
  width: number;
  height: number;
} | null = null;
let keyboard = { x: 650, height: 105, power: 0.75 };
let previousTime = performance.now();
let animationTime = 0;

function readout(value: Shot | null) {
  element<HTMLMeterElement>("power").value = value?.power ?? 0;
  element("power-value").textContent = value
    ? `${Math.round(value.power * 100)}%`
    : "—";

}
function releaseCapture() {
  if (drag && canvas.hasPointerCapture(drag.id))
    canvas.releasePointerCapture(drag.id);
  drag = null;
}
function cancel() {
  releaseCapture();
  if (phase === "aiming") {
    phase = "ready";
    preview = null;
    readout(null);
    element("hint").textContent = "Drag the ball. Release to shoot.";
  }
}
function reset() {
  cancel();
  phase = "ready";
  shot = null;
  preview = null;
  result = null;
  elapsed = 0;
  element("announcement").classList.remove("visible");
  next.disabled = true;
  element("hint").textContent = "Drag the ball. Release to shoot.";
  readout(null);
  audio.play("ready");
}
function fire(value: Shot) {
  if (phase === "flying" || phase === "result") return;
  releaseCapture();
  audio.unlock();
  audio.play("kick");
  shot = value;
  preview = null;
  attempt = shots;
  phase = "flying";
  elapsed = 0;
  result = outcome(value, attempt);
  readout(value);
  next.disabled = true;
  element("hint").textContent = "Eyes on the ball.";
}
function finish() {
  if (!result) return;
  phase = "result";
  shots++;
  if (result === "goal") {
    goals++;
    streak++;
    best = Math.max(best, streak);
  } else streak = 0;
  history.push(result);
  element("goals").textContent = String(goals).padStart(2, "0");
  element("shots").textContent = String(shots).padStart(2, "0");
  element("history").innerHTML =
    history
      .slice(-5)
      .map(
        (r) =>
          `<i class="${r}"></i>`,
      )
      .join("") + "<i></i>".repeat(Math.max(0, 5 - history.length));
  element("history").setAttribute(
    "aria-label",
    `Last shots: ${history.slice(-5).join(", ")}`,
  );
  element("result-title").textContent = result === "goal" ? "Goal." : result === "save" ? "Saved." : shot?.short ? "Too short." : "Off target.";
  element("announcement").classList.add("visible");
  next.disabled = false;
  element("hint").textContent = result === "goal" ? "Nice finish." : result === "save" ? "Try aiming for a corner." : shot?.short ? "Drag further for more power." : shot && shot.y < FIELD.top + 9 ? "Swipe slower for less height." : "Aim inside the posts.";
  audio.play(result);
}
function point(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  const view = pitchView(rect.width, rect.height, immersive.matches);
  return {
    x: (event.clientX - rect.left - view.x) / view.scaleX,
    y: (event.clientY - rect.top - view.y) / view.scaleY,
  };
}
function updateDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.id) return;
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width !== drag.width || bounds.height !== drag.height) {
    cancel();
    return;
  }
  const p = point(event);
  // Holding at the end preserves the last preview and never changes the release height.
  if (Math.hypot(p.x - drag.lastX, p.y - drag.lastY) < 1) return;
  drag.lastX = p.x;
  drag.lastY = p.y;
  preview = gesture(p.x - drag.x, p.y - drag.y, event.timeStamp - drag.time);
  readout(preview);
  element("hint").textContent = preview
    ? event.pointerType === "touch" ? "Release to shoot." : "Release to shoot · Esc to cancel"
    : "Drag up toward the goal.";
}
canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || !event.isPrimary || drag || phase === "flying")
    return;
  const p = point(event);
  const bounds = canvas.getBoundingClientRect();
  const view = pitchView(bounds.width, bounds.height, immersive.matches);
  const radius = Math.max(
    48,
    28 / view.scaleX,
  );
  if (Math.hypot(p.x - FIELD.ballX, p.y - FIELD.ballY) > radius) return;
  if (phase === "result") reset();
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  audio.unlock();
  drag = {
    id: event.pointerId,
    x: p.x,
    y: p.y,
    lastX: p.x,
    lastY: p.y,
    time: event.timeStamp,
    width: canvas.getBoundingClientRect().width,
    height: canvas.getBoundingClientRect().height,
  };
  phase = "aiming";
  preview = null;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", updateDrag);
canvas.addEventListener("pointerup", (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  updateDrag(event);
  const value = preview;
  if (value) fire(value);
  else cancel();
});
canvas.addEventListener("pointercancel", (event) => {
  if (event.pointerId === drag?.id) cancel();
});
canvas.addEventListener("lostpointercapture", (event) => {
  if (event.pointerId === drag?.id) cancel();
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
next.addEventListener("click", () => {
  if (phase === "result") {
    audio.unlock();
    reset();
  }
});
function toggleSound() {
  audio.muted = !audio.muted;
  if (!audio.muted) {
    audio.unlock();
    audio.play("ready");
  }
  element("sound").setAttribute("aria-pressed", String(audio.muted));
  element("sound").setAttribute(
    "aria-label",
    audio.muted ? "Unmute sound" : "Mute sound",
  );
}
element("sound").addEventListener("click", toggleSound);
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "m" && !event.repeat) toggleSound();
  if (event.key === "Escape") cancel();
});
canvas.addEventListener("keydown", (event) => {
  if (
    ![
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "w",
      "W",
      "s",
      "S",
      " ",
    ].includes(event.key)
  )
    return;
  event.preventDefault();
  if (phase === "flying" || drag) return;
  if (phase === "result") {
    if (event.key === " " && !event.repeat) reset();
    return;
  }
  audio.unlock();
  if (event.key === "ArrowLeft") keyboard.x = Math.max(100, keyboard.x - 20);
  if (event.key === "ArrowRight") keyboard.x = Math.min(900, keyboard.x + 20);
  if (event.key === "ArrowUp")
    keyboard.height = Math.min(250, keyboard.height + 12);
  if (event.key === "ArrowDown")
    keyboard.height = Math.max(20, keyboard.height - 12);
  if (event.key.toLowerCase() === "w")
    keyboard.power = Math.min(1, keyboard.power + 0.05);
  if (event.key.toLowerCase() === "s")
    keyboard.power = Math.max(0.1, keyboard.power - 0.05);
  preview = makeShot(keyboard.x, keyboard.height, keyboard.power);
  phase = "aiming";
  readout(preview);
  if (event.key === " " && !event.repeat) fire(preview);
});
window.addEventListener("blur", cancel);
window.addEventListener("resize", cancel);
document.addEventListener("visibilitychange", () => {
  previousTime = performance.now();
  if (document.hidden) {
    cancel();
    audio.suspend();
  }
});

function frame(now: number) {
  const dt = Math.min(now - previousTime, 50);
  previousTime = now;
  if (!document.hidden) {
    animationTime += dt / 1000;
    if (shot && (phase === "flying" || phase === "result")) {
      elapsed += dt;
      if (phase === "flying" && elapsed >= shot.duration) finish();
      if (phase === "result" && elapsed >= shot.duration + 1450) reset();
    }
    renderer.draw({
      preview,
      shot,
      progress: shot ? elapsed / shot.duration : 0,
      attempt,
      result,
      ready: phase === "ready",
      reducedMotion: reducedMotion.matches,
      time: animationTime,
    });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only acceptance-test snapshot, available only with an explicit test query.
if (new URLSearchParams(location.search).has("test")) {
  Object.defineProperty(window, "__penalty", {
    get: () => ({
      phase,
      preview: preview && { ...preview },
      shot: shot && { ...shot },
      result,
      goals,
      shots,
      streak,
      best,
      muted: audio.muted,
    }),
  });
}
