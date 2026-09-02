import { Then, When } from '@cucumber/cucumber';
import type { SalesforceWorld } from '../support/world';

When(
  'Click global search and enter the account name as {string}',
  async function (this: SalesforceWorld, accountName: string) {
    await this.page.goto('/lightning/page/home', { waitUntil: 'domcontentloaded' });
    const globalSearch = this.page
      .locator('input[id^="global-search"]:visible')
      .or(this.page.locator('.slds-global-header input[type="search"]:visible'))
      .or(this.page.getByPlaceholder(/^Search\.\.\.$/i))
      .first();
    await globalSearch.click();
    await this.page.keyboard.press('Control+A');
    await globalSearch.fill(accountName);
   // await this.page.keyboard.press('Enter');
  },
);

When('Click Related tab', async function (this: SalesforceWorld) {
  await this.accountPage.openAccountFromSearch(/scottsdale.*gun.*club/i);
  await this.accountPage.openRelatedTab();
});

Then('Click New button from the opportunity related tab', async function (this: SalesforceWorld) {
  await this.accountPage.clickNewOpportunity();
});
