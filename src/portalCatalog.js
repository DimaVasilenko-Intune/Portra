export const PORTAL_CATALOG = [
  { id: 'azure', name: 'Azure', url: 'https://portal.azure.com', icon: '/portals/azure.svg' },
  { id: 'intune', name: 'Intune', url: 'https://intune.microsoft.com', icon: '/portals/intune.svg' },
  { id: 'admin-center', name: 'Admin Center', url: 'https://admin.microsoft.com', icon: '/portals/admin-center.svg' },
  { id: 'security-center', name: 'Security Center', url: 'https://security.microsoft.com', icon: '/portals/security-center.svg' },
  { id: 'entra', name: 'Entra', url: 'https://entra.microsoft.com', icon: '/portals/entra.svg' },
  { id: 'endpoint-manager', name: 'Endpoint Manager', url: 'https://endpoint.microsoft.com', icon: '/portals/endpoint-manager.svg' },
  { id: 'defender', name: 'Defender', url: 'https://security.microsoft.com/defender', icon: '/portals/defender.svg' },
  { id: 'exchange-admin', name: 'Exchange Admin', url: 'https://admin.exchange.microsoft.com', icon: '/portals/exchange-admin.svg' },
  { id: 'sharepoint-admin', name: 'SharePoint Admin', url: 'https://admin.microsoft.com/sharepoint', icon: '/portals/sharepoint-admin.svg' },
  { id: 'teams-admin', name: 'Teams Admin', url: 'https://admin.teams.microsoft.com', icon: '/portals/teams-admin.svg' },
  { id: 'compliance', name: 'Compliance', url: 'https://compliance.microsoft.com', icon: '/portals/compliance.svg' },
  { id: 'purview', name: 'Purview', url: 'https://purview.microsoft.com', icon: '/portals/purview.svg' },
  { id: 'power-platform', name: 'Power Platform', url: 'https://admin.powerplatform.microsoft.com', icon: '/portals/power-platform.svg' },
  { id: 'power-bi', name: 'Power BI', url: 'https://app.powerbi.com', icon: '/portals/power-bi.svg' },
  { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com', icon: '/portals/copilot.svg' }
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
