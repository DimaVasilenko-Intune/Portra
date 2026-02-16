export const PORTAL_CATALOG = [
  { id: 'azure', name: 'Azure', url: 'https://portal.azure.com', icon: 'https://portal.azure.com/favicon.ico' },
  { id: 'intune', name: 'Intune', url: 'https://intune.microsoft.com', icon: 'https://intune.microsoft.com/favicon.ico' },
  { id: 'admin-center', name: 'Admin Center', url: 'https://admin.microsoft.com', icon: 'https://admin.microsoft.com/favicon.ico' },
  { id: 'security-center', name: 'Security Center', url: 'https://security.microsoft.com', icon: 'https://security.microsoft.com/favicon.ico' },
  { id: 'entra', name: 'Entra', url: 'https://entra.microsoft.com', icon: 'https://entra.microsoft.com/favicon.ico' },
  { id: 'endpoint-manager', name: 'Endpoint Manager', url: 'https://endpoint.microsoft.com', icon: 'https://endpoint.microsoft.com/favicon.ico' },
  { id: 'defender', name: 'Defender', url: 'https://security.microsoft.com/defender', icon: 'https://security.microsoft.com/favicon.ico' },
  { id: 'exchange-admin', name: 'Exchange Admin', url: 'https://admin.exchange.microsoft.com', icon: 'https://admin.exchange.microsoft.com/favicon.ico' },
  { id: 'sharepoint-admin', name: 'SharePoint Admin', url: 'https://admin.microsoft.com/sharepoint', icon: 'https://admin.microsoft.com/favicon.ico' },
  { id: 'teams-admin', name: 'Teams Admin', url: 'https://admin.teams.microsoft.com', icon: 'https://admin.teams.microsoft.com/favicon.ico' },
  { id: 'compliance', name: 'Compliance', url: 'https://compliance.microsoft.com', icon: 'https://compliance.microsoft.com/favicon.ico' },
  { id: 'purview', name: 'Purview', url: 'https://purview.microsoft.com', icon: 'https://purview.microsoft.com/favicon.ico' },
  { id: 'power-platform', name: 'Power Platform', url: 'https://admin.powerplatform.microsoft.com', icon: 'https://admin.powerplatform.microsoft.com/favicon.ico' },
  { id: 'power-bi', name: 'Power BI', url: 'https://app.powerbi.com', icon: 'https://app.powerbi.com/favicon.ico' },
  { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com', icon: 'https://copilot.microsoft.com/favicon.ico' }
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
