import * as fs from 'fs';
import * as vscode from 'vscode';
import { labelFor, listAccounts, removeAccount, SavedAccount } from './accounts';
import { readOAuthAccount } from './claudeConfig';
import { claudeJsonPath, credentialsPath } from './paths';
import { describeUsage, pickBest } from './ranking';
import { AccountRow, StatusBar } from './statusBar';
import { saveCurrentLogin, switchTo } from './switcher';
import { checkUsage, UsageInfo } from './usage';

const CACHE_TTL_MS = 60_000;

let statusBar: StatusBar;
let activeEmail: string | undefined;
let rows: AccountRow[] = [];
const usage = new Map<string, UsageInfo>();
let refreshing: Promise<void> | undefined;

export function activate(context: vscode.ExtensionContext): void {
  statusBar = new StatusBar();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeWings.menu', showMenu),
    vscode.commands.registerCommand('claudeWings.switchBest', switchBest),
    vscode.commands.registerCommand('claudeWings.switchAccount', pickAndSwitch),
    vscode.commands.registerCommand('claudeWings.saveCurrent', saveCurrent),
    vscode.commands.registerCommand('claudeWings.removeAccount', pickAndRemove),
    vscode.commands.registerCommand('claudeWings.refreshUsage', () => refresh(true))
  );

  // Notice /login and logouts made in Claude Code.
  let debounce: NodeJS.Timeout | undefined;
  const onLoginFileChange = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const email = readOAuthAccount()?.emailAddress;
      if (email !== activeEmail && email) {
        usage.delete(email);
      }
      void refresh(false);
    }, 1500);
  };
  for (const file of [credentialsPath(), claudeJsonPath()]) {
    fs.watchFile(file, { interval: 5000 }, onLoginFileChange);
    context.subscriptions.push({ dispose: () => fs.unwatchFile(file, onLoginFileChange) });
  }

  let timer: NodeJS.Timeout | undefined;
  const schedule = () => {
    clearInterval(timer);
    const minutes = vscode.workspace.getConfiguration('claudeWings').get<number>('refreshIntervalMinutes', 5);
    timer = setInterval(() => void refresh(true), Math.max(1, minutes) * 60_000);
  };
  schedule();
  context.subscriptions.push(
    { dispose: () => clearInterval(timer) },
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('claudeWings')) {
        schedule();
        render();
      }
    }),
    vscode.window.onDidChangeWindowState((s) => {
      if (s.focused) {
        void refresh(false);
      }
    })
  );

  void refresh(true);
}

export function deactivate(): void {}

function render(): void {
  statusBar.render(activeEmail, rows);
}

/** Re-read saved accounts and the active login, then check usage (cached unless `force`). */
function refresh(force: boolean): Promise<void> {
  if (refreshing) {
    return refreshing;
  }
  refreshing = (async () => {
    try {
      activeEmail = readOAuthAccount()?.emailAddress;
      const saved = listAccounts();
      const targets: { account: SavedAccount; saved: boolean }[] = saved.map((a) => ({ account: a, saved: true }));
      if (activeEmail && !saved.some((a) => a.email === activeEmail)) {
        // Show the live login too, even before it is saved.
        const oauthAccount = readOAuthAccount()!;
        targets.unshift({
          account: { email: activeEmail, label: labelFor(activeEmail), oauthAccount, credentials: {}, savedAt: '' },
          saved: false,
        });
      }

      rows = targets.map((t) => ({ email: t.account.email, saved: t.saved, usage: usage.get(t.account.email) }));
      render();

      await Promise.all(
        targets.map(async (t) => {
          const cached = usage.get(t.account.email);
          if (!force && cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
            return;
          }
          usage.set(t.account.email, await checkUsage(t.account, t.account.email === activeEmail));
        })
      );

      rows = targets.map((t) => ({ email: t.account.email, saved: t.saved, usage: usage.get(t.account.email) }));
      render();
    } finally {
      refreshing = undefined;
    }
  })();
  return refreshing;
}

