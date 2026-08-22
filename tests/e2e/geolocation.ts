import type { Page } from "@playwright/test";

/** Set the browser context's deterministic geolocation fix for a page. */
export async function setFix(
  page: Page,
  lat: number,
  lng: number,
  accuracy: number,
): Promise<void> {
  await page.context().setGeolocation({ latitude: lat, longitude: lng, accuracy });
}
