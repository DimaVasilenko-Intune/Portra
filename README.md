# Portra

Portra is a desktop app for managing and launching customer portals with isolated browser profiles.

## What Portra does
- Organize customers and their portal links
- Launch each portal with a dedicated browser profile per customer
- Keep customer sessions separated and persistent
- Store usernames (never passwords)
- Search customers and portals instantly
- Light/Dark mode
- Import/Export data as JSON

## Security model
- Passwords are **not** stored
- Usernames only
- Customer data is stored locally in app userData (`customers.json`)
- Browser session persistence is handled by each customer profile directory

## Run locally (Windows/macOS)
```bash
npm install
npm run dev
```

Alternative (runs built app directly):
```bash
npm start
```

## Build installers
```bash
npm run dist:win   # Windows NSIS installer (.exe)
npm run dist:mac   # macOS DMG/ZIP (must run on macOS host)
```

Output: `release/`

## Platform behavior
- Windows: detects Chrome/Edge in standard install paths
- macOS: detects Chrome/Edge/Chromium in `/Applications`
- Fallback: opens URL with system default browser if supported browsers are not found

## Roadmap
- Edit/Delete customer and portal actions in UI
- Optional encrypted local data at rest
- Optional cloud backup/sync
- Global quick launcher
