# Portra

A desktop app for managing and launching customer portals with isolated browser profiles.

## Download

- **Windows:** [Portra Setup (.exe)](https://github.com/DimaVasilenko-Intune/Portra/releases/latest)
- **macOS:** [Portra (.dmg)](https://github.com/DimaVasilenko-Intune/Portra/releases/latest)

## Features

- **Customer management** — add, rename, delete customers
- **Portal shortcuts** — add, edit, delete portal links per customer
- **Isolated browser profiles** — each customer gets a dedicated Chrome/Edge profile with persistent sessions
- **Username storage** — encrypted at rest using OS keychain (Windows DPAPI / macOS Keychain)
- **Copy username** — one click to clipboard
- **Search** — filter across all customers and portals instantly
- **Light / Dark mode** — toggle and persist preference
- **Import / Export** — backup and restore data as JSON
- **Cross-platform** — Windows and macOS

## Security

- Customer data (including usernames) is **encrypted at rest** using Electron `safeStorage` backed by your OS keychain
- Passwords are **never stored**
- Browser profiles are isolated per customer in app userData
- No telemetry, no network calls, no cloud — 100% local
- Context isolation and sandbox enabled

## Run from source

```bash
git clone https://github.com/DimaVasilenko-Intune/Portra.git
cd Portra
npm install
npm run dev
```

## Build installers

```bash
npm run dist:win   # Windows .exe (NSIS)
npm run dist:mac   # macOS .dmg + .zip
```

## Platform support

| Platform | Browser detection |
|----------|-------------------|
| Windows  | Chrome, Edge (default install paths) |
| macOS    | Chrome, Edge, Chromium (`/Applications`) |

Falls back to system default browser if none found.

## License

MIT
