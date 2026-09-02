import type { BrowserContext } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { config } from './config';

export function getStorageStatePath(): string {
  return resolve(config.storageStatePath);
}

export function ensureAuthDir(): void {
  const dir = dirname(getStorageStatePath());
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function sessionFileExists(): boolean {
  return existsSync(getStorageStatePath());
}

export function getChromeProfilePath(): string {
  return resolve(config.chromeProfilePath);
}

export function chromeProfileExists(): boolean {
  const profile = getChromeProfilePath();
  return existsSync(join(profile, 'Default')) || existsSync(join(profile, 'Local State'));
}

export function hasStoredSession(): boolean {
  return config.reuseSession && (sessionFileExists() || chromeProfileExists());
}

export function lightningHomeUrl(baseUrl = config.baseUrl): string {
  const normalized = baseUrl.replace(/\/$/, '');

  if (/\.sandbox\.my\.salesforce\.com/i.test(normalized)) {
    return `${normalized.replace('.sandbox.my.salesforce.com', '.sandbox.lightning.force.com')}/lightning/page/home`;
  }

  if (/\.my\.salesforce\.com/i.test(normalized)) {
    return `${normalized.replace('.my.salesforce.com', '.lightning.force.com')}/lightning/page/home`;
  }

  return `${normalized}/lightning/page/home`;
}

export async function applySavedCookies(context: BrowserContext): Promise<number> {
  if (!sessionFileExists()) {
    return 0;
  }

  try {
    const state = JSON.parse(readFileSync(getStorageStatePath(), 'utf-8')) as {
      cookies?: Parameters<BrowserContext['addCookies']>[0];
    };
    if (!state.cookies?.length) {
      return 0;
    }
    await context.addCookies(state.cookies);
    return state.cookies.length;
  } catch {
    return 0;
  }
}

export async function saveSession(context: BrowserContext): Promise<void> {
  ensureAuthDir();
  await context.storageState({ path: getStorageStatePath(), indexedDB: true });
}

