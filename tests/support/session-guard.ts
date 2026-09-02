import type { Page } from '@playwright/test';

const SESSION_ENDED_TEXT = /your session has ended/i;

export function sessionEndedDialog(page: Page) {
  return page
    .getByRole('dialog')
    .filter({ hasText: SESSION_ENDED_TEXT })
    .or(page.locator('.slds-modal, lightning-modal, .uiModal, [role="dialog"]').filter({ hasText: SESSION_ENDED_TEXT }))
    .or(page.locator('one-sessionend, .oneSessionEnd'));
}

export function returnToPageButton(page: Page) {
  return page
    .getByRole('button', { name: /return to page/i })
    .or(page.locator('button, a, input[type="button"]').filter({ hasText: /return to page/i }));
}

/** Runs in the browser. Hides Salesforce session-end UI in light DOM and open shadow roots. */
export function stripSessionEndedOverlayInPage(): boolean {
  const ended = /your session has ended/i;
  const win = window as Window & { __axonStripSessionEnded?: boolean };
  let removed = false;

  const hideEl = (el: Element | null) => {
    if (!(el instanceof HTMLElement)) {
      return;
    }
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.setAttribute('aria-hidden', 'true');
    removed = true;
  };

  const isSessionNode = (el: Element) => {
    const tag = el.localName || '';
    const cls = String((el as HTMLElement).className || '');
    const role = el.getAttribute?.('role') || '';
    const text = el.textContent || '';
    return (
      tag === 'one-sessionend' ||
      /sessionend/i.test(tag) ||
      /sessionend/i.test(cls) ||
      ((role === 'dialog' || /slds-modal|uiModal/i.test(cls)) && ended.test(text))
    );
  };

  const visit = (root: Document | ShadowRoot | Element) => {
    const list =
      root instanceof Element ? [root, ...root.querySelectorAll('*')] : [...root.querySelectorAll('*')];

    for (const el of list) {
      if (isSessionNode(el)) {
        hideEl(el);
        const parent = el.parentElement;
        parent
          ?.querySelectorAll(':scope > .slds-backdrop, :scope > .slds-backdrop_open')
          .forEach((backdrop) => hideEl(backdrop));
        el.remove();
      }

      const shadow = (el as HTMLElement).shadowRoot;
      if (shadow) {
        visit(shadow);
      }
    }
  };

  if (!document.getElementById('axon-hide-session-ended')) {
    const style = document.createElement('style');
    style.id = 'axon-hide-session-ended';
    style.textContent = `
      one-sessionend, .oneSessionEnd {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  visit(document);

  if (!win.__axonStripSessionEnded) {
    win.__axonStripSessionEnded = true;
    setInterval(() => visit(document), 250);
    new MutationObserver(() => visit(document)).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  return removed;
}

function hideSessionHostFromNode(node: Node): void {
  const hideEl = (el: Element | null) => {
    if (!(el instanceof HTMLElement)) {
      return;
    }
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.setAttribute('aria-hidden', 'true');
  };

  let current: Node | null = node;
  while (current && current !== document.documentElement) {
    if (current instanceof HTMLElement) {
      const tag = current.localName || '';
      const cls = String(current.className || '');
      const role = current.getAttribute('role') || '';
      if (
        tag === 'one-sessionend' ||
        /sessionend/i.test(tag) ||
        /sessionend/i.test(cls) ||
        role === 'dialog' ||
        /slds-modal|uiModal/i.test(cls)
      ) {
        hideEl(current);
        current.parentElement
          ?.querySelectorAll(':scope > .slds-backdrop, :scope > .slds-backdrop_open')
          .forEach((backdrop) => {
            hideEl(backdrop);
            backdrop.remove();
          });
        current.remove();
        return;
      }
    }

    const parent = (current as HTMLElement).parentElement;
    if (parent) {
      current = parent;
      continue;
    }

    const root = current.getRootNode();
    if (root instanceof ShadowRoot) {
      hideEl(root.host);
      root.host.parentElement
        ?.querySelectorAll(':scope > .slds-backdrop, :scope > .slds-backdrop_open')
        .forEach((backdrop) => {
          hideEl(backdrop);
          backdrop.remove();
        });
      root.host.remove();
      return;
    }
    break;
  }
}

async function hideSessionEndedWithPlaywright(page: Page): Promise<boolean> {
  let hidden = false;

  const text = page.getByText(SESSION_ENDED_TEXT).first();
  if (await text.isVisible({ timeout: 0 }).catch(() => false)) {
    await text.evaluate(hideSessionHostFromNode).catch(() => undefined);
    hidden = true;
  }

  const dialogs = sessionEndedDialog(page);
  const dialogCount = await dialogs.count().catch(() => 0);
  for (let i = 0; i < dialogCount; i += 1) {
    const dialog = dialogs.nth(i);
    if (await dialog.isVisible({ timeout: 0 }).catch(() => false)) {
      await dialog.evaluate((el) => {
        const host = el as HTMLElement;
        host.style.setProperty('display', 'none', 'important');
        host.style.setProperty('visibility', 'hidden', 'important');
        host.style.setProperty('pointer-events', 'none', 'important');
        host.parentElement
          ?.querySelectorAll(':scope > .slds-backdrop, :scope > .slds-backdrop_open')
          .forEach((backdrop) => {
            if (backdrop instanceof HTMLElement) {
              backdrop.style.setProperty('display', 'none', 'important');
              backdrop.remove();
            }
          });
        host.remove();
      }).catch(() => undefined);
      hidden = true;
    }
  }

  await page
    .locator('one-sessionend, .oneSessionEnd')
    .evaluateAll((els) => {
      for (const el of els) {
        if (!(el instanceof HTMLElement)) {
          continue;
        }
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.remove();
      }
    })
    .catch(() => undefined);

  await page
    .getByRole('button', { name: /^log in$/i })
    .evaluateAll((els) => {
      for (const el of els) {
        if (el instanceof HTMLElement && /session has ended/i.test(el.closest('[role="dialog"], one-sessionend, .slds-modal')?.textContent || document.body.innerText || '')) {
          el.style.display = 'none';
          el.style.pointerEvents = 'none';
        }
      }
    })
    .catch(() => undefined);

  for (const frame of page.frames()) {
    await frame.evaluate(stripSessionEndedOverlayInPage).catch(() => undefined);
  }

  return hidden;
}

function isLoginUrl(url: string): boolean {
  return (
    /\/login\.jsp|login\.salesforce\.com|(^|\/\/)test\.salesforce\.com/i.test(url) &&
    !/lightning\.force\.com/i.test(url)
  );
}

export async function isSessionEndedVisible(page: Page): Promise<boolean> {
  if (page.isClosed()) {
    return false;
  }

  return (
    (await page.getByText(SESSION_ENDED_TEXT).first().isVisible({ timeout: 0 }).catch(() => false)) ||
    (await sessionEndedDialog(page).first().isVisible({ timeout: 0 }).catch(() => false))
  );
}

export async function isSalesforceLoginPage(page: Page): Promise<boolean> {
  if (page.isClosed()) {
    return false;
  }

  const headerVisible = await page
    .locator('.slds-global-header, .slds-global-header__item_search')
    .first()
    .isVisible({ timeout: 0 })
    .catch(() => false);

  if (headerVisible) {
    return false;
  }

  const url = page.url();
  if (/lightning\.force\.com|\/lightning\//i.test(url)) {
    return false;
  }

  if (isLoginUrl(url)) {
    return true;
  }

  return page
    .locator('#username, input[name="username"]')
    .first()
    .isVisible({ timeout: 0 })
    .catch(() => false);
}

export async function dismissSessionEndedIfPresent(page: Page): Promise<boolean> {
  if (page.isClosed()) {
    return false;
  }

  const removed = await hideSessionEndedWithPlaywright(page);
  if (removed) {
    console.log('\n>>> Session ended popup closed — reloading the page\n');
    await reloadPageAfterSessionPopup(page);
  }
  return removed;
}

export function isLightningCreateUrl(url: string): boolean {
  return /\/lightning\/o\/[^/]+\/new/i.test(url);
}

export function isLightningRecordUrl(url: string): boolean {
  return /\/lightning\/r\//i.test(url);
}

let lastRecordReloadAt = 0;

export async function reloadLightningRecordIfStuck(page: Page): Promise<boolean> {
  return reloadPageAfterSessionPopup(page);
}

export async function reloadPageAfterSessionPopup(page: Page): Promise<boolean> {
  if (page.isClosed()) {
    return false;
  }

  const url = page.url();
  if (isLightningCreateUrl(url) || (await isSalesforceLoginPage(page))) {
    return false;
  }

  if (Date.now() - lastRecordReloadAt < 12_000) {
    return false;
  }

  lastRecordReloadAt = Date.now();
  console.log(`\n>>> Reloading after session popup close: ${url}\n`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(3_000);
  await hideSessionEndedWithPlaywright(page);
  return true;
}

export async function recoverIfSessionEnded(page: Page): Promise<void> {
  await dismissSessionEndedIfPresent(page);
}

export function isSalesforceUrl(url: string): boolean {
  return /salesforce\.com|force\.com|visual\.force|vf\.force|file\.force/i.test(url);
}

export function startSessionKeepAlive(getPage: () => Page): () => void {
  let lastLogAt = 0;

  const timer = setInterval(() => {
    void (async () => {
      const page = getPage();
      if (!page || page.isClosed()) {
        return;
      }

      try {
        const hidden = await hideSessionEndedWithPlaywright(page);
        if (hidden) {
          if (Date.now() - lastLogAt > 8_000) {
            lastLogAt = Date.now();
            console.log('\n>>> Session ended popup closed — reloading the page\n');
          }
          await reloadPageAfterSessionPopup(page);
        }
        await page.mouse.move(140, 160).catch(() => undefined);
        await page.mouse.move(180, 190).catch(() => undefined);
      } catch {
        // Keep the test running even if a keep-alive ping fails.
      }
    })();
  }, 400);

  timer.unref?.();
  return () => clearInterval(timer);
}
