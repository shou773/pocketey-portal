import { test, expect } from "@playwright/test";

const slugs = ["orbit-ribbon", "amber-step", "pulse-drift", "tilttrail"];
test("all four games stay directly reachable at narrow and wide widths in both languages", async ({
  page,
}) => {
  for (const route of ["/", "/games/"])
    for (const lang of ["ja", "en"])
      for (const width of [320, 390, 600, 760, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`${route}?lang=${lang}`);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${route} ${lang} ${width}`,
        ).toBe(true);
        await expect(page.locator(".game-card")).toHaveCount(4);
        for (const slug of slugs) {
          const quick = page.locator(`.quick-picks a[href^="/games/${slug}/"]`);
          await expect(quick).toBeInViewport();
          await expect(quick).toHaveAttribute(
            "href",
            `/games/${slug}/?lang=${lang}`,
          );
          const button = page.locator(
            `.game-card .play-link[href^="/games/${slug}/"]`,
          );
          const bounds = await button.boundingBox();
          expect(bounds!.height).toBeGreaterThanOrEqual(42);
          expect(
            await page
              .locator(`.preview img[src$="${slug}.png"]`)
              .evaluate(
                (e: HTMLImageElement) => e.complete && e.naturalWidth > 0,
              ),
          ).toBe(true);
        }
      }
});

test("keyboard navigation exposes focus and activates a game while preserving language", async ({
  page,
}) => {
  await page.goto("/?lang=ja");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  const quick = page.locator(".quick-picks a").first();
  await quick.focus();
  expect(
    await quick.evaluate((e) => getComputedStyle(e).outlineStyle),
  ).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/games\/orbit-ribbon\/\?lang=ja$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
});

test("portal text and play buttons meet WCAG AA contrast", async ({ page }) => {
  await page.goto("/?lang=en");
  const samples = await page.evaluate(() => {
    const rgb = (value: string) =>
      value
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number);
    const luminance = (value: string) =>
      rgb(value)
        .map((v) => {
          v /= 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    return [
      ".card-copy h3",
      ".game-type",
      ".game-tagline",
      ".card-facts",
      ".play-link",
      ".description",
      ".stage-list",
      ".hero-description",
    ].flatMap((selector) =>
      Array.from(document.querySelectorAll(selector)).map((e) => {
        const style = getComputedStyle(e);
        const bg = e.closest(".game-card")
          ? "rgb(23, 41, 50)"
          : e.closest(".world-detail")
            ? "rgb(22, 38, 46)"
            : "rgb(32, 57, 65)";
        const a = luminance(style.color),
          b = luminance(selector === ".play-link" ? style.backgroundColor : bg);
        return {
          selector,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      }),
    );
  });
  for (const sample of samples)
    expect(sample.ratio, sample.selector).toBeGreaterThanOrEqual(4.5);
});
