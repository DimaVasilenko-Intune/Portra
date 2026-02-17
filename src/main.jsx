import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { IconSun, IconMoon, IconPlus, IconSearch, IconEdit, IconTrash, IconCopy, IconExternalLink, IconDownload, IconUpload, IconChevron, IconShield, PortalIcon } from './icons'
import { InputModal, PortalModal, ConfirmModal, CustomerModal } from './Modal'
import { getStandardPortals, PORTAL_CATALOG } from './portalCatalog'
import './styles.css'

function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t) }, [onDone])
  return <div className="toast">{message}</div>
}

function App() {
  const [data, setData] = useState({ customers: [] })
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState({})
  const [theme, setTheme] = useState(localStorage.getItem('portra-theme') || 'dark')
  const [toast, setToast] = useState(null)
  const [version, setVersion] = useState('')
  const [modal, setModal] = useState(null)

  const notify = useCallback((msg) => setToast(msg), [])
  const closeModal = useCallback(() => setModal(null), [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('portra-theme', theme)
  }, [theme])

  useEffect(() => {
    window.orbit.loadData().then((d) => {
      setData(d)
      const e = {}
      d.customers.forEach(c => (e[c.id] = false))
      setExpanded(e)
    })
    window.orbit.getVersion?.().then(v => setVersion(v || ''))
  }, [])

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim()
    if (!s) return data.customers
    return data.customers.filter(c =>
      c.name.toLowerCase().includes(s) || c.portals.some(p => p.name.toLowerCase().includes(s))
    )
  }, [data, q])

  const stats = useMemo(() => ({
    customers: data.customers.length,
    portals: data.customers.reduce((a, c) => a + c.portals.length, 0)
  }), [data])

  const persist = useCallback((next) => {
    setData(next)
    window.orbit.saveData(next)
  }, [])

  // --- Customer ---
  const addCustomer = () => {
    setModal(
      <CustomerModal
        customers={data.customers}
        onCancel={closeModal}
        onSubmit={({ name, mode, sourceCustomerId }) => {
          closeModal()
          const id = crypto.randomUUID()
          setData(prev => {
            const next = structuredClone(prev)
            let portals = []

            if (mode === 'copy') {
              portals = (next.customers.find(c => c.id === sourceCustomerId)?.portals || []).map(p => ({ ...p }))
            } else if (mode === 'standard') {
              portals = getStandardPortals().map((p) => ({ name: p.name, url: p.url, username: '' }))
            }

            next.customers.push({ id, name, portals })
            window.orbit.saveData(next)
            return next
          })
          setExpanded(prev => ({ ...prev, [id]: true }))
          notify(mode === 'copy' ? `Added "${name}" with copied portals` : mode === 'standard' ? `Added "${name}" with standard portals` : `Added "${name}"`)
        }}
      />
    )
  }

  const renameCustomer = (cid) => {
    const c = data.customers.find(x => x.id === cid)
    if (!c) return
    setModal(
      <InputModal
        title="Rename Customer"
        label="New name"
        defaultValue={c.name}
        onCancel={closeModal}
        onSubmit={(name) => {
          closeModal()
          const next = structuredClone(data)
          next.customers.find(x => x.id === cid).name = name
          persist(next)
          notify(`Renamed to "${name}"`)
        }}
      />
    )
  }

  const deleteCustomer = (cid) => {
    const c = data.customers.find(x => x.id === cid)
    if (!c) return
    setModal(
      <ConfirmModal
        title="Delete Customer"
        message={`Delete "${c.name}" and all its portals? This cannot be undone.`}
        danger
        onCancel={closeModal}
        onConfirm={() => {
          closeModal()
          const next = structuredClone(data)
          next.customers = next.customers.filter(x => x.id !== cid)
          persist(next)
          notify(`Deleted "${c.name}"`)
        }}
      />
    )
  }

  // --- Portal ---
  const addPortal = (cid) => {
    setModal(
      <PortalModal
        title="Add Portal"
        onCancel={closeModal}
        onSubmit={(payload) => {
          closeModal()
          const next = structuredClone(data)
          const customer = next.customers.find(x => x.id === cid)
          if (!customer) return data

          const list = Array.isArray(payload) ? payload : [payload]
          list.forEach(({ name, url }) => {
            customer.portals.push({ name, url, username: '' })
            notify(`Added "${name}"`)
          })

          persist(next)
        }}
      />
    )
  }

  const editPortal = (cid, idx) => {
    const p = data.customers.find(x => x.id === cid)?.portals[idx]
    if (!p) return
    setModal(
      <PortalModal
        title="Edit Portal"
        defaults={p}
        onCancel={closeModal}
        onSubmit={({ name, url }) => {
          closeModal()
          const next = structuredClone(data)
          const np = next.customers.find(x => x.id === cid).portals[idx]
          np.name = name
          np.url = url
          persist(next)
          notify(`Updated "${name}"`)
        }}
      />
    )
  }

  const deletePortal = (cid, idx) => {
    const p = data.customers.find(x => x.id === cid)?.portals[idx]
    if (!p) return
    setModal(
      <ConfirmModal
        title="Delete Portal"
        message={`Delete "${p.name}"? This cannot be undone.`}
        danger
        onCancel={closeModal}
        onConfirm={() => {
          closeModal()
          const next = structuredClone(data)
          next.customers.find(x => x.id === cid).portals.splice(idx, 1)
          persist(next)
          notify(`Deleted "${p.name}"`)
        }}
      />
    )
  }

  const setUsername = (cid, idx, username) => {
    const next = structuredClone(data)
    next.customers.find(x => x.id === cid).portals[idx].username = username
    persist(next)
  }

  const copyUsername = async (username) => {
    if (!username) return
    try { await navigator.clipboard.writeText(username); notify('Copied to clipboard') } catch {}
  }

  const exportData = async () => {
    const res = await window.orbit.exportData(data)
    if (res?.ok) notify('Data exported')
  }

  const importData = async () => {
    const res = await window.orbit.importData()
    if (res?.ok) {
      setData(res.data)
      const e = {}
      res.data.customers.forEach(c => (e[c.id] = false))
      setExpanded(e)
      notify('Data imported')
    }
    if (res?.error) notify(res.error)
  }

  return (
    <div className="app">
      {modal}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <header className="topbar">
        <div className="brand">
          <img src="./logo.svg" alt="Portra" />
          <h1>Portra</h1>
          <span className="badge">{stats.customers} customers · {stats.portals} portals</span>
        </div>
        <div className="actions">
          <button className="iconBtn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Toggle theme">
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
          <button className="ghost" onClick={importData}><IconUpload /> Import</button>
          <button className="ghost" onClick={exportData}><IconDownload /> Export</button>
          <button className="primary" onClick={addCustomer}><IconPlus /> Customer</button>
        </div>
      </header>

      <div className="searchWrap">
        <IconSearch />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search customers or portals..." />
      </div>

      {filtered.length === 0 && (
        <div className="empty">
          {q ? 'No results found.' : 'No customers yet — add one to get started.'}
        </div>
      )}

      <main className="list">
        {filtered.map(c => (
          <section key={c.id} className="card">
            <div className="cardHead" onClick={() => setExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}>
              <IconChevron open={expanded[c.id]} />
              <h2>{c.name}</h2>
              <span className="portalCount">{c.portals.length} portal{c.portals.length !== 1 ? 's' : ''}</span>
              <div className="cardActions" onClick={e => e.stopPropagation()}>
                <button className="ghost small" onClick={() => addPortal(c.id)}><IconPlus /> Portal</button>
                <button className="iconBtn" onClick={() => renameCustomer(c.id)} title="Rename"><IconEdit /></button>
                <button className="iconBtn dangerHover" onClick={() => deleteCustomer(c.id)} title="Delete"><IconTrash /></button>
              </div>
            </div>
            {expanded[c.id] && (
              <div className="portals">
                {c.portals.length === 0 && <p className="muted">No portals yet.</p>}
                {c.portals.map((p, i) => {
                  const match = PORTAL_CATALOG.find(t => t.id === p.id || t.name === p.name || p.url.startsWith(t.url))
                  return (
                  <div key={p.name + i} className="portalRow">
                    <div className="portalInfo">
                      {match && <PortalIcon icon={match.icon} name={match.name} />}
                      <div>
                        <div className="pname">{p.name}</div>
                        <span className="purl">{p.url}</span>
                      </div>
                    </div>
                    <div className="inputWrap">
                      <input
                        value={p.username || ''}
                        onChange={e => setUsername(c.id, i, e.target.value)}
                        placeholder="Username"
                      />
                      <button className="iconBtn" onClick={() => copyUsername(p.username)} title="Copy username"><IconCopy /></button>
                    </div>
                    <div className="portalActions">
                      <button className="primary compact" onClick={() => window.orbit.openPortal({ customerId: c.id, url: p.url, username: p.username })}>
                        <IconExternalLink /> Open
                      </button>
                      <button className="iconBtn" onClick={() => editPortal(c.id, i)} title="Edit"><IconEdit /></button>
                      <button className="iconBtn dangerHover" onClick={() => deletePortal(c.id, i)} title="Delete"><IconTrash /></button>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </section>
        ))}
      </main>

      <footer className="appFooter">
        <span>Portra{version ? ` v${version}` : ''}</span>
        <span className="footerSecure"><IconShield /> Encrypted locally</span>
        <span className="footerMadeBy">Made by DimaVasilenko</span>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