async function showMenu(): Promise<void> {
  const items: (vscode.QuickPickItem & { run: () => unknown })[] = [
    { label: '$(rocket) Switch to best account', description: 'Ctrl+Alt+A', run: switchBest },
    { label: '$(account) Claude accounts', run: pickAndSwitch },
    { label: '$(save) Save current login', description: activeEmail, run: saveCurrent },
    { label: '$(trash) Remove saved account', run: pickAndRemove },
    { label: '$(refresh) Refresh usage', run: () => refresh(true) },
  ];
  const choice = await vscode.window.showQuickPick(items, { title: 'ClaudeWings' });
  await choice?.run();
}

async function saveCurrent(): Promise<void> {
  try {
    const account = saveCurrentLogin();
    usage.delete(account.email);
    vscode.window.showInformationMessage(
      `ClaudeWings: saved ${account.email}. To add another account, run /login in Claude Code and save again.`
    );
  } catch (err) {
    vscode.window.showErrorMessage(`ClaudeWings: ${errorText(err)}`);
  }
  await refresh(false);
}

async function pickAndSwitch(): Promise<void> {
  const saved = rows.filter((r) => r.saved);
  if (saved.length === 0) {
    const save = 'Save current login';
    if ((await vscode.window.showInformationMessage('ClaudeWings: no saved accounts yet.', save)) === save) {
      await saveCurrent();
    }
    return;
  }
  const picked = await vscode.window.showQuickPick(
    saved.map((r) => ({
      label: `${r.email === activeEmail ? '$(check)' : '$(account)'} ${r.email}`,
      description: describeUsage(r.usage),
      email: r.email,
    })),
    { title: 'Switch Claude account', placeHolder: 'Pick an account' }
  );
  if (picked) {
    await doSwitch(picked.email);
  }
}

async function switchBest(): Promise<void> {
  await refresh(false);
  const best = pickBest(rows.filter((r) => r.saved));
  if (!best) {
    vscode.window.showWarningMessage('ClaudeWings: no saved account has usage data right now.');
    return;
  }
  if (best.email === activeEmail) {
    vscode.window.showInformationMessage(`ClaudeWings: ${best.email} already has the most usage left.`);
    return;
  }
  await doSwitch(best.email);
}

async function doSwitch(email: string): Promise<void> {
  if (email === activeEmail) {
    vscode.window.showInformationMessage(`ClaudeWings: already using ${email}.`);
    return;
  }
  try {
    switchTo(email);
  } catch (err) {
    vscode.window.showErrorMessage(`ClaudeWings: switch failed: ${errorText(err)}`);
    return;
  }
  await refresh(false);
  const action = 'New Conversation';
  const choice = await vscode.window.showInformationMessage(
    `ClaudeWings: switched to ${email}. Open conversations keep using the old account.`,
    action
  );
  if (choice === action) {
    await openNewConversation();
  }
}

async function openNewConversation(): Promise<void> {
  const all = await vscode.commands.getCommands(true);
  const claude = all.filter((c) => /^claude[-.]/i.test(c));
  const command =
    claude.find((c) => /new.?conversation|new.?chat|newSession/i.test(c)) ??
    claude.find((c) => /editor\.open|openInNewTab|sidebar\.open/i.test(c));
  if (command) {
    await vscode.commands.executeCommand(command);
  } else {
    vscode.window.showInformationMessage('ClaudeWings: start a new conversation in Claude Code to use the new account.');
  }
}

async function pickAndRemove(): Promise<void> {
  const picked = await vscode.window.showQuickPick(
    rows.filter((r) => r.saved).map((r) => ({ label: r.email, description: describeUsage(r.usage) })),
    { title: 'Remove a saved Claude account', placeHolder: 'The login stays active in Claude Code if it is current' }
  );
  if (!picked) {
    return;
  }
  const confirm = 'Remove';
  const ok = await vscode.window.showWarningMessage(`Remove saved login ${picked.label}?`, { modal: true }, confirm);
  if (ok === confirm) {
    removeAccount(picked.label);
    usage.delete(picked.label);
    await refresh(false);
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
