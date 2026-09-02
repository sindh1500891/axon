import type { Frame, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { recoverIfSessionEnded, reloadLightningRecordIfStuck } from '../support/session-guard';
import { BasePage } from './base.page';

export class AccountPage extends BasePage {
  lastOpportunityName = '';

  constructor(page: Page) {
    super(page);
  }

  async openAccountFromSearch(accountNamePattern: RegExp): Promise<void> {
    const accountLink = this.page.getByRole('link', { name: accountNamePattern }).first();
    await accountLink.waitFor({ state: 'visible', timeout: 60_000 });
    await accountLink.click();
    await this.waitForLightning();
  }

  async openRelatedTab(): Promise<void> {
    await recoverIfSessionEnded(this.page);
    await this.waitForLightning();

    const recordTabs = this.page.locator('.slds-tabs_default__nav, [role="tablist"]').first();

    const relatedTab = recordTabs
      .locator('a[data-tab-value="relatedListsTab"], a[data-label="Related"]')
      .filter({ visible: true })
      .or(this.page.locator('a#relatedListsTab__item').filter({ visible: true }))
      .or(this.page.getByRole('tab', { name: /^related$/i }).filter({ visible: true }))
      .first();

    await expect(relatedTab).toBeVisible({ timeout: 30_000 });
    await relatedTab.scrollIntoViewIfNeeded();
    await relatedTab.click({ force: true });
    await this.waitForLightning();
  }

  async clickNewButton(): Promise<void> {
    await recoverIfSessionEnded(this.page);
    await this.page.waitForTimeout(10_000);

    const opportunitiesSection = this.page
      .locator('article, section, div')
      .filter({ has: this.page.getByText(/^opportunities/i) })
      .first();

    const newButton = opportunitiesSection
      .getByRole('button', { name: /^new$/i })
      .or(this.page.getByRole('button', { name: /^new$/i }))
      .first();

    await expect(newButton).toBeVisible({ timeout: 30_000 });
    await newButton.click();
  }

  async clickNewOpportunity(): Promise<void> {
    await this.clickNewButton();
  }

  async clickNextOnNewOpportunityModal(): Promise<void> {
    const modal = this.page
      .locator('[role="dialog"], .slds-modal')
      .filter({ hasText: /new opportunity|select a record type/i });

    await expect(modal).toBeVisible({ timeout: 30_000 });

    const firstRecordType = modal.locator('input[type="radio"]').first();
    if (await firstRecordType.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await firstRecordType.check({ force: true }).catch(() => firstRecordType.click({ force: true }));
    }

    const nextButton = modal.getByRole('button', { name: /^next$/i });
    await expect(nextButton).toBeVisible({ timeout: 15_000 });
    await expect(nextButton).toBeEnabled({ timeout: 15_000 });
    await nextButton.click();
  }

  private newOpportunityForm() {
    return this.page
      .locator('[role="dialog"], .slds-modal, .uiModal')
      .filter({ hasText: /new opportunity/i })
      .first();
  }

  async selectCloseDateToday(): Promise<void> {
    const form = this.newOpportunityForm();
    await expect(form).toBeVisible({ timeout: 30_000 });

    const closeDateField = form
      .locator('input[name="CloseDate"]')
      .or(form.locator('#CloseDate'))
      .or(form.getByLabel(/^close date$/i))
      .or(form.locator('lightning-input').filter({ hasText: /^close date$/i }).locator('input'))
      .or(form.getByRole('textbox', { name: /close date/i }))
      .first();

    await expect(closeDateField).toBeVisible({ timeout: 15_000 });
    await closeDateField.click();
    await closeDateField.fill('');

    const today = this.formatTodayDate();
    await closeDateField.pressSequentially(today, { delay: 50 });

    let typed = (await closeDateField.inputValue()).trim();
    if (!typed.includes(today)) {
      await closeDateField.fill(today);
      typed = (await closeDateField.inputValue()).trim();
    }

    await closeDateField.press('Tab');

    if (!typed.includes(today)) {
      throw new Error(`Expected Close Date "${today}" but field has "${typed || '(empty)'}"`);
    }
  }

  async selectStage(stageValue: string): Promise<void> {
    await this.selectPicklist('Stage', stageValue);
  }

  async selectType(typeValue: string): Promise<void> {
    await this.selectPicklist('Type', typeValue);
  }

  private async selectPicklist(fieldName: string, value: string): Promise<void> {
    const form = this.newOpportunityForm();
    await expect(form).toBeVisible({ timeout: 30_000 });

    const field = form
      .locator('lightning-combobox')
      .filter({ has: form.getByText(new RegExp(`^${fieldName}$`, 'i')) })
      .locator('button[aria-haspopup="listbox"]')
      .or(form.getByLabel(new RegExp(`^${fieldName}$`, 'i')))
      .or(form.getByRole('combobox', { name: new RegExp(`^${fieldName}$`, 'i') }))
      .or(form.locator('lightning-combobox').filter({ hasText: new RegExp(`^${fieldName}$`, 'i') }).locator('button'))
      .first();

    await expect(field).toBeVisible({ timeout: 15_000 });
    await field.click();

    const option = this.page
      .locator('lightning-base-combobox-item')
      .filter({ has: this.page.locator(`span[title="${value}"]`) })
      .or(this.page.locator(`lightning-base-combobox-item span[title="${value}"]`))
      .or(this.page.getByRole('option', { name: new RegExp(`^${value}$`, 'i') }))
      .or(this.page.locator('.slds-listbox__option').filter({ hasText: new RegExp(`^${value}$`, 'i') }))
      .first();

    await expect(option).toBeVisible({ timeout: 10_000 });
    await option.click();
  }

  async selectPrimaryContact(contactName: string): Promise<void> {
    const form = this.newOpportunityForm();
    await expect(form).toBeVisible({ timeout: 30_000 });

    const contactField = form
      .getByLabel(/^primary contact$/i)
      .or(form.getByPlaceholder(/search contacts/i))
      .or(form.locator('lightning-lookup').filter({ hasText: /primary contact/i }).locator('input'))
      .or(form.getByRole('combobox', { name: /primary contact/i }))
      .or(form.getByRole('textbox', { name: /primary contact/i }))
      .first();

    await expect(contactField).toBeVisible({ timeout: 15_000 });
    await contactField.click();
    await contactField.pressSequentially(contactName, { delay: 50 });

    let typed = (await contactField.inputValue()).trim();
    if (!typed.toLowerCase().includes(contactName.toLowerCase())) {
      await contactField.fill(contactName);
    }

    const lookupResult = this.page
      .locator('.slds-listbox, [role="listbox"], lightning-base-combobox')
      .getByRole('option', { name: new RegExp(contactName, 'i') })
      .or(this.page.locator('.slds-listbox__option').filter({ hasText: new RegExp(`^${contactName}$`, 'i') }))
      .or(this.page.getByTitle(new RegExp(`^${contactName}$`, 'i')))
      .first();

    await expect(lookupResult).toBeVisible({ timeout: 15_000 });
    await lookupResult.click();
  }

  private cooperativeContractInput() {
    const form = this.newOpportunityForm();
    return form
      .getByLabel(/^cooperative contract$/i)
      .or(form.getByPlaceholder(/search cooperative contract/i))
      .or(form.locator('lightning-lookup, lightning-grouped-combobox').filter({ hasText: /cooperative contract/i }).locator('input'))
      .or(form.getByRole('combobox', { name: /cooperative contract/i }))
      .or(form.getByRole('textbox', { name: /cooperative contract/i }))
      .first();
  }

  async clickCooperativeContractField(): Promise<void> {
    const form = this.newOpportunityForm();
    await expect(form).toBeVisible({ timeout: 30_000 });

    const field = this.cooperativeContractInput();
    await field.scrollIntoViewIfNeeded();
    await this.highlightElement(field);
    await this.page.waitForTimeout(300);
    await field.click();
    console.log('>>> Clicked Cooperative Contract field');
  }

  async enterCooperativeContract(value: string): Promise<void> {
    const field = this.cooperativeContractInput();
    await field.click();
    await field.fill('');
    await field.pressSequentially(value, { delay: 50 });

    const typed = (await field.inputValue()).trim();
    if (typed.toLowerCase() !== value.toLowerCase()) {
      await field.fill(value);
    }
    console.log(`>>> Entered "${value}" in Cooperative Contract`);
  }

  async selectCooperativeContractResult(value: string): Promise<void> {
    const lookupResult = this.page
      .locator('.slds-listbox, [role="listbox"], lightning-base-combobox')
      .getByRole('option', { name: new RegExp(`^${value}$`, 'i') })
      .or(this.page.locator('.slds-listbox__option').filter({ hasText: new RegExp(`^${value}$`, 'i') }))
      .or(this.page.getByTitle(new RegExp(`^${value}$`, 'i')))
      .or(this.page.locator('[role="option"]').filter({ hasText: new RegExp(`^${value}$`, 'i') }))
      .first();

    await this.highlightElement(lookupResult);
    await lookupResult.click();
    console.log(`>>> Selected "${value}" from Cooperative Contract search results`);
  }

  async appendTodayDateTimeToOpportunityName(): Promise<void> {
    const form = this.newOpportunityForm();
    await expect(form).toBeVisible({ timeout: 30_000 });

    const nameField = form
      .getByLabel(/^opportunity name$/i)
      .or(form.getByLabel(/^name$/i))
      .or(form.getByRole('textbox', { name: /^(opportunity )?name$/i }))
      .first();

    await expect(nameField).toBeVisible({ timeout: 15_000 });

    const currentName = (await nameField.inputValue()).trim();
    const timestamp = this.formatTodayDateTime();
    const updatedName = currentName ? `${currentName} ${timestamp}` : timestamp;

    await nameField.click();
    await nameField.fill(updatedName);
    await expect(nameField).toHaveValue(updatedName, { timeout: 10_000 });
    this.lastOpportunityName = updatedName;
  }

  private formatTodayDate(): string {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear();

    return `${month}/${day}/${year}`;
  }

  private formatTodayDateTime(): string {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
  }

  async clickSaveButton(): Promise<void> {
    const form = this.newOpportunityForm();
    const saveButton = form
      .getByRole('button', { name: /^save$/i })
      .or(this.page.getByRole('button', { name: /^save$/i }))
      .first();

    await expect(saveButton).toBeVisible({ timeout: 15_000 });
    await expect(saveButton).toBeEnabled({ timeout: 15_000 });
    await saveButton.click();

    const toast = this.page
      .locator('.slds-notify, .forceToastMessage, .toastContainer, .slds-notify_toast')
      .filter({ hasText: /created/i })
      .first();
    await toast.waitFor({ state: 'attached', timeout: 30_000 }).catch(() => undefined);
    await this.page.waitForTimeout(1_000);

    await recoverIfSessionEnded(this.page);

    const toastLink = this.page
      .locator('.slds-notify a, .forceToastMessage a, .toastMessage a, .toastContainer a')
      .filter({ hasText: /scottsdale|opportunity|q-/i })
      .or(this.page.getByRole('link', { name: /scottsdale gun club/i }))
      .first();

    if ((await toastLink.count().catch(() => 0)) > 0) {
      await toastLink.click({ force: true, timeout: 10_000 }).catch(() => undefined);
      console.log('>>> Clicked success toast to open the saved Opportunity');
    } else if (this.lastOpportunityName) {
      const namedLink = this.page.getByRole('link', { name: new RegExp(this.lastOpportunityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
      await namedLink.click({ force: true, timeout: 5_000 }).catch(() => undefined);
    }

    await this.page.keyboard.press('Escape').catch(() => undefined);
    await recoverIfSessionEnded(this.page);
    await this.waitForLightning();
    await this.newOpportunityForm().waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => undefined);
  }

  async clickOpportunityActionsDropdown(): Promise<void> {
    await this.waitForLightning();

    const actionsArrow = this.page
      .locator('runtime_platform_actions-actions-ribbon lightning-button-menu button[aria-haspopup="true"]')
      .or(this.page.locator('records-lwc-highlights-panel lightning-button-menu button[aria-haspopup="true"]'))
      .or(
        this.page
          .locator('.slds-page-header')
          .filter({ has: this.page.getByRole('button', { name: /^edit$/i }) })
          .locator('lightning-button-menu button[aria-haspopup="true"]'),
      )
      .filter({ visible: true })
      .first();

    await actionsArrow.waitFor({ state: 'visible', timeout: 30_000 });
    await actionsArrow.scrollIntoViewIfNeeded();
    await actionsArrow.click({ force: true });
  }

  async clickNewQuote(): Promise<void> {
    const newQuoteOption = this.page
      .getByRole('menuitem', { name: /^new quote$/i })
      .or(this.page.locator('lightning-menu-item').filter({ hasText: /^new quote$/i }))
      .or(this.page.locator('.slds-dropdown__item, .slds-listbox__option').filter({ hasText: /^new quote$/i }))
      .or(this.page.getByText(/^new quote$/i))
      .first();

    await expect(newQuoteOption).toBeVisible({ timeout: 15_000 });
    await newQuoteOption.click();
    await this.waitForLightning();
  }

  private newQuoteForm() {
    return this.page
      .locator('.slds-modal:visible, [role="dialog"]:visible, .uiModal:visible')
      .filter({ hasText: /new quote/i })
      .first();
  }

  async clickNewQuoteSaveButton(): Promise<void> {
    const modal = this.newQuoteForm();
    const footer = modal.locator('.slds-modal__footer, .modal-footer').first();

    await footer
      .locator('button.slds-button_brand')
      .filter({ hasText: /^save$/i })
      .or(footer.getByRole('button', { name: /^save$/i }))
      .first()
      .click({ force: true });
  }

  async clickShowAllRelatedListQuickLinks(): Promise<void> {
    await this.page.waitForTimeout(10_000);

    const showAllLink = this.page
      .locator('div.rlql-toggle a, .rlql-toggle.slds-text-align_center a')
      .filter({ hasText: /show all \(\d+\)/i })
      .or(this.page.getByRole('link', { name: /show all \(\d+\)/i }))
      .or(
        this.page.locator(
          'xpath=//div[contains(@class,"rlql-toggle")]/a[contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"show all")]',
        ),
      )
      .filter({ visible: true })
      .first();

    await showAllLink.waitFor({ state: 'attached', timeout: 60_000 });
    await showAllLink.scrollIntoViewIfNeeded({ timeout: 30_000 }).catch(() => undefined);
    await this.highlightElement(showAllLink);
    await this.page.waitForTimeout(2_000);
    await showAllLink.click({ force: true, timeout: 30_000 });
  }

  private async highlightElement(element: Locator): Promise<void> {
    await element
      .evaluate((el) => {
        const node = el as HTMLElement;
        node.style.outline = '4px solid #ff0000';
        node.style.backgroundColor = '#ffff00';
        node.style.boxShadow = '0 0 12px 4px #ff0000';
      })
      .catch(() => undefined);
  }

  async clickQuotesQuickLink(): Promise<void> {
    await this.waitForLightning();

    const quickLinksSection = this.page
      .locator('article, section, div, flexipage-component2')
      .filter({ hasText: /related list quick links/i })
      .first();

    const quotesLink = quickLinksSection
      .getByRole('link', { name: /quotes \(\d+\)/i })
      .or(quickLinksSection.getByText(/^quotes \(\d+\)$/i))
      .or(this.page.getByRole('link', { name: /quotes \(\d+\)/i }))
      .first();

    await expect(quotesLink).toBeVisible({ timeout: 30_000 });
    await quotesLink.click();
    await this.waitForLightning();
  }

  async scrollToOrdersQuickLink(): Promise<void> {
    const ordersLink = this.ordersQuickLink();
    await ordersLink.waitFor({ state: 'visible', timeout: 30_000 });
    await ordersLink.scrollIntoViewIfNeeded();
    await this.highlightElement(ordersLink);
    console.log('>>> Scrolled to Orders in Related List Quick Links');
  }

  async clickOrdersQuickLink(): Promise<void> {
    const ordersLink = this.ordersQuickLink();
    await ordersLink.waitFor({ state: 'visible', timeout: 30_000 });
    await ordersLink.scrollIntoViewIfNeeded();
    await this.highlightElement(ordersLink);
    await this.page.waitForTimeout(500);
    await ordersLink.click({ force: true, timeout: 30_000 });
    await this.waitForLightning();
    console.log('>>> Clicked Orders in Related List Quick Links');
  }

  private ordersQuickLink(): Locator {
    const quickLinksSection = this.page
      .locator('article, section, div, flexipage-component2')
      .filter({ hasText: /related list quick links/i })
      .first();

    return quickLinksSection
      .getByRole('link', { name: /^orders \(\d+\)$/i })
      .or(quickLinksSection.getByText(/^orders \(\d+\)$/i))
      .or(this.page.getByRole('link', { name: /^orders \(\d+\)$/i }))
      .or(this.page.locator('a, span, lightning-formatted-text').filter({ hasText: /^orders \(\d+\)$/i }))
      .filter({ visible: true })
      .first();
  }

  async clickOrderNumberLink(): Promise<string> {
    await this.waitForLightning();

    const ordersList = this.page
      .locator('lst-related-list-view, lst-list-view-manager, force-list-view-manager, lightning-datatable, .listViewContainer')
      .filter({ hasText: /order number/i })
      .first();

    const orderLink = ordersList
      .locator('tbody a[href*="/Order/"], tbody a[href*="/lightning/r/Order/"]')
      .filter({ hasText: /^\d+$/ })
      .or(ordersList.getByRole('link', { name: /^\d+$/ }))
      .or(this.page.locator('lightning-datatable tbody a, .slds-table tbody a').filter({ hasText: /^\d+$/ }))
      .or(this.page.locator('a[href*="/lightning/r/Order/"]').filter({ hasText: /^\d+$/ }))
      .filter({ visible: true })
      .first();

    await expect(orderLink).toBeVisible({ timeout: 30_000 });
    const orderNumber = (await orderLink.innerText()).trim();

    await orderLink.scrollIntoViewIfNeeded();
    await this.highlightElement(orderLink);
    await this.page.waitForTimeout(500);
    await orderLink.click({ force: true, timeout: 30_000 });
    await this.waitForLightning();
    console.log(`>>> Clicked Order Number link: ${orderNumber}`);
    return orderNumber;
  }

  async clickActivateOrderButton(): Promise<void> {
    const activateOrderButton = this.page
      .locator('runtime_platform_actions-actions-ribbon ul.slds-button-group-list')
      .locator('runtime_platform_actions-action-renderer')
      .filter({ hasText: /^activate order$/i })
      .locator('button')
      .or(this.page.getByRole('button', { name: /^activate order$/i }))
      .or(this.page.locator('button, a, lightning-button').filter({ hasText: /^activate order$/i }))
      .filter({ visible: true })
      .first();

    await activateOrderButton.waitFor({ state: 'visible', timeout: 30_000 });
    await activateOrderButton.scrollIntoViewIfNeeded();
    await this.highlightElement(activateOrderButton);
    await this.page.waitForTimeout(500);
    await activateOrderButton.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Activate Order button');
  }

  async clickStartOrderActivationButton(): Promise<void> {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      for (const p of this.page.context().pages()) {
        const scopes: Array<Page | Frame> = [p, ...p.frames()];
        for (const scope of scopes) {
          const startButton = scope
            .locator('[role="dialog"], .slds-modal, lightning-modal, .slds-modal__container, .uiModal')
            .getByRole('button', { name: /start order activation/i })
            .or(scope.getByRole('button', { name: /start order activation/i }))
            .or(scope.locator('button, a, input[type="button"], input[type="submit"], lightning-button').filter({ hasText: /start order activation/i }))
            .filter({ visible: true })
            .first();

          if ((await startButton.count().catch(() => 0)) === 0) {
            continue;
          }

          await startButton.scrollIntoViewIfNeeded().catch(() => undefined);
          await this.highlightElement(startButton);
          await this.page.waitForTimeout(500);
          await startButton.click({ force: true, timeout: 10_000 });
          console.log('>>> Clicked Start Order Activation button');
          return;
        }
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error('Could not click the Start Order Activation button');
  }

  async clickOrderActivationDialogCloseIcon(): Promise<void> {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      for (const p of this.page.context().pages()) {
        const scopes: Array<Page | Frame> = [p, ...p.frames()];
        for (const scope of scopes) {
          const dialog = scope
            .locator('[role="dialog"], .slds-modal, lightning-modal, .slds-modal__container, .uiModal')
            .filter({ hasText: /start activation process|start order activation|activation sequence/i })
            .first();

          const closeButton = dialog
            .locator(
              'button.slds-modal__close, button[title="Close"], button[aria-label="Close"], button[title="close"], lightning-button-icon[icon-name="utility:close"] button',
            )
            .or(dialog.getByRole('button', { name: /^close$/i }))
            .or(
              scope
                .locator('button.slds-modal__close, button[title="Close"], button[aria-label="Close"]')
                .filter({ visible: true }),
            )
            .filter({ visible: true })
            .first();

          if ((await closeButton.count().catch(() => 0)) === 0) {
            continue;
          }

          await this.highlightElement(closeButton);
          await this.page.waitForTimeout(500);
          await closeButton.click({ force: true, timeout: 10_000 });
          console.log('>>> Clicked close icon on order activation dialog');
          return;
        }
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error('Could not click close icon on the order activation dialog');
  }

  async clickOrderActivationStatusRefreshIcon(): Promise<void> {
    const panel = this.page
      .locator('article, lightning-card, .slds-card, section, flexipage-component2, .slds-panel')
      .filter({ hasText: /order activation status/i })
      .first();

    await panel.waitFor({ state: 'visible', timeout: 30_000 });
    await panel.scrollIntoViewIfNeeded();

    const refreshIcon = panel
      .locator('button[title="Refresh"], button[aria-label="Refresh"], button[title="refresh"], button[aria-label="Refresh List"]')
      .or(panel.getByRole('button', { name: /^refresh$/i }))
      .or(panel.locator('lightning-button-icon[icon-name="utility:refresh"] button'))
      .or(panel.locator('lightning-button-icon[title="Refresh"] button'))
      .or(panel.locator('button, lightning-button-icon button').filter({ has: this.page.locator('[data-key="refresh"], [icon-name="utility:refresh"], use[href*="refresh"]') }))
      .filter({ visible: true })
      .first();

    await refreshIcon.waitFor({ state: 'visible', timeout: 20_000 });
    await this.highlightElement(refreshIcon);
    await this.page.waitForTimeout(500);
    await refreshIcon.click({ force: true, timeout: 15_000 });
    console.log('>>> Clicked highlighted refresh icon in Order Activation Status');
  }

  async refreshPage(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await this.waitForLightning();
    console.log('>>> Refreshed the page');
  }

  async extractAndClickQuoteNumber(): Promise<string> {
    await this.waitForLightning();

    const quotesList = this.page
      .locator('lst-list-view-manager, force-list-view-manager, lightning-datatable, .listViewContainer')
      .first();

    const quoteLink = quotesList
      .locator('a[href*="/Quote/"], a[href*="/SBQQ__Quote/"]')
      .filter({ hasText: /^Q-\d+$/i })
      .or(quotesList.getByRole('link', { name: /^Q-\d+$/i }))
      .or(this.page.locator('lightning-datatable tbody a, .slds-table tbody a').filter({ hasText: /^Q-\d+$/i }))
      .or(this.page.getByRole('link', { name: /^Q-\d+$/i }))
      .first();

    await expect(quoteLink).toBeVisible({ timeout: 30_000 });

    const quoteNumber = (await quoteLink.innerText()).trim();
    if (!/^Q-\d+$/i.test(quoteNumber)) {
      throw new Error(`Could not extract quote number from link. Found: "${quoteNumber || '(empty)'}"`);
    }

    await quoteLink.click();
    await this.waitForLightning();
    await this.page.waitForURL(/\/lightning\/r\//i, { timeout: 30_000 }).catch(() => undefined);
    await recoverIfSessionEnded(this.page);
    await this.page.waitForTimeout(3_000);

    return quoteNumber;
  }

  async verifyQuoteNumberIsDisplayed(expectedQuoteNumber?: string): Promise<void> {
    await this.waitForLightning();

    const quoteNumberValue = this.page
      .locator('xpath=//span[normalize-space()="Quote Number"]/following::a[1]')
      .or(this.page.locator('xpath=//*[@title="Quote Number"]/following::a[1]'))
      .or(
        this.page
          .locator('records-highlights-details-item, records-record-layout-item')
          .filter({ hasText: /quote number/i })
          .locator('a, lightning-formatted-text, .slds-truncate, .fieldComponent')
          .filter({ hasText: /^Q-\d+$/i }),
      )
      .or(this.page.getByRole('link', { name: /^Q-\d+$/i }))
      .first();

    await expect(quoteNumberValue).toBeVisible({ timeout: 30_000 });

    const displayed = (await quoteNumberValue.innerText()).trim();
    if (!/^Q-\d+$/i.test(displayed)) {
      throw new Error(`Quote Number is not displayed. Found: "${displayed || '(empty)'}"`);
    }

    if (expectedQuoteNumber && displayed.toUpperCase() !== expectedQuoteNumber.toUpperCase()) {
      throw new Error(`Expected Quote Number "${expectedQuoteNumber}" but page shows "${displayed}"`);
    }

    await this.highlightElement(quoteNumberValue);
    console.log(`>>> Quote Number is displayed: ${displayed}`);
  }

  async highlightVertexTaxStatusField(): Promise<void> {
    const taxStatusValue = this.page
      .locator('article, lightning-card, .slds-card, section, flexipage-component2')
      .filter({ hasText: /vertex tax details/i })
      .locator('.slds-form-element')
      .filter({ hasText: /tax status/i })
      .locator('.slds-form-element__static, lightning-formatted-text, lightning-formatted-rich-text, .slds-truncate, a, p, span')
      .or(
        this.page.locator(
          'xpath=//*[contains(normalize-space(),"Vertex Tax Details")]/following::*[normalize-space()="Tax Status" or starts-with(normalize-space(),"Tax Status")][1]/following::*[self::span or self::div or self::p or self::a or self::lightning-formatted-text][normalize-space()!=""][1]',
        ),
      )
      .first();

    await taxStatusValue.waitFor({ state: 'attached', timeout: 30_000 }).catch(() => undefined);
    await taxStatusValue.scrollIntoViewIfNeeded().catch(() => undefined);
    await this.highlightElement(taxStatusValue);
    console.log('>>> Highlighted Vertex Tax Status field');
  }

  async clickInvoicePlansTab(): Promise<void> {
    await this.waitForLightning();

    const invoicePlansTab = this.page
      .getByRole('tab', { name: /^invoice plans$/i })
      .or(this.page.locator('a[data-label="Invoice Plans"], a[title="Invoice Plans"], a[data-tab-value*="Invoice"]'))
      .or(this.page.locator('.slds-tabs_default__item a, lightning-tab-bar a').filter({ hasText: /^invoice plans$/i }))
      .filter({ visible: true })
      .first();

    await invoicePlansTab.scrollIntoViewIfNeeded();
    await this.highlightElement(invoicePlansTab);
    await this.page.waitForTimeout(500);
    await invoicePlansTab.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Invoice Plans tab');
  }

  async clickCreateInvoicePlanButton(): Promise<void> {
    const createInvoicePlanButton = this.page
      .getByRole('button', { name: /create invoice plan/i })
      .or(this.page.locator('button, a').filter({ hasText: /create invoice plan/i }))
      .filter({ visible: true })
      .first();

    await createInvoicePlanButton.scrollIntoViewIfNeeded();
    await this.highlightElement(createInvoicePlanButton);
    await this.page.waitForTimeout(500);
    await createInvoicePlanButton.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Create Invoice Plan button');
  }

  async clickCreateOnNewInvoicePlanModal(): Promise<void> {
    const modal = this.page
      .locator('[role="dialog"], .slds-modal, .uiModal')
      .filter({ hasText: /create new invoice plan/i })
      .first();

    const createButton = modal
      .locator('.slds-modal__footer, .modal-footer, footer')
      .getByRole('button', { name: /^create$/i })
      .or(modal.getByRole('button', { name: /^create$/i }))
      .or(this.page.locator('[role="dialog"] button, .slds-modal__footer button').filter({ hasText: /^create$/i }))
      .first();

    await this.highlightElement(createButton);
    await this.page.waitForTimeout(500);
    await createButton.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Create on Create New Invoice Plan modal');
  }

  async clickShippingDetailsTab(): Promise<void> {
    await this.waitForLightning();

    const shippingDetailsTab = this.page
      .getByRole('tab', { name: /^shipping details$/i })
      .or(this.page.locator('a[data-label="Shipping Details"], a[title="Shipping Details"], a[data-tab-value*="Shipping"]'))
      .or(this.page.locator('.slds-tabs_default__item a, lightning-tab-bar a').filter({ hasText: /^shipping details$/i }))
      .filter({ visible: true })
      .first();

    await shippingDetailsTab.scrollIntoViewIfNeeded();
    await this.highlightElement(shippingDetailsTab);
    await this.page.waitForTimeout(500);
    await shippingDetailsTab.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Shipping Details tab');
  }

  async clickSaveAllShippingDetailsButton(): Promise<void> {
    const saveAllShippingDetailsButton = this.page
      .getByRole('button', { name: /save all shipping details/i })
      .or(this.page.locator('button, a, lightning-button').filter({ hasText: /save all shipping details/i }))
      .filter({ visible: true })
      .first();

    await saveAllShippingDetailsButton.scrollIntoViewIfNeeded();
    await this.highlightElement(saveAllShippingDetailsButton);
    await this.page.waitForTimeout(500);
    await saveAllShippingDetailsButton.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Save All Shipping Details button');
  }

  async clickQuoteActionsDownArrow(): Promise<void> {
    await this.waitForLightning();

    const actionsArrow = this.page
      .locator('runtime_platform_actions-actions-ribbon lightning-button-menu button[aria-haspopup="true"]')
      .or(this.page.locator('records-lwc-highlights-panel lightning-button-menu button[aria-haspopup="true"]'))
      .or(
        this.page
          .locator('.slds-page-header')
          .filter({ has: this.page.getByRole('button', { name: /^edit$/i }) })
          .locator('lightning-button-menu button[aria-haspopup="true"]'),
      )
      .filter({ visible: true })
      .first();

    await actionsArrow.waitFor({ state: 'visible', timeout: 30_000 });
    await actionsArrow.scrollIntoViewIfNeeded();
    await this.highlightElement(actionsArrow);
    await this.page.waitForTimeout(500);
    await actionsArrow.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked quote actions down arrow');
  }

  async highlightAndClickVertexQuoteTaxCall(): Promise<void> {
    const vertexTaxCall = this.page
      .getByRole('menuitem', { name: /vertex quote tax call|vertex tax quote call/i })
      .or(this.page.locator('lightning-menu-item, .slds-dropdown__item, a, button, span').filter({ hasText: /vertex quote tax call|vertex tax quote call/i }))
      .filter({ visible: true })
      .first();

    await vertexTaxCall.scrollIntoViewIfNeeded();
    await this.highlightElement(vertexTaxCall);
    await this.page.waitForTimeout(500);
    await vertexTaxCall.click({ force: true, timeout: 30_000 });
    console.log('>>> Highlighted and clicked Vertex Quote Tax Call');
  }

  async clickGeneratePaymentSoup(): Promise<void> {
    const generatePaymentSoup = this.page
      .getByRole('menuitem', { name: /generate payment soup/i })
      .or(this.page.locator('lightning-menu-item, .slds-dropdown__item, a, button, span').filter({ hasText: /generate payment soup/i }))
      .filter({ visible: true })
      .first();

    await generatePaymentSoup.scrollIntoViewIfNeeded();
    await this.highlightElement(generatePaymentSoup);
    await this.page.waitForTimeout(500);
    await generatePaymentSoup.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Generate Payment Soup');
  }

  async clickGeneratePaymentSoupDialogCloseIcon(): Promise<void> {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      for (const p of this.page.context().pages()) {
        const dialog = p
          .locator('[role="dialog"], .slds-modal, lightning-modal, .slds-modal__container, .uiModal')
          .filter({ hasText: /generate payment soup|payment soup/i })
          .first();

        const closeButton = dialog
          .locator('button.slds-modal__close, button[title="Close"], button[aria-label="Close"], button[title="close"]')
          .or(dialog.getByRole('button', { name: /^close$/i }))
          .or(p.locator('button.slds-modal__close, button[title="Close"], button[aria-label="Close"]').filter({ visible: true }))
          .filter({ visible: true })
          .first();

        if ((await closeButton.count().catch(() => 0)) === 0) {
          continue;
        }

        await this.highlightElement(closeButton);
        await this.page.waitForTimeout(500);
        await closeButton.click({ force: true, timeout: 10_000 });
        console.log('>>> Clicked close icon on Generate Payment Soup dialog');
        return;
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error('Could not click close icon on the Generate Payment Soup dialog');
  }

  async clickTaxCallDialogCloseIcon(): Promise<void> {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      for (const p of this.page.context().pages()) {
        const closeButton = p
          .locator('[role="dialog"], .slds-modal, lightning-modal, .slds-modal__container, .uiModal')
          .filter({ hasText: /tax call submitted/i })
          .locator('button.slds-modal__close, button[title="Close"], button[aria-label="Close"], button[title="close"]')
          .or(p.getByRole('button', { name: /^close$/i }))
          .or(p.locator('button.slds-modal__close, button[title="Close"], button[aria-label="Close"]'))
          .filter({ visible: true })
          .first();

        if ((await closeButton.count().catch(() => 0)) === 0) {
          continue;
        }

        await this.highlightElement(closeButton);
        await this.page.waitForTimeout(500);
        await closeButton.click({ force: true, timeout: 10_000 });
        console.log('>>> Clicked close icon on tax call dialog');
        return;
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error('Could not click close icon on the tax call dialog');
  }

  async clickRunQuoteQualityCheckButton(): Promise<void> {
    const runQualityCheckButton = this.page
      .locator('runtime_platform_actions-actions-ribbon ul.slds-button-group-list')
      .locator('runtime_platform_actions-action-renderer')
      .filter({ hasText: /run quote quality check/i })
      .locator('button')
      .or(this.page.getByRole('button', { name: /run quote quality check/i }))
      .or(this.page.locator('button, a, lightning-button').filter({ hasText: /run quote quality check/i }))
      .filter({ visible: true })
      .first();

    await runQualityCheckButton.scrollIntoViewIfNeeded();
    await this.highlightElement(runQualityCheckButton);
    await this.page.waitForTimeout(500);
    await runQualityCheckButton.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Run Quote Quality Check button');
  }

  async validateAndHighlightText(text: string): Promise<void> {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      for (const p of this.page.context().pages()) {
        const scopes: Array<Page | Frame> = [p, ...p.frames()];
        for (const scope of scopes) {
          const message = scope.getByText(text, { exact: false }).filter({ visible: true }).first();
          if ((await message.count().catch(() => 0)) === 0) {
            continue;
          }

          await expect(message).toBeVisible({ timeout: 5_000 }).catch(() => undefined);
          if (await message.isVisible().catch(() => false)) {
            await this.highlightElement(message);
            console.log(`>>> Validated and highlighted text: ${text}`);
            return;
          }
        }
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error(`Could not find text: ${text}`);
  }

  async clickQualityCheckDialogCloseIcon(): Promise<void> {
    const dialog = this.page
      .locator('[role="dialog"], .slds-modal, lightning-modal, .slds-modal__container, .uiModal')
      .filter({ hasText: /running record quality check|record quality check has finished running/i })
      .first();

    const closeButton = dialog
      .locator('button.slds-modal__close, button[title="Close"], button[aria-label="Close"], button[title="close"]')
      .or(dialog.getByRole('button', { name: /^close$/i }))
      .or(this.page.locator('button.slds-modal__close, button[title="Close"], button[aria-label="Close"]').filter({ visible: true }))
      .filter({ visible: true })
      .first();

    await this.highlightElement(closeButton);
    await this.page.waitForTimeout(500);
    await closeButton.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked close icon on quality check dialog');
  }

  async clickQuoteQualityCheckTab(): Promise<void> {
    await this.waitForLightning();

    const quoteQualityCheckTab = this.page
      .getByRole('tab', { name: /^quote quality check$/i })
      .or(this.page.locator('a[data-label="Quote Quality Check"], a[title="Quote Quality Check"], a[data-tab-value*="Quality"]'))
      .or(this.page.locator('.slds-tabs_default__item a, lightning-tab-bar a').filter({ hasText: /^quote quality check$/i }))
      .filter({ visible: true })
      .first();

    await quoteQualityCheckTab.scrollIntoViewIfNeeded();
    await this.highlightElement(quoteQualityCheckTab);
    await this.page.waitForTimeout(500);
    await quoteQualityCheckTab.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Quote Quality Check tab');
  }

  async clickRefreshResultsButton(): Promise<void> {
    const refreshResultsButton = this.page
      .getByRole('button', { name: /refresh results/i })
      .or(this.page.locator('button, a, lightning-button').filter({ hasText: /refresh results/i }))
      .filter({ visible: true })
      .first();

    await refreshResultsButton.scrollIntoViewIfNeeded();
    await this.highlightElement(refreshResultsButton);
    await this.page.waitForTimeout(500);
    await refreshResultsButton.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Refresh Results button');
  }

  async clickSubmitForApproval(): Promise<void> {
    const submitForApproval = this.page
      .getByRole('menuitem', { name: /^submit for approval$/i })
      .or(this.page.locator('lightning-menu-item, .slds-dropdown__item, a, button, span').filter({ hasText: /^submit for approval$/i }))
      .filter({ visible: true })
      .first();

    await submitForApproval.scrollIntoViewIfNeeded();
    await this.highlightElement(submitForApproval);
    await this.page.waitForTimeout(500);
    await submitForApproval.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Submit for Approval');
  }

  async clickReturnToQuoteButton(): Promise<void> {
    const started = Date.now();
    const deadline = started + 120_000;
    let lastLog = 0;

    while (Date.now() < deadline) {
      const pages = this.page.context().pages();
      const now = Date.now();
      const onQuoteRecord = pages.some((p) => /\/lightning\/r\/SBQQ__Quote__c\//i.test(p.url()));
      const hasSubmitQuote = pages.some((p) =>
        p.frames().some((f) => /Submit_Quote/i.test(f.url())) || /Submit_Quote/i.test(p.url()),
      );

      if (now - lastLog > 8_000) {
        const frameUrls = pages.flatMap((p) => p.frames().map((f) => f.url())).filter((u) => u && u !== 'about:blank');
        console.log(`>>> Return to Quote scan pages=${pages.length} frames=${frameUrls.join(' | ')}`);
        lastLog = now;
      }

      if (onQuoteRecord && !hasSubmitQuote && now - started > 15_000) {
        console.log('>>> Already on quote record page — Return to Quote not shown, continuing');
        return;
      }

      for (const p of pages) {
        const frames = p.frames();
        const submitFrames = frames.filter((f) => /Submit_Quote/i.test(f.url()));
        const scopes: Array<Frame | Page> = submitFrames.length > 0 ? submitFrames : hasSubmitQuote ? [p, ...frames] : [];

        for (const scope of scopes) {
          const clicked = await this.clickReturnToQuoteInScope(scope);
          if (clicked) {
            const scopeUrl = 'url' in scope ? scope.url() : p.url();
            console.log(`>>> Clicked Return to Quote button in: ${scopeUrl}`);
            await this.page.bringToFront().catch(() => undefined);
            return;
          }
        }

        const iframeCount = await p.locator('iframe[src*="Submit_Quote"]').count().catch(() => 0);
        for (let i = 0; i < iframeCount; i++) {
          const frameBtn = p
            .frameLocator('iframe[src*="Submit_Quote"]')
            .nth(i)
            .locator('input[value="Return to Quote"], input[value*="Return to Quote" i]')
            .or(p.frameLocator('iframe[src*="Submit_Quote"]').nth(i).getByRole('button', { name: /return to quote/i }))
            .first();

          if (await frameBtn.isVisible().catch(() => false)) {
            await this.highlightElement(frameBtn);
            await frameBtn.click({ force: true, timeout: 10_000 }).catch(() => undefined);
            console.log('>>> Clicked Return to Quote on Submit_Quote iframe');
            await this.page.bringToFront().catch(() => undefined);
            return;
          }
        }
      }

      await this.page.waitForTimeout(500);
    }

    if (this.page.context().pages().some((p) => /\/lightning\/r\/SBQQ__Quote__c\//i.test(p.url()))) {
      console.log('>>> Timed out looking for Return to Quote, but quote record is open — continuing');
      return;
    }

    throw new Error('Could not click Return to Quote button');
  }

  private async clickReturnToQuoteInScope(scope: Frame | Page): Promise<boolean> {
    const clicked = await scope
      .evaluate(() => {
        const matches = (el: Element) => {
          const value = (el as HTMLInputElement).value ?? '';
          const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
          const title = el.getAttribute('title') ?? '';
          return /return\s+to\s+quote/i.test(`${value} ${text} ${title}`);
        };

        const controls = Array.from(document.querySelectorAll('input, button, a'));
        const other = Array.from(document.querySelectorAll('span, div'));
        const target = (controls.find(matches) ?? other.find(matches)) as HTMLElement | undefined;
        if (!target) {
          return false;
        }

        target.style.outline = '4px solid #ff0000';
        target.style.backgroundColor = '#ffff00';
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
        target.click();
        return true;
      })
      .catch(() => false);

    if (clicked) {
      return true;
    }

    const button = scope
      .locator('input[value="Return to Quote"], input[value*="Return to Quote" i]')
      .or(scope.getByRole('button', { name: /return to quote/i }))
      .or(scope.getByRole('link', { name: /return to quote/i }))
      .or(scope.getByText(/return to quote/i))
      .first();

    if ((await button.count().catch(() => 0)) === 0) {
      return false;
    }

    await this.highlightElement(button);
    await button.click({ force: true, timeout: 8_000 }).catch(() => undefined);
    return true;
  }

  private statusLayoutItem(): Locator {
    return this.page
      .locator('records-record-layout-item[field-label="Status"]')
      .or(this.page.locator('records-record-layout-item[field-label="Quote HC Status"]'))
      .filter({ visible: true })
      .first();
  }

  private statusEditIcon(): Locator {
    const item = this.statusLayoutItem();
    return item
      .locator(
        'button[title="Edit Status"], button[title="Edit Quote HC Status"], button[title="Edit"], button.inline-edit-trigger, lightning-button-icon[icon-name="utility:edit"] button',
      )
      .or(item.locator('button.slds-button_icon').filter({ has: this.page.locator('[data-key="edit"], [icon-name="utility:edit"]') }))
      .filter({ visible: true })
      .last();
  }

  private async clickRightmostStatusEditIcon(): Promise<boolean> {
    return this.statusLayoutItem()
      .evaluate((root) => {
        const isHelp = (button: HTMLElement) => {
          const label = `${button.getAttribute('title') ?? ''} ${button.getAttribute('aria-label') ?? ''}`.toLowerCase();
          return (
            /help|info/.test(label) ||
            Boolean(button.closest('lightning-helptext')) ||
            Boolean(button.querySelector('[icon-name="utility:info"], [icon-name="utility:help"], [data-key="info"], [data-key="help"]'))
          );
        };

        const isEdit = (button: HTMLElement) => {
          const label = `${button.getAttribute('title') ?? ''} ${button.getAttribute('aria-label') ?? ''}`.toLowerCase();
          return (
            /edit/.test(label) ||
            button.classList.contains('inline-edit-trigger') ||
            Boolean(button.querySelector('[icon-name="utility:edit"], [data-key="edit"]'))
          );
        };

        const buttons = Array.from(root.querySelectorAll('button')).filter(
          (button) => !isHelp(button as HTMLElement),
        ) as HTMLElement[];

        const editButtons = buttons.filter(isEdit);
        const target = (editButtons.length > 0 ? editButtons : buttons)
          .map((button) => ({ button, x: button.getBoundingClientRect().right }))
          .sort((a, b) => b.x - a.x)[0]?.button;

        if (!target) {
          return false;
        }

        target.style.outline = '4px solid #ff0000';
        target.style.backgroundColor = '#ffff00';
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
        target.click();
        return true;
      })
      .catch(() => false);
  }

  async scrollToStatusElement(): Promise<void> {
    const detailsTab = this.page
      .getByRole('tab', { name: /^details$/i })
      .or(this.page.locator('a[data-label="Details"], a[title="Details"]'))
      .or(this.page.locator('.slds-tabs_default__item a, lightning-tab-bar a').filter({ hasText: /^details$/i }))
      .filter({ visible: true })
      .first();

    if ((await detailsTab.count().catch(() => 0)) > 0) {
      await detailsTab.click({ force: true, timeout: 10_000 }).catch(() => undefined);
      await this.page.waitForTimeout(1_000);
    }

    const statusField = this.page
      .locator('records-record-layout-item[field-label="Status"], records-record-layout-item[field-label="Quote HC Status"]')
      .or(this.page.locator('xpath=//span[normalize-space()="Status"]/ancestor::records-record-layout-item[1]'))
      .or(this.page.locator('.slds-form-element').filter({ has: this.page.getByText(/^status$/i) }))
      .first();

    await statusField.waitFor({ state: 'attached', timeout: 30_000 });
    await statusField.evaluate((el) => {
      (el as HTMLElement).scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    });
    await this.page.waitForTimeout(500);
    await this.highlightElement(statusField);
    console.log('>>> Scrolled to Status field');
  }

  async highlightStatusEditIcon(): Promise<void> {
    const editIcon = this.statusEditIcon();
    await editIcon.scrollIntoViewIfNeeded().catch(() => undefined);
    await this.highlightElement(editIcon);
    console.log('>>> Highlighted Status edit icon (pencil)');
  }

  async clickStatusEditIcon(): Promise<void> {
    const clicked = await this.clickRightmostStatusEditIcon();
    if (clicked) {
      console.log('>>> Clicked Status edit pencil on the far right of the Status row');
      return;
    }

    const editIcon = this.statusEditIcon();
    await editIcon.scrollIntoViewIfNeeded();
    await this.highlightElement(editIcon);
    await this.page.waitForTimeout(500);
    await editIcon.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Status edit pencil on the far right of the Status row');
  }

  async clickStatusPicklistDownArrow(): Promise<void> {
    const layoutItem = this.statusLayoutItem();
    const combobox = layoutItem
      .locator('button[role="combobox"], button[aria-haspopup="listbox"], lightning-combobox button.slds-combobox__input')
      .filter({ visible: true })
      .first();

    await layoutItem.scrollIntoViewIfNeeded().catch(() => undefined);
    await combobox.waitFor({ state: 'visible', timeout: 30_000 });

    const box = await combobox.boundingBox();
    if (!box) {
      throw new Error('Could not find the Status picklist down arrow');
    }

    await this.highlightElement(combobox);
    await this.page.waitForTimeout(300);
    await this.page.mouse.click(box.x + box.width - 14, box.y + box.height / 2);
    console.log('>>> Clicked Status picklist down arrow');
  }

  async selectQuoteLayoutPicklist(fieldLabel: string, value: string): Promise<void> {
    const labels = fieldLabel === 'Approval Status' ? ['Approval Status', 'Approved Status'] : [fieldLabel];
    const layoutItem = this.page
      .locator(labels.map((label) => `records-record-layout-item[field-label="${label}"]`).join(', '))
      .or(this.page.locator('records-record-layout-item').filter({ hasText: new RegExp(`^(${labels.join('|')})$`, 'i') }))
      .filter({ visible: true })
      .first();

    const combobox = layoutItem
      .locator('button[role="combobox"], button[aria-haspopup="listbox"], lightning-combobox button')
      .filter({ visible: true })
      .first();

    await layoutItem.scrollIntoViewIfNeeded();

    const option = this.page
      .getByRole('option', { name: new RegExp(`^${value}$`, 'i') })
      .or(this.page.locator('lightning-base-combobox-item').filter({ has: this.page.locator(`span[title="${value}"]`) }))
      .or(this.page.locator('.slds-listbox__option').filter({ hasText: new RegExp(`^${value}$`, 'i') }))
      .filter({ visible: true })
      .first();

    if (!(await option.isVisible().catch(() => false))) {
      await this.highlightElement(combobox);
      await this.page.waitForTimeout(300);
      await combobox.click({ force: true, timeout: 30_000 });
    }

    await this.highlightElement(option);
    await this.page.waitForTimeout(300);
    await option.click({ force: true, timeout: 15_000 });
    console.log(`>>> Selected ${value} on ${fieldLabel} picklist`);
  }

  async clickQuoteDetailsSaveButton(): Promise<void> {
    const saveButton = this.page
      .locator('.slds-docked-form-footer, records-form-footer, .inline-edit-footer, footer')
      .getByRole('button', { name: /^save$/i })
      .or(this.page.locator('.slds-docked-form-footer button, records-form-footer button').filter({ hasText: /^save$/i }))
      .or(this.page.getByRole('button', { name: /^save$/i }))
      .filter({ visible: true })
      .first();

    await saveButton.scrollIntoViewIfNeeded();
    await this.highlightElement(saveButton);
    await this.page.waitForTimeout(500);
    await saveButton.click({ force: true, timeout: 30_000 });
    await this.waitForLightning();
    console.log('>>> Clicked Save on quote details form');
  }

  async clickOpportunityRecordLink(): Promise<void> {
    const opportunityLink = this.page
      .locator('xpath=//span[normalize-space()="Opportunity"]/following::a[1]')
      .or(this.page.locator('xpath=//*[@title="Opportunity"]/following::a[1]'))
      .or(
        this.page
          .locator('records-highlights-details-item')
          .filter({ has: this.page.getByText(/^opportunity$/i) })
          .locator('a')
          .filter({ hasNotText: /stage/i }),
      )
      .or(
        this.page
          .locator('records-record-layout-item[field-label="Opportunity"]')
          .locator('a')
          .filter({ visible: true }),
      )
      .filter({ visible: true })
      .first();

    await opportunityLink.scrollIntoViewIfNeeded();
    await this.highlightElement(opportunityLink);
    await this.page.waitForTimeout(500);
    await opportunityLink.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Opportunity record link');
  }

  async clickClosedStageOnPath(): Promise<void> {
    const closedStage = this.page
      .locator('lightning-picklist-path, runtime_sales_path, .slds-path')
      .locator('a.slds-path__link, li.slds-path__item, .slds-path__nav li')
      .filter({ hasText: /^closed$/i })
      .or(this.page.getByRole('link', { name: /^closed$/i }))
      .or(this.page.locator('.slds-path__title, .slds-path__link').filter({ hasText: /^closed$/i }))
      .filter({ visible: true })
      .last();

    await closedStage.scrollIntoViewIfNeeded();
    await this.highlightElement(closedStage);
    await this.page.waitForTimeout(500);
    await closedStage.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Closed stage on opportunity path');
  }

  async clickSelectClosedStage(): Promise<void> {
    const selectClosedStage = this.page
      .getByRole('button', { name: /select closed stage/i })
      .or(this.page.locator('button, a, lightning-button').filter({ hasText: /select closed stage/i }))
      .filter({ visible: true })
      .first();

    await selectClosedStage.scrollIntoViewIfNeeded();
    await this.highlightElement(selectClosedStage);
    await this.page.waitForTimeout(500);
    await selectClosedStage.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Select Closed Stage');
  }

  async clickEditDependenciesDoneButton(): Promise<void> {
    const modal = this.page
      .locator('[role="dialog"], .slds-modal, lightning-modal, .uiModal')
      .filter({ hasText: /edit dependencies/i })
      .first();

    const doneButton = modal
      .locator('.slds-modal__footer, footer')
      .getByRole('button', { name: /^done$/i })
      .or(modal.getByRole('button', { name: /^done$/i }))
      .or(this.page.getByRole('button', { name: /^done$/i }))
      .filter({ visible: true })
      .first();

    await this.highlightElement(doneButton);
    await this.page.waitForTimeout(500);
    await doneButton.click({ force: true, timeout: 30_000 });
    console.log('>>> Clicked Done on Edit Dependencies');
  }

  async validateStageField(expectedValue: string): Promise<void> {
    const detailsTab = this.page
      .getByRole('tab', { name: /^details$/i })
      .or(this.page.locator('a[data-label="Details"], a[title="Details"]'))
      .or(this.page.locator('.slds-tabs_default__item a, lightning-tab-bar a').filter({ hasText: /^details$/i }))
      .filter({ visible: true })
      .first();

    if ((await detailsTab.count().catch(() => 0)) > 0) {
      await detailsTab.click({ force: true, timeout: 10_000 }).catch(() => undefined);
      await this.page.waitForTimeout(1_000);
    }

    const stageItem = this.page
      .locator('records-record-layout-item[field-label="Stage"]')
      .or(this.page.locator('.slds-form-element').filter({ has: this.page.getByText(/^stage$/i, { exact: true }) }))
      .or(this.page.locator('xpath=//span[normalize-space()="Stage"]/ancestor::records-record-layout-item[1]'))
      .first();

    await stageItem.waitFor({ state: 'visible', timeout: 30_000 });
    await stageItem.scrollIntoViewIfNeeded();

    const stageValue = stageItem
      .locator('.test-id__field-value, lightning-formatted-text, .slds-form-element__static, lightning-formatted-text')
      .filter({ hasText: new RegExp(expectedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
      .or(stageItem.getByText(expectedValue, { exact: false }))
      .first();

    await expect(stageValue).toBeVisible({ timeout: 30_000 });
    const actual = (await stageValue.innerText()).trim();
    if (!actual.toLowerCase().includes(expectedValue.toLowerCase())) {
      throw new Error(`Expected Stage field to be "${expectedValue}" but found "${actual || '(empty)'}"`);
    }

    await this.highlightElement(stageValue);
    console.log(`>>> Validated Stage field is: ${actual}`);
  }

  async clickEditLinesButton(): Promise<void> {
    await recoverIfSessionEnded(this.page);

    const editLinesButton = this.page
      .getByRole('button', { name: /^edit lines$/i })
      .or(this.page.locator('button, a, lightning-button').filter({ hasText: /^edit lines$/i }))
      .or(
        this.page
          .locator('runtime_platform_actions-actions-ribbon ul.slds-button-group-list')
          .locator('runtime_platform_actions-action-renderer')
          .filter({ hasText: /^edit lines$/i })
          .locator('button'),
      )
      .filter({ visible: true })
      .first();

    const alreadyVisible = await editLinesButton.isVisible({ timeout: 20_000 }).catch(() => false);
    if (!alreadyVisible) {
      await reloadLightningRecordIfStuck(this.page);
      await this.page.waitForTimeout(5_000);
    }

    await editLinesButton.waitFor({ state: 'visible', timeout: 45_000 });
    await editLinesButton.scrollIntoViewIfNeeded();
    await this.highlightElement(editLinesButton);
    await this.page.waitForTimeout(1_000);
    await editLinesButton.click({ force: true, timeout: 60_000 });
  }

  async clickAddProductsButton(): Promise<void> {
    const selector = 'sb-custom-action[name="Add Products"]';
    const deadline = Date.now() + 60_000;

    while (Date.now() < deadline) {
      for (const frame of this.page.frames()) {
        const addProductsAction = frame.locator(selector).first();
        if ((await addProductsAction.count().catch(() => 0)) === 0) {
          continue;
        }

        await addProductsAction.click({ force: true, timeout: 30_000 });
        return;
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error('Could not find Add Products: sb-custom-action[name="Add Products"]');
  }

  async clickSearchProductsAndType(productCode: string): Promise<void> {
    await this.page.waitForTimeout(20_000);

    const deadline = Date.now() + 60_000;

    while (Date.now() < deadline) {
      for (const frame of this.page.frames()) {
        const controls = await this.getProductSearchControls(frame);
        if (!controls) {
          continue;
        }

        const { searchInput, searchIcon } = controls;

        await this.highlightElement(searchInput);
        await searchInput.click({ force: true, timeout: 30_000 });
        await searchInput.pressSequentially(productCode, { delay: 30 });

        await this.highlightElement(searchIcon);
        await searchIcon.click({ force: true, timeout: 30_000 });
        return;
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error('Could not find Search Products input');
  }

  async selectProductCheckboxAndClickSelect(productCode: string): Promise<void> {
    await this.page.waitForTimeout(2_000);

    const deadline = Date.now() + 30_000;
    let targetFrame: Frame | null = null;

    while (Date.now() < deadline && !targetFrame) {
      for (const frame of this.page.frames()) {
        const clicked = await this.clickProductCheckbox(frame, productCode);
        if (clicked) {
          targetFrame = frame;
          break;
        }
      }

      if (!targetFrame) {
        await this.page.waitForTimeout(500);
      }
    }

    if (!targetFrame) {
      throw new Error(`Could not select checkbox and click Select for product: ${productCode}`);
    }

    const framesToTry = [targetFrame, ...this.page.frames()];
    for (const frame of framesToTry) {
      try {
        await frame
          .locator('sb-custom-action[name="Select"]')
          .or(frame.getByRole('button', { name: /^select$/i }))
          .first()
          .click({ force: true, timeout: 5_000 });
        return;
      } catch {
        continue;
      }
    }

    throw new Error(`Could not select checkbox and click Select for product: ${productCode}`);
  }

  private async clickProductCheckbox(frame: Frame, productCode: string): Promise<boolean> {
    const codePattern = new RegExp(productCode, 'i');
    const productRow = frame.locator('sb-table-row').filter({ hasText: codePattern }).last();

    const locatorAttempts = [
      productRow.getByRole('checkbox'),
      productRow.locator('input[type="checkbox"]'),
      productRow.locator('span.slds-checkbox_faux'),
      productRow.locator('div.parentCheckboxContainer'),
      frame.locator('sb-table-row').filter({ hasText: codePattern }).last().locator('div.parentCheckboxContainer'),
      frame.locator('sb-table-row >> div.parentCheckboxContainer').last(),
      frame.locator('div.parentCheckboxContainer').last(),
    ];

    for (const checkbox of locatorAttempts) {
      try {
        if ((await checkbox.count().catch(() => 0)) === 0) {
          continue;
        }
        await checkbox.click({ force: true, timeout: 3_000 });
        return true;
      } catch {
        continue;
      }
    }

    const clickedInShadow = await frame
      .evaluate((code) => {
        const findRows = (root: Document | ShadowRoot): Element[] => {
          const rows: Element[] = [];
          root.querySelectorAll('sb-table-row').forEach((row) => rows.push(row));
          root.querySelectorAll('*').forEach((el) => {
            const shadow = (el as HTMLElement).shadowRoot;
            if (shadow) {
              rows.push(...findRows(shadow));
            }
          });
          return rows;
        };

        const findCheckbox = (root: Document | ShadowRoot | Element): HTMLElement | null => {
          const scopes: Array<Document | ShadowRoot | Element> = [root];
          if (root instanceof Element && root.shadowRoot) {
            scopes.unshift(root.shadowRoot);
          }

          for (const scope of scopes) {
            const queryRoot = scope as Document | ShadowRoot;
            const container = queryRoot.querySelector?.('div.parentCheckboxContainer') as HTMLElement | null;
            if (container) {
              return (container.querySelector('input[type="checkbox"]') as HTMLElement) ?? container;
            }

            const input = queryRoot.querySelector?.('input[type="checkbox"]') as HTMLElement | null;
            if (input) {
              return input;
            }

            const faux = queryRoot.querySelector?.('span.slds-checkbox_faux') as HTMLElement | null;
            if (faux) {
              return faux;
            }
          }

          const children =
            root instanceof ShadowRoot || root instanceof Document
              ? Array.from(root.querySelectorAll('*'))
              : Array.from((root as Element).shadowRoot?.querySelectorAll('*') ?? []);

          for (const el of children) {
            const shadow = (el as HTMLElement).shadowRoot;
            if (shadow) {
              const found = findCheckbox(shadow);
              if (found) {
                return found;
              }
            }
          }

          return null;
        };

        const matchingRows = findRows(document).filter((row) =>
          row.textContent?.toLowerCase().includes(code.toLowerCase()),
        );
        const targetRow = matchingRows[matchingRows.length - 1];
        if (!targetRow) {
          return false;
        }

        const checkbox = findCheckbox(targetRow);
        if (!checkbox) {
          return false;
        }

        checkbox.click();
        return true;
      }, productCode)
      .catch(() => false);

    if (clickedInShadow) {
      return true;
    }

    try {
      if ((await productRow.count().catch(() => 0)) === 0) {
        return false;
      }

      const box = await productRow.boundingBox();
      if (!box) {
        return false;
      }

      await this.page.mouse.click(box.x + 12, box.y + box.height / 2);
      return true;
    } catch {
      return false;
    }
  }

  private async getProductSearchControls(
    frame: Frame,
  ): Promise<{ searchInput: Locator; searchIcon: Locator } | null> {
    const inputs = frame.getByPlaceholder('Search Products');
    const count = await inputs.count().catch(() => 0);
    if (count === 0) {
      return null;
    }

    const searchInput = count > 1 ? inputs.nth(1) : inputs.first();

    const lookupBar = frame.locator('div.sb-lookup-input').filter({ has: searchInput }).first();
    const iconInBar = lookupBar.locator('div.searchActions, div[class*="searchActions"]').first();
    const searchIcon =
      (await iconInBar.count().catch(() => 0)) > 0
        ? iconInBar
        : frame.locator('div.searchActions, div[class*="searchActions"]').first();

    return { searchInput, searchIcon };
  }

  async enterConfigureProductsQuantity(quantity: string): Promise<void> {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      for (const frame of this.page.frames()) {
        const quantityFields = [
          frame.locator('input#myinput.myinput.numberinput--desktop').first(),
          frame.locator('input#myinput').first(),
          frame.locator('input.myinput, input[class*="numberinput"]').first(),
          frame
            .locator('sb-table-row')
            .filter({ hasText: /BUNDLE\s*-\s*TASER\s*7\s*CERTIFICATION/i })
            .locator('input#myinput, input.myinput')
            .first(),
        ];

        for (const quantityField of quantityFields) {
          try {
            await quantityField.click({ force: true, timeout: 3_000 });
            await quantityField.fill(quantity);
            return;
          } catch {
            continue;
          }
        }

        const filledInShadow = await frame
          .evaluate((qty) => {
            const findInputs = (root: Document | ShadowRoot): HTMLInputElement[] => {
              const inputs: HTMLInputElement[] = [];
              root.querySelectorAll('input#myinput, input.myinput, input[class*="numberinput"]').forEach((el) => {
                inputs.push(el as HTMLInputElement);
              });
              root.querySelectorAll('*').forEach((el) => {
                const shadow = (el as HTMLElement).shadowRoot;
                if (shadow) {
                  inputs.push(...findInputs(shadow));
                }
              });
              return inputs;
            };

            const input = findInputs(document)[0];
            if (!input) {
              return false;
            }

            input.focus();
            input.value = qty;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }, quantity)
          .catch(() => false);

        if (filledInShadow) {
          return;
        }
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error('Could not find Quantity field on Configure Products');
  }

  async clickConfigureProductsSaveButton(): Promise<void> {
    for (const frame of this.page.frames()) {
      const inConfigurator =
        (await frame.locator('input#myinput, input.myinput.numberinput--desktop').count().catch(() => 0)) >
        0;
      if (!inConfigurator) {
        continue;
      }

      try {
        await frame
          .locator('sb-custom-action[name="Save"]')
          .or(frame.getByRole('button', { name: /^save$/i }))
          .first()
          .click({ force: true, timeout: 5_000 });
        console.log(`>>> Clicked Configure Products Save in: ${frame.url()}`);
        return;
      } catch {
        continue;
      }
    }

    throw new Error('Could not find Save button on Configure Products');
  }

  async clickQuoteLineEditorSave(): Promise<void> {
    for (const frame of this.page.frames()) {
      if (!/sbqq|vf\.force/i.test(frame.url())) {
        continue;
      }
      try {
        await frame
          .locator('sb-custom-action[name="Save"]')
          .or(frame.getByRole('button', { name: /^save$/i }))
          .first()
          .click({ force: true, timeout: 10_000 });
        console.log(`>>> Clicked Quote Line Editor Save in: ${frame.url()}`);
        return;
      } catch {
        continue;
      }
    }

    throw new Error('Could not find Save on Quote Line Editor');
  }

  private quoteLineEditorFrames(): Frame[] {
    const frames = this.page.frames().filter((frame) => /sbqq|vf\.force/i.test(frame.url()));
    const sbLineEditor = frames.filter((frame) => /\/apex\/sb/i.test(frame.url()));
    const quoteSave = frames.filter((frame) => /QuoteSave/i.test(frame.url()));
    const others = frames.filter(
      (frame) => !sbLineEditor.includes(frame) && !quoteSave.includes(frame),
    );

    return [...sbLineEditor, ...quoteSave, ...others];
  }

  private async probeAdditionalDiscInFrame(
    frame: Frame,
  ): Promise<{ discCount: number; rowCount: number; sampleFields: string[] }> {
    return frame
      .evaluate(() => {
        const walk = (root: Document | ShadowRoot, visit: (r: Document | ShadowRoot) => void) => {
          visit(root);
          root.querySelectorAll('*').forEach((el) => {
            const shadow = (el as HTMLElement).shadowRoot;
            if (shadow) {
              walk(shadow, visit);
            }
          });
        };

        let discCount = 0;
        let rowCount = 0;
        const sampleFields: string[] = [];
        walk(document, (root) => {
          root.querySelectorAll('sb-table-row').forEach(() => rowCount++);
          root.querySelectorAll('[field]').forEach((el) => {
            const field = el.getAttribute('field') ?? '';
            if (sampleFields.length < 12) {
              sampleFields.push(field);
            }
            if (/AdditionalDisc/i.test(field)) {
              discCount++;
            }
          });
        });

        return { discCount, rowCount, sampleFields };
      })
      .catch(() => ({ discCount: 0, rowCount: 0, sampleFields: [] as string[] }));
  }

  private isAdditionalDiscHeaderText(text: string): boolean {
    const normalized = text.replace(/\s+/g, ' ').trim();
    return /^(additional disc\.?|addl\.?\s*disc\.?)$/i.test(normalized);
  }

  private async findAdditionalDiscLocator(frame: Frame): Promise<Locator | null> {
    const header = frame
      .getByText(/^additional disc\.?$/i)
      .or(frame.locator('sb-table-header-cell, th').filter({ hasText: /^additional disc\.?$/i }))
      .first();

    if ((await header.count().catch(() => 0)) === 0) {
      return null;
    }

    console.log('>>> Found ADDITIONAL DISC header — locating first cell under it');
    return header;
  }

  private async waitForAdditionalDiscGrid(timeoutMs = 60_000): Promise<Frame | null> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      for (const frame of this.quoteLineEditorFrames()) {
        const headerCount = await frame
          .getByText(/^additional disc\.?$/i)
          .count()
          .catch(() => 0);
        const playwrightCount = await frame
          .locator('[field="SBQQ__AdditionalDisc__c"], [field*="AdditionalDisc"]')
          .count()
          .catch(() => 0);
        if (headerCount > 0 || playwrightCount > 0) {
          console.log(
            `>>> Additional Disc. grid ready in ${frame.url()} (header=${headerCount}, cells=${playwrightCount})`,
          );
          return frame;
        }

        const probe = await this.probeAdditionalDiscInFrame(frame);
        if (probe.discCount > 0) {
          console.log(`>>> Additional Disc. grid ready in ${frame.url()} (shadow probe)`);
          return frame;
        }
      }

      await this.page.waitForTimeout(500);
    }

    return null;
  }

  private markAndHighlightAdditionalDisc(frame: Frame): Promise<boolean> {
    return frame
      .evaluate(() => {
        document.querySelectorAll('[data-bdd-additional-disc]').forEach((el) => {
          el.removeAttribute('data-bdd-additional-disc');
        });

        const walk = (root: Document | ShadowRoot, visit: (r: Document | ShadowRoot) => void) => {
          visit(root);
          root.querySelectorAll('*').forEach((el) => {
            const shadow = (el as HTMLElement).shadowRoot;
            if (shadow) {
              walk(shadow, visit);
            }
          });
        };

        const collect = <T extends Element>(selector: string): T[] => {
          const found: T[] = [];
          walk(document, (root) => {
            root.querySelectorAll(selector).forEach((el) => found.push(el as T));
          });
          return found;
        };

        const walkSubtree = (
          root: Document | ShadowRoot | Element,
          visit: (el: Element) => void,
        ) => {
          if (root instanceof Element) {
            visit(root);
            const hostShadow = (root as HTMLElement).shadowRoot;
            if (hostShadow) {
              walkSubtree(hostShadow, visit);
            }
          }
          root.querySelectorAll('*').forEach((el) => {
            visit(el);
            const shadow = (el as HTMLElement).shadowRoot;
            if (shadow) {
              walkSubtree(shadow, visit);
            }
          });
        };

        const isDiscHeaderText = (text: string): boolean =>
          /^(additional disc\.?|addl\.?\s*disc\.?)$/i.test(text.replace(/\s+/g, ' ').trim());

        const isDiscField = (name: string): boolean =>
          name === 'SBQQ__AdditionalDisc__c' ||
          /AdditionalDisc/i.test(name) ||
          /AdditionalDiscount/i.test(name);

        const highlight = (el: HTMLElement): boolean => {
          el.setAttribute('data-bdd-additional-disc', 'true');
          el.scrollIntoView({ block: 'center', inline: 'center' });
          el.style.setProperty('outline', '4px solid #ff0000', 'important');
          el.style.setProperty('background-color', '#ffff00', 'important');
          el.style.setProperty('box-shadow', '0 0 12px 4px #ff0000', 'important');
          return true;
        };

        const pickInnerDiv = (el: HTMLElement): HTMLElement => {
          let content: HTMLElement | null = null;
          let anyDiv: HTMLElement | null = null;
          walkSubtree(el, (node) => {
            if (!(node instanceof HTMLElement) || node === el) {
              return;
            }
            if (isDiscHeaderText(node.textContent ?? '')) {
              return;
            }
            if (!content && node.matches('div.content')) {
              content = node;
            }
            if (!anyDiv && node.tagName.toLowerCase() === 'div') {
              anyDiv = node;
            }
          });
          return content ?? anyDiv ?? el;
        };

        const header =
          collect<HTMLElement>('sb-table-header-cell, th, .sf-le-table-header, [class*="table-header"]').find((el) =>
            isDiscHeaderText(el.textContent ?? ''),
          ) ??
          collect<HTMLElement>('[field="SBQQ__AdditionalDisc__c"], [field*="AdditionalDisc"]').find((el) =>
            isDiscHeaderText(el.textContent ?? ''),
          );

        if (!header) {
          console.log('>>> ADDITIONAL DISC header not found');
          return false;
        }

        console.log('>>> Found ADDITIONAL DISC header — selecting first cell under it');
        header.scrollIntoView({ block: 'nearest', inline: 'center' });

        const headerRect = header.getBoundingClientRect();
        const headerCenterX = headerRect.left + headerRect.width / 2;
        const headerField = header.getAttribute('field') ?? 'SBQQ__AdditionalDisc__c';

        const fieldCells = collect<HTMLElement>(
          '[field="SBQQ__AdditionalDisc__c"], [field*="AdditionalDisc"]',
        ).filter((el) => isDiscField(el.getAttribute('field') ?? headerField));

        const underHeader = fieldCells
          .filter((el) => {
            if (el === header || header.contains(el) || el.contains(header)) {
              return false;
            }
            const rect = el.getBoundingClientRect();
            if (rect.height < 4 || rect.width < 4) {
              return false;
            }
            const centerX = rect.left + rect.width / 2;
            return (
              rect.top >= headerRect.bottom - 4 &&
              Math.abs(centerX - headerCenterX) <= Math.max(headerRect.width / 2, 20) + 8
            );
          })
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

        let firstCell = underHeader[0] ?? null;

        if (!firstCell) {
          const allDivs = collect<HTMLElement>('div.content, div.sf-le-table-cell, sb-table-cell, td, div');
          const geometric = allDivs
            .filter((el) => {
              if (el === header || header.contains(el)) {
                return false;
              }
              if (isDiscHeaderText(el.textContent ?? '')) {
                return false;
              }
              const rect = el.getBoundingClientRect();
              if (rect.height < 8 || rect.width < 8 || rect.height > 72 || rect.width > headerRect.width * 2.5) {
                return false;
              }
              const centerX = rect.left + rect.width / 2;
              return (
                rect.top >= headerRect.bottom - 4 &&
                Math.abs(centerX - headerCenterX) <= headerRect.width / 2 + 8
              );
            })
            .sort((a, b) => {
              const aRect = a.getBoundingClientRect();
              const bRect = b.getBoundingClientRect();
              if (Math.abs(aRect.top - bRect.top) > 3) {
                return aRect.top - bRect.top;
              }
              return aRect.width * aRect.height - bRect.width * bRect.height;
            });

          firstCell =
            geometric.find((el) => el.classList.contains('content') || el.matches('div.content')) ??
            geometric[0] ??
            null;
        }

        if (!firstCell) {
          const rows = collect<HTMLElement>('sb-table-row, tr');
          const firstRow = rows[0];
          if (firstRow) {
            const headers = collect<HTMLElement>('sb-table-header-cell, th');
            const discIndex = headers.findIndex((h) => isDiscHeaderText(h.textContent ?? ''));
            if (discIndex >= 0) {
              const rowCells: HTMLElement[] = [];
              walkSubtree(firstRow, (el) => {
                if (el instanceof HTMLElement && el.matches('sb-table-cell, td, div.sf-le-table-cell')) {
                  rowCells.push(el);
                }
              });
              firstCell = rowCells[discIndex] ?? null;
            }
          }
        }

        if (!firstCell) {
          console.log('>>> ADDITIONAL DISC header found, but no cell under it');
          return false;
        }

        return highlight(pickInnerDiv(firstCell));
      })
      .catch(() => false);
  }

  private async tryPlaywrightAdditionalDisc(frame: Frame, value: string): Promise<boolean> {
    const row = frame.locator('sb-table-row').first();
    if ((await row.count().catch(() => 0)) === 0) {
      return false;
    }

    const candidates = [
      row.locator('[field="SBQQ__AdditionalDisc__c"] div.content').first(),
      row.locator('[field*="AdditionalDisc"] div.content').first(),
      row.locator('[field="SBQQ__AdditionalDisc__c"]').first(),
      row.locator('[field*="AdditionalDisc"]').first(),
      row.locator('div.sf-le-table-cellPercent[field*="AdditionalDisc"]').first(),
      row.locator('div.content').filter({ hasText: /^\s*\d+\.?\d*%\s*$/ }).first(),
    ];

    for (const cell of candidates) {
      if ((await cell.count().catch(() => 0)) === 0) {
        continue;
      }

      await cell.scrollIntoViewIfNeeded().catch(() => undefined);
      await this.highlightElement(cell);
      await this.page.waitForTimeout(2_000);
      await cell.click({ clickCount: 2, force: true, timeout: 15_000 });
      await this.page.waitForTimeout(500);
      await this.page.keyboard.type(value, { delay: 30 });
      await this.page.keyboard.press('Enter');
      return true;
    }

    return false;
  }

  private async enterAdditionalDiscValue(frame: Frame, value: string): Promise<boolean> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const filled = await frame
        .evaluate((val) => {
          const walk = (root: Document | ShadowRoot): HTMLElement | null => {
            const marked = root.querySelector('[data-bdd-additional-disc="true"]') as HTMLElement | null;
            if (marked) {
              return marked;
            }
            for (const el of Array.from(root.querySelectorAll('*'))) {
              const shadow = (el as HTMLElement).shadowRoot;
              if (shadow) {
                const found = walk(shadow);
                if (found) {
                  return found;
                }
              }
            }
            return null;
          };

          const collectInputs = (
            root: Document | ShadowRoot | Element,
            inputs: HTMLInputElement[] = [],
          ): HTMLInputElement[] => {
            root.querySelectorAll('input.myinput, input[type="text"]').forEach((el) => {
              inputs.push(el as HTMLInputElement);
            });
            root.querySelectorAll('*').forEach((el) => {
              const shadow = (el as HTMLElement).shadowRoot;
              if (shadow) {
                collectInputs(shadow, inputs);
              }
            });
            return inputs;
          };

          const cell = walk(document);
          if (!cell) {
            return false;
          }

          const dblClick = (el: HTMLElement) => {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 2 }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, detail: 2 }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 2 }));
            el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 }));
          };

          dblClick(cell);
          const inner = cell.querySelector('div.content') as HTMLElement | null;
          if (inner) {
            dblClick(inner);
          }

          const input =
            collectInputs(cell).at(-1) ??
            (document.activeElement instanceof HTMLInputElement ? document.activeElement : null) ??
            collectInputs(document).at(-1) ??
            null;

          if (!input) {
            return false;
          }

          input.focus();
          input.value = val;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          return true;
        }, value)
        .catch(() => false);

      if (filled) {
        return true;
      }

      await this.page.waitForTimeout(300);
    }

    return false;
  }

  async doubleClickHighlightedDivAndEnter(value: string): Promise<void> {
    console.log('>>> Waiting 5 seconds for quote line grid after Configure Products...');
    await this.page.waitForTimeout(5_000);

    const readyFrame = await this.waitForAdditionalDiscGrid(60_000);
    if (!readyFrame) {
      console.log('>>> Additional Disc. grid not detected — continuing with frame scan anyway');
    }

    const deadline = Date.now() + 90_000;
    let lastProbe = '';

    while (Date.now() < deadline) {
      const editorFrames = readyFrame
        ? [readyFrame, ...this.quoteLineEditorFrames().filter((frame) => frame !== readyFrame)]
        : this.quoteLineEditorFrames();

      if (editorFrames.length === 0) {
        console.log('>>> Waiting for CPQ quote line editor iframe...');
        await this.page.waitForTimeout(500);
        continue;
      }

      for (const editorFrame of editorFrames) {
        const probe = await this.probeAdditionalDiscInFrame(editorFrame);
        const probeLine = `rows=${probe.rowCount}, disc=${probe.discCount}, fields=${JSON.stringify(probe.sampleFields.filter((f) => /Disc|SBQQ|Quantity|Product/i.test(f)).slice(0, 6))}`;
        if (probeLine !== lastProbe) {
          console.log(`>>> Frame ${editorFrame.url()}: ${probeLine}`);
          lastProbe = probeLine;
        }

        const highlighted = await this.markAndHighlightAdditionalDisc(editorFrame);
        if (highlighted) {
          console.log('>>> First cell under ADDITIONAL DISC header highlighted — pausing 2 seconds');
          await this.page.waitForTimeout(2_000);

          const marked = editorFrame.locator('[data-bdd-additional-disc="true"]').first();
          await marked.click({ force: true, timeout: 10_000 }).catch(() => undefined);
          try {
            await marked.dblclick({ force: true, timeout: 10_000 });
          } catch {
            await marked.click({ clickCount: 2, force: true, timeout: 10_000 });
          }

          await this.page.waitForTimeout(500);
          await this.page.keyboard.type(value, { delay: 30 });
          await this.page.keyboard.press('Enter');
          console.log(`>>> Clicked first cell under ADDITIONAL DISC and entered ${value}`);
          return;
        }

        const header = editorFrame
          .getByText(/^additional disc\.?$/i)
          .or(editorFrame.locator('sb-table-header-cell, th').filter({ hasText: /^additional disc\.?$/i }))
          .first();
        if ((await header.count().catch(() => 0)) > 0) {
          const box = await header.boundingBox().catch(() => null);
          if (box) {
            const clickX = box.x + box.width / 2;
            const clickY = box.y + box.height + 14;
            console.log(`>>> Clicking first cell under ADDITIONAL DISC header at ${clickX},${clickY}`);
            await this.page.mouse.click(clickX, clickY);
            await this.page.waitForTimeout(300);
            await this.page.mouse.dblclick(clickX, clickY);
            await this.page.waitForTimeout(500);
            await this.page.keyboard.type(value, { delay: 30 });
            await this.page.keyboard.press('Enter');
            console.log(`>>> Entered ${value} on first cell under ADDITIONAL DISC`);
            return;
          }
        }
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error(`Could not double-click Additional Disc. content div and enter: ${value}`);
  }

  async clickCalculateButton(times: number): Promise<void> {
    for (let i = 0; i < times; i++) {
      let clicked = false;

      for (const frame of this.page.frames()) {
        if (!/sbqq|vf\.force/i.test(frame.url())) {
          continue;
        }

        try {
          await frame
            .locator('sb-custom-action[name="Calculate"]')
            .or(frame.getByRole('button', { name: /^calculate$/i }))
            .first()
            .click({ force: true, timeout: 10_000 });
          console.log(`>>> Clicked Calculate (${i + 1}/${times}) in: ${frame.url()}`);
          clicked = true;
          break;
        } catch {
          continue;
        }
      }

      if (!clicked) {
        throw new Error(`Could not click Calculate button (attempt ${i + 1}/${times})`);
      }

      await this.page.waitForTimeout(500);
    }
  }

  async clickAlertContinueButton(): Promise<void> {
    const deadline = Date.now() + 30_000;

    while (Date.now() < deadline) {
      const scopes: Array<Frame | Page> = [...this.page.frames(), this.page];

      for (const scope of scopes) {
        const alert = scope
          .locator('[role="dialog"], .slds-modal, .uiModal, .slds-modal__container')
          .filter({ hasText: /alert|quantity of 0/i })
          .first();

        const continueButton = alert
          .getByRole('button', { name: /^continue$/i })
          .or(scope.getByRole('button', { name: /^continue$/i }))
          .or(scope.locator('button').filter({ hasText: /^continue$/i }))
          .or(scope.locator('xpath=//button[normalize-space()="Continue"]'))
          .first();

        if ((await continueButton.count().catch(() => 0)) === 0) {
          continue;
        }

        await this.highlightElement(continueButton);
        await this.page.waitForTimeout(500);
        await continueButton.click({ force: true, timeout: 10_000 });
        const scopeUrl = 'url' in scope ? scope.url() : this.page.url();
        console.log(`>>> Clicked Alert Continue in: ${scopeUrl}`);
        return;
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error('Could not click Continue on the Alert dialog');
  }

  private orderedExpediteScopes(): Array<Frame | Page> {
    const frames = this.page.frames();
    const quoteSave = frames.filter((f) => /QuoteSave/i.test(f.url()));
    const cpqSb = frames.filter((f) => /sbqq.*vf\.force\.com.*\/apex\/sb/i.test(f.url()));
    const cpqOther = frames.filter(
      (f) => /sbqq|vf\.force\.com/i.test(f.url()) && !quoteSave.includes(f) && !cpqSb.includes(f),
    );
    const lightning = frames.filter(
      (f) =>
        /lightning\.force\.com/i.test(f.url()) &&
        !quoteSave.includes(f) &&
        !cpqSb.includes(f) &&
        !cpqOther.includes(f),
    );
    const rest = frames.filter(
      (f) => !quoteSave.includes(f) && !cpqSb.includes(f) && !cpqOther.includes(f) && !lightning.includes(f),
    );
    return [...quoteSave, ...cpqSb, ...cpqOther, ...lightning, this.page, ...rest];
  }

  private async expediteReasonAction(
    scope: Frame | Page,
    selectId: string,
    action: 'highlight' | 'select',
    value: string,
  ): Promise<'native' | 'combobox' | false> {
    return scope
      .evaluate(
        ({ id, action, value }) => {
          const style = (el: HTMLElement) => {
            el.style.outline = '4px solid #ff0000';
            el.style.backgroundColor = '#ffff00';
            el.style.boxShadow = '0 0 12px 4px #ff0000';
          };

          const walk = (root: Document | ShadowRoot, visit: (root: Document | ShadowRoot) => void) => {
            visit(root);
            root.querySelectorAll('*').forEach((el) => {
              const shadow = (el as HTMLElement).shadowRoot;
              if (shadow) {
                walk(shadow, visit);
              }
            });
          };

          const findLabel = (select: Element): HTMLElement | null => {
            let node: Element | null = select;
            for (let depth = 0; depth < 15 && node; depth++) {
              const labels = node.querySelectorAll(
                'label, span.slds-form-element__label, .slds-form-element__label, span.test-id__field-label',
              );
              for (const candidate of labels) {
                if (/^expedite reason$/i.test(candidate.textContent?.trim() ?? '')) {
                  return candidate as HTMLElement;
                }
              }
              node = node.parentElement;
            }
            return null;
          };

          const allSelects: HTMLSelectElement[] = [];
          walk(document, (root) => {
            root.querySelectorAll('select').forEach((el) => allSelects.push(el as HTMLSelectElement));
          });

          const pickExpediteSelect = (): HTMLSelectElement | null => {
            const byId = allSelects.filter((s) => s.id === id);
            for (const select of byId) {
              if (Array.from(select.options).some((o) => /bypass/i.test(o.text.trim()))) {
                return select;
              }
            }

            const withBypass = allSelects.filter((s) =>
              Array.from(s.options).some((o) => /^bypass$/i.test(o.text.trim())),
            );
            if (withBypass.length === 1) {
              return withBypass[0] ?? null;
            }

            for (const select of withBypass) {
              if (findLabel(select)) {
                return select;
              }
            }

            return withBypass[0] ?? null;
          };

          const select = pickExpediteSelect();
          if (select) {
            const label = findLabel(select);
            select.scrollIntoView({ block: 'center', inline: 'nearest' });
            if (label) {
              label.scrollIntoView({ block: 'center', inline: 'nearest' });
              style(label);
            }
            style(select);

            if (action === 'select') {
              const bypass = Array.from(select.options).find((o) =>
                new RegExp(`^${value}$`, 'i').test(o.text.trim()),
              );
              if (bypass) {
                select.value = bypass.value;
                select.dispatchEvent(new Event('input', { bubbles: true }));
                select.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
            return 'native';
          }

          let comboboxBtn: HTMLElement | null = null;
          let comboboxLabel: HTMLElement | null = null;
          walk(document, (root) => {
            root.querySelectorAll('records-record-layout-item[field-label="Expedite Reason"]').forEach((item) => {
              if (comboboxBtn) {
                return;
              }
              const btn = item.querySelector(
                'lightning-combobox button.slds-combobox__input, lightning-combobox button[aria-haspopup="listbox"]',
              ) as HTMLElement | null;
              if (btn) {
                comboboxBtn = btn;
                comboboxLabel =
                  (item.querySelector('span.slds-form-element__label, label') as HTMLElement | null) ?? null;
              }
            });
          });

          if (comboboxBtn) {
            comboboxBtn.scrollIntoView({ block: 'center', inline: 'nearest' });
            if (comboboxLabel) {
              style(comboboxLabel);
            }
            style(comboboxBtn);
            if (action === 'select') {
              comboboxBtn.click();
            }
            return 'combobox';
          }

          return false;
        },
        { id: selectId, action, value },
      )
      .catch(() => false as const);
  }

  private async closeStrayTabs(): Promise<void> {
    for (const tab of this.page.context().pages()) {
      if (tab === this.page) {
        continue;
      }
      const url = tab.url();
      console.log(`>>> Closing stray tab: ${url}`);
      await tab.close().catch(() => undefined);
    }
    await this.page.bringToFront().catch(() => undefined);
  }

  private expediteReasonFrames(): Frame[] {
    return this.page.frames().filter((f) => /QuoteSave|sbqq.*vf\.force\.com/i.test(f.url()));
  }

  private async expediteReasonInFrame(
    frame: Frame,
    selectId: string,
    action: 'highlight' | 'select',
    value: string,
  ): Promise<boolean> {
    return frame
      .evaluate(
        ({ id, action, value }) => {
          const style = (el: HTMLElement) => {
            el.style.outline = '4px solid #ff0000';
            el.style.backgroundColor = '#ffff00';
            el.style.boxShadow = '0 0 12px 4px #ff0000';
          };

          const walk = (root: Document | ShadowRoot, visit: (root: Document | ShadowRoot) => void) => {
            visit(root);
            root.querySelectorAll('*').forEach((el) => {
              const shadow = (el as HTMLElement).shadowRoot;
              if (shadow) {
                walk(shadow, visit);
              }
            });
          };

          const findLabel = (select: Element): HTMLElement | null => {
            let node: Element | null = select;
            for (let depth = 0; depth < 15 && node; depth++) {
              for (const candidate of node.querySelectorAll(
                'label, span.slds-form-element__label, .slds-form-element__label',
              )) {
                if (/^expedite reason$/i.test(candidate.textContent?.trim() ?? '')) {
                  return candidate as HTMLElement;
                }
              }
              node = node.parentElement;
            }
            return null;
          };

          const allSelects: HTMLSelectElement[] = [];
          walk(document, (root) => {
            root.querySelectorAll('select').forEach((el) => allSelects.push(el as HTMLSelectElement));
          });

          const pickSelect = (): HTMLSelectElement | null => {
            const byId = allSelects.filter((s) => s.id === id);
            for (const select of byId) {
              if (Array.from(select.options).some((o) => /bypass/i.test(o.text.trim()))) {
                return select;
              }
            }
            const withBypass = allSelects.filter((s) =>
              Array.from(s.options).some((o) => /^bypass$/i.test(o.text.trim())),
            );
            return withBypass[0] ?? null;
          };

          const select = pickSelect();
          if (select) {
            const label = findLabel(select);
            select.scrollIntoView({ block: 'center', inline: 'nearest' });
            if (label) {
              label.scrollIntoView({ block: 'center', inline: 'nearest' });
              style(label);
            }
            style(select);
            if (action === 'select') {
              const option = Array.from(select.options).find((o) =>
                new RegExp(`^${value}$`, 'i').test(o.text.trim()),
              );
              if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event('input', { bubbles: true }));
                select.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
            return true;
          }

          return false;
        },
        { id: selectId, action, value },
      )
      .catch(() => false);
  }

  private async debugExpediteFrames(): Promise<void> {
    for (const frame of this.page.frames()) {
      const info = await frame
        .evaluate(() => {
          const selects = Array.from(document.querySelectorAll('select')).map((s) => ({
            id: s.id,
            options: Array.from(s.options).map((o) => o.text.trim()).slice(0, 8),
          }));
          const hasExpediteText = /expedite reason/i.test(document.body?.innerText ?? '');
          return { selects, hasExpediteText };
        })
        .catch((error) => ({ error: String(error) }));
      console.log(`>>> DEBUG ${frame.url()}: ${JSON.stringify(info)}`);
    }
  }

  async clickExpediteReasonAndSelect(value: string): Promise<void> {
    console.log('>>> Waiting for Expedite Reason after Calculate...');
    await this.page.waitForTimeout(3_000);

    const deadline = Date.now() + 60_000;
    let loggedFrames = false;

    while (Date.now() < deadline) {
      const scopes: Array<Frame | Page> = [...this.page.frames(), this.page];

      for (const scope of scopes) {
        const scopeUrl = 'url' in scope ? scope.url() : this.page.url();
        const label = scope.locator('[tooltip="Expedite Reason"]').first();
        const labelCount = await label.count().catch(() => 0);

        if (!loggedFrames) {
          console.log(`>>> Expedite scan ${scopeUrl}: tooltip-label=${labelCount}`);
        }

        if (labelCount === 0) {
          const viaTooltip = await this.highlightTooltipLabelAndClickPicklist(scope, value);
          if (viaTooltip) {
            console.log(`>>> Clicked Expedite Reason picklist via DOM walk in: ${scopeUrl}`);
            return;
          }
          continue;
        }

        await label.scrollIntoViewIfNeeded().catch(() => undefined);
        await this.highlightElement(label);
        console.log(`>>> Highlighted [tooltip="Expedite Reason"] label in: ${scopeUrl}`);
        await this.page.waitForTimeout(1_500);

        const followingSelect = label.locator('xpath=following::select[1]');
        const target =
          (await this.isSelectOnSameRowAsLabel(label, followingSelect))
            ? followingSelect
            : await this.findSelectOnSameRowAsLabel(scope, label);

        if (!target) {
          const box = await label.boundingBox().catch(() => null);
          if (box) {
            const clickX = box.x + box.width + 48;
            const clickY = box.y + box.height / 2;
            console.log(`>>> Clicking same-row picklist to the right of Expedite Reason at ${clickX},${clickY}`);
            await this.page.mouse.click(clickX, clickY);
            await this.page.waitForTimeout(300);
            await followingSelect.selectOption({ label: value }).catch(() => undefined);
            return;
          }
          continue;
        }

        await this.highlightElement(target);
        await target.click({ force: true, timeout: 10_000 });
        await target.selectOption({ label: value }).catch(() => undefined);
        console.log(`>>> Clicked Expedite Reason picklist (not Amendment Type) and selected ${value} in: ${scopeUrl}`);
        return;
      }

      loggedFrames = true;
      await this.page.waitForTimeout(500);
    }

    await this.debugExpediteFrames();
    throw new Error(`Could not click Expedite Reason picklist and select ${value}`);
  }

  async clickDiscountReasonAndEnter(value: string): Promise<void> {
    const deadline = Date.now() + 60_000;

    while (Date.now() < deadline) {
      for (const scope of this.orderedExpediteScopes()) {
        const scopeUrl = 'url' in scope ? scope.url() : this.page.url();

        const label = scope
          .locator('[tooltip="Discount Reason"]')
          .or(scope.getByText(/^discount reason$/i))
          .first();

        if ((await label.count().catch(() => 0)) > 0) {
          await label.scrollIntoViewIfNeeded().catch(() => undefined);
          await this.highlightElement(label);

          const followingTextarea = label.locator('xpath=following::textarea[1]');
          const target =
            (await this.isControlOnSameRowAsLabel(label, followingTextarea))
              ? followingTextarea
              : await this.findTextareaOnSameRowAsLabel(scope, label);

          if (!target) {
            const box = await label.boundingBox().catch(() => null);
            if (box) {
              const clickX = box.x + box.width + 80;
              const clickY = box.y + box.height / 2;
              console.log(`>>> Clicking Discount Reason text area to the right of label at ${clickX},${clickY}`);
              await this.page.mouse.click(clickX, clickY);
              await this.page.waitForTimeout(300);
              await this.page.keyboard.type(value, { delay: 30 });
              console.log(`>>> Entered "${value}" in Discount Reason`);
              return;
            }
          } else {
            await this.highlightElement(target);
            await target.click({ force: true, timeout: 10_000 });
            await target.fill(value).catch(async () => {
              await target.press('Control+A').catch(() => undefined);
              await this.page.keyboard.type(value, { delay: 30 });
            });
            console.log(`>>> Clicked Discount Reason text area and entered "${value}" in: ${scopeUrl}`);
            return;
          }
        }

        const viaDom = await this.fillDiscountReasonViaDom(scope, value);
        if (viaDom) {
          console.log(`>>> Clicked Discount Reason text area via DOM walk in: ${scopeUrl}`);
          return;
        }
      }

      await this.page.waitForTimeout(500);
    }

    throw new Error(`Could not click Discount Reason text area and enter: ${value}`);
  }

  private async isControlOnSameRowAsLabel(label: Locator, control: Locator): Promise<boolean> {
    if ((await control.count().catch(() => 0)) === 0) {
      return false;
    }

    const labelBox = await label.boundingBox().catch(() => null);
    const controlBox = await control.boundingBox().catch(() => null);
    if (!labelBox || !controlBox) {
      return false;
    }

    const labelCy = labelBox.y + labelBox.height / 2;
    const controlCy = controlBox.y + controlBox.height / 2;
    return Math.abs(controlCy - labelCy) <= 40 && controlBox.x >= labelBox.x - 8;
  }

  private async findTextareaOnSameRowAsLabel(scope: Frame | Page, label: Locator): Promise<Locator | null> {
    const fields = scope.locator('textarea, input[type="text"], input.slds-input');
    const count = await fields.count().catch(() => 0);
    const labelBox = await label.boundingBox().catch(() => null);
    if (!labelBox || count === 0) {
      return null;
    }

    let bestIndex = -1;
    let bestVertical = Number.POSITIVE_INFINITY;

    for (let i = 0; i < count; i++) {
      const box = await fields.nth(i).boundingBox().catch(() => null);
      if (!box) {
        continue;
      }

      const labelCy = labelBox.y + labelBox.height / 2;
      const fieldCy = box.y + box.height / 2;
      const vertical = Math.abs(fieldCy - labelCy);
      const toTheRight = box.x >= labelBox.x - 8;
      if (vertical <= 40 && toTheRight && vertical < bestVertical) {
        bestVertical = vertical;
        bestIndex = i;
      }
    }

    return bestIndex >= 0 ? fields.nth(bestIndex) : null;
  }

  private async fillDiscountReasonViaDom(scope: Frame | Page, value: string): Promise<boolean> {
    return scope
      .evaluate((val) => {
        const walk = (root: Document | ShadowRoot, visit: (root: Document | ShadowRoot) => void) => {
          visit(root);
          root.querySelectorAll('*').forEach((el) => {
            const shadow = (el as HTMLElement).shadowRoot;
            if (shadow) {
              walk(shadow, visit);
            }
          });
        };

        const labels: HTMLElement[] = [];
        const fields: Array<HTMLTextAreaElement | HTMLInputElement> = [];
        walk(document, (root) => {
          root.querySelectorAll('[tooltip="Discount Reason"]').forEach((el) => labels.push(el as HTMLElement));
          root.querySelectorAll('textarea, input[type="text"]').forEach((el) => {
            fields.push(el as HTMLTextAreaElement | HTMLInputElement);
          });
        });

        const label = labels[0];
        if (!label) {
          return false;
        }

        label.scrollIntoView({ block: 'center', inline: 'nearest' });
        label.style.setProperty('outline', '4px solid #ff0000', 'important');
        label.style.setProperty('background-color', '#ffff00', 'important');
        label.style.setProperty('box-shadow', '0 0 12px 4px #ff0000', 'important');

        const labelRect = label.getBoundingClientRect();
        const field = fields.find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          const labelCy = labelRect.y + labelRect.height / 2;
          const fieldCy = rect.y + rect.height / 2;
          return Math.abs(fieldCy - labelCy) <= 40 && rect.x >= labelRect.x - 8 && rect.width > 20;
        });

        if (!field) {
          return false;
        }

        field.style.setProperty('outline', '4px solid #ff0000', 'important');
        field.style.setProperty('background-color', '#ffff00', 'important');
        field.focus();
        field.click();
        field.value = val;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })
      .catch(() => false);
  }

  private async isSelectOnSameRowAsLabel(label: Locator, select: Locator): Promise<boolean> {
    if ((await select.count().catch(() => 0)) === 0) {
      return false;
    }

    const labelBox = await label.boundingBox().catch(() => null);
    const selectBox = await select.boundingBox().catch(() => null);
    if (!labelBox || !selectBox) {
      return false;
    }

    const labelCy = labelBox.y + labelBox.height / 2;
    const selectCy = selectBox.y + selectBox.height / 2;
    return Math.abs(selectCy - labelCy) <= 20 && selectBox.x >= labelBox.x - 8;
  }

  private async findSelectOnSameRowAsLabel(scope: Frame | Page, label: Locator): Promise<Locator | null> {
    const selects = scope.locator('select#myselect.myselect.desktop, select#myselect, select.myselect, select');
    const count = await selects.count().catch(() => 0);
    const labelBox = await label.boundingBox().catch(() => null);
    if (!labelBox || count === 0) {
      return null;
    }

    let bestIndex = -1;
    let bestVertical = Number.POSITIVE_INFINITY;

    for (let i = 0; i < count; i++) {
      const box = await selects.nth(i).boundingBox().catch(() => null);
      if (!box) {
        continue;
      }

      const labelCy = labelBox.y + labelBox.height / 2;
      const selectCy = box.y + box.height / 2;
      const vertical = Math.abs(selectCy - labelCy);
      const toTheRight = box.x >= labelBox.x - 8;
      if (vertical <= 20 && toTheRight && vertical < bestVertical) {
        bestVertical = vertical;
        bestIndex = i;
      }
    }

    return bestIndex >= 0 ? selects.nth(bestIndex) : null;
  }

  private async highlightTooltipLabelAndClickPicklist(scope: Frame | Page, value: string): Promise<boolean> {
    return scope
      .evaluate((val) => {
        const walk = (root: Document | ShadowRoot, visit: (root: Document | ShadowRoot) => void) => {
          visit(root);
          root.querySelectorAll('*').forEach((el) => {
            const shadow = (el as HTMLElement).shadowRoot;
            if (shadow) {
              walk(shadow, visit);
            }
          });
        };

        const labels: HTMLElement[] = [];
        const selects: HTMLSelectElement[] = [];
        walk(document, (root) => {
          root.querySelectorAll('[tooltip="Expedite Reason"]').forEach((el) => labels.push(el as HTMLElement));
          root
            .querySelectorAll('select#myselect.myselect.desktop, select#myselect, select.myselect.desktop')
            .forEach((el) => selects.push(el as HTMLSelectElement));
        });

        const label = labels[0];
        if (!label) {
          return false;
        }

        label.scrollIntoView({ block: 'center', inline: 'nearest' });
        label.style.setProperty('outline', '4px solid #ff0000', 'important');
        label.style.setProperty('background-color', '#ffff00', 'important');
        label.style.setProperty('box-shadow', '0 0 12px 4px #ff0000', 'important');

        const labelRect = label.getBoundingClientRect();
        const picklist =
          selects.find((select) => {
            const rect = select.getBoundingClientRect();
            const labelCy = labelRect.top + labelRect.height / 2;
            const selectCy = rect.top + rect.height / 2;
            return Math.abs(selectCy - labelCy) <= 20 && rect.left >= labelRect.left - 8;
          }) ??
          null;

        if (!picklist) {
          return false;
        }

        picklist.style.setProperty('outline', '4px solid #ff0000', 'important');
        picklist.click();
        const option = Array.from(picklist.options).find((o) => new RegExp(`^${val}$`, 'i').test(o.text.trim()));
        if (option) {
          picklist.value = option.value;
          option.selected = true;
          picklist.dispatchEvent(new Event('input', { bubbles: true }));
          picklist.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
      }, value)
      .catch(() => false);
  }

  private async trySelectBypassInScope(scope: Frame | Page, value: string): Promise<void> {
    const select = scope.locator('select#myselect.myselect.desktop, select#myselect, select.myselect').first();
    if ((await select.count().catch(() => 0)) > 0) {
      await select.selectOption({ label: value }).catch(() => undefined);
    }

    await scope
      .evaluate((val) => {
        const selects = Array.from(document.querySelectorAll('select#myselect, select.myselect')) as HTMLSelectElement[];
        const select =
          selects.find((s) => Array.from(s.options).some((o) => new RegExp(`^${val}$`, 'i').test(o.text.trim()))) ??
          selects[0];
        if (!select) {
          return;
        }
        const option = Array.from(select.options).find((o) => new RegExp(`^${val}$`, 'i').test(o.text.trim()));
        if (!option) {
          return;
        }
        select.value = option.value;
        option.selected = true;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }, value)
      .catch(() => undefined);
  }

  async highlightExpediteReasonField(): Promise<void> {
    await this.closeStrayTabs();

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      for (const frame of this.expediteReasonFrames()) {
        if (await this.expediteReasonInFrame(frame, 'myselect', 'highlight', '')) {
          console.log(`>>> Highlighted Expedite Reason in: ${frame.url()}`);
          await this.page.waitForTimeout(2_000);
          return;
        }
      }
      await this.page.waitForTimeout(500);
    }

    await this.debugExpediteFrames();
    throw new Error('Could not highlight Expedite Reason field');
  }

  async clickDropdownSelectById(selectId: string, value = 'Bypass'): Promise<void> {
    await this.closeStrayTabs();

    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      for (const frame of this.expediteReasonFrames()) {
        if (await this.expediteReasonInFrame(frame, selectId, 'select', value)) {
          console.log(`>>> Selected ${value} on Expedite Reason in: ${frame.url()}`);
          return;
        }
      }
      await this.page.waitForTimeout(500);
    }

    await this.debugExpediteFrames();
    throw new Error(`Could not select ${value} on Expedite Reason select#${selectId}`);
  }
}
