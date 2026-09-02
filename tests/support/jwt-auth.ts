import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { config } from './config';

export interface JwtTokenResponse {
  access_token: string;
  instance_url: string;
  id: string;
  token_type: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function buildJwtAssertion(): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: config.jwt.clientId,
    sub: config.jwt.username,
    aud: config.jwt.audience,
    exp: Math.floor(Date.now() / 1000) + 180,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const privateKey = readFileSync(config.jwt.privateKeyPath, 'utf-8');
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();

  return `${signingInput}.${base64url(signer.sign(privateKey))}`;
}

/** Exchanges a signed JWT assertion for an OAuth access token (JWT Bearer Flow). */
export async function fetchJwtAccessToken(): Promise<JwtTokenResponse> {
  const assertion = buildJwtAssertion();
  const tokenUrl = `${config.jwt.loginUrl.replace(/\/$/, '')}/services/oauth2/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const payload = (await response.json()) as JwtTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(
      `JWT bearer token request failed (${response.status}): ${payload.error ?? ''} ${payload.error_description ?? ''}`.trim(),
    );
  }

  return payload;
}

/** Exchanges an OAuth access token for a logged-in Lightning session (bridges API auth to UI). */
export function frontDoorUrl(instanceUrl: string, accessToken: string, retUrl = '/lightning/page/home'): string {
  return `${instanceUrl.replace(/\/$/, '')}/secur/frontdoor.jsp?sid=${encodeURIComponent(accessToken)}&retURL=${encodeURIComponent(retUrl)}`;
}
