import { SavedAccount, updateCredentials } from './accounts';
import { CredentialsBlob, OAuthCredentials, readActiveCredentials } from './credentials';

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const TOKEN_URL = 'https://console.anthropic.com/v1/oauth/token';
// Claude Code's public OAuth client id.
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

export type UsageStatus = 'ok' | 'expired' | 'error';

export interface UsageInfo {
  status: UsageStatus;
  session?: number; // five-hour window, percent used
  weekly?: number; // seven-day window, percent used
  sessionResetsAt?: string;
  weeklyResetsAt?: string;
  message?: string;
  checkedAt: number;
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function fetchUsage(accessToken: string): Promise<UsageInfo> {
  const res = await fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new HttpError(res.status, `Usage check failed (HTTP ${res.status})`);
  }
  const body = (await res.json()) as any;
  return {
    status: 'ok',
    session: pct(body?.five_hour?.utilization),
    weekly: pct(body?.seven_day?.utilization),
    sessionResetsAt: body?.five_hour?.resets_at ?? undefined,
    weeklyResetsAt: body?.seven_day?.resets_at ?? undefined,
    checkedAt: Date.now(),
  };
}

function pct(v: unknown): number | undefined {
  return typeof v === 'number' && isFinite(v) ? Math.round(v) : undefined;
}

async function refreshTokens(oauth: OAuthCredentials): Promise<OAuthCredentials> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: oauth.refreshToken,
      client_id: CLIENT_ID,
    }),
  });
  if (!res.ok) {
    throw new HttpError(res.status, `Token refresh failed (HTTP ${res.status})`);
  }
  const body = (await res.json()) as any;
  return {
    ...oauth,
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? oauth.refreshToken,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
}

const expired = (message: string): UsageInfo => ({ status: 'expired', message, checkedAt: Date.now() });
const failed = (message: string): UsageInfo => ({ status: 'error', message, checkedAt: Date.now() });

/**
 * Check one account's usage. The active account's tokens belong to Claude Code, so we read them
 * live and never refresh them. Saved, inactive accounts are refreshed here when needed and the
 * new tokens are written back to their saved file.
 */
export async function checkUsage(account: SavedAccount, isActive: boolean): Promise<UsageInfo> {
  const blob: CredentialsBlob | undefined = isActive ? readActiveCredentials() : account.credentials;
  let oauth = blob?.claudeAiOauth;
  if (!oauth?.accessToken) {
    return expired('No saved token');
  }

  const persist = (fresh: OAuthCredentials) => {
    oauth = fresh;
    account.credentials = { ...blob, claudeAiOauth: fresh };
    updateCredentials(account.email, account.credentials);
  };

  try {
    if (!isActive && oauth.expiresAt && oauth.expiresAt < Date.now() + 60_000) {
      persist(await refreshTokens(oauth));
    }
    try {
      return await fetchUsage(oauth.accessToken);
    } catch (err) {
      if (err instanceof HttpError && err.status === 401 && !isActive) {
        persist(await refreshTokens(oauth));
        return await fetchUsage(oauth.accessToken);
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof HttpError && (err.status === 400 || err.status === 401 || err.status === 403)) {
      return isActive ? failed('Claude Code will refresh this login shortly') : expired('Login expired');
    }
    return failed(err instanceof Error ? err.message : String(err));
  }
}
