import { loadAccount, saveAccount, SavedAccount, updateCredentials } from './accounts';
import { readOAuthAccount, writeOAuthAccount } from './claudeConfig';
import { readActiveCredentials, writeActiveCredentials } from './credentials';

/** Save whoever is logged in to Claude Code right now. */
export function saveCurrentLogin(): SavedAccount {
  const oauthAccount = readOAuthAccount();
  const credentials = readActiveCredentials();
  if (!oauthAccount) {
    throw new Error('No Claude Code login found. Log in to Claude Code first.');
  }
  if (!credentials?.claudeAiOauth?.accessToken) {
    throw new Error('Could not read Claude Code credentials. Log in to Claude Code first.');
  }
  return saveAccount(oauthAccount, credentials);
}

/**
 * Make `email` the active Claude Code login. Before overwriting, the current login's tokens are
 * copied back into its saved file, because Claude Code may have refreshed them since it was saved.
 */
export function switchTo(email: string): SavedAccount {
  const target = loadAccount(email);
  if (!target) {
    throw new Error(`No saved login for ${email}.`);
  }

  const current = readOAuthAccount();
  const currentCreds = readActiveCredentials();
  if (current && current.emailAddress !== email && currentCreds?.claudeAiOauth?.accessToken) {
    updateCredentials(current.emailAddress, currentCreds);
  }

  writeActiveCredentials(target.credentials);
  writeOAuthAccount(target.oauthAccount);
  return target;
}
