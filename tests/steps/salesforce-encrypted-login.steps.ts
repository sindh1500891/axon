import { Given, Then, When } from '@cucumber/cucumber';
import { assertCredentials, config } from '../support/config';
import { decrypt, encrypt } from '../support/crypto';
import { loadMcpSalesforceCredentials } from '../support/mcp-credentials';
import { recoverIfSessionEnded } from '../support/session-guard';
import { chromeProfileExists, ensureAuthDir, saveSession, sessionFileExists } from '../support/session-storage';
import type { SalesforceWorld } from '../support/world';

function resolveUsername(): string {
  if (config.username) {
    return config.username;
  }
  return loadMcpSalesforceCredentials().username;
}

function resolvePasswordForUiLogin(): string {
  if (config.password) {
    return config.password;
  }
  return loadMcpSalesforceCredentials().password;
}

Given('I am on the Salesforce test sandbox login page', async function (this: SalesforceWorld) {
  this.sessionReused = false;

  if (await this.loginPage.isLoggedIn()) {
    const base = (config.baseUrl || config.loginUrl).replace(/\/$/, '');
    await this.page.goto(`${base}/secur/logout.jsp`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    }).catch(() => undefined);
    await this.page.waitForTimeout(2_000);
  }

  const loginUrl = config.loginUrl || loadMcpSalesforceCredentials().loginUrl;
  await this.loginPage.open(loginUrl);
});

Given('I am logged in using saved session', async function (this: SalesforceWorld) {
  if (!config.reuseSession) {
    throw new Error('Set REUSE_SESSION=true in .env to bypass MFA with the saved session.');
  }

  if (!sessionFileExists() && !chromeProfileExists() && !this.persistentSession) {
    throw new Error(
      'No saved session. Run: npm run session:save — log in once (with MFA), then press Enter.',
    );
  }

  await this.loginPage.openHome();
  this.sessionReused = true;
  console.log('\n>>> Logged in via saved Chrome profile — MFA skipped. Waiting 15s for Lightning session to settle.\n');
  await this.page.waitForTimeout(15_000);
  await recoverIfSessionEnded(this.page).catch(() => undefined);
});

When('I encrypt the username and password from env', function (this: SalesforceWorld) {
  assertCredentials();
  const username = resolveUsername();
  const password = resolvePasswordForUiLogin();

  this.encryptedUsername = encrypt(username);
  this.encryptedPassword = encrypt(password);
});

When('I decrypt the credentials and enter username on the login page', async function (this: SalesforceWorld) {
  if (this.sessionReused) {
    return;
  }

  if (!this.encryptedUsername) {
    throw new Error('Username must be encrypted before decryption');
  }

  this.decryptedUsername = decrypt(this.encryptedUsername);
  await this.loginPage.enterUsername(this.decryptedUsername);
});

When('I click the Log In to Sandbox button', async function (this: SalesforceWorld) {
  if (this.sessionReused) {
    return;
  }

  await this.loginPage.clickLogInToSandbox();
});

When(
  'I enter username if visible otherwise focus the password field',
  async function (this: SalesforceWorld) {
    if (this.sessionReused) {
      return;
    }

    const username =
      this.decryptedUsername ||
      (this.encryptedUsername ? decrypt(this.encryptedUsername) : undefined);
    await this.loginPage.prepareForPasswordEntry(username);
  },
);

When('I decrypt and enter the password on the login page', async function (this: SalesforceWorld) {
  if (this.sessionReused) {
    return;
  }

  if (!this.encryptedPassword) {
    throw new Error('Password must be encrypted before decryption');
  }

  this.decryptedPassword = decrypt(this.encryptedPassword);
  await this.loginPage.enterPassword(this.decryptedPassword);
});

When('I complete verification code if prompted', async function (this: SalesforceWorld) {
  if (this.sessionReused) {
    return;
  }

  await this.loginPage.waitForVerificationCodeIfPrompted();

  if (config.saveSession && (await this.loginPage.isLoggedIn())) {
    await this.loginPage.openHome();
    await saveSession(this.context);
    console.log(`\n>>> Session saved (cookies + localStorage) to ${config.storageStatePath}\n`);
  }
});

