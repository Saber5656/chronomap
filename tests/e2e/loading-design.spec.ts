import { expect, test } from "@playwright/test";
import { stubUpstream } from "./stubs/network";

for (const colorScheme of ["light", "dark"] as const) {
  test(`keeps the ${colorScheme} brand stable while the application loads`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await stubUpstream(page);
    const applicationAssets = /\/assets\/index-[^/]+\.(js|css)$/;
    await page.route(applicationAssets, (route) => route.abort());
    await page.goto("/chronomap/");
    await expect(page.getByRole("status")).toHaveText("chronomap を読み込み中…");
    const readBrand = () =>
      page.locator(".app-brand").evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return {
          color: style.color,
          background: style.backgroundColor,
          fontSize: style.fontSize,
          radius: style.borderRadius,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        };
      });
    const loadingBrand = await readBrand();
    await page.unroute(applicationAssets);
    await page.reload();
    await expect(page.locator(".time-navigation__year")).toBeVisible();
    expect(await readBrand()).toEqual(loadingBrand);
  });
}
