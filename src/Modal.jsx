import React, { useEffect, useRef, useState, useMemo } from 'react'
import { IconX, IconSearch, PortalIcon } from './icons'
import { PORTAL_CATALOG } from './portalCatalog'

export function InputModal({ title, label, defaultValue = '', onSubmit, onCancel }) {
  const [value, setValue] = useState(defaultValue)
  const ref = useRef()
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  const submit = () => { if (value.trim()) onSubmit(value.trim()) }

  return (
    <div className="modalOverlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modalHeader">
          <h3>{title}</h3>
          <button className="iconBtn" onClick={onCancel}><IconX /></button>
        </div>
        <label className="modalLabel">{label}</label>
        <input ref={ref} className="modalInput" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        <div className="modalActions">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={submit} disabled={!value.trim()}>Save</button>
        </div>
      </div>
    </div>
  )
}

export function CustomerModal({ customers = [], onSubmit, onCancel }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState('standard') // standard | fresh | copy
  const [sourceCustomerId, setSourceCustomerId] = useState(customers[0]?.id || '')
  const ref = useRef()

  useEffect(() => { ref.current?.focus() }, [])

  const submit = () => {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), mode, sourceCustomerId: mode === 'copy' ? sourceCustomerId : null })
  }

  return (
    <div className="modalOverlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modalHeader">
          <h3>New Customer</h3>
          <button className="iconBtn" onClick={onCancel}><IconX /></button>
        </div>

        <label className="modalLabel">Customer name</label>
        <input ref={ref} className="modalInput" value={name} onChange={e => setName(e.target.value)} placeholder="Customer name" />

        <label className="modalLabel">Portal setup</label>
        <div className="modeGrid modeGrid3">
          <label className={`modeCard ${mode === 'standard' ? 'active' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'standard'} onChange={() => setMode('standard')} />
            <div><strong>Standard</strong><span>Azure, Intune, Admin, Security, Entra, Exchange, SharePoint</span></div>
          </label>
          <label className={`modeCard ${mode === 'fresh' ? 'active' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'fresh'} onChange={() => setMode('fresh')} />
            <div><strong>Fresh</strong><span>Start with no portals</span></div>
          </label>
          <label className={`modeCard ${mode === 'copy' ? 'active' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'copy'} onChange={() => setMode('copy')} />
            <div><strong>Copy</strong><span>Copy portals from existing customer</span></div>
          </label>
        </div>

        {mode === 'copy' && (
          <>
            <label className="modalLabel">Copy from customer</label>
            <select className="modalInput" value={sourceCustomerId} onChange={e => setSourceCustomerId(e.target.value)}>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>
        )}

        <div className="modalActions">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={submit} disabled={!name.trim() || (mode === 'copy' && !sourceCustomerId)}>Create</button>
        </div>
      </div>
    </div>
  )
}

export function PortalModal({ title, defaults = {}, onSubmit, onCancel }) {
  const [name, setName] = useState(defaults.name || '')
  const [url, setUrl] = useState(defaults.url || '')
  const [selectedIds, setSelectedIds] = useState([])
  const [search, setSearch] = useState('')
  const ref = useRef()
  useEffect(() => { ref.current?.focus() }, [])

  const submit = () => {
    if (selectedIds.length > 0) {
      const portals = selectedIds
        .map((id) => PORTAL_CATALOG.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({ name: p.name, url: p.url }))
      if (portals.length) onSubmit(portals)
      return
    }
    if (name.trim() && url.trim()) onSubmit({ name: name.trim(), url: url.trim() })
  }

  const toggleTemplate = (id, p) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
    setName(p.name)
    setUrl(p.url)
  }

  const filteredCatalog = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return PORTAL_CATALOG
    return PORTAL_CATALOG.filter((p) => p.name.toLowerCase().includes(q) || p.url.toLowerCase().includes(q))
  }, [search])

  return (
    <div className="modalOverlay" onClick={onCancel}>
      <div className="modal modalWide" onClick={e => e.stopPropagation()}>
        <div className="modalHeader">
          <h3>{title}</h3>
          <button className="iconBtn" onClick={onCancel}><IconX /></button>
        </div>

        <label className="modalLabel">Quick add (pick a portal)</label>
        <div className="catalogSearch">
          <IconSearch />
          <input className="modalInput" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search portal templates..." />
        </div>
        <div className="templateGrid">
          {filteredCatalog.map((p) => (
            <button
              key={p.id}
              className={`templateChip ${selectedIds.includes(p.id) ? 'active' : ''}`}
              onClick={() => toggleTemplate(p.id, p)}
              type="button"
            >
              <PortalIcon icon={p.icon} name={p.name} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>

        <label className="modalLabel">Portal name</label>
        <input ref={ref} className="modalInput" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Azure Portal" />
        <label className="modalLabel">URL</label>
        <input className="modalInput" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://portal.azure.com" onKeyDown={e => e.key === 'Enter' && submit()} />
        <div className="modalActions">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={submit} disabled={!name.trim() || !url.trim()}>Save</button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmModal({ title, message, danger = false, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <div className="modalOverlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modalHeader">
          <h3>{title}</h3>
          <button className="iconBtn" onClick={onCancel}><IconX /></button>
        </div>
        <p className="modalMessage">{message}</p>
        <div className="modalActions">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
