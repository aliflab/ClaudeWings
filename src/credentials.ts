import { execFileSync } from 'child_process';
import * as os from 'os';
import { readJson, writeJsonAtomic } from './fsutil';
import { credentialsPath } from './paths';

export interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes?: string[];
  subscriptionType?: string;
  [key: string]: unknown;
}

// The whole credentials blob, e.g. { claudeAiOauth: {...} }. Other keys are kept as-is.
export interface CredentialsBlob {
  claudeAiOauth?: OAuthCredentials;
  [key: string]: unknown;
}

const KEYCHAIN_SERVICE = 'Claude Code-credentials';

function useKeychain(): boolean {
  return process.platform === 'darwin' && !process.env.CLAUDE_CONFIG_DIR;
}

function keychainAccount(): string {
  return process.env.USER || os.userInfo().username;
}

export function readActiveCredentials(): CredentialsBlob | undefined {
  if (useKeychain()) {
    try {
      const out = execFileSync(
        'security',
        ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', keychainAccount(), '-w'],
        { encoding: 'utf8' }
      );
      return JSON.parse(out.trim()) as CredentialsBlob;
    } catch {
      // Fall through: some setups still keep the file.
    }
  }
  return readJson<CredentialsBlob>(credentialsPath());
}

export function writeActiveCredentials(blob: CredentialsBlob): void {
  if (useKeychain()) {
    execFileSync('security', [
      'add-generic-password',
      '-U',
      '-s',
      KEYCHAIN_SERVICE,
      '-a',
      keychainAccount(),
      '-w',
      JSON.stringify(blob),
    ]);
    return;
  }
  writeJsonAtomic(credentialsPath(), blob);
}
