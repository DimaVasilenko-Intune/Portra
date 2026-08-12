# Portra security posture

Assessed 2026-08-12 against 0.6.2 on macOS 26.6.1. Every claim below was measured on a packaged
build, and the method is given so it can be re-checked. Where something is not protected, that is
stated plainly rather than softened.

## Short answer on passwords

**Portra never stores, reads or handles your passwords.** There is no password field in the app,
no password manager, and no autofill store. When you sign in to a portal you type into a Chromium
window that posts straight to Microsoft over TLS, and nothing about that is persisted by Portra.

Verified: `Login Data`, `Login Data For Account` and `Web Data` — the Chromium password and
autofill databases — are absent from every session partition. Electron does not ship the password
manager component.

**But passwords are not the thing an attacker would go after.** What is on disk is your *signed-in
session*, and that is a bearer credential: whoever holds it is you, without needing the password
or a second factor. Read the next section.

## What is on disk, and how well protected

| What | Where | Protection | Verified by |
|---|---|---|---|
| Customer names, portal lists | `customers.enc` | Encrypted, key in the login keychain (`safeStorage`) | `isEncryptionAvailable()` true, file is ciphertext |
| Usernames | `customers.enc` | Same | Same |
| Passwords | nowhere | n/a — never stored | Password/autofill DBs absent |
| **Portal session cookies** | `Partitions/workspace-<id>/Cookies` | **None — plaintext** | `value` column holds the cleartext, `encrypted_value` empty, no `v10` marker |
| **Tokens portals keep in localStorage** | `Partitions/workspace-<id>/Local Storage/leveldb/*.log` | **None — plaintext** | Wrote a token via a page, found it verbatim in the leveldb log |
| All of the above | `~/Library/Application Support/portra` | Directory mode `700` | `stat` |

### The plaintext session-credential problem

Entra session cookies (`ESTSAUTH`, `ESTSAUTHPERSISTENT`) and the access/refresh tokens MSAL keeps
in `localStorage` for the Azure portal sit unencrypted in your home directory. Anything that can
read files as your user account can lift them and replay your session against those tenants:

- another program you run, including anything that ships a malicious dependency
- a backup or sync tool that reaches into Application Support (Time Machine, iCloud Drive,
  Dropbox, a corporate backup agent)
- anyone who gets your unlocked Mac, or an unencrypted disk image of it

**This is worse than Chrome or Edge.** Chromium encrypts its cookie store with a key held in the
login keychain; a process wanting the plaintext has to get past the keychain, which is an audited,
promptable boundary. Electron compiles that machinery in — `os_crypt_mac.mm` and
`keychain_password_mac.mm` are present in the framework binary — but never wires it to the cookie
store, and exposes no API to turn it on. **So this cannot be fixed inside Portra.** `localStorage`
is unencrypted in Chrome too, so that row is not an Electron regression, just a fact.

It matters more here than in an ordinary browser, because the sessions Portra holds are
administrative ones across many customer tenants. The blast radius of one stolen cookie jar is
every tenant you were signed in to.

**What actually reduces the risk, in order of effect:**

1. **Sign out of workspaces you are not using.** Each customer row has a sign-out button that
   clears that workspace's cookies, tokens and cached data and nothing else. A workspace left
   signed in is a credential sitting on disk; one signed out is not.
2. **Keep FileVault on.** It protects the at-rest case — a stolen or imaged disk — though not a
   process running as you while you are logged in.
3. **Short sign-in lifetimes on the tenant side.** Conditional Access sign-in frequency limits how
   long a stolen cookie is worth anything. This is the control that does not depend on Portra
   behaving well.
4. **Do not put Application Support in a sync folder.**

An ephemeral-session mode, where nothing is written to disk at all and you sign in each launch,
would remove this entirely. It is not implemented — see [IMPROVEMENT-PLAN.md](IMPROVEMENT-PLAN.md).

## What leaves your machine

Measured on the packaged 0.6.2 build by polling every Portra process's sockets with `lsof`, and
by recording every request with the Chrome DevTools Protocol.

**Idle, with no portal open: nothing.** Zero outbound connections over 75 seconds — no telemetry,
no update ping, no DNS. A full reload of the Portra window itself issues four requests, all
`file://` inside the app bundle. Nothing remote.

**No crash reporting.** `crashReporter.start()` is never called and no crashpad process runs for
Portra, so no crash dumps are uploaded anywhere.

**The auto-updater never runs on macOS.** It is skipped before it can contact anything.

Portra's own code has exactly two network paths, and one of them is dead on macOS:

| Path | When | What is sent |
|---|---|---|
| `api.github.com/repos/.../releases/latest` | Only when you click "check for updates" or use the menu item | The request itself: your IP, and `User-Agent: Portra/<version>`. No customer data, no usernames, no identifiers |
| `electron-updater` | Windows only — disabled on macOS | Standard update check |

