import * as os from 'os';
import * as path from 'path';

// Claude Code honours CLAUDE_CONFIG_DIR; when set, ~/.claude.json lives inside it too.
export function claudeDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

export function claudeJsonPath(): string {
  return process.env.CLAUDE_CONFIG_DIR
    ? path.join(process.env.CLAUDE_CONFIG_DIR, '.claude.json')
    : path.join(os.homedir(), '.claude.json');
}

export function credentialsPath(): string {
  return path.join(claudeDir(), '.credentials.json');
}

export function accountsDir(): string {
  return path.join(claudeDir(), 'accounts');
}
