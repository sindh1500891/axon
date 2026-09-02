import type { Page } from '@playwright/test';
import { recoverIfSessionEnded } from '../support/session-guard';

export class BasePage {
  constructor(protected readonly page: Page) {}

  async waitForLightning(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await recoverIfSessionEnded(this.page);
    await this.page
      .locator('.slds-global-header, one-appnav, .oneHeader')
      .first()
      .waitFor({ state: 'visible', timeout: 60_000 })
      .catch(() => undefined);
    await recoverIfSessionEnded(this.page);
  }
}
