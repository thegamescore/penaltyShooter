import "./style.css";
import { Renderer } from "./art";
import { MatchAudio } from "./audio";
import { immersiveQuery, pitchView } from "./viewport";
import {
  FIELD,
  aimShot,
  outcome,
  strike,
  difficulty,
  type Shot,
  type Strike,
  type Outcome,
} from "./physics";

const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>("pitch");
const renderer = new Renderer(canvas);
const startRenderer = new Renderer(element<HTMLCanvasElement>("start-background"));
let started = false;
const audio = new MatchAudio();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const immersive = matchMedia(immersiveQuery);
const prompt = element("goal-prompt");
const touchInput = matchMedia("(hover: none) and (pointer: coarse)");
function updatePromptText() {
  prompt.firstChild!.textContent = touchInput.matches ? "Tap the goal to shoot " : "Click the goal to shoot ";
  element("start-shot-guide").textContent = touchInput.matches
    ? "Tap the goal to shoot."
    : "Aim with the mouse. Click to shoot.";
}
updatePromptText();
touchInput.addEventListener("change", updatePromptText);
const readyHint = "Aim for a corner. Beat the keeper.";
const history: Outcome[] = [];
const params = new URLSearchParams(location.search);
// Test mode only: ?roll=0,0.99 fixes keeper rolls, cycled per shot. Low roll scores, high roll saved.
const fixedRolls = params.has("test") ? (params.get("roll") ?? "").split(",").filter(Boolean).map(Number) : [];
let phase: "ready" | "aiming" | "flying" | "result" = "ready";
let preview: Shot | null = null,
  shot: Strike | null = null,
  result: Outcome | null = null;
let goals = 0,
  shots = 0,
  streak = 0,
  best = 0,
  elapsed = 0,
  attempt = 0;
let pointer: { id: number; width: number; height: number } | null = null;
let keyboard = { x: 710, y: 246 };
let previousTime = performance.now();
let animationTime = 0;

element("start-game").addEventListener("click", () => {
  if (started) return;
  started = true;
  element("start-screen").hidden = true;
  element("game").hidden = false;
  element("game").inert = false;
  audio.unlock();
  positionPrompt();
  canvas.focus({ preventScroll: true });
});

function releaseCapture() {
  const active = pointer;
  pointer = null;
  if (active && canvas.hasPointerCapture(active.id))
    canvas.releasePointerCapture(active.id);
}
function cancel() {
  releaseCapture();
  if (phase === "aiming") {
    phase = "ready";
    preview = null;
    element("hint").textContent = readyHint;
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
  prompt.hidden = false;
  element("hint").textContent = readyHint;
  audio.play("ready");
}
function fire(value: Shot) {
  if (!started || phase === "flying" || phase === "result") return;
  releaseCapture();
  audio.unlock();
  audio.play("kick");
  attempt = shots;
  const struck = strike(value, attempt, fixedRolls.length ? fixedRolls[attempt % fixedRolls.length] : Math.random());
  shot = struck;
  preview = null;
  phase = "flying";
  elapsed = 0;
  result = outcome(struck);
  prompt.hidden = true;
  canvas.style.cursor = "default";
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
  element("result-title").textContent = result === "goal" ? "Goal." : result === "save" ? "Saved." : shot?.short ? "Too short." : shot?.frame ? "Off the post." : "Off target.";
  element("announcement").classList.add("visible");
  element("hint").textContent = result === "goal"
    ? "Nice shot! Next ball…"
    : "Try a corner! Next ball…";
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
function updateAim(event: PointerEvent) {
  if (!started || phase === "flying" || phase === "result") return;
  if (pointer && event.pointerId !== pointer.id) return;
  const bounds = canvas.getBoundingClientRect();
  if (pointer && (bounds.width !== pointer.width || bounds.height !== pointer.height)) {
    cancel();
    return;
  }
  const p = point(event);
  preview = aimShot(p.x, p.y);
  phase = preview ? "aiming" : "ready";
  canvas.style.cursor = preview ? "crosshair" : "default";
}
canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || !event.isPrimary || pointer || phase === "flying" || phase === "result") return;
  updateAim(event);
  if (!preview) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  audio.unlock();
  const bounds = canvas.getBoundingClientRect();
  pointer = { id: event.pointerId, width: bounds.width, height: bounds.height };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", updateAim);
canvas.addEventListener("pointerup", (event) => {
  if (event.pointerId !== pointer?.id) return;
  updateAim(event);
  // A canceled/resized interaction must never fire a later release.
  if (!pointer) return;
  const value = preview;
  if (value) fire(value);
  else cancel();
});
canvas.addEventListener("pointerleave", () => {
  if (!pointer) cancel();
});
canvas.addEventListener("pointercancel", (event) => {
  if (event.pointerId === pointer?.id) cancel();
});
canvas.addEventListener("lostpointercapture", (event) => {
  if (event.pointerId === pointer?.id) cancel();
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

function positionPrompt() {
  const bounds = canvas.getBoundingClientRect();
  const view = pitchView(bounds.width, bounds.height, immersive.matches);
  prompt.style.left = `${view.x + 500 * view.scaleX}px`;
  prompt.style.top = `${view.y + (FIELD.top - 24) * view.scaleY}px`;
}
new ResizeObserver(positionPrompt).observe(canvas);
immersive.addEventListener("change", () => { cancel(); positionPrompt(); });

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
  if (!started) return;
  if (event.key.toLowerCase() === "m" && !event.repeat) toggleSound();
  if (event.key === "Escape") cancel();
});
canvas.addEventListener("keydown", (event) => {
  if (!started) return;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"].includes(event.key)) return;
  event.preventDefault();
  if (phase === "flying" || phase === "result" || pointer) return;
  const shoot = event.key === " " || event.key === "Enter";
  if (shoot && event.repeat) return;
  audio.unlock();
  if (event.key === "ArrowLeft") keyboard.x = Math.max(FIELD.left + 14, keyboard.x - 20);
  if (event.key === "ArrowRight") keyboard.x = Math.min(FIELD.right - 14, keyboard.x + 20);
  if (event.key === "ArrowUp") keyboard.y = Math.max(FIELD.top + 14, keyboard.y - 12);
  if (event.key === "ArrowDown") keyboard.y = Math.min(FIELD.ground - 18, keyboard.y + 12);
  preview = aimShot(keyboard.x, keyboard.y);
  phase = "aiming";
  element("hint").textContent = "Arrows to aim. Space or Enter to shoot.";
  if (shoot && preview) fire(preview);
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
    (started ? renderer : startRenderer).draw({
      preview,
      shot,
      progress: shot ? elapsed / shot.duration : 0,
      result,
      ready: phase === "ready" || phase === "aiming",
      reducedMotion: reducedMotion.matches,
      time: animationTime,
    });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only acceptance-test snapshot, available only with an explicit test query.
if (params.has("test")) {
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
      level: difficulty(shots).level,
      muted: audio.muted,
    }),
  });
}
