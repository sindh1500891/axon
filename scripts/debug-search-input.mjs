import 'dotenv/config';
import { chromium } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';

const STORAGE = 'playwright/.auth/salesforce.json';
const BASE = process.env.BASE_URL || 'https://axon--test.sandbox.my.salesforce.com';

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    baseURL: BASE,
    storageState: existsSync(STORAGE) ? STORAGE : undefined,
  });
  const page = await context.newPage();
  await page.goto('/lightning/page/home', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(10_000);

  const inputs = await page.locator('input').evaluateAll((els) =>
    els.map((el) => ({
      placeholder: el.getAttribute('placeholder'),
      type: el.getAttribute('type'),
      className: el.className,
      visible: (el as HTMLElement).offsetParent !== null,
      parentClass: el.parentElement?.className?.slice(0, 80) ?? '',
    })),
  );

  console.log('URL:', page.url());
  console.log('Inputs:', JSON.stringify(inputs.filter((i) => i.placeholder?.toLowerCase().includes('search')), null, 2));

  await browser.close();
}

main().catch(console.error);
