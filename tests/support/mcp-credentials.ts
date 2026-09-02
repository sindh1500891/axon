import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { AXON_MY_DOMAIN_URL } from '../pages/login.page';

export interface McpSalesforceCredentials {
  username: string;
  password: string;
  securityToken: string;
  loginUrl: string;
  instanceUrl: string;
}

const DEFAULT_MCP_PATH = join(homedir(), '.cursor', 'mcp.json');

export function loadMcpSalesforceCredentials(
  mcpPath = process.env.MCP_JSON_PATH || DEFAULT_MCP_PATH,
): McpSalesforceCredentials {
  const raw = readFileSync(mcpPath, 'utf-8');
  const parsed = JSON.parse(raw) as {
    mcpServers?: Record<string, { env?: Record<string, string> }>;
  };

  const env = parsed.mcpServers?.['salesforce-test']?.env;
  if (!env?.SF_USERNAME || !env?.SF_PASSWORD) {
    throw new Error(
      'salesforce-test SF_USERNAME and SF_PASSWORD not found in mcp.json',
    );
  }

  const instanceUrl = (env.SF_LOGIN_URL || AXON_MY_DOMAIN_URL).trim();

  return {
    username: env.SF_USERNAME.trim(),
    password: env.SF_PASSWORD.trim(),
    securityToken: (env.SF_SECURITY_TOKEN || '').trim(),
    loginUrl: instanceUrl,
    instanceUrl,
  };
}

export function loginPassword(credentials: McpSalesforceCredentials): string {
  return credentials.securityToken
    ? `${credentials.password}${credentials.securityToken}`
    : credentials.password;
}
