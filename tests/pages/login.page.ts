import type { Frame, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { config } from '../support/config';
import { fetchJwtAccessToken, frontDoorUrl } from '../support/jwt-auth';
import { lightningHomeUrl } from '../support/session-storage';
import { dismissSessionEndedIfPresent } from '../support/session-guard';
import { BasePage } from './base.page';

export const AXON_MY_DOMAIN_URL = 'https://axon--test.sandbox.my.salesforce.com/';

export class LoginPage extends BasePage {
  private loginFrame: Page | Frame | null = null;

  constructor(page: Page) {
    super(page);
  }

  private scope(): Page | Frame {
    return this.loginFrame ?? this.page;
  }

  private usernameInput() {
    const root = this.scope();
    return root
      .getByLabel(/^username$/i)
      .or(root.locator('#username'))
      .or(root.locator('input[name="username"]'))
      .first();
  }

  private passwordInput() {
    const root = this.scope();
    return root
      .getByLabel(/^password$/i)
      .or(root.locator('#password'))
      .or(root.locator('input[name="pw"]'))
      .or(root.locator('input[type="password"]'))
      .first();
  }

  private verificationCodeInput() {
    return this.page
      .getByLabel(/verification code/i)
      .or(this.page.getByPlaceholder(/verification code|enter code|one-time/i))
      .or(this.page.locator('input[name*="code"], input[id*="code"]'))
      .first();
  }

  private logInToSandboxButton() {
    const root = this.scope();
    return root
      .getByRole('button', { name: /^log in to sandbox$/i })
      .or(root.getByRole('button', { name: /login into salesforce/i }))
      .or(root.locator('#Login'))
      .or(root.getByRole('button', { name: /^log in$/i }))
      .first();
  }

  async open(loginUrl = AXON_MY_DOMAIN_URL): Promise<void> {
    await this.page.goto(loginUrl, { waitUntil: 'load', timeout: 120_000 });
    await this.resolveLoginContext();
    await expect(this.usernameInput()).toBeVisible({ timeout: 60_000 });
    await expect(this.logInToSandboxButton()).toBeVisible({ timeout: 30_000 });
  }

  async openHome(): Promise<void> {
    const lightningHome = lightningHomeUrl(config.baseUrl);

    await this.page.goto(lightningHome, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await this.page.waitForTimeout(3_000);
    await dismissSessionEndedIfPresent(this.page);

    if (await this.isLightningHeaderVisible()) {
      return;
    }

    if (await this.isLoginPageVisible()) {
      console.log('\n>>> Login page shown — opening Lightning home with the saved session instead of MFA\n');
      await this.page.goto(lightningHome, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await this.page.waitForTimeout(3_000);
    }

    await this.page
      .locator('.slds-global-header__item_search, .slds-global-header')
      .first()
      .waitFor({ state: 'visible', timeout: 45_000 })
      .catch(() => undefined);

    if (!(await this.isLightningHeaderVisible())) {
      throw this.sessionExpiredError();
    }
  }

  private async isLightningHeaderVisible(): Promise<boolean> {
    return this.page
      .locator('.slds-global-header__item_search, .slds-global-header')
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
  }

  async isLoggedIn(): Promise<boolean> {
    if (this.page.isClosed()) {
      return false;
    }

    if (await this.isLoginPageVisible()) {
      return false;
    }

    const headerVisible = await this.page
      .locator('.slds-global-header__item_search, .slds-global-header')
      .first()
      .isVisible({ timeout: 1_000 })
      .catch(() => false);

    if (headerVisible) {
      return true;
    }

    const url = this.page.url();
    return /lightning\.force\.com|\.my\.salesforce\.com\/lightning/i.test(url);
  }

  private async isLoginPageVisible(): Promise<boolean> {
    return this.usernameInput()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
  }

  private sessionExpiredError(): Error {
    return new Error(
      'Saved session expired or was logged out. Close other Chrome windows using this sandbox, then run: npm run session:save — log in once (with MFA) and press Enter.',
    );
  }

  private async resolveLoginContext(): Promise<void> {
    this.loginFrame = null;

    if (
      (await this.usernameInput().isVisible({ timeout: 2_000 }).catch(() => false)) ||
      (await this.passwordInput().isVisible({ timeout: 2_000 }).catch(() => false))
    ) {
      return;
    }

    for (const frame of this.page.frames()) {
      const hasUsername = await frame
        .getByLabel(/^username$/i)
        .or(frame.locator('#username'))
        .first()
        .isVisible({ timeout: 1_000 })
        .catch(() => false);
      const hasPassword = await frame
        .getByLabel(/^password$/i)
        .or(frame.locator('input[type="password"]'))
        .first()
        .isVisible({ timeout: 1_000 })
        .catch(() => false);

      if (hasUsername || hasPassword) {
        this.loginFrame = frame;
        return;
      }
    }
  }

  async enterUsername(username: string): Promise<void> {
    if (!username.trim()) {
      throw new Error('Username is empty');
    }

    const field = this.usernameInput();
    await field.scrollIntoViewIfNeeded();
    await field.click({ timeout: 30_000 });
    await field.fill(username, { timeout: 30_000 });
    await expect(field).toHaveValue(username, { timeout: 10_000 });
  }

  async clickLogInToSandbox(): Promise<void> {
    const button = this.logInToSandboxButton();
    await expect(button).toBeVisible({ timeout: 30_000 });
    await button.click({ timeout: 30_000 });
    await this.page.waitForLoadState('domcontentloaded');
    await this.resolveLoginContext();
  }

  async clickLoginIntoSalesforce(): Promise<void> {
    await this.clickLogInToSandbox();
  }

  async waitForPasswordScreen(): Promise<void> {
    await expect(this.passwordInput()).toBeVisible({ timeout: 60_000 });
  }

  async prepareForPasswordEntry(username?: string): Promise<void> {
    await this.resolveLoginContext();
    await this.waitForPasswordScreen();

    const usernameField = this.usernameInput();
    const usernameVisible = await usernameField.isVisible({ timeout: 5_000 }).catch(() => false);

    if (usernameVisible) {
      await usernameField.scrollIntoViewIfNeeded();
      await usernameField.click({ timeout: 30_000 });

      if (username?.trim()) {
        const currentValue = await usernameField.inputValue();
        if (currentValue.trim() !== username.trim()) {
          await usernameField.fill(username, { timeout: 30_000 });
          await expect(usernameField).toHaveValue(username, { timeout: 10_000 });
        }
      }

      await this.page.keyboard.press('Tab');
      return;
    }

    const passwordField = this.passwordInput();
    await passwordField.scrollIntoViewIfNeeded();
    await passwordField.click({ timeout: 30_000 });
  }

  async enterPassword(password: string): Promise<void> {
    if (!password.trim()) {
      throw new Error('Password is empty');
    }

    const field = this.passwordInput();
    await expect(field).toBeVisible({ timeout: 30_000 });
    await field.scrollIntoViewIfNeeded();
    await field.click({ timeout: 30_000 });
    await field.fill(password, { timeout: 30_000 });
    await expect(field).not.toHaveValue('', { timeout: 10_000 });
  }

  async isVerificationPromptVisible(): Promise<boolean> {
    const hasVerificationText = await this.page
      .getByText(/verify your identity|verification code|one-time password|authenticator app/i)
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);

    const hasVerificationInput = await this.verificationCodeInput()
      .isVisible({ timeout: 500 })
      .catch(() => false);

    return hasVerificationText || hasVerificationInput;
  }

  async waitForVerificationCodeIfPrompted(
    timeoutMs = config.verificationTimeoutMs,
  ): Promise<boolean> {
    if (config.alwaysPromptVerification) {
      console.log(
        '\n>>> Enter verification code in the browser if prompted.\n',
      );
    }

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.isLoggedIn()) {
        console.log('\n>>> Login complete — proceeding to search.\n');
        return true;
      }

      await this.page.waitForTimeout(500);
    }

    return this.isLoggedIn();
  }

  async waitAfterLogin(): Promise<void> {
    // No post-login wait.
  }

  /** Logs in via the JWT Bearer Flow, bridging the OAuth token to a Lightning session via frontdoor.jsp. */
  async loginViaJwt(): Promise<void> {
    const token = await fetchJwtAccessToken();
    await this.page.goto(frontDoorUrl(token.instance_url, token.access_token), {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });

    await this.page
      .locator('.slds-global-header__item_search, .slds-global-header')
      .first()
      .waitFor({ state: 'visible', timeout: 45_000 });
  }

  async loginTwoStep(username: string, password: string): Promise<void> {
    await this.open(AXON_MY_DOMAIN_URL);
    await this.enterUsername(username);
    await this.clickLogInToSandbox();
    await this.prepareForPasswordEntry(username);
    await this.enterPassword(password);
    await this.clickLogInToSandbox();
    await this.waitForVerificationCodeIfPrompted();
  }
}
