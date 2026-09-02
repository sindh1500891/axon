import { Given } from '@cucumber/cucumber';
import { config, passwordWithToken } from '../support/config';
import { loadMcpSalesforceCredentials, loginPassword } from '../support/mcp-credentials';
import { chromeProfileExists, sessionFileExists } from '../support/session-storage';
import type { SalesforceWorld } from '../support/world';

async function loginOrReuseSession(world: SalesforceWorld): Promise<void> {
  if (config.reuseSession && (sessionFileExists() || chromeProfileExists() || world.persistentSession)) {
    await world.loginPage.openHome();
    world.sessionReused = true;
    console.log('\n>>> Logged in via saved session — MFA skipped.\n');
    await world.page.waitForTimeout(5_000);
    return;
  }

  if (config.username && config.password) {
    await world.loginPage.loginTwoStep(config.username, passwordWithToken());
    await world.page.waitForTimeout(5_000);
    return;
  }

  const credentials = loadMcpSalesforceCredentials();
  await world.loginPage.loginTwoStep(credentials.username, loginPassword(credentials));
  await world.page.waitForTimeout(5_000);
}

Given('I am logged into Salesforce test sandbox', async function (this: SalesforceWorld) {
  await loginOrReuseSession(this);
});

Given('Login to salesforce', async function (this: SalesforceWorld) {
  await loginOrReuseSession(this);
});
