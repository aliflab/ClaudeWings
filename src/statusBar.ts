import * as vscode from 'vscode';
import { labelFor } from './accounts';
import { describeUsage, formatPercent, formatReset } from './ranking';
import { UsageInfo } from './usage';

export interface AccountRow {
  email: string;
  saved: boolean;
  usage?: UsageInfo;
}

export class StatusBar implements vscode.Disposable {
  private readonly wings:vscode.StatusBarItem;
  private readonly account: vscode.StatusBarItem;

  constructor() {
    this.wings = vscode.window.createStatusBarItem('claudeWings.menu', vscode.StatusBarAlignment.Left, 100);
    this.wings.name = 'ClaudeWings Menu';
    this.wings.text = '$(claudewings-wings)';
    this.wings.tooltip = 'ClaudeWings (Ctrl+Alt+F)';
    this.wings.command = 'claudeWings.menu';
    this.wings.show();

    this.account = vscode.window.createStatusBarItem('claudeWings.account', vscode.StatusBarAlignment.Left, 99);
    this.account.name = 'ClaudeWings Account';
    this.account.command = 'claudeWings.switchAccount';
    this.account.show();
  }

  render(activeEmail: string | undefined, rows: AccountRow[]): void {
    const threshold = vscode.workspace.getConfiguration('claudeWings').get<number>('warningThreshold', 90);
    const active = rows.find((r) => r.email === activeEmail);
    this.account.command = 'claudeWings.switchAccount';

    if (!activeEmail) {
      this.account.text = '$(account) Claude: not logged in';
      this.account.backgroundColor = undefined;
    } else if (!rows.some((r) => r.saved)) {
      this.account.text = '$(account) ClaudeWings: save a login';
      this.account.command = 'claudeWings.saveCurrent';
      this.account.backgroundColor = undefined;
    } else {
      const u = active?.usage;
      const pct = u?.status === 'ok' ? ` ${formatPercent(u.session)}` : u?.status === 'expired' ? ' $(warning)' : '';
      this.account.text = `$(account) ${labelFor(activeEmail)}${pct}`;
      const hot = u?.status === 'ok' && Math.max(u.session ?? 0, u.weekly ?? 0) >= threshold;
      this.account.backgroundColor = hot ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
    }

    this.account.tooltip = this.tooltip(activeEmail, rows);
  }

  private tooltip(activeEmail: string | undefined, rows: AccountRow[]): vscode.MarkdownString {
    const md = new vscode.MarkdownString(undefined, true);
    md.supportHtml = true;
    md.appendMarkdown('**ClaudeWings**\n\n');
    if (rows.length === 0) {
      md.appendMarkdown('No saved accounts yet. Click ★ → *Save current login*.');
      return md;
    }
    md.appendMarkdown('| | Account | Session | Weekly |\n|---|---|---|---|\n');
    for (const r of rows) {
      const mark = r.email === activeEmail ? '$(check)' : '';
      const name = r.saved ? escape(r.email) : `${escape(r.email)} *(not saved)*`;
      const u = r.usage;
      if (u?.status === 'ok') {
        md.appendMarkdown(
          `| ${mark} | ${name} | ${formatPercent(u.session)} ${small(formatReset(u.sessionResetsAt))} ` +
            `| ${formatPercent(u.weekly)} ${small(formatReset(u.weeklyResetsAt))} |\n`
        );
      } else {
        md.appendMarkdown(`| ${mark} | ${name} | ${escape(describeUsage(u))} | |\n`);
      }
    }
    md.appendMarkdown('\nClick to switch · Ctrl+Alt+A switches to the account with the most usage left');
    return md;
  }

  dispose(): void {
    this.wings.dispose();
    this.account.dispose();
  }
}

function small(s: string): string {
  return s ? `<small>(${s})</small>` : '';
}

function escape(s: string): string {
  return s.replace(/[|*_`\\[\]<>]/g, (c) => `\\${c}`);
}
