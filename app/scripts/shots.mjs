/**
 * Снимки интерфейса для README. Скрипт рассчитан на уже запущенное приложение:
 *
 *   SHOTS_URL=http://localhost:4321/ node scripts/shots.mjs
 *   SHOTS_URL=http://localhost:4321/bi-dwh-showcase/ node scripts/shots.mjs
 *
 * Playwright не входит в рантайм приложения: `npm i -D playwright` и
 * `npx playwright install chromium`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const url = process.env.SHOTS_URL || 'http://localhost:4321/';
const outDir = path.join(import.meta.dirname, '..', '..', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];

page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

async function shot(name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, name) });
  console.log(`saved ${name}`);
}

await page.goto(url, { waitUntil: 'networkidle' });
await page.locator('.rating-row').first().waitFor();
await page.waitForTimeout(400);
await shot('overview.png');

await page.locator('.period-btn').click();
await page.locator('.calendar-popover').waitFor();
await shot('calendar.png');
await page.keyboard.press('Escape');

const drill = page.locator('.rating-row', { hasText: 'Управление операций' });
if (await drill.count()) {
  await drill.first().click();
  await page.waitForTimeout(350);
  await shot('drilldown.png');
  await page.locator('.rating-col .back').click();
  await page.waitForTimeout(250);
}

await page.locator('button.stat-card').nth(4).click();
await page.locator('.overlay-panel').waitFor();
await shot('overlay.png');

await page.locator('.overlay-body tbody .link-button').first().click();
await page.waitForTimeout(350);
await shot('employee-days.png');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');

await page.locator('.summary-panel').scrollIntoViewIfNeeded();
await shot('summary.png');

await browser.close();

if (errors.length > 0) {
  console.error('Browser errors:');
  for (const error of errors.slice(0, 10)) console.error(' -', error);
  process.exitCode = 1;
}
