import { test, expect } from "@playwright/test";

test("first keyboard shot plays audio; mute silences active and future effects", async ({ page }) => {
  await page.addInitScript(() => {
    const metrics = { started: 0, silenced: 0 };
    (window as any).__audioMetrics = metrics;
    const start = OscillatorNode.prototype.start;
    const stop = OscillatorNode.prototype.stop;
    OscillatorNode.prototype.start = function (when?: number) {
      metrics.started++;
      return start.call(this, when);
    };
    OscillatorNode.prototype.stop = function (when?: number) {
      if (when === undefined) metrics.silenced++;
      return stop.call(this, when);
    };
  });
  await page.goto("/?test");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await page.locator("#pitch").focus();
  await page.keyboard.press("Space");
  await expect.poll(() => page.evaluate(() => (window as any).__audioMetrics.started)).toBeGreaterThan(0);
  await page.keyboard.press("m");
  const count = await page.evaluate(() => (window as any).__audioMetrics.started);
  await expect(page.locator("#shots")).toHaveText("01");
  expect(await page.evaluate(() => (window as any).__audioMetrics.started)).toBe(count);

  // The unmute cue schedules two notes. Muting in the same turn must stop both.
  const silenced = await page.evaluate(() => {
    const button = document.getElementById("sound")!;
    const before = (window as any).__audioMetrics.silenced;
    button.click();
    button.click();
    return (window as any).__audioMetrics.silenced - before;
  });
  expect(silenced).toBeGreaterThanOrEqual(2);
  await expect(page.locator("#sound")).toHaveAttribute("aria-label", "Unmute sound");
});

test("game remains playable when Web Audio is unavailable", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { value: undefined });
  });
  await page.goto("/?test");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await page.locator("#pitch").focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#shots")).toHaveText("01");
  expect(errors).toEqual([]);
});
