# 🚀 Antigravity Kit

A CLI toolkit to manage Google Antigravity IDE authentication profiles. Seamlessly switch between multiple Google accounts without the hassle of signing in and out.

[![npm version](https://img.shields.io/npm/v/antigravity-kit.svg)](https://www.npmjs.com/package/antigravity-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔐 **Multi-account support** - Manage multiple Google accounts for Antigravity IDE
- ⚡ **Quick switching** - Switch between profiles in seconds
- 💾 **Profile backup** - Each profile is stored separately with all settings intact
- 🖥️ **Cross-platform** - Works on macOS, Linux, and Windows

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
# Add your first account
agk auth add

# List all profiles
agk auth list

# Switch to a different profile
agk auth switch
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
agk auth add
```

**How it works:**

1. If an existing Antigravity login is detected, you'll be prompted to add it as a profile
2. If no login exists, Antigravity IDE will open for you to sign in
3. The CLI watches for authentication and saves your profile automatically

**Example output:**

```
◆ Add a new account

Found existing login: user@gmail.com
Name: John Doe

✔ Add user@gmail.com as a new profile? … yes

Saving profile...

┌ Profile Created ─────────────────────────────┐
│                                              │
│  Email: user@gmail.com                       │
│  Profile: ~/.antigravity-kit/profiles/...   │
│  Status: Active                              │
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

     Email                               Size        Created
──────────────────────────────────────────────────────────────────────
● user@gmail.com                        45.2 MB     Dec 15, 2024
○ work@company.com                      38.7 MB     Dec 10, 2024
○ personal@gmail.com                    42.1 MB     Nov 28, 2024
──────────────────────────────────────────────────────────────────────

Active profile: user@gmail.com
Total: 3 profiles

Use 'auth switch' to change the active profile
```

**Legend:**
- `●` (green) - Active profile
- `○` (dim) - Inactive profile

---

### `auth switch`

Switch between Google Antigravity profiles.

```bash
agk auth switch
```

**How it works:**

1. Displays a list of all saved profiles
2. Select the profile you want to switch to
3. If Antigravity is running, you'll be prompted to close it
4. Profile data is restored and you can optionally launch Antigravity

**Example output:**

```
◆ Switch Profile

Current profile: user@gmail.com

? Select a profile to switch to:
  ● user@gmail.com (active)
  ○ work@company.com
  ○ personal@gmail.com

Antigravity is currently running. Close it to continue? … yes

Closing Antigravity...

? Launch Antigravity with the new profile? … yes

✔ Switched to work@company.com and launched Antigravity
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

