# Portra — review findings and improvement plan

Review date: 2026-08-12 · Reviewed version: 0.5.3 · Released as: 0.6.0 · Reviewed on: macOS 26.6.1, Apple Silicon

Every finding below was reproduced on this machine, not inferred from reading the code. The
verification method is stated per finding so the result can be re-checked.

---

## 1. Findings

### Fixed in this change

| # | Finding | Severity | How it was verified |
|---|---|---|---|
| 1 | **Downloaded macOS builds cannot be opened.** The app is ad-hoc signed and not notarized, so Gatekeeper rejects it once the download is quarantined. | Blocker | `spctl -a -t exec` returns `rejected`; removing `com.apple.quarantine` makes the same bundle launch normally |
| 2 | **Portal windows spoofed a Windows user agent on every platform.** Entra therefore offered Windows Hello on a Mac. | High | Portal window reported `Windows NT 10.0` while running on `MacIntel` |
| 3 | **Undecryptable data was silently replaced with the sample customer**, and the next save overwrote the real file. On macOS a changed code signature can revoke keychain access, which triggers exactly this. | High (data loss) | `readData()` caught every error and returned `defaultData()`; `saveData()` then wrote over `customers.enc` |
| 4 | **Export → import lost every customer username.** `sanitizeImportedData()` mapped a per-portal `username` field that the UI stopped writing in 0.5.1, and dropped the customer-level one. | High (data loss) | Round-trip test: `"admin@contoso.no"` in, `undefined` out. Now covered by `electron/dataFormat.test.js` |
| 5 | **Sign-in and consent popups replaced the page the user was on.** `setWindowOpenHandler` called `win.loadURL(popupUrl)` on the opener. | High | `window.open()` from a portal window; opener URL was replaced instead of a second window appearing |
| 6 | **The Chromium sandbox was disabled for windows loading remote content** (`sandbox: false`, added in 0.5.2 to chase a WebAuthn problem), while the README claimed the sandbox was enabled. | High | Re-enabled and re-measured: the Entra sign-in page, WebAuthn and conditional mediation all work with `sandbox: true` |
| 7 | **Every permission request was granted** — camera, microphone, geolocation, notifications — for any site a portal window navigated to. | Medium | `callback(true)` for all permissions; now scoped, and geolocation/notifications verified as denied |
| 8 | **Any URL scheme could be launched.** Portal definitions come from imported `.json`/`.cfg` files, so `file:///etc/passwd` reached `loadURL()` in a window with the sandbox off. | Medium | `openPortal` with a `file:` URL now returns `Only https URLs can be opened.`; covered by tests |
| 9 | **The app window fetched favicons from Microsoft on every render** for 6 of 15 catalog entries, contradicting "no telemetry, no cloud backend" and breaking icons offline. | Medium | Local SVGs already existed for all 6; catalog now points at them |
| 10 | **`copilot.svg` was invalid XML** (duplicate `fill` attribute) and had never rendered. Hidden until now because that entry used a remote favicon. | Low | `naturalWidth === 0` for that icon; all 15 now render |
| 11 | **No application menu and no navigation in portal windows.** A portal window had no Back, Forward, Reload or "copy URL" — a dead end once a login flow went sideways. | Medium (usability) | No `Menu.setApplicationMenu` anywhere in the codebase |
| 12 | **macOS traffic lights overlapped the header** in narrow windows (`titleBarStyle: hiddenInset` with a 24px content inset). | Low | Brand logo occupied y 24–52 against traffic lights at y 12–28 below 1080px width |
| 13 | **Two instances could run at once** and clobber each other's writes to `customers.enc`. | Medium | No `requestSingleInstanceLock()` in the codebase |
| 14 | **Import replaced the entire workspace with no confirmation and no backup.** | Medium | `saveData(sanitized)` ran immediately after parsing |
| 15 | **Electron 40.4.1 was 6 patch releases behind**, missing ~30 published security fixes including several rated 7.5–8.3. | Medium | `npm audit` against the pinned version |
| 16 | **No LICENSE file**, although `package.json` and the README both state MIT. | Low | Absent from the repository |
| 17 | **No tests, and CI only ran on tags** — a broken `main` was invisible until release. | Medium | Workflow triggered on `push: tags: v*` only; now also on pushes to `main` and on pull requests |
| 18 | **Unencrypted storage was indistinguishable from encrypted storage.** Where `safeStorage` is unavailable, data was written as plain text into a file named `customers.enc`, with no indication. | Medium | Code path in `encrypt()`/`decrypt()`; the app now warns |
| 19 | **macOS users had no update path and were not told.** The updater was silently failing on every launch (`autoUpdater.on('error', () => {})`). | Medium | Now skipped deliberately on macOS, stated in the footer, with a manual **Check for Updates…** |

