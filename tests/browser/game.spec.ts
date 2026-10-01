import { test, expect, type Page } from "@playwright/test";
import { immersiveQuery, pitchView } from "../../src/viewport";

const state = (page: Page) => page.evaluate(() => (window as any).__penalty);
async function coordinates(page: Page, x = 710, y = 246) {
  const box = (await page.locator("#pitch").boundingBox())!;
  const immersive = await page.evaluate(query => matchMedia(query).matches, immersiveQuery);
  const view = pitchView(box.width, box.height, immersive);
  return { x: box.x + view.x + x * view.scaleX, y: box.y + view.y + y * view.scaleY };
}
async function ready(page: Page) {
  await expect.poll(async () => (await state(page)).phase).toBe("ready");
}

test("one click shoots at the previewed spot and automatically readies the next ball", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/?test&roll=0,0.999");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await expect(page.locator("#goal-prompt")).toHaveText("Click the goal to shoot ↓");
  await page.screenshot({ path: "test-results/desktop-ready.png", fullPage: true });
  const p = await coordinates(page);
  await page.mouse.move(p.x, p.y);
  const preview = (await state(page)).preview;
  expect(preview.x).toBeCloseTo(710);
  expect(preview.y).toBeCloseTo(246);
  await page.screenshot({ path: "test-results/desktop-aim.png" });
  await page.mouse.click(p.x, p.y);
  expect((await state(page)).shot).toMatchObject(preview);
  await expect(page.locator("#goal-prompt")).toBeHidden();
  // Extra clicks while the ball is in flight must not create another shot.
  await page.mouse.click(p.x, p.y);
  await expect(page.locator("#shots")).toHaveText("01");
  expect((await state(page)).result).toBe("goal");
  await page.screenshot({ path: "test-results/desktop-goal.png", fullPage: true });
  await ready(page);
  await expect(page.locator("#goal-prompt")).toBeVisible();
  const center = await coordinates(page, 500, 270);
  await page.mouse.click(center.x, center.y);
  await expect(page.locator("#shots")).toHaveText("02");
  expect((await state(page)).result).toBe("save");
  expect((await state(page)).goals).toBe(1);
  expect(errors).toEqual([]);
});

test("outside taps, Escape, pointer cancellation and resize never shoot", async ({ page }) => {
  await page.goto("/?test&roll=0");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  const outside = await coordinates(page, 500, 601);
  await page.mouse.click(outside.x, outside.y);
  expect((await state(page)).phase).toBe("ready");
  const p = await coordinates(page);
  for (const cancel of ["escape", "pointer", "outside", "resize"]) {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    if (cancel === "escape") await page.keyboard.press("Escape");
    if (cancel === "pointer") await page.locator("#pitch").dispatchEvent("pointercancel", { pointerId: 1 });
    if (cancel === "outside") await page.mouse.move(outside.x, outside.y);
    if (cancel === "resize") await page.setViewportSize({ width: 900, height: 700 });
    await page.mouse.up();
    expect((await state(page)).phase).toBe("ready");
    expect((await state(page)).shots).toBe(0);
  }
});

for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 844, height: 390 }, { width: 1180, height: 820 }]) {
  test(`one touch shoots at ${viewport.width}×${viewport.height}, canceled touches do not shoot`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto("/?test&roll=0");
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    await expect(page.locator("#goal-prompt")).toHaveText("Tap the goal to shoot ↓");
    const p = await coordinates(page, 290, 215);
    await page.screenshot({ path: testInfo.outputPath("ready.png"), fullPage: true });
    await page.touchscreen.tap(p.x, p.y);
    const shot = (await state(page)).shot;
    expect(shot.x).toBeCloseTo(290, 0);
    expect(shot.y).toBeCloseTo(215, 0);
    await expect(page.locator("#shots")).toHaveText("01");
    expect((await state(page)).result).toBe("goal");
    await ready(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    expect((await state(page)).phase).toBe("ready");
    expect((await state(page)).shots).toBe(1);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await context.close();
  });
}

test("keyboard uses only arrows and shoot; aiming remains inside the goal", async ({ page }) => {
  await page.goto("/?test&roll=0");
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await page.locator("#pitch").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  expect((await state(page)).preview.x).toBe(690);
  expect((await state(page)).preview.y).toBe(234);
  expect((await state(page)).preview.power).toBe(0.9);
  await page.keyboard.press("m");
  expect((await state(page)).muted).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.locator("#shots")).toHaveText("01");
  await ready(page);
  await page.locator("#pitch").focus();
  for (let i = 0; i < 30; i++) await page.keyboard.press("ArrowRight");
  expect((await state(page)).preview.x).toBe(738);
  await page.keyboard.press("Space");
  await expect(page.locator("#shots")).toHaveText("02");
  expect((await state(page)).result).toBe("goal");
});

for (const size of [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 568, height: 320 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
]) {
  test(`layout fits ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/?test&roll=0");
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("#pitch")).toBeVisible();
    const pitch = (await page.locator("#pitch").boundingBox())!;
    const prompt = (await page.locator("#goal-prompt").boundingBox())!;
    expect(prompt.y).toBeGreaterThanOrEqual(pitch.y);
    expect(prompt.x).toBeGreaterThanOrEqual(0);
    expect(prompt.x + prompt.width).toBeLessThanOrEqual(size.width);
    const shell = (await page.locator('.game-shell').boundingBox())!;
    expect(shell.x).toBe(0);
    expect(shell.y).toBe(0);
    expect(shell.width).toBe(size.width);
    expect(shell.height).toBe(size.height);
    const controls = (await page.locator('.controls').boundingBox())!;
    expect(controls.y + controls.height).toBeLessThanOrEqual(size.height);
    const sound = (await page.locator('#sound').boundingBox())!;
    expect(sound.width).toBeGreaterThanOrEqual(44);
    expect(sound.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(size.height);
    await page.screenshot({
      path: `test-results/layout-${size.width}.png`,
      fullPage: true,
    });
    await page.locator('.help summary').click();
    const help = (await page.locator('.help > div').boundingBox())!;
    expect(help.x).toBeGreaterThanOrEqual(0);
    expect(help.x + help.width).toBeLessThanOrEqual(size.width);
    expect(help.y + help.height).toBeLessThanOrEqual(size.height);
  });
}
