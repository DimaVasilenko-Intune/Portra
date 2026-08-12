# Reporting a security issue in Portra

Please **do not open a public issue** for a security problem. Portra is used to hold
administrative sessions for other people's Microsoft tenants, so a public report exposes those
users before a fix exists.

Use GitHub's private reporting instead: **Security → Report a vulnerability** on
https://github.com/DimaVasilenko-Intune/Portra, which opens a private advisory visible only to
the maintainer.

Useful things to include: the Portra version (shown in the footer), your OS and version, what you
observed, and how to reproduce it. If you are unsure whether something counts, report it.

## Supported versions

Only the latest release is supported. Fixes land in a new release rather than being backported.

## What is already known and documented

Read [docs/SECURITY.md](../docs/SECURITY.md) before reporting — it records the current posture,
measured rather than assumed, including two limitations that are already known and are **not**
new findings:

- **Portal session cookies and localStorage tokens are stored unencrypted.** Electron does not
  encrypt the Chromium cookie store and exposes no API to enable it, so this cannot be fixed in
  Portra. Mitigations are documented.
- **Portra is not code-signed on either platform**, so nothing verifies the integrity of the app
  you downloaded.

Reports that these are insecure are welcome but will be closed as known. A report showing a *way
around* the documented mitigations, or anything not on that list, is very much wanted.

## Especially interesting to us

- Anything that lets one customer workspace read another's cookies, tokens or cached data. The
  session partition boundary is the product's core promise; the customer id is what enforces it.
- Anything that escapes the portal window's sandbox, or reaches Node from page content.
- Anything that makes Portra open or navigate to a non-`https` URL.
- Anything in the import path (`.json` / `.cfg`) that affects the filesystem or a session
  partition beyond adding customers and portals.
