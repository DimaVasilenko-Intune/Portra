# Portra

A secure desktop app for managing and launching customer portals with isolated browser profiles.

## Download

- **Windows (.exe):** https://github.com/DimaVasilenko-Intune/Portra/releases/latest
- **macOS (.dmg):** https://github.com/DimaVasilenko-Intune/Portra/releases/latest

## Core features

- Customer and portal management (add/edit/delete)
- New customer options:
  - **Fresh** (empty customer)
  - **Copy** (clone portals from another customer)
  - **Standard** (pre-configured with Azure, Intune, Admin Center, Security Center, Entra, Exchange Admin, SharePoint Admin)
- **Built-in isolated browser** — each customer workspace opens portals in its own browser session with separate cookies and auth state (no Windows SSO leaking between tenants)
- Multi-select when adding portals (pick several at once)
- Username storage per portal (encrypted at rest)
- Search, light/dark mode, import/export
- Import supports both **.json** and **.cfg** (including Portals app format)

## Security

- **100% local** — all data stays on your machine under your OS user profile
- Usernames are encrypted at rest with Electron `safeStorage` (OS keychain)
- Passwords are never stored or handled by the app
- Each customer workspace uses a dedicated Electron session with isolated cookies, localStorage, and auth — no cross-tenant leakage
- Context isolation + sandbox enabled in the renderer process
- No telemetry, no cloud backend, no sync, no accounts

## Automatic updates

Portra checks GitHub Releases for updates in production builds and prompts users to restart when update is downloaded.

## Run from source

```bash
git clone https://github.com/DimaVasilenko-Intune/Portra.git
cd Portra
npm install
npm run dev
```

## Build installers

```bash
npm run dist:win
npm run dist:mac
```
