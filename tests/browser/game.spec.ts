import { test, expect, type Page } from "@playwright/test";

const state = (page: Page) => page.evaluate(() => (window as any).__penalty);
async function coordinates(page: Page, dx = 155, dy = -210) {
  const box = (await page.locator("canvas").boundingBox())!;
  return {
    x: box.x + box.width * 0.5,
    y: box.y + (box.height * 601) / 720,
    endX: box.x + (box.width * (500 + dx)) / 1000,
    endY: box.y + (box.height * (601 + dy)) / 720,
  };
}
async function mouseShot(page: Page, dx = 155, dy = -210, release = true) {
  const p = await coordinates(page, dx, dy);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(45);
    await page.mouse.move(
      p.x + ((p.endX - p.x) * i) / 8,
      p.y + ((p.endY - p.y) * i) / 8,
    );
  }
  const preview = (await state(page)).preview;
  if (release) await page.mouse.up();
  return preview;
}

test("mouse aiming preview, frozen hold, goal, next shot, save, miss and auto reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/?test");
  const preview = await mouseShot(page, 155, -210, false);
  expect(preview.x).toBeGreaterThan(680);
  await page.screenshot({ path: "test-results/desktop-aim.png" });
  await page.waitForTimeout(400);
  expect((await state(page)).preview).toEqual(preview);
  await page.mouse.up();
  expect((await state(page)).shot).toEqual(preview);
  await expect(page.locator("#shots")).toHaveText("01");
  expect((await state(page)).result).toBe("goal");
  await page.screenshot({
    path: "test-results/desktop-goal.png",
    fullPage: true,
  });
  await page.locator("#next").click();
  await mouseShot(page, 0, -210);
  await expect(page.locator("#shots")).toHaveText("02");
  expect((await state(page)).result).toBe("save");
  await page.locator("#next").click();
  await mouseShot(page, 270, -170);
  await expect(page.locator("#shots")).toHaveText("03");
  expect((await state(page)).result).toBe("miss");
  await expect.poll(async () => (await state(page)).phase).toBe("ready");
  expect((await state(page)).goals).toBe(1);
  expect(errors).toEqual([]);
});

test("tiny gestures, off-ball starts, Escape, canceled pointers and resize do not shoot", async ({
  page,
}) => {
  await page.goto("/?test");
  await mouseShot(page, 4, -4);
  expect((await state(page)).shots).toBe(0);
  const p = await coordinates(page);
  await page.mouse.move(p.x - 170, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x, p.y - 150);
  await page.mouse.up();
  expect((await state(page)).phase).toBe("ready");
  await mouseShot(page, 155, -210, false);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await state(page)).phase).toBe("ready");
  await mouseShot(page, 155, -210, false);
  await page.locator("canvas").dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  expect((await state(page)).shots).toBe(0);
  await mouseShot(page, 155, -210, false);
  await page.setViewportSize({ width: 900, height: 700 });
  await page.mouse.up();
  expect((await state(page)).phase).toBe("ready");
});

test("touch swipes aim and shoot, cancellation is harmless, viewport does not scroll", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto("/?test");
  const cdp = await context.newCDPSession(page);
  const p = await coordinates(page, -155, -210);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: p.x, y: p.y }],
  });
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(45);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: p.x + ((p.endX - p.x) * i) / 8,
          y: p.y + ((p.endY - p.y) * i) / 8,
        },
      ],
    });
  }
  await page.waitForTimeout(60);
  const preview = (await state(page)).preview;
  expect(preview.x).toBeLessThan(320);
  await page.screenshot({ path: "test-results/mobile-aim.png" });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  expect((await state(page)).shot).toEqual(preview);
  await expect(page.locator("#shots")).toHaveText("01");
  expect((await state(page)).result).toBe("goal");
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.locator("#next").click();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: p.x, y: p.y }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: p.endX, y: p.endY }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  expect((await state(page)).phase).toBe("ready");
  expect((await state(page)).shots).toBe(1);
  await page.screenshot({
    path: "test-results/mobile-ready.png",
    fullPage: true,
  });
  await context.close();
});

test("keyboard controls and mute are operable", async ({ page }) => {
  await page.goto("/?test");
  await page.locator("canvas").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("w");
  expect((await state(page)).preview.x).toBe(670);
  await page.keyboard.press("m");
  expect((await state(page)).muted).toBe(true);
  await expect(page.locator("#sound")).toHaveAttribute(
    "aria-label",
    "Unmute sound",
  );
  await page.keyboard.press("Space");
  await expect(page.locator("#shots")).toHaveText("01");
  await page.locator("#sound").click();
  expect((await state(page)).muted).toBe(false);
});

for (const size of [
  { width: 360, height: 640 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
]) {
  test(`layout fits ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/?test");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("canvas")).toBeVisible();
    await page.screenshot({
      path: `test-results/layout-${size.width}.png`,
      fullPage: true,
    });
  });
}
