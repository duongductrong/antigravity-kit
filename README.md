# 🚀 Antigravity Kit

A CLI toolkit to manage Google Antigravity IDE authentication profiles. Seamlessly switch between multiple Google accounts without the hassle of signing in and out.

[![npm version](https://img.shields.io/npm/v/antigravity-kit.svg)](https://www.npmjs.com/package/antigravity-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔐 **Multi-account support** - Manage multiple Google accounts for Antigravity IDE
- ⚡ **Quick switching** - Switch between profiles in seconds
- 💾 **Profile backup** - Each profile is stored separately with all settings intact
- 🖥️ **Cross-platform** - Works on macOS, Linux, and Windows
- 🔑 **OAuth authentication** - Secure Google sign-in with automatic token storage
- 📊 **Quota monitoring** - Real-time quota tracking with auto-refresh
- 🔒 **Keychain storage** - Secure token storage in macOS Keychain

## 📦 Installation

```bash
# Using npm
npm install -g antigravity-kit

# Using pnpm
pnpm add -g antigravity-kit

# Using yarn
yarn global add antigravity-kit
```

## 🎯 Quick Start

```bash
# Interactive menu - select from available actions
agk auth

# Or use direct commands:
agk auth add      # Add your first account
agk auth list     # List all profiles
agk auth switch   # Switch to a different profile
agk auth quota    # Monitor quota usage
```

## 📖 Commands

The CLI can be invoked using any of these aliases:
- `antigravity-kit`
- `antigravikit`
- `agk` (recommended - shortest)

---

### `auth add`

Add a new Google Antigravity account profile.

```bash
# Default: OAuth sign-in (opens browser)
agk auth add

# Manual: IDE-based login
agk auth add --manual

# Force file storage instead of Keychain
agk auth add --insecure
```

**Options:**

| Flag | Description |
|------|-------------|
| `--manual` | Use manual IDE login instead of OAuth (opens Antigravity IDE) |
| `--insecure` | Store tokens in local file instead of macOS Keychain |

**How it works:**

**OAuth Flow (default):**
1. Opens your browser for Google sign-in
2. Captures authentication and creates a profile
3. Stores refresh token securely (Keychain on macOS)
4. Shows available quota for the account

**Manual Flow (`--manual`):**
1. If an existing Antigravity login is detected, you'll be prompted to add it as a profile
2. If no login exists, Antigravity IDE will open for you to sign in
3. The CLI watches for authentication and saves your profile automatically

**Example output:**

```
◆ Add a new account

This will:
1. Open your browser for Google sign-in
2. Capture your login and create a profile
3. Store tokens for quota checking

🔐 Tokens will be stored in macOS Keychain

Saving profile...

┌ Profile Created ─────────────────────────────┐
│                                              │
│  Email: user@gmail.com                       │
│  Profile: ~/.antigravity-kit/profiles/...   │
│  Status: Active                              │
│  Quota: 5 models available                   │
│                                              │
└──────────────────────────────────────────────┘

✔ Account user@gmail.com added successfully!
```

---

### `auth list`

List all saved Google Antigravity profiles.

```bash
agk auth list
```

**Example output:**

```
◆ Saved Profiles

     Email                          OAuth  Storage   Size        Created
────────────────────────────────────────────────────────────────────────────────
● user@gmail.com                    ✓      🔐        45.2 MB     Dec 15, 2024
○ work@company.com                  ✓      🔐        38.7 MB     Dec 10, 2024
○ personal@gmail.com                ✗      —         42.1 MB     Nov 28, 2024
────────────────────────────────────────────────────────────────────────────────

Active profile: user@gmail.com

Legend: ✓ OAuth enabled  🔐 Keychain  💾 File storage
Total: 3 profiles

Use 'auth switch' to change the active profile
```

**Legend:**
- `●` (green) - Active profile
- `○` (dim) - Inactive profile
- `✓` - OAuth token stored (quota checking enabled)
- `✗` - No OAuth token (added with `--manual`)
- `🔐` - Token stored in Keychain
- `💾` - Token stored in file

---

### `auth switch`

Switch between Google Antigravity profiles.

```bash
# Interactive selection
agk auth switch

# With workspace options
agk auth switch --workspace select    # Choose workspace interactively
agk auth switch -w my-project         # Open specific workspace by name
```

**Options:**

| Flag | Alias | Description |
|------|-------|-------------|
| `--workspace <name>` | `-w` | Specify a workspace to open. Use `select` to choose interactively. |

**How it works:**

1. Displays a list of all saved profiles
2. Select the profile you want to switch to
3. **OAuth check**: If the profile has no OAuth token, you'll be prompted to sign in
4. If Antigravity is running, you'll be prompted to close it
5. Profile data is restored and Antigravity can be launched
6. **Workspace persistence**: Your previously open workspace is remembered and reopened automatically

**Example output:**

```
◆ Switch Profile

Current profile: user@gmail.com

? Select a profile to switch to:
  ● user@gmail.com (active)
  ○ work@company.com
  ○ personal@gmail.com

⚠ work@company.com has no OAuth token. Quota checking won't work.
? What would you like to do?
  › Sign in with OAuth first
    Continue without OAuth
    Cancel

Antigravity is currently running. Close it to continue? … yes

Closing Antigravity...

? Launch Antigravity with the new profile? … yes

✔ Switched to work@company.com and opened my-project
```

---

### `auth remove`

Remove a Google Antigravity profile.

```bash
agk auth remove
```

**How it works:**

1. Displays a list of all saved profiles with sizes
2. Select the profile to remove
3. Confirm deletion (shows disk space that will be freed)
4. If the active profile is removed, another profile becomes active

**Example output:**

```
◆ Remove Profile

? Select a profile to remove:
  ● user@gmail.com (active)     45.2 MB
  ○ work@company.com            38.7 MB

? Are you sure you want to remove work@company.com?
  This will free up 38.7 MB of disk space. … yes

Removing profile...

✔ Profile work@company.com removed
```

---

### `auth quota`

Monitor quota usage for Google Antigravity accounts in real-time.

```bash
# Check quota for active profile
agk auth quota

# Check quota for specific account
agk auth quota --account user@gmail.com

# Set custom refresh interval (seconds)
agk auth quota --interval 60
```

**Options:**

| Flag | Alias | Description |
|------|-------|-------------|
| `--account <email>` | `-a` | Email of the account to check (defaults to active profile) |
| `--interval <seconds>` | `-i` | Auto-refresh interval in seconds (default: 30, min: 10) |

**Interactive Controls:**
- Press `r` to manually reload quota data
- Press `q` to exit the monitor

**Example output:**

```
◆ Quota Monitor

  Monitoring quota for user@gmail.com
  Refresh interval: 30s

  📊 Quota Status - user@gmail.com
  💎 Subscription: Gemini Business

  ┌────────────────────────────┬──────────────────┬───────────────┐
  │ Model                      │ Quota            │ Reset Time    │
  ├────────────────────────────┼──────────────────┼───────────────┤
  │ gemini-2.0-flash           │ ████████░░  80%  │ in 2h 45m     │
  │ gemini-2.0-pro             │ ██████░░░░  60%  │ in 2h 45m     │
  │ claude-3.5-sonnet          │ ██████████ 100%  │ —             │
  └────────────────────────────┴──────────────────┴───────────────┘

  ⟳ Auto-refresh in 28s | Press 'r' to reload | Press 'q' to exit
```

**Requirements:**
- OAuth token must be stored for the account
- Use `agk auth add` (without `--manual`) to enable quota checking

---

## 🔐 Token Security

Antigravity Kit supports secure token storage for OAuth authentication:

| Platform | Storage Method | Notes |
|----------|---------------|-------|
| macOS    | Keychain      | Default. Uses macOS Keychain for secure storage |
| Linux    | File          | Stored in `~/.antigravity-kit/tokens/` |
| Windows  | File          | Stored in `~/.antigravity-kit/tokens/` |

**Flags:**
- Use `--insecure` with `auth add` to force file-based storage on macOS
- Keychain storage may require user permission on first use

---

## 🖥️ Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| macOS    | ✅     | Looks for Antigravity.app in `/Applications` or `~/Applications` |
| Linux    | ✅     | Uses `antigravity` command or checks `/usr/bin`, `/usr/local/bin` |
| Windows  | ✅     | Supports Git Bash, MSYS, Cygwin. Looks in Program Files |

## 📁 Profile Storage

Profiles are stored in `~/.antigravity-kit/profiles/`. Each profile contains a complete copy of the Antigravity user data directory, including:

- Authentication tokens
- Settings and preferences
- Extensions (if any)
- Workspace data

## ⚙️ Requirements

- **Node.js** >= 18.0.0
- **Antigravity IDE** installed on your system

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🙏 Acknowledgments

- Built with [citty](https://github.com/unjs/citty) for CLI framework
- Interactive prompts powered by [@clack/prompts](https://github.com/natemoo-re/clack)
- Beautiful gradients with [gradient-string](https://github.com/bokub/gradient-string)

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/duongductrong">duongductrong</a>
</p>
