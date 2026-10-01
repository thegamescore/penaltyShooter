import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 568, height: 320 }]) {
  test(`start screen and keyboard entry at ${viewport.width}×${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/?test&roll=0");
    await expect(page.getByRole("button")).toHaveCount(1);
    await expect(page.locator("#game")).toBeHidden();
    await expect(page.locator(".start-guide")).toContainText("Aim with the mouse. Click to shoot.");
    await page.keyboard.press("Space");
    await page.keyboard.press("m");
    expect(await page.evaluate(() => (window as any).__penalty)).toMatchObject({ shots: 0, muted: false });
    const button = page.getByRole("button", { name: "Start game", exact: true });
    await expect(button).toBeInViewport();
    await expect(page.locator(".start-guide")).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath("start.png") });
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#start-screen")).toBeHidden();
    await expect(page.locator("#pitch")).toBeFocused();
    await expect(page.locator("#shots")).toHaveText("00");
    await page.keyboard.press("Space");
    await expect(page.locator("#shots")).toHaveText("01");
  });
}

test("mobile guide explains tapping and starts with a touch", async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/?test");
  await expect(page.locator("#start-shot-guide")).toHaveText("Tap the goal to shoot.");
  await expect(page.locator(".start-keyboard")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("start-mobile.png") });
  await page.getByRole("button", { name: "Start game", exact: true }).tap();
  await expect(page.locator("#start-screen")).toBeHidden();
  await expect(page.locator("#goal-prompt")).toHaveText("Tap the goal to shoot ↓");
  await expect(page.locator("#shots")).toHaveText("00");
  await context.close();
});