When('I wait for {int} seconds', async function (this: SalesforceWorld, seconds: number) {
  const deadline = Date.now() + seconds * 1000;

  while (Date.now() < deadline) {
    if (this.page.isClosed()) {
      const remaining = this.context.pages().find((p) => !p.isClosed());
      if (!remaining) {
        throw new Error(
          'Browser page was closed during wait. Close other Chrome windows using this sandbox, then run: npm run session:save',
        );
      }
      this.page = remaining;
      this.initPages();
    }

    await recoverIfSessionEnded(this.page).catch(() => undefined);

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      break;
    }
    await this.page.waitForTimeout(Math.min(500, remaining)).catch(() => undefined);
  }
});

Then('I should see the Axon Sales app in Salesforce UI', async function (this: SalesforceWorld) {
  await this.homePage.verifyAxonSalesAppDisplayed();
});

Then('I should be logged into Axon Salesforce', async function (this: SalesforceWorld) {
  await this.homePage.verifyLoggedIntoSalesforce();
});

Then('I should be on the Axon Salesforce home page', async function (this: SalesforceWorld) {
  await this.homePage.verifyAxonHomePage();
});

When('I type {string} in the global search box', async function (this: SalesforceWorld, searchTerm: string) {
  await this.homePage.enterSearchTermInGlobalSearch(searchTerm);
});

When('I open {string} from search results', async function (this: SalesforceWorld, accountName: string) {
  await this.homePage.openAccountFromSearchResults(accountName);
});

When(
  'I type {string} in global search and open {string} from results',
  async function (this: SalesforceWorld, searchTerm: string, accountName: string) {
    await this.homePage.searchAndOpenAccount(searchTerm, accountName);
  },
);

When('I click the Related tab', async function (this: SalesforceWorld) {
  await this.accountPage.openRelatedTab();
});

When('I click the New button', async function (this: SalesforceWorld) {
  await this.accountPage.clickNewButton();
});

When('I click the Next button', async function (this: SalesforceWorld) {
  await this.accountPage.clickNextOnNewOpportunityModal();
});

When('I select today as the Close Date', async function (this: SalesforceWorld) {
  await this.accountPage.selectCloseDateToday();
});

When('I select {string} as the Stage', async function (this: SalesforceWorld, stageValue: string) {
  await this.accountPage.selectStage(stageValue);
});

When('I select {string} as the Type', async function (this: SalesforceWorld, typeValue: string) {
  await this.accountPage.selectType(typeValue);
});

When(
  'I type {string} in Primary Contact and select from results',
  async function (this: SalesforceWorld, contactName: string) {
    await this.accountPage.selectPrimaryContact(contactName);
  },
);

When('I click the Cooperative Contract field', async function (this: SalesforceWorld) {
  await this.accountPage.clickCooperativeContractField();
});

When('I enter {string} in the Cooperative Contract field', async function (this: SalesforceWorld, value: string) {
  await this.accountPage.enterCooperativeContract(value);
});

When('I select {string} from the Cooperative Contract search results', async function (this: SalesforceWorld, value: string) {
  await this.accountPage.selectCooperativeContractResult(value);
});

When('I append today\'s date and time to the Opportunity Name', async function (this: SalesforceWorld) {
  await this.accountPage.appendTodayDateTimeToOpportunityName();
});

When('I click the Save button', async function (this: SalesforceWorld) {
  await this.accountPage.clickSaveButton();
  await recoverIfSessionEnded(this.page);
});

When('I click the opportunity actions dropdown arrow', async function (this: SalesforceWorld) {
  await this.accountPage.clickOpportunityActionsDropdown();
});

When('I click the highlighted actions dropdown', async function (this: SalesforceWorld) {
  await this.accountPage.clickOpportunityActionsDropdown();
});

When('I click New Quote', async function (this: SalesforceWorld) {
  await this.accountPage.clickNewQuote();
});

When('I click Save on the New Quote form', async function (this: SalesforceWorld) {
  await this.accountPage.clickNewQuoteSaveButton();
});

When('I click Show All in Related List Quick Links', async function (this: SalesforceWorld) {
  await this.accountPage.clickShowAllRelatedListQuickLinks();
});

