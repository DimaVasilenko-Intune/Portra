const test = require('node:test');
const assert = require('node:assert/strict');
const { isLaunchableUrl, sanitizeImportedData, parseCfgText } = require('./dataFormat');

test('only https URLs are launchable', () => {
  assert.equal(isLaunchableUrl('https://portal.azure.com'), true);
  assert.equal(isLaunchableUrl('http://portal.azure.com'), false);
  assert.equal(isLaunchableUrl('file:///etc/passwd'), false);
  assert.equal(isLaunchableUrl('javascript:alert(1)'), false);
  assert.equal(isLaunchableUrl('not a url'), false);
  assert.equal(isLaunchableUrl(undefined), false);
});

test('export/import round-trip keeps the customer username', () => {
  const exported = {
    customers: [
      {
        id: 'c1',
        name: 'Contoso',
        username: 'admin@contoso.no',
        portals: [{ name: 'Azure', url: 'https://portal.azure.com' }]
      }
    ]
  };
  const imported = sanitizeImportedData(structuredClone(exported));
  assert.equal(imported.customers[0].username, 'admin@contoso.no');
  assert.equal(imported.customers[0].name, 'Contoso');
  assert.deepEqual(imported.customers[0].portals, [{ name: 'Azure', url: 'https://portal.azure.com' }]);
});

test('pre-0.5.1 exports with per-portal usernames are lifted to the customer', () => {
  const legacy = {
    customers: [
      {
        name: 'Fabrikam',
        portals: [
          { name: 'Azure', url: 'https://portal.azure.com', username: '' },
          { name: 'Intune', url: 'https://intune.microsoft.com', username: 'admin@fabrikam.no' }
        ]
      }
    ]
  };
  const imported = sanitizeImportedData(legacy);
  assert.equal(imported.customers[0].username, 'admin@fabrikam.no');
});

test('non-https and malformed portals are dropped on import', () => {
  const hostile = {
    customers: [
      {
        name: 'Evil',
        portals: [
          { name: 'Local file', url: 'file:///etc/passwd' },
          { name: 'Script', url: 'javascript:alert(1)' },
          { name: 'Insecure', url: 'http://portal.azure.com' },
          { name: 'Fine', url: 'https://portal.azure.com' },
          { name: 'No url' },
          null
        ]
      }
    ]
  };
  const imported = sanitizeImportedData(hostile);
  assert.deepEqual(imported.customers[0].portals.map((p) => p.name), ['Fine']);
});

test('customers without a name are dropped, ids are generated', () => {
  const imported = sanitizeImportedData({ customers: [{ portals: [] }, { name: 'Keep', portals: [] }] });
  assert.equal(imported.customers.length, 1);
  assert.equal(imported.customers[0].name, 'Keep');
  assert.ok(imported.customers[0].id);
});

test('sanitizing junk input yields an empty workspace, not a crash', () => {
  assert.deepEqual(sanitizeImportedData(null), { customers: [] });
  assert.deepEqual(sanitizeImportedData({}), { customers: [] });
  assert.deepEqual(sanitizeImportedData({ customers: 'nope' }), { customers: [] });
});

test('.cfg: Portals app users-data format maps to customers with usernames', () => {
  const cfg = JSON.stringify({
    'users-data': [
      { friendlyName: 'Contoso', name: 'admin@contoso.no' },
      { tenant: 'fabrikam.onmicrosoft.com', name: 'admin@fabrikam.no' }
    ]
  });
  const parsed = parseCfgText(cfg);
  assert.equal(parsed.customers.length, 2);
  assert.equal(parsed.customers[0].name, 'Contoso');
  assert.equal(parsed.customers[0].username, 'admin@contoso.no');
  assert.equal(parsed.customers[1].name, 'fabrikam.onmicrosoft.com');
  assert.ok(parsed.customers[0].portals.length > 0);
});

test('.cfg: ini sections become customers', () => {
  const parsed = parseCfgText('[Contoso]\nAzure=https://portal.azure.com\n; a comment\n\n[Fabrikam]\nIntune=https://intune.microsoft.com');
  assert.deepEqual(parsed.customers.map((c) => c.name), ['Contoso', 'Fabrikam']);
  assert.deepEqual(parsed.customers[0].portals, [{ name: 'Azure', url: 'https://portal.azure.com' }]);
});

test('.cfg: csv rows group by customer and carry the username', () => {
  const parsed = parseCfgText(
    'Contoso,Azure,https://portal.azure.com,admin@contoso.no\nContoso,Intune,https://intune.microsoft.com\n'
  );
  assert.equal(parsed.customers.length, 1);
  assert.equal(parsed.customers[0].username, 'admin@contoso.no');
  assert.equal(parsed.customers[0].portals.length, 2);
});

test('.cfg: unsupported content is rejected', () => {
  assert.throws(() => parseCfgText('just some prose\nwith no structure'), /Unsupported \.cfg format/);
});
