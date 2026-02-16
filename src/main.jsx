import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

// ---------------------------------------------------------------------------
// Toast notification
// ---------------------------------------------------------------------------
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [onDone])
  return <div className="toast">{message}</div>
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function App() {
  const [data, setData] = useState({ customers: [] })
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState({})
  const [theme, setTheme] = useState(localStorage.getItem('portra-theme') || 'dark')
  const [toast, setToast] = useState(null)
  const [version, setVersion] = useState('')

  const notify = useCallback((msg) => setToast(msg), [])

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

  const stats = useMemo(() => {
    const customers = data.customers.length
    const portals = data.customers.reduce((a, c) => a + c.portals.length, 0)
    return { customers, portals }
  }, [data])

  const persist = useCallback((next) => {
    setData(next)
    window.orbit.saveData(next)
  }, [])

  // --- Customer CRUD ---
  const addCustomer = () => {
    const name = prompt('Customer name')
    if (!name?.trim()) return
    const id = crypto.randomUUID()
    const next = structuredClone(data)
    next.customers.push({ id, name: name.trim(), portals: [] })
    persist(next)
    setExpanded(prev => ({ ...prev, [id]: true }))
    notify(`Added "${name.trim()}"`)
  }

  const renameCustomer = (cid) => {
    const c = data.customers.find(x => x.id === cid)
    if (!c) return
    const name = prompt('New name', c.name)
    if (!name?.trim() || name.trim() === c.name) return
    const next = structuredClone(data)
    next.customers.find(x => x.id === cid).name = name.trim()
    persist(next)
    notify(`Renamed to "${name.trim()}"`)
  }

  const deleteCustomer = (cid) => {
    const c = data.customers.find(x => x.id === cid)
    if (!c) return
    if (!confirm(`Delete "${c.name}" and all its portals?`)) return
    const next = structuredClone(data)
    next.customers = next.customers.filter(x => x.id !== cid)
    persist(next)
    notify(`Deleted "${c.name}"`)
  }

  // --- Portal CRUD ---
  const addPortal = (cid) => {
    const name = prompt('Portal name (e.g. Azure)')
    if (!name?.trim()) return
    const url = prompt('Portal URL (https://...)')
    if (!url?.trim()) return
    const next = structuredClone(data)
    const c = next.customers.find(x => x.id === cid)
    c.portals.push({ name: name.trim(), url: url.trim(), username: '' })
    persist(next)
    notify(`Added portal "${name.trim()}"`)
  }

  const editPortal = (cid, idx) => {
    const c = data.customers.find(x => x.id === cid)
    if (!c) return
    const p = c.portals[idx]
    const name = prompt('Portal name', p.name)
    if (!name?.trim()) return
    const url = prompt('Portal URL', p.url)
    if (!url?.trim()) return
    const next = structuredClone(data)
    const np = next.customers.find(x => x.id === cid).portals[idx]
    np.name = name.trim()
    np.url = url.trim()
    persist(next)
    notify(`Updated "${name.trim()}"`)
  }

  const deletePortal = (cid, idx) => {
    const c = data.customers.find(x => x.id === cid)
    if (!c) return
    const p = c.portals[idx]
    if (!confirm(`Delete portal "${p.name}"?`)) return
    const next = structuredClone(data)
    next.customers.find(x => x.id === cid).portals.splice(idx, 1)
    persist(next)
    notify(`Deleted "${p.name}"`)
  }

  const setUsername = (cid, idx, username) => {
    const next = structuredClone(data)
    next.customers.find(x => x.id === cid).portals[idx].username = username
    persist(next)
  }

  const copyUsername = async (username) => {
    if (!username) return
    try {
      await navigator.clipboard.writeText(username)
      notify('Copied!')
    } catch { /* no-op */ }
  }

  // --- Import / Export ---
  const exportData = async () => {
    const res = await window.orbit.exportData(data)
    if (res?.ok) notify(`Exported to ${res.filePath}`)
  }

  const importData = async () => {
    const res = await window.orbit.importData()
    if (res?.ok) {
      setData(res.data)
      const e = {}
      res.data.customers.forEach(c => (e[c.id] = false))
      setExpanded(e)
      notify(`Imported from ${res.filePath}`)
      return
    }
    if (res?.error) notify(res.error)
  }

  return (
    <div className="app">
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <header className="topbar">
        <div className="brand">
          <img src="./logo.svg" alt="Portra" />
          <h1>Portra</h1>
          <span className="badge">{stats.customers} customers · {stats.portals} portals</span>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="ghost" onClick={importData}>Import</button>
          <button className="ghost" onClick={exportData}>Export</button>
          <button className="primary" onClick={addCustomer}>+ Customer</button>
        </div>
      </header>

      <div className="searchWrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search customers or portals..." />
      </div>

      {filtered.length === 0 && (
        <div className="empty">
          {q ? 'No results found.' : 'No customers yet — click "+ Customer" to get started.'}
        </div>
      )}

      <main className="list">
        {filtered.map(c => (
          <section key={c.id} className="card">
            <div className="cardHead" onClick={() => setExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}>
              <span className="chevron">{expanded[c.id] ? '▾' : '▸'}</span>
              <h2>{c.name}</h2>
              <span className="portalCount">{c.portals.length} portals</span>
              <div className="cardActions" onClick={e => e.stopPropagation()}>
                <button className="ghost small" onClick={() => addPortal(c.id)}>+ Portal</button>
                <button className="ghost small" onClick={() => renameCustomer(c.id)}>✏️</button>
                <button className="ghost small danger" onClick={() => deleteCustomer(c.id)}>🗑</button>
              </div>
            </div>
            {expanded[c.id] && (
              <div className="portals">
                {c.portals.length === 0 && <p className="muted">No portals yet — click "+ Portal" to add one.</p>}
                {c.portals.map((p, i) => (
                  <div key={p.name + i} className="portalRow">
                    <div className="portalInfo">
                      <div className="pname">{p.name}</div>
                      <a href={p.url} target="_blank" rel="noreferrer">{p.url}</a>
                    </div>
                    <div className="inputWrap">
                      <input
                        value={p.username || ''}
                        onChange={e => setUsername(c.id, i, e.target.value)}
                        placeholder="Username"
                      />
                      <button className="tiny" onClick={() => copyUsername(p.username)} title="Copy username">📋</button>
                    </div>
                    <div className="portalActions">
                      <button className="primary" onClick={() => window.orbit.openPortal({ customerId: c.id, url: p.url })}>Open</button>
                      <button className="ghost tiny" onClick={() => editPortal(c.id, i)} title="Edit portal">✏️</button>
                      <button className="ghost tiny danger" onClick={() => deletePortal(c.id, i)} title="Delete portal">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </main>

      <footer className="appFooter">
        <span>Portra{version ? ` v${version}` : ''}</span>
        <span>Data encrypted locally</span>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
