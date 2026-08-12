// Pure data-format helpers: default seed, import sanitising and .cfg parsing.
// Kept free of Electron APIs so they can be unit-tested with node:test.

function defaultData() {
  return {
    customers: [
      {
        id: 'sample-1',
        name: 'Sample Customer',
        username: '',
        portals: [
          { name: 'Azure', url: 'https://portal.azure.com' },
          { name: 'M365 Admin', url: 'https://admin.microsoft.com' }
        ]
      }
    ]
  };
}

// Only https portals are launchable — file:, javascript: and similar schemes must never
// reach loadURL(), since portal definitions can come from an imported .json/.cfg file.
function isLaunchableUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function newId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`.replace(/\./g, '');
}

// The customer id becomes the Electron session partition name — `persist:workspace-<id>` —
// which in turn becomes a directory under Partitions/. An imported id is untrusted input, so:
//   - only safe characters are allowed, keeping it out of path separators and traversal;
//   - ids must be unique, because two customers sharing an id share one session, which is
//     exactly the cross-tenant leakage the partitioning exists to prevent.
// Anything failing either rule gets a fresh id. Ids are internal, so regenerating one costs
// nothing beyond signing in to that workspace again.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function safeCustomerId(candidate, taken) {
  const id = SAFE_ID.test(String(candidate ?? '')) && !taken.has(candidate) ? String(candidate) : newId();
  taken.add(id);
  return id;
}

function sanitizeImportedData(parsed) {
  const customers = Array.isArray(parsed?.customers) ? parsed.customers : [];
  const takenIds = new Set();
  return {
    customers: customers
      .filter((c) => c && typeof c.name === 'string')
      .map((c) => {
        const portals = Array.isArray(c.portals)
          ? c.portals
              .filter((p) => p && typeof p.name === 'string' && typeof p.url === 'string')
              .map((p) => ({ name: p.name.trim(), url: p.url.trim() }))
              .filter((p) => isLaunchableUrl(p.url))
          : [];

        // A customer has one username; older exports stored it per portal, so fall back to
        // the first portal username rather than dropping it.
        const legacyUsername = Array.isArray(c.portals)
          ? c.portals.find((p) => typeof p?.username === 'string' && p.username.trim())?.username
          : undefined;

        return {
          id: safeCustomerId(c.id, takenIds),
          name: c.name.trim() || 'Customer',
          username: (typeof c.username === 'string' ? c.username : legacyUsername || '').trim(),
          portals
        };
      })
  };
}

function parseCfgText(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed?.customers) return sanitizeImportedData(parsed);

    const users = Array.isArray(parsed?.['users-data']) ? parsed['users-data'] : [];
    if (users.length) {
      const defaultPortals = [
        { name: 'Azure', url: 'https://portal.azure.com' },
        { name: 'Intune', url: 'https://intune.microsoft.com' },
        { name: 'Admin Center', url: 'https://admin.microsoft.com' },
        { name: 'Security Center', url: 'https://security.microsoft.com' },
        { name: 'Entra', url: 'https://entra.microsoft.com' }
      ];

      const customers = users.map((u, idx) => {
        const customerName = u.friendlyName || u.tenant || u.name || `Customer ${idx + 1}`;
        return {
          id: newId(),
          name: String(customerName),
          username: typeof u.name === 'string' ? u.name : '',
          portals: defaultPortals.map((p) => ({ ...p }))
        };
      });

      return { customers };
    }
  } catch {}

  const lines = text.split(/\r?\n/);
  const customers = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    const sectionMatch = line.match(/^\[(.+?)\]$/);
    if (sectionMatch) {
      current = { id: newId(), name: sectionMatch[1], username: '', portals: [] };
      customers.push(current);
      continue;
    }

    const kv = line.match(/^([^=]+)=(.+)$/);
    if (kv && current) {
      current.portals.push({ name: kv[1].trim(), url: kv[2].trim() });
      continue;
    }

    const parts = line.split(',').map((p) => p.trim());
    if (parts.length >= 3) {
      const [customerName, portalName, url, username = ''] = parts;
      let customer = customers.find((c) => c.name === customerName);
      if (!customer) {
        customer = { id: newId(), name: customerName, username: '', portals: [] };
        customers.push(customer);
      }
      customer.portals.push({ name: portalName, url });
      if (username && !customer.username) customer.username = username;
    }
  }

  if (!customers.length) throw new Error('Unsupported .cfg format');
  return { customers };
}

// Semantic version comparison for the update check. Returns >0 when a is newer than b.
// Tolerates a leading "v" and missing components, as GitHub tags carry both forms.
function compareVersions(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

module.exports = { compareVersions, defaultData, isLaunchableUrl, newId, safeCustomerId, sanitizeImportedData, parseCfgText };
