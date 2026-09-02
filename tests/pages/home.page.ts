import { BasePage } from './base.page';
import type { Locator } from '@playwright/test';
import { recoverIfSessionEnded } from '../support/session-guard';

export class HomePage extends BasePage {
  private headerSearchArea() {
    return this.page.locator('.slds-global-header__item_search').first();
  }

  private globalSearchInput() {
    return this.page
      .locator('input[id^="global-search"]:visible')
      .or(this.page.locator('.slds-global-header input[type="search"]:visible'))
      .or(this.page.locator('.slds-global-header input[placeholder="Search..."]'))
      .or(this.page.locator('div.forceSearchInputDesktop input[placeholder="Search..."]'))
      .or(this.page.getByPlaceholder(/^Search\.\.\.$/i))
      .first();
  }

  private async focusGlobalSearch(): Promise<Locator> {
    await this.headerSearchArea().click({ force: true });
    const searchInput = this.globalSearchInput();
    await searchInput.waitFor({ state: 'visible', timeout: 30_000 });
    await searchInput.click({ force: true });
    await searchInput.focus();
    await this.page.waitForTimeout(300);
    return searchInput;
  }

  private async waitBeforeTyping(): Promise<void> {
    await this.page.waitForTimeout(5_000);
  }

  private async typeSearchTerm(searchTerm: string): Promise<void> {
    const searchInput = await this.focusGlobalSearch();

    await searchInput.fill('');
    await searchInput.pressSequentially(searchTerm, { delay: 80 });

    let typed = (await searchInput.inputValue()).trim();
    if (!typed.includes(searchTerm)) {
      await searchInput.fill(searchTerm);
      await searchInput.dispatchEvent('input');
      typed = (await searchInput.inputValue()).trim();
    }

    if (!typed.includes(searchTerm)) {
      throw new Error(`Expected "${searchTerm}" but search box has "${typed || '(empty)'}"`);
    }
  }

  private async clickHighlightedSearchResult(accountName: string): Promise<void> {
    await this.page.waitForTimeout(5_000);

    const searchPanel = this.page
      .locator(
        'div.forceSearchAssistant:visible, div.forceSearchInputDesktop:visible, div[class*="searchAssistant"]:visible',
      )
      .first();

    await searchPanel.waitFor({ state: 'visible', timeout: 20_000 });

    const accountLink = searchPanel
      .locator('a')
      .filter({ hasText: new RegExp(accountName, 'i') })
      .first();

    if (await accountLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await accountLink.scrollIntoViewIfNeeded();
      await accountLink.click({ force: true });
      await this.page.waitForTimeout(2_000);
      await recoverIfSessionEnded(this.page);
      await this.waitForLightning();
      return;
    }

    const firstResultLink = searchPanel.locator('li a, [role="option"] a, .forceSearchResult a').first();

    if (await firstResultLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstResultLink.click({ force: true });
      await this.page.waitForTimeout(2_000);
      await recoverIfSessionEnded(this.page);
      await this.waitForLightning();
      return;
    }

    const searchInput = this.globalSearchInput();
    await searchInput.focus();
    await this.page.keyboard.press('ArrowDown');
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2_000);
    await recoverIfSessionEnded(this.page);
    await this.waitForLightning();
  }

  private async clickAccountLinkInResults(accountName: string): Promise<void> {
    const accountLink = this.page.getByRole('link', { name: new RegExp(accountName, 'i') }).first();

    await accountLink.waitFor({ state: 'visible', timeout: 15_000 });
    await accountLink.click({ force: true });
    await this.page.waitForTimeout(2_000);
    await recoverIfSessionEnded(this.page);
    await this.waitForLightning();
  }

  async searchAndOpenAccount(searchTerm: string, accountName = 'Scottsdale Gun Club'): Promise<void> {
    await recoverIfSessionEnded(this.page);
    await this.waitBeforeTyping();
    await this.typeSearchTerm(searchTerm);
    await this.clickHighlightedSearchResult(accountName);
    await recoverIfSessionEnded(this.page);
  }

  async enterSearchTermInGlobalSearch(searchTerm: string, accountName = 'Scottsdale Gun Club'): Promise<void> {
    await this.waitBeforeTyping();
    await this.typeSearchTerm(searchTerm);
    await this.clickHighlightedSearchResult(accountName);
  }

  async openAccountFromSearchResults(accountName: string): Promise<void> {
    await this.clickAccountLinkInResults(accountName);
  }

  async verifyAxonHomePage(): Promise<void> {}

  async verifyLoggedIntoSalesforce(): Promise<void> {}

  async verifyAxonSalesAppDisplayed(): Promise<void> {}
}