**When you open a portal, that window is a browser and behaves like one.** Opening the Azure
portal contacted, and nothing else:

```
aadcdn.msftauth.net              (sign-in assets)
login.microsoftonline.com        (Entra sign-in)
login.live.com                   (Microsoft account endpoint in the sign-in flow)
portal.azure.com                 (the portal)
eu-mobile.events.data.microsoft.com   (Microsoft's own page telemetry, EU endpoint)
```

All Microsoft. No third-party analytics, no non-Microsoft host. The telemetry endpoint is the
Microsoft *page's* instrumentation, not Portra's — you get exactly the same request opening that
page in Chrome or Edge. Portra adds nothing to it and removes nothing from it.

**Portra cannot read what you type into a portal.** Portal windows are created with no `preload`
script, so there is no bridge between page content and the app: `window.orbit` is undefined in a
portal window (verified), as are `require`, `process` and `module`. The entire IPC surface
available to the *app* window is eleven functions — load/save/export/import data, open or sign out
of a portal, and read the version, platform and update status. None of them can reach into a
portal page, and no code reads form fields or keystrokes.

The one thing Microsoft sees differently from a real browser is the user agent, which claims
Chrome on macOS rather than Electron. That is deliberate, so sign-in offers passkey and
security-key options.

## Isolation between customers

The product's core promise is that one customer's session cannot reach another's. It holds, with a
caveat that was fixed in 0.6.1.

Each customer gets `session.fromPartition('persist:workspace-<id>')`. Measured: a cookie set in
one workspace is invisible to another workspace and to the default session.

**Fixed in 0.6.1:** the customer id came straight out of an imported `.json`/`.cfg` file with no
validation, and the id *is* the partition name.

- Two customers sharing an id shared one session — measured: workspace B read workspace A's
  `ESTSAUTH` cookie. A hand-edited or hostile import file was enough to collapse the isolation
  boundary.
- Ids containing `../` or `/` were used as path components. Chromium contained them (no write
  landed outside the data directory), but they created stray nested partition directories.

Ids are now constrained to `[A-Za-z0-9_-]{1,64}` and de-duplicated on import, with the same check
repeated where the partition name is built. Both are covered by unit tests.

## Portal windows

| Control | State |
|---|---|
| Chromium sandbox | On (verified: no `require`, `process`, `module` or `Buffer` in the page) |
| Context isolation | On |
| Node integration | Off |
| Navigation | `https` only; other schemes are blocked, including in popups |
| Permissions | Only clipboard, fullscreen, USB/HID. Camera, microphone, geolocation and notifications denied (verified: geolocation and notifications return denied) |
| Device access | HID/USB only, for security keys |
| Popups | Own window in the same session — cannot replace the page you are on |

The app shell itself runs from `file://` with a strict CSP (`default-src 'self'`,
`connect-src 'none'`), loads only bundled assets, and cannot navigate or open windows.

## The unsigned-app problem

Portra is ad-hoc signed, not signed with a Developer ID, and carries
`com.apple.security.cs.disable-library-validation` (which Chromium requires).

**Nothing verifies Portra's integrity.** Any process running as your user can modify the app
bundle — patch the JavaScript, swap a library — and macOS will not object, because there is no
signature to break. A tampered Portra could exfiltrate every session and every keystroke, and look
identical.

For anything called bulletproof, this is the gap that matters most, and it is a purchase decision
rather than a code change: a Developer ID certificate plus notarization. The CI workflow is already
wired for it. See [MACOS.md](MACOS.md).

## Honest summary

Nothing leaks outward. Idle, Portra makes no network connections at all — no telemetry, no crash
reports, no phone-home — and when you open a portal, the only hosts contacted are Microsoft's, the
same ones any browser would contact. Portra has no way to read what you type into a portal.

The exposure is **local, not outbound**: session credentials sitting unencrypted on your own disk,
and an app whose integrity nothing verifies.

Portra is solid on the things it controls: no password handling, encrypted app data, real session
isolation, a properly locked-down renderer, no egress. It is **not** bulletproof, and two of the
reasons are outside its code:

1. Chromium-in-Electron stores session cookies unencrypted, and Electron gives no way to change
   that. Mitigate by signing out of idle workspaces and leaning on Conditional Access sign-in
   frequency.
2. The app is unsigned, so its own integrity is unverifiable. Mitigate by paying for signing.

Anyone who can run code as your macOS user can take your Portra sessions. That is true of Chrome
and Edge profiles too, but Portra currently sets a lower bar than they do, and holds
higher-value sessions.

## Re-running this assessment

The cookie and isolation measurements were made with a short Electron harness that sets a cookie
in a partition, flushes the store, and inspects the SQLite file and leveldb logs directly. It is
not committed. Rebuilding it is a few lines against `session.fromPartition`, `cookies.set`,
`cookies.flushStore` and `fs.readFileSync`, and doing so is the only way to confirm the plaintext
claim rather than take this document's word for it.
