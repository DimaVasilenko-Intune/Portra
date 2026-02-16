# Portra

Modern customer portal launcher for multi-tenant work.

## Why this exists
Portals is great for account switching, but your workflow was blocked by embedded browser limits (copy/paste friction, capped window behavior).

Portra solves this by launching each customer portal in a **real browser profile** (Chrome/Edge), one profile per customer.

## Key MVP features
- Customer list with search
- Expand/collapse customer sections
- Portal shortcuts per customer (Azure, M365, etc)
- Stored username (no password storage)
- One-click username copy
- Launch portal in dedicated browser profile per customer
- Persistent sign-in sessions per customer profile
- Light/Dark mode toggle (saved preference)
- Import/Export JSON data
- Modern UI

## Security model
- Passwords are **not** stored
- Usernames only
- Session persistence is handled by browser profile storage
- Data is stored locally in app userData (`customers.json`)

## Run locally (Windows/macOS)
```bash
npm install
npm run dev
```

Alternative (no dev server, runs built app directly):
```bash
npm start
```

## Build installers
```bash
npm run dist:win   # Windows NSIS installer (.exe)
npm run dist:mac   # macOS DMG/ZIP (must run on macOS host)
```
Output: `release/`

## Notes
- On Windows, Portra looks for Chrome/Edge in default install paths.
- On macOS, Portra looks for Chrome/Edge/Chromium in `/Applications`.
- If no supported browser is found, it opens links with system default browser.

## Planned next
- Import existing Portals config format (where possible)
- Encrypted local data at rest
- Better profile management UI
- Optional cloud sync
- Global hotkeys and quick launcher
