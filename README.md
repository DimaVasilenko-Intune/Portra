# Portra

A secure desktop app for managing and launching customer portals with isolated browser sessions.

<p align="center">
  <img src="docs/screenshots/dark-mode.png" alt="Portra — Dark Mode" width="800" />
</p>

## Download

- **Windows (.exe):** https://github.com/DimaVasilenko-Intune/Portra/releases/latest
- **macOS (.dmg):** https://github.com/DimaVasilenko-Intune/Portra/releases/latest

## Screenshots

| Dark Mode | Light Mode |
|:-:|:-:|
| ![Dark Mode](docs/screenshots/dark-mode.png) | ![Light Mode](docs/screenshots/light-mode.png) |

| Add Portal | New Customer |
|:-:|:-:|
| ![Add Portal](docs/screenshots/add-portal.png) | ![New Customer](docs/screenshots/new-customer.png) |

## Core features

- Customer and portal management (add/edit/delete)
- New customer options:
  - **Standard** (pre-configured with Azure, Intune, Admin Center, Security Center, Entra, Exchange Admin, SharePoint Admin)
  - **Fresh** (empty customer)
  - **Copy** (clone portals from another customer)
- **Built-in isolated browser** — each customer workspace opens portals in its own browser session with separate cookies and auth state (no Windows SSO leaking between tenants)
- Multi-select when adding portals (pick several at once)
- One username per customer workspace (encrypted at rest)
- Passkey / security key support (YubiKey, Windows Hello, etc.)
- Search, light/dark mode, import/export
- Import supports both **.json** and **.cfg** (including Portals app format)
- Automatic updates via GitHub Releases

## Security

- **100% local** — all data stays on your machine under your OS user profile
- Usernames are encrypted at rest with Electron `safeStorage` (OS keychain)
- Passwords are never stored or handled by the app
- Each customer workspace uses a dedicated Electron session with isolated cookies, localStorage, and auth — no cross-tenant leakage
- Context isolation + sandbox enabled in the renderer process
- No telemetry, no cloud backend, no sync, no accounts

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

## License

MIT
