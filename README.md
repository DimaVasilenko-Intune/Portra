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
- Isolated browser profile per customer
- Username storage (encrypted at rest)
- Search, light/dark mode, import/export
- Import supports both **.json** and **.cfg**

## Security

- Data is stored **locally only** under the current OS user profile
- Usernames are encrypted at rest with Electron `safeStorage` (OS keychain)
- Passwords are never stored or handled by the app
- Each workspace uses a dedicated browser profile folder for isolation
- Context isolation + sandbox enabled in the renderer process
- No telemetry, no cloud backend, no sync

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