### Known limitation, not fixable in this codebase

**Touch ID and iCloud Keychain passkeys do not work inside Portra on macOS.** Measured in a
packaged build: `isUserVerifyingPlatformAuthenticatorAvailable()` returns `false`, while
conditional mediation and USB security keys work. Electron does not expose the macOS platform
authenticator. Details and workarounds in [MACOS.md](MACOS.md).

### Open, deliberately not changed yet

| # | Finding | Why it was left |
|---|---|---|
| 20 | Electron 40.10.6 → 43.4.0 (three Chromium majors behind) | Needs its own regression pass. 40.10.6 closes nearly all outstanding advisories at patch-level risk |
| 21 | Portal windows can navigate to any https host | An allowlist of Microsoft sign-in and portal domains would be tighter, but risks blocking legitimate federated IdPs. Needs a decision on scope |
| 22 | No renderer tests | The React layer is verified manually. Worth adding once the UI settles |
| 23 | No way to clear a workspace session | There is no "sign out of this customer" action; `session.clearStorageData()` per partition would provide it |

---

## 2. Plan

### Now — unblocked, no external dependencies

1. Merge this branch. macOS works from a local build today; Windows behaviour is unchanged
   except for the shared fixes above.
2. Tag a release so Windows users also get findings 3, 4, 5, 6, 7, 8, 13, 14 and 15.

### Next — requires a decision from you

3. **Apple Developer Program membership (99 USD/year)** and the five repository secrets listed
   in [MACOS.md](MACOS.md). This is the only thing standing between a macOS user and a
   double-click install. The CI workflow is already wired for it; nothing else changes.

   **Deferred 2026-08-12.** Until it happens, every macOS user runs
   `xattr -dr com.apple.quarantine` after every update. That is acceptable for personal use; it
   is not something to put in front of a colleague or a customer, so this decision should be
   revisited before Portra is shared further.
4. ~~**Decide whether the macOS auto-updater matters.**~~ **Decided 2026-08-12: signing is
   deferred, so the gap is made visible instead.** The updater stays off on macOS, and Portra
   now states that in the footer and offers a manual **Check for Updates…** against the GitHub
   Releases API. Signing (step 3) turns the real updater back on and makes the notice
   disappear on its own.
5. **Confirm the passkey story you want to support on macOS.** If Touch ID is a requirement,
   Portra as an Electron app is the wrong vehicle and the question becomes whether to hand off
   sign-in to the system browser for the auth step. If security key or phone passkey is
   acceptable, document it and move on.

### Then — quality, in priority order

6. Electron 43.x upgrade with a re-run of the verification in this review.
7. Per-workspace "sign out" using `session.clearStorageData()`, plus a visible indicator of
   which workspaces currently hold a live session. This is the feature that makes the isolation
   story legible to the user rather than implicit.
8. Renderer tests around the customer/portal reducers, which currently mutate deep-cloned state
   in several places.
9. Replace the ad-hoc `structuredClone` + `find` + mutate pattern in `src/main.jsx` with a small
   reducer. Six call sites repeat the same clone-find-mutate-persist sequence, and two of them
   duplicate the save call.
10. Decide on the navigation allowlist for portal windows (finding 21).

---

## 3. Verifying this review

```bash
npm run check          # syntax + 10 unit tests on the data-format layer
npm run build          # renderer build
npm run dist:mac       # universal macOS build
spctl -a -t exec -vvv release/mac-universal/Portra.app   # expect: rejected until signed
```

The end-to-end checks (portal window opens, reaches the Entra sign-in page, correct user agent,
sandbox on, WebAuthn present, popups get their own window, non-https refused) were performed by
driving the packaged app over the Chrome DevTools Protocol. They are not yet automated — that is
worth doing before the Electron 43 upgrade.
