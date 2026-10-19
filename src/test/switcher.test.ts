import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { listAccounts, loadAccount } from '../accounts';
import { saveCurrentLogin, switchTo } from '../switcher';

let dir: string;

const creds = (token: string) => ({ claudeAiOauth: { accessToken: token, refreshToken: `r-${token}`, expiresAt: 1 } });
const writeJson = (name: string, data: unknown) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data));
const readJson = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));

function login(email: string, token: string) {
  const cfg = fs.existsSync(path.join(dir, '.claude.json')) ? readJson('.claude.json') : { theme: 'dark' };
  writeJson('.claude.json', { ...cfg, oauthAccount: { emailAddress: email, accountUuid: email } });
  writeJson('.credentials.json', creds(token));
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudewings-'));
  process.env.CLAUDE_CONFIG_DIR = dir;
});

afterEach(() => {
  delete process.env.CLAUDE_CONFIG_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

test('save two logins and switch between them', () => {
  login('jane@example.com', 'tok-jane');
  saveCurrentLogin();
  login('bob@example.com', 'tok-bob');
  saveCurrentLogin();
  assert.deepEqual(
    listAccounts().map((a) => a.label),
    ['bob', 'jane']
  );

  switchTo('jane@example.com');
  assert.equal(readJson('.credentials.json').claudeAiOauth.accessToken, 'tok-jane');
  const cfg = readJson('.claude.json');
  assert.equal(cfg.oauthAccount.emailAddress, 'jane@example.com');
  assert.equal(cfg.theme, 'dark', 'other settings are preserved');
});

test('switching away snapshots tokens Claude Code refreshed meanwhile', () => {
  login('jane@example.com', 'tok-jane');
  saveCurrentLogin();
  login('bob@example.com', 'tok-bob');
  saveCurrentLogin();
  // Claude Code rotates bob's token while bob is active.
  writeJson('.credentials.json', creds('tok-bob-2'));

  switchTo('jane@example.com');
  assert.equal(loadAccount('bob@example.com')?.credentials.claudeAiOauth?.accessToken, 'tok-bob-2');
});

test('saveCurrentLogin fails clearly when nobody is logged in', () => {
  assert.throws(() => saveCurrentLogin(), /No Claude Code login/);
});
