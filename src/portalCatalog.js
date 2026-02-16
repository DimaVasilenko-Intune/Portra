export const PORTAL_CATALOG = [
  { id: 'azure', name: 'Azure', url: 'https://portal.azure.com' },
  { id: 'intune', name: 'Intune', url: 'https://intune.microsoft.com' },
  { id: 'admin-center', name: 'Admin Center', url: 'https://admin.microsoft.com' },
  { id: 'security-center', name: 'Security Center', url: 'https://security.microsoft.com' },
  { id: 'entra', name: 'Entra', url: 'https://entra.microsoft.com' },
  { id: 'endpoint-manager', name: 'Endpoint Manager', url: 'https://endpoint.microsoft.com' },
  { id: 'defender', name: 'Defender', url: 'https://security.microsoft.com/defender' },
  { id: 'exchange-admin', name: 'Exchange Admin', url: 'https://admin.exchange.microsoft.com' },
  { id: 'sharepoint-admin', name: 'SharePoint Admin', url: 'https://admin.microsoft.com/sharepoint' },
  { id: 'teams-admin', name: 'Teams Admin', url: 'https://admin.teams.microsoft.com' },
  { id: 'compliance', name: 'Compliance', url: 'https://compliance.microsoft.com' },
  { id: 'purview', name: 'Purview', url: 'https://purview.microsoft.com' },
  { id: 'power-platform', name: 'Power Platform', url: 'https://admin.powerplatform.microsoft.com' },
  { id: 'power-bi', name: 'Power BI', url: 'https://app.powerbi.com' },
  { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com' }
]

export const STANDARD_PORTALS = [
  'azure',
  'intune',
  'admin-center',
  'security-center',
  'entra'
]

export function getStandardPortals() {
  return STANDARD_PORTALS.map((id) => PORTAL_CATALOG.find((p) => p.id === id)).filter(Boolean)
}
