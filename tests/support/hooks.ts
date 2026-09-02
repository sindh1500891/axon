import 'dotenv/config';
import { After, Before, BeforeStep, Status, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { HEADED_BROWSER_ARGS, maximizeBrowserWindow } from './browser-window';
import { config } from './config';
import { loadMcpSalesforceCredentials } from './mcp-credentials';
import {
  isSalesforceUrl,
  recoverIfSessionEnded,
  startSessionKeepAlive,
  stripSessionEndedOverlayInPage,
} from './session-guard';
import {
  ensureAuthDir,
  getChromeProfilePath,
  hasStoredSession,
  saveSession,
  sessionFileExists,
} from './session-storage';
import type { SalesforceWorld } from './world';

setDefaultTimeout(10 * 60 * 1000);

const PROFILE_LOCKED_MESSAGE =
  'Chrome session profile is locked. Close EVERY Chrome window from this Salesforce test (Task Manager → end chrome.exe if needed), then run again.';

Before(async function (this: SalesforceWorld) {
  if (!existsSync('reports')) {
    mkdirSync('reports', { recursive: true });
  }
  ensureAuthDir();

  const params = (this.parameters ?? {}) as { headed?: boolean };
  const headed = config.headed || Boolean(params.headed);

  try {
    this.mcpCredentials = loadMcpSalesforceCredentials();
  } catch {
    this.mcpCredentials = undefined;
  }

  const baseURL = this.mcpCredentials?.instanceUrl || config.baseUrl;
  const sharedOptions = {
    channel: 'chrome' as const,
    ignoreHTTPSErrors: true,
    viewport: headed ? null : { width: 1920, height: 1080 },
    baseURL,
    ignoreDefaultArgs: ['--enable-automation'],
  };

  if (config.reuseSession) {
    const profileDir = getChromeProfilePath();
    mkdirSync(profileDir, { recursive: true });

    try {
      this.context = await chromium.launchPersistentContext(profileDir, {
        ...sharedOptions,
        headless: !headed,
        args: [
          ...(headed ? HEADED_BROWSER_ARGS : []),
          '--disable-session-crashed-bubble',
          '--hide-crash-restore-bubble',
          '--disable-blink-features=AutomationControlled',
        ],
      });
    } catch (error) {
      throw new Error(`${PROFILE_LOCKED_MESSAGE}\n\n${String(error)}`);
    }

    this.persistentSession = true;
    this.browser = this.context.browser()!;
    this.page = this.context.pages()[0] ?? (await this.context.newPage());

    console.log(`\n>>> Using persistent Chrome profile (MFA bypass): ${profileDir}\n`);
    if (headed) {
      console.log(
        '\n>>> DEMO: close Salesforce in any other Chrome window. Two logins will trigger "Your session has ended".\n',
      );
    }
  } else {
    this.browser = await chromium.launch({
      channel: 'chrome',
      headless: !headed,
      ...(headed ? { args: HEADED_BROWSER_ARGS } : {}),
    });

    this.context = await this.browser.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
      viewport: headed ? null : { width: 1920, height: 1080 },
      ...(hasStoredSession() ? { storageState: config.storageStatePath } : {}),
    });
    this.page = await this.context.newPage();

    if (sessionFileExists() && !config.reuseSession) {
      console.log(
        `\n>>> Session file exists but REUSE_SESSION=false — using fresh login (set REUSE_SESSION=true to bypass MFA)\n`,
      );
    }
  }

  const bindPage = (page: typeof this.page) => {
    this.page = page;
    this.initPages();
    page.on('close', () => {
      const remaining = this.context.pages().find((p) => !p.isClosed());
      if (remaining) {
        console.log(`\n>>> Tab closed — switching to remaining tab: ${remaining.url()}\n`);
        bindPage(remaining);
      }
    });
  };

  bindPage(this.page);
  await this.context.addInitScript(stripSessionEndedOverlayInPage);
  await this.page.evaluate(stripSessionEndedOverlayInPage).catch(() => undefined);

  this.context.on('page', async (newPage) => {
    if (newPage === this.page) {
      return;
    }

    if (config.reuseSession) {
      await newPage.waitForLoadState('domcontentloaded', { timeout: 8_000 }).catch(() => undefined);
      console.log(`\n>>> Keeping tab (session mode): ${newPage.url()}\n`);
      if (this.page.isClosed()) {
        bindPage(newPage);
      }
      return;
    }

    const step = this.currentStep || '(before first step)';
    await newPage.waitForLoadState('domcontentloaded', { timeout: 8_000 }).catch(() => undefined);
    await newPage
      .waitForURL((url) => url.href !== 'about:blank' && url.href !== '', { timeout: 10_000 })
      .catch(() => undefined);
    const url = newPage.url();
    const keepForFlow =
      /submit for approval|return to quote|quality check|activate order/i.test(step) ||
      isSalesforceUrl(url);

    if (keepForFlow) {
      console.log(`\n>>> Keeping Salesforce tab during step "${step}": ${url}\n`);
      if (this.page.isClosed()) {
        bindPage(newPage);
      }
      return;
    }

    console.log(`\n>>> CLOSING stray tab during step "${step}": ${url}\n`);
    await newPage.close().catch(() => undefined);
    if (!this.page.isClosed()) {
      await this.page.bringToFront().catch(() => undefined);
    }
  });

  if (headed) {
    await maximizeBrowserWindow(this.page);
  }

  this.stopSessionKeepAlive = startSessionKeepAlive(() => this.page);
  this.page.setDefaultTimeout(15_000);
  this.initPages();
  this.sessionReused = false;
});

BeforeStep(async function (this: SalesforceWorld, { pickleStep }) {
  this.currentStep = pickleStep.text;
  await recoverIfSessionEnded(this.page).catch(() => undefined);
});

After(async function (this: SalesforceWorld, scenario) {
  this.stopSessionKeepAlive?.();

  if (config.saveSession && this.context && this.page && !this.page.isClosed()) {
    const loggedIn = await this.page
      .locator('.slds-global-header__item_search, .slds-global-header')
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);

    if (loggedIn) {
      await saveSession(this.context);
      console.log(`\n>>> Session saved (cookies + localStorage) to ${config.storageStatePath}\n`);
    }
  }

  if (scenario.result?.status === Status.FAILED) {
    await this.page.screenshot({
      path: `reports/${Date.now()}-failed.png`,
      fullPage: true,
    }).catch(() => undefined);
  }

  if (config.keepBrowserOpen && config.headed && !config.reuseSession) {
    console.log('\n>>> Browser left open for inspection. Close that Chrome window before the next run.\n');
    return;
  }

  if (config.keepBrowserOpen && config.headed && config.reuseSession && scenario.result?.status === Status.PASSED) {
    console.log('\n>>> Browser left open after a passing session run. Close it before the next run.\n');
    return;
  }

  await this.context?.close().catch(() => undefined);
  if (!this.persistentSession) {
    await this.browser?.close().catch(() => undefined);
  }
});
