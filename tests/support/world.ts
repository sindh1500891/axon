import { setWorldConstructor, World, type IWorldOptions } from '@cucumber/cucumber';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { AccountPage } from '../pages/account.page';
import { HomePage } from '../pages/home.page';
import { LoginPage } from '../pages/login.page';
import type { McpSalesforceCredentials } from './mcp-credentials';

export class SalesforceWorld extends World {
  browser!: Browser;
  context!: BrowserContext;
  page!: Page;

  loginPage!: LoginPage;
  homePage!: HomePage;
  accountPage!: AccountPage;

  mcpCredentials?: McpSalesforceCredentials;
  encryptedUsername = '';
  encryptedPassword = '';
  decryptedUsername = '';
  decryptedPassword = '';
  sessionReused = false;
  quoteNumber = '';
  orderNumber = '';
  currentStep = '';
  persistentSession = false;
  stopSessionKeepAlive?: () => void;

  constructor(options: IWorldOptions) {
    super(options);
  }

  initPages(): void {
    this.loginPage = new LoginPage(this.page);
    this.homePage = new HomePage(this.page);
    this.accountPage = new AccountPage(this.page);
  }
}

setWorldConstructor(SalesforceWorld);
