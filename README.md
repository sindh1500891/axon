# AXON BDD — Salesforce Playwright + Cucumber

UI automation framework for the **Axon Salesforce test sandbox** using Playwright and Cucumber (BDD).

## Project structure

```
tests/
  features/          # Gherkin feature files (.feature)
  steps/             # Step definitions (Given/When/Then)
  pages/             # Page Object Model (locators + actions)
  support/           # World, hooks, config
reports/             # HTML report + failure screenshots
```

## Prerequisites

- Node.js 18+
- Google Chrome (Playwright uses `channel: 'chrome'`)
- Salesforce test sandbox credentials

## Setup

```bash
npm install
npx playwright install chrome
```

Copy environment file and fill credentials:

```bash
copy .env.example .env
```

Edit `.env`:

| Variable | Description |
|---|---|
| `BASE_URL` | Sandbox My Domain URL (e.g. `https://axon--test.sandbox.my.salesforce.com`) |
| `SF_SANDBOX_URL` | Login URL (`https://test.salesforce.com`) |
| `SF_USERNAME` | Sandbox username |
| `SF_PASSWORD` | Sandbox password |
| `SF_SECURITY_TOKEN` | Optional — append to password if required |
| `HEADED` | `true` to see the browser |

## Run tests

Headless (default):

```bash
npm test
```

Headed (visible browser):

```bash
npm run test:headed
```

Smoke tests only:

```bash
npm run test:smoke
```

Login scenario only:

```bash
npm run test:login
```

## Reports

After each run, open:

- `reports/cucumber-report.html` — Cucumber HTML report
- `reports/<timestamp>-failed.png` — screenshot on failure

## Writing new scenarios

1. Add a `.feature` file under `tests/features/`
2. Create step definitions in `tests/steps/`
3. Put reusable UI logic in `tests/pages/`
4. Tag scenarios (`@smoke`, `@regression`) for selective runs

Example:

```gherkin
@regression
Feature: Account search
  Scenario: Find account by name
    Given I am logged into Salesforce test sandbox
    When I search for account "Acme Corp"
    Then I should see the account record
```

## Tips for Salesforce Lightning

- Use role-based locators (`getByRole`) where possible
- Wait for Lightning shell (`.slds-global-header`) after navigation
- Avoid hard-coded `waitForTimeout` — prefer `expect(...).toBeVisible()`
- If MFA is enabled on the sandbox user, UI login automation will need an alternate approach (API session or bypass user)
