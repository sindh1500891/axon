import type { Page } from '@playwright/test';

export const HEADED_BROWSER_ARGS = ['--start-maximized'];

export async function maximizeBrowserWindow(page: Page): Promise<void> {
  try {
    const cdp = await page.context().newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'maximized' },
    });
  } catch {
    // Chrome channel on some environments may not support CDP maximize.
  }
}
