# Portra on macOS

## Why a downloaded build will not open

Portra is currently built **without an Apple Developer ID certificate**. `electron-builder`
falls back to an ad-hoc signature:

```
• falling back to ad-hoc signature for macOS application code signing
• skipped macOS notarization  reason=`notarize` options were unable to be generated
```

macOS refuses to launch such an app once it has been downloaded, because the download carries
the `com.apple.quarantine` attribute and Gatekeeper cannot verify the signature:

```bash
spctl -a -t exec -vvv /Applications/Portra.app
# Portra.app: rejected
```

The user sees *"Apple could not verify 'Portra' is free of malware"* and the app never starts.
On macOS 15 and later the old right-click → **Open** shortcut no longer works, so there is no
obvious way out from the UI.

This affects the `.dmg` and `.zip` downloads on the Releases page. It is not a bug in the app
itself — a locally built Portra runs fine, because a local build is never quarantined.

## Running it today, unsigned

**Option 1 — build and install from source (recommended while unsigned):**

```bash
npm install
npm run install:mac-local
```

This builds a universal app, copies it to `/Applications`, strips the quarantine attribute and
launches it.

**Option 2 — use a downloaded build:** after dragging Portra to `/Applications`, remove the
quarantine attribute:

```bash
xattr -dr com.apple.quarantine /Applications/Portra.app
```

Then launch it normally. This has to be repeated after every update.

Only do this for builds you produced yourself or downloaded from the official Portra releases —
stripping quarantine disables the only check macOS performs on an unsigned app.

## Shipping signed and notarized builds

This is the real fix. Once it is in place, macOS users just drag and run, and the auto-updater
starts working (Squirrel refuses to apply updates to an unsigned app, so Portra currently skips
the updater entirely on macOS).

What is needed:

1. **Apple Developer Program membership** — 99 USD/year, tied to an Apple ID or an
   Organization account (an organization needs a D-U-N-S number).
2. **A "Developer ID Application" certificate**, exported as a `.p12` file with a password.
3. **An app-specific password** for the Apple ID used for notarization.
4. **Repository secrets** in GitHub:

   | Secret | Contents |
   |---|---|
   | `MAC_CERT_P12` | Base64 of the `.p12` certificate |
   | `MAC_CERT_PASSWORD` | Password for the `.p12` |
   | `APPLE_ID` | Apple ID used for notarization |
   | `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for that Apple ID |
   | `APPLE_TEAM_ID` | 10-character Apple Team ID |

The workflow in `.github/workflows/build.yml` already branches on `MAC_CERT_P12`: with the
secrets present it signs and notarizes, without them it produces the unsigned build and emits a
warning. Nothing else needs to change.

Verify a signed build with:

```bash
spctl -a -t exec -vvv release/mac-universal/Portra.app   # expect: accepted
codesign -dv --verbose=2 release/mac-universal/Portra.app # expect: Authority=Developer ID Application: ...
```

## Passkeys and security keys on macOS

Measured against the Entra sign-in page in a packaged build (Electron 40.10.6, Chromium 144):

| Capability | Status |
|---|---|
| WebAuthn API present | Yes |
| Conditional mediation (passkey autofill) | Yes |
| **Platform authenticator (Touch ID / iCloud Keychain)** | **No** — `isUserVerifyingPlatformAuthenticatorAvailable()` returns `false` |
| Security key over USB/HID (YubiKey and similar) | Yes |
| Phone as passkey (QR / hybrid transport) | Expected to work; not yet verified end to end |

Electron does not expose the macOS platform authenticator, so **Touch ID cannot be used to sign
in from inside Portra**. Whether this can be enabled at all needs confirmation upstream — using
the macOS system passkey store normally requires Apple's
`com.apple.developer.web-browser.public-key-credential` entitlement, which Apple grants only to
browser apps.

Until that is resolved, macOS users should sign in with a security key, a phone passkey, or
password plus MFA. This differs from Windows, where Windows Hello works.

## Data location

```
~/Library/Application Support/portra/customers.enc
```

Encrypted with Electron `safeStorage`, which on macOS wraps the key in the login keychain.

Because the key is bound to the app's code signature, replacing Portra with a build that has a
different signature can cause the keychain to deny access. Portra detects this: it keeps a
timestamped copy of the unreadable file, refuses to overwrite it, and shows the path in the app
instead of silently starting over with an empty list. Signing all builds with the same
Developer ID certificate removes the problem.
