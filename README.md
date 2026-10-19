# ClaudeWings

Switch Claude Code between your Claude accounts in one click, without logging in again. When one account runs out of usage, swap to another and keep working. Works in **VS Code** and **Cursor**.

It adds two things to the status bar (bottom left):

- **★**: a menu (Ctrl+Alt+F) with "Switch to best account", "Claude accounts", "Save current login", "Remove saved account" and "Refresh usage".
- **Your account and usage**, for example `jane 42%` (session usage). Hover over it to see every saved account's session and weekly usage and when each resets. Click it to switch.

**Ctrl+Alt+A** switches straight to the account with the most usage left.

## What you need

- VS Code (1.85 or newer) or Cursor, with the Claude Code extension installed and logged in.
- Nothing else. ClaudeWings has no Python or other runtime dependency.

## Install

1. Get `claudewings-0.1.0.vsix` (or build it, see below).
2. Open the Extensions view (Ctrl+Shift+X, or Cmd+Shift+X on Mac).
3. Click the **…** menu at the top of the Extensions view and choose **Install from VSIX…**
4. Pick `claudewings-0.1.0.vsix`.
5. Reload: press Ctrl+Shift+P (Cmd+Shift+P on Mac), type **Reload Window** and press Enter.

Or from a terminal:

```sh
code --install-extension claudewings-0.1.0.vsix     # VS Code
cursor --install-extension claudewings-0.1.0.vsix   # Cursor
```

## Save your accounts (once per account)

The switcher can only swap between logins you've saved.

1. Log in to Claude Code with your first account as usual.
2. Click **★**, then **Save current login**.
3. In the Claude Code chat, type `/login` and log in with your next account.
4. Click **★**, then **Save current login** again.
5. Repeat steps 3 and 4 for any other accounts.

The account and usage now show in the status bar.

## Switch

- Click the account in the status bar and pick one, or
- press **Ctrl+Alt+A** to jump to the account with the most usage left.

After switching, click **New Conversation** in the message that pops up. Conversations that are already open keep using the old account.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `claudeWings.refreshIntervalMinutes` | `5` | How often each saved account's usage is checked |
| `claudeWings.warningThreshold` | `90` | Usage % at which the status bar item turns to a warning colour |

## Good to know

- Your saved logins stay on your own computer, in the `.claude/accounts` folder in your home folder (or in `$CLAUDE_CONFIG_DIR/accounts` if you set that). Nothing is sent anywhere except to Anthropic, to check usage and to renew a saved login's token.
- A switch changes only the Claude Code login: the credentials (`~/.claude/.credentials.json`, or the macOS keychain) and the `oauthAccount` entry in `~/.claude.json`. Your other Claude Code settings are left alone.
- On a Mac, the first switch may ask for permission to use the "Claude Code-credentials" keychain item. Choose **Always Allow**.
- If an account shows "log in again and re-save", that login has expired. Switch to it, run `/login` in Claude Code, then **Save current login**.
- To remove the extension, uninstall "ClaudeWings" from the Extensions view. Your saved logins remain in `.claude/accounts` until you delete that folder.

## Build from source

```sh
npm install
npm test          # compile + unit tests
npm run package   # produces claudewings-0.1.0.vsix
```

Press F5 in VS Code to run the extension in a development window.
