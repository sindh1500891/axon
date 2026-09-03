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

## JWT Authentication (bypasses MFA)

Set `AUTH_MODE=jwt` in `.env` to log in via Salesforce's JWT Bearer Flow instead of the UI form — no MFA prompt, no saved session needed. `AUTH_MODE=ui` (default) keeps the existing username/password flow untouched.

### One-time setup (per Connected App, not per person)

1. Generate an RSA key pair + self-signed certificate:
   ```bash
   openssl req -x509 -newkey rsa:2048 -keyout secrets/axontest-server.key -out secrets/axontest-server.crt -days 365 -nodes
   ```
   `-nodes` is required — the key must be unencrypted since the framework reads it directly with no passphrase prompt. Keep both files under `secrets/` (already gitignored).
2. In Salesforce Setup → App Manager, create a Connected App (or External Client App):
   - Enable OAuth, check **"Use Digital Signatures"**, upload `axontest-server.crt`
   - Scopes: `api` + `web` (or `full`)
3. Edit the app's policies: **Permitted Users → "Admin approved users are pre-authorized"**, relax IP restrictions, and assign the profile/permission set that covers your test user(s).
4. Note the **Consumer Key** — this is `SF_JWT_CLIENT_ID`.

### Env vars

| Variable | Description |
|---|---|
| `AUTH_MODE` | `jwt` to enable this flow |
| `SF_JWT_CLIENT_ID` | Connected App Consumer Key — same for everyone |
| `SF_JWT_USERNAME` | Sandbox username the token is issued for — falls back to `SF_USERNAME` if unset |
| `SF_JWT_PRIVATE_KEY_PATH` | Path to the unencrypted private key (default `secrets/axontest-server.key`) |
| `SF_JWT_AUDIENCE` | `https://test.salesforce.com` (sandbox) / `https://login.salesforce.com` (production) |
| `SF_JWT_LOGIN_URL` | OAuth token endpoint host — usually same as the audience |

### The cert, key, and username explained

The JWT has three relevant parts: `iss` (Consumer Key), `sub` (username), `aud` (login host) — signed with the private key. The **cert and Consumer Key are fixed constants** for the whole Connected App; **`sub` (username) is the only thing that varies per person or per service account.**

- **Cert (`.crt`)** — public, uploaded to Salesforce once. Safe to share.
- **Private key (`.key`)** — pairs with that one cert; the same key is used no matter whose username is in `sub`. Never commit it. Share it only through a secrets vault or CI secret store — new teammates receive this file, they don't generate their own (a self-generated key won't match the uploaded cert).
- **Username (`sub`)** — either one shared service account for all automation, or each person's own sandbox username. If using per-person usernames, an admin must add each new person's user to the Connected App's pre-authorized profile/permission set; the key and cert stay the same either way.

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
