import * as fs from 'fs';
import * as path from 'path';
import { OAuthAccount } from './claudeConfig';
import { CredentialsBlob } from './credentials';
import { readJson, writeJsonAtomic } from './fsutil';
import { accountsDir } from './paths';

export interface SavedAccount {
  email: string;
  label: string;
  oauthAccount: OAuthAccount;
  credentials: CredentialsBlob;
  savedAt: string;
}

export function labelFor(email: string): string {
  return email.split('@')[0] || email;
}

function fileFor(email: string): string {
  const safe = email.toLowerCase().replace(/[^a-z0-9@._+-]/g, '_');
  return path.join(accountsDir(), `${safe}.json`);
}

export function listAccounts(): SavedAccount[] {
  let names: string[];
  try {
    names = fs.readdirSync(accountsDir());
  } catch {
    return [];
  }
  return names
    .filter((n) => n.endsWith('.json'))
    .map((n) => readJson<SavedAccount>(path.join(accountsDir(), n)))
    .filter((a): a is SavedAccount => !!a && !!a.email && !!a.credentials)
    .sort((a, b) => a.email.localeCompare(b.email));
}

export function loadAccount(email: string): SavedAccount | undefined {
  return readJson<SavedAccount>(fileFor(email));
}

export function saveAccount(oauthAccount: OAuthAccount, credentials: CredentialsBlob): SavedAccount {
  const email = oauthAccount.emailAddress;
  const account: SavedAccount = {
    email,
    label: labelFor(email),
    oauthAccount,
    credentials,
    savedAt: new Date().toISOString(),
  };
  writeJsonAtomic(fileFor(email), account);
  return account;
}

export function updateCredentials(email: string, credentials: CredentialsBlob): void {
  const existing = loadAccount(email);
  if (existing) {
    writeJsonAtomic(fileFor(email), { ...existing, credentials });
  }
}

export function removeAccount(email: string): void {
  fs.rmSync(fileFor(email), { force: true });
}