When('I click Quotes in Related List Quick Links', async function (this: SalesforceWorld) {
  await this.accountPage.clickQuotesQuickLink();
});

When('I extract QuoteNumber from the quote link and click it', async function (this: SalesforceWorld) {
  this.quoteNumber = await this.accountPage.extractAndClickQuoteNumber();
  console.log(`\n>>> QuoteNumber: ${this.quoteNumber}\n`);
});

When('I click the Edit Lines button', async function (this: SalesforceWorld) {
  await this.accountPage.clickEditLinesButton();
});

When('I click the Add Products button', async function (this: SalesforceWorld) {
  await this.accountPage.clickAddProductsButton();
});

When('I click Search Products and type {string}', async function (
  this: SalesforceWorld,
  productCode: string,
) {
  await this.accountPage.clickSearchProductsAndType(productCode);
});

When('I select product {string} checkbox and click Select', async function (
  this: SalesforceWorld,
  productCode: string,
) {
  await this.accountPage.selectProductCheckboxAndClickSelect(productCode);
});

When('I enter Quantity as {int} on Configure Products', async function (
  this: SalesforceWorld,
  quantity: number,
) {
  await this.accountPage.enterConfigureProductsQuantity(String(quantity));
});

When('I click Save on Configure Products', async function (this: SalesforceWorld) {
  await this.accountPage.clickConfigureProductsSaveButton();
});

When('I click Save on Quote Line Editor', async function (this: SalesforceWorld) {
  await this.accountPage.clickQuoteLineEditorSave();
});

When('I click the Expedite Reason dropdown and select {string}', async function (
  this: SalesforceWorld,
  value: string,
) {
  await this.accountPage.clickExpediteReasonAndSelect(value);
});

When('I click the Discount Reason text area and enter {string}', async function (
  this: SalesforceWorld,
  value: string,
) {
  await this.accountPage.clickDiscountReasonAndEnter(value);
});

When('I click the dropdown select with id {string} and select {string}', async function (
  this: SalesforceWorld,
  selectId: string,
  value: string,
) {
  await this.accountPage.clickDropdownSelectById(selectId, value);
});

When('I double click the highlighted div and enter {string}', async function (
  this: SalesforceWorld,
  value: string,
) {
  await this.accountPage.doubleClickHighlightedDivAndEnter(value);
});

When('I click Continue on the Alert dialog', async function (this: SalesforceWorld) {
  await this.accountPage.clickAlertContinueButton();
});

When('I click the Calculate button {int} times', async function (
  this: SalesforceWorld,
  times: number,
) {
  await this.accountPage.clickCalculateButton(times);
});

Then('the quote number is displayed', async function (this: SalesforceWorld) {
  await this.accountPage.verifyQuoteNumberIsDisplayed(this.quoteNumber);
});

When('I click the Invoice Plans tab', async function (this: SalesforceWorld) {
  await this.accountPage.clickInvoicePlansTab();
});

When('I click the Create Invoice Plan button', async function (this: SalesforceWorld) {
  await this.accountPage.clickCreateInvoicePlanButton();
});

When('I click Create on the Create New Invoice Plan form', async function (this: SalesforceWorld) {
  await this.accountPage.clickCreateOnNewInvoicePlanModal();
});

When('I click the Shipping Details tab', async function (this: SalesforceWorld) {
  await this.accountPage.clickShippingDetailsTab();
});

When('I click the Save All Shipping Details button', async function (this: SalesforceWorld) {
  await this.accountPage.clickSaveAllShippingDetailsButton();
});

When('I click the quote actions down arrow', async function (this: SalesforceWorld) {
  await this.accountPage.clickQuoteActionsDownArrow();
});

When('I highlight the Vertex Quote Tax Call button', async function (this: SalesforceWorld) {
  await this.accountPage.highlightAndClickVertexQuoteTaxCall();
});

When('I click Generate Payment Soup', async function (this: SalesforceWorld) {
  await this.accountPage.clickGeneratePaymentSoup();
});

When('I click the close icon on the Generate Payment Soup dialog', async function (this: SalesforceWorld) {
  await this.accountPage.clickGeneratePaymentSoupDialogCloseIcon();
});

