import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { decrypt } from './crypto';

function mcpBaseUrl(): string | undefined {
  try {
    const mcpPath = process.env.MCP_JSON_PATH || join(homedir(), '.cursor', 'mcp.json');
    if (!existsSync(mcpPath)) return undefined;
    const parsed = JSON.parse(readFileSync(mcpPath, 'utf-8')) as {
      mcpServers?: Record<string, { env?: Record<string, string> }>;
    };
    return parsed.mcpServers?.['salesforce-test']?.env?.SF_LOGIN_URL?.trim();
  } catch {
    return undefined;
  }
}

function resolveSecret(plainKey: string, encryptedKey: string, allowDecryptFailure = false): string {
  const encrypted = process.env[encryptedKey]?.trim();
  if (encrypted) {
    try {
      return decrypt(encrypted);
    } catch {
      if (allowDecryptFailure) {
        return process.env[plainKey]?.trim() ?? '';
      }
      throw new Error(
        `Failed to decrypt ${encryptedKey}. Check ENCRYPTION_SECRET matches the value used during encryption.`,
      );
    }
  }
  return process.env[plainKey]?.trim() ?? '';
}

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

const mcpUrl = mcpBaseUrl();
const reuseSession = String(process.env.REUSE_SESSION || 'false').toLowerCase() === 'true';

export const config = {
  baseUrl: (process.env.BASE_URL || mcpUrl || 'https://axon--test.sandbox.my.salesforce.com').trim(),
  loginUrl: (process.env.BASE_URL || mcpUrl || 'https://axon--test.sandbox.my.salesforce.com').trim(),
  username: process.env.SF_USERNAME?.trim() ?? '',
  password: resolveSecret('SF_PASSWORD', 'SF_PASSWORD_ENCRYPTED', reuseSession),
  securityToken: resolveSecret('SF_SECURITY_TOKEN', 'SF_SECURITY_TOKEN_ENCRYPTED', reuseSession),
  headed: String(process.env.HEADED || '').toLowerCase() === 'true',
  keepBrowserOpen: String(process.env.KEEP_BROWSER_OPEN || 'true').toLowerCase() === 'true',
  reuseSession,
  alwaysPromptVerification:
    String(process.env.ALWAYS_PROMPT_VERIFICATION || 'true').toLowerCase() === 'true',
  verificationTimeoutMs: Number(process.env.VERIFICATION_TIMEOUT_MS || 180_000),
  saveSession: String(process.env.SAVE_SESSION || 'true').toLowerCase() === 'true',
  storageStatePath: (process.env.SESSION_STORAGE_PATH || 'playwright/.auth/salesforce.json').trim(),
  chromeProfilePath: (process.env.CHROME_PROFILE_PATH || 'playwright/.auth/chrome-profile').trim(),
};

export function assertCredentials(): void {
  required('SF_USERNAME', config.username);
  if (!config.password) {
    throw new Error('Missing SF_PASSWORD or SF_PASSWORD_ENCRYPTED in .env');
  }
}

export function passwordWithToken(): string {
  return config.securityToken
    ? `${config.password}${config.securityToken}`
    : config.password;
}
