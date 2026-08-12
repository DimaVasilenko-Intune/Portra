import React from 'react'

const s = { width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' }

export const IconSun = () => (
  <svg {...s}><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
)
export const IconMoon = () => (
  <svg {...s}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
)
export const IconPlus = () => (
  <svg {...s}><path d="M12 5v14m-7-7h14"/></svg>
)
export const IconSearch = () => (
  <svg {...s}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
)
export const IconEdit = () => (
  <svg {...s}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
)
export const IconTrash = () => (
  <svg {...s}><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
)
export const IconCopy = () => (
  <svg {...s}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
)
export const IconExternalLink = () => (
  <svg {...s}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6m4-3h6v6m-11 5L21 3"/></svg>
)
export const IconDownload = () => (
  <svg {...s}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5l5 5 5-5m-5 5V3"/></svg>
)
export const IconUpload = () => (
  <svg {...s}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m14-7l-5-5-5 5m5-5v12"/></svg>
)
export const IconChevron = ({ open }) => (
  <svg {...s} style={{ ...s, transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}><path d="M9 18l6-6-6-6"/></svg>
)
export const IconShield = () => (
  <svg {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
)
export const IconSignOut = () => (
  <svg {...s}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5m5 5H9"/></svg>
)

// Portal logo component — uses explicit icon paths from catalog
export const PortalIcon = ({ icon, name }) => {
  if (!icon) return null
  return (
    <img
      className="portalIcon"
      src={icon}
      alt={name || 'portal icon'}
    />
  )
}

export const IconX = () => (
  <svg {...s}><path d="M18 6L6 18M6 6l12 12"/></svg>
)
