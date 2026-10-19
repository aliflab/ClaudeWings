import { readJson, writeJsonAtomic } from './fsutil';
import { claudeJsonPath } from './paths';

export interface OAuthAccount {
  emailAddress: string;
  accountUuid?: string;
  organizationUuid?: string;
  displayName?: string;
  [key: string]: unknown;
}

export function readOAuthAccount(): OAuthAccount | undefined {
  const cfg = readJson<Record<string, unknown>>(claudeJsonPath());
  const acct = cfg?.oauthAccount as OAuthAccount | undefined;
  return acct && acct.emailAddress ? acct : undefined;
}

// Replace only the oauthAccount key; every other setting in ~/.claude.json is preserved.
export function writeOAuthAccount(account: OAuthAccount): void {
  const file = claudeJsonPath();
  const cfg = readJson<Record<string, unknown>>(file) ?? {};
  cfg.oauthAccount = account;
  writeJsonAtomic(file, cfg, 0o644);
}