When('I click the close icon on the tax call dialog', async function (this: SalesforceWorld) {
  await this.accountPage.clickTaxCallDialogCloseIcon();
});

When('I click the Run Quote Quality Check button', async function (this: SalesforceWorld) {
  await this.accountPage.clickRunQuoteQualityCheckButton();
});

When('I validate the text {string}', async function (this: SalesforceWorld, text: string) {
  await this.accountPage.validateAndHighlightText(text);
});

When('I click the close icon on the quality check dialog', async function (this: SalesforceWorld) {
  await this.accountPage.clickQualityCheckDialogCloseIcon();
});

When('I click the Quote Quality Check tab', async function (this: SalesforceWorld) {
  await this.accountPage.clickQuoteQualityCheckTab();
});

When('I click the Refresh Results button', async function (this: SalesforceWorld) {
  await this.accountPage.clickRefreshResultsButton();
});

When('I click the Submit for Approval button', async function (this: SalesforceWorld) {
  await this.accountPage.clickSubmitForApproval();
});

When('I click the Return to Quote button', async function (this: SalesforceWorld) {
  await this.accountPage.clickReturnToQuoteButton();
});

When('I highlight the Vertex Tax Status field', async function (this: SalesforceWorld) {
  await this.accountPage.highlightVertexTaxStatusField();
});

When('I scroll to the Status field', async function (this: SalesforceWorld) {
  await this.accountPage.scrollToStatusElement();
});

When('I highlight the Status edit icon', async function (this: SalesforceWorld) {
  await this.accountPage.highlightStatusEditIcon();
});

When('I click the Status edit icon', async function (this: SalesforceWorld) {
  await this.accountPage.clickStatusEditIcon();
});

When('I click the Status picklist down arrow', async function (this: SalesforceWorld) {
  await this.accountPage.clickStatusPicklistDownArrow();
});

When('I click the Status picklist and select {string}', async function (this: SalesforceWorld, value: string) {
  await this.accountPage.selectQuoteLayoutPicklist('Status', value);
});

When('I click the Approval Status picklist and select {string}', async function (this: SalesforceWorld, value: string) {
  await this.accountPage.selectQuoteLayoutPicklist('Approval Status', value);
});

When('I click Save on the quote details form', async function (this: SalesforceWorld) {
  await this.accountPage.clickQuoteDetailsSaveButton();
});

When('I click the Opportunity record link', async function (this: SalesforceWorld) {
  await this.accountPage.clickOpportunityRecordLink();
});

When('I click the Closed stage', async function (this: SalesforceWorld) {
  await this.accountPage.clickClosedStageOnPath();
});

When('I click Select Closed Stage', async function (this: SalesforceWorld) {
  await this.accountPage.clickSelectClosedStage();
});

When('I click the Done button', async function (this: SalesforceWorld) {
  await this.accountPage.clickEditDependenciesDoneButton();
});

When('I validate the Stage field is {string}', async function (this: SalesforceWorld, value: string) {
  await this.accountPage.validateStageField(value);
});

When('I scroll to Orders in Related List Quick Links', async function (this: SalesforceWorld) {
  await this.accountPage.scrollToOrdersQuickLink();
});

When('I click Orders', async function (this: SalesforceWorld) {
  await this.accountPage.clickOrdersQuickLink();
});

When('I click the Order Number link', async function (this: SalesforceWorld) {
  this.orderNumber = await this.accountPage.clickOrderNumberLink();
  console.log(`\n>>> OrderNumber: ${this.orderNumber}\n`);
});

When('I click the Activate Order button', async function (this: SalesforceWorld) {
  await this.accountPage.clickActivateOrderButton();
});

When('I click the Start Order Activation button', async function (this: SalesforceWorld) {
  await this.accountPage.clickStartOrderActivationButton();
});

When('I click the close icon on the order activation dialog', async function (this: SalesforceWorld) {
  await this.accountPage.clickOrderActivationDialogCloseIcon();
});

When('I click the highlighted refresh icon in Order Activation Status', async function (this: SalesforceWorld) {
  await this.accountPage.clickOrderActivationStatusRefreshIcon();
});

When('I refresh the page', async function (this: SalesforceWorld) {
  await this.accountPage.refreshPage();
});
