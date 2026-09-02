import 'dotenv/config';
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import readline from 'node:readline';

const LOGIN_URL =
  process.env.BASE_URL?.trim() || 'https://axon--test.sandbox.my.salesforce.com/';
const STORAGE_PATH = resolve(
  process.env.SESSION_STORAGE_PATH?.trim() || 'playwright/.auth/salesforce.json',
);
const PROFILE_DIR = resolve(
  process.env.CHROME_PROFILE_PATH?.trim() || 'playwright/.auth/chrome-profile',
);

function ensureAuthDir() {
  const dir = dirname(STORAGE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function waitForEnter(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function isLoggedIn(page) {
  return page
    .locator('.slds-global-header__item_search, .slds-global-header')
    .first()
    .isVisible({ timeout: 3_000 })
    .catch(() => false);
}

function getLightningHomeUrl(loginUrl) {
  const normalized = loginUrl.replace(/\/$/, '');

  if (/\.sandbox\.my\.salesforce\.com/i.test(normalized)) {
    return `${normalized.replace('.sandbox.my.salesforce.com', '.sandbox.lightning.force.com')}/lightning/page/home`;
  }

  if (/\.my\.salesforce\.com/i.test(normalized)) {
    return `${normalized.replace('.my.salesforce.com', '.lightning.force.com')}/lightning/page/home`;
  }

  return `${normalized}/lightning/page/home`;
}

async function dismissSessionEndedIfPresent(page) {
  const button = page.getByRole('button', { name: /return to page/i }).first();
  if (await button.isVisible({ timeout: 2_000 }).catch(() => false)) {
    console.log('\nSession-ended dialog found during save — clicking Return to Page');
    await button.click({ force: true });
    await page.waitForTimeout(2_000);
  }
}

async function prepareSessionForSave(page) {
  const lightningHome = getLightningHomeUrl(LOGIN_URL);
  console.log(`\nOpening Lightning home to capture localStorage: ${lightningHome}`);

  await page.goto(lightningHome, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await dismissSessionEndedIfPresent(page);
  await page
    .locator('.slds-global-header__item_search, .slds-global-header')
    .first()
    .waitFor({ state: 'visible', timeout: 60_000 })
    .catch(() => undefined);
  await page.waitForTimeout(3_000);
}

function summarizeStorageState(storagePath) {
  try {
    const state = JSON.parse(readFileSync(storagePath, 'utf-8'));
    const cookieCount = state.cookies?.length ?? 0;
    const originCount = state.origins?.length ?? 0;
    const localStorageCount =
      state.origins?.reduce((total, origin) => total + (origin.localStorage?.length ?? 0), 0) ?? 0;

    console.log(`  Cookies saved      : ${cookieCount}`);
    console.log(`  Origins saved      : ${originCount}`);
    console.log(`  localStorage items : ${localStorageCount}`);
  } catch {
    // Ignore summary errors.
  }
}

async function main() {
  ensureAuthDir();

  console.log('\n=== Save Salesforce session (bypass MFA on future runs) ===\n');
  console.log(`Login URL : ${LOGIN_URL}`);
  console.log(`Profile   : ${PROFILE_DIR}`);
  console.log(`Save path : ${STORAGE_PATH}`);
  console.log('\nIMPORTANT: Close every other Chrome window logged into this sandbox first.');
  console.log('\nSteps:');
  console.log('  1. Chrome opens — log in manually (username, password, MFA if required).');
  console.log('  2. Wait until Axon Sales / Lightning home is fully loaded.');
  console.log('  3. Return here and press Enter.');
  console.log('  4. Set REUSE_SESSION=true in .env');
  console.log('  5. Run: npm run test:headed:scottsdale:session\n');

  mkdirSync(PROFILE_DIR, { recursive: true });

  let context;
  try {
    context = await chromium.launchPersistentContext(PROFILE_DIR, {
      channel: 'chrome',
      headless: false,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--start-maximized',
        '--disable-session-crashed-bubble',
        '--hide-crash-restore-bubble',
        '--disable-blink-features=AutomationControlled',
      ],
      baseURL: LOGIN_URL.replace(/\/$/, ''),
      ignoreHTTPSErrors: true,
      viewport: null,
    });
  } catch (error) {
    console.error(
      '\nChrome profile is locked. Close ALL Chrome windows from this test (Task Manager → chrome.exe), then run npm run session:save again.\n',
    );
    console.error(error);
    process.exit(1);
  }

  const page = context.pages()[0] || (await context.newPage());
  try {
    const cdp = await context.newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'maximized' },
    });
  } catch {
    // Ignore if CDP maximize is unavailable.
  }

  await page.goto(LOGIN_URL, { waitUntil: 'load', timeout: 120_000 });

  await waitForEnter('Press Enter after you are on Salesforce home (MFA complete)... ');

  await dismissSessionEndedIfPresent(page);
  await prepareSessionForSave(page);

  if (!(await isLoggedIn(page))) {
    console.error(
      '\nCould not see the Axon Sales header. Session was NOT saved.\nStay on Lightning home (search bar visible), then run npm run session:save again.\n',
    );
    await context.close().catch(() => undefined);
    process.exit(1);
  }

  await context.storageState({ path: STORAGE_PATH, indexedDB: true });
  console.log(`\nSession saved to ${STORAGE_PATH}`);
  console.log(`Chrome profile kept at ${PROFILE_DIR}`);
  console.log('Saved: cookies, localStorage, sessionStorage, indexedDB');
  summarizeStorageState(STORAGE_PATH);
  console.log('\nNext steps:');
  console.log('  1. Add to .env:  REUSE_SESSION=true');
  console.log('  2. Run test:     npm run test:headed:scottsdale:session\n');

  await context.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
