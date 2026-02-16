import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  const [data, setData] = useState({ customers: [] })
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState({})
  const [theme, setTheme] = useState(localStorage.getItem('portra-theme') || 'dark')

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

  const persist = (next) => {
    setData(next)
    window.orbit.saveData(next)
  }

  const setUsername = (cid, idx, username) => {
    const next = structuredClone(data)
    const c = next.customers.find(x => x.id === cid)
    c.portals[idx].username = username
    persist(next)
  }

  const addCustomer = () => {
    const name = prompt('Customer name')
    if (!name) return
    const id = crypto.randomUUID()
    const next = structuredClone(data)
    next.customers.push({ id, name, portals: [] })
    persist(next)
    setExpanded({ ...expanded, [id]: true })
  }

  const addPortal = (cid) => {
    const name = prompt('Portal name (e.g. Azure)')
    const url = prompt('Portal URL (https://...)')
    if (!name || !url) return
    const next = structuredClone(data)
    const c = next.customers.find(x => x.id === cid)
    c.portals.push({ name, url, username: '' })
    persist(next)
  }

  const exportData = async () => {
    const res = await window.orbit.exportData(data)
    if (res?.ok) alert(`Exported: ${res.filePath}`)
  }

  const importData = async () => {
    const res = await window.orbit.importData()
    if (res?.ok) {
      setData(res.data)
      const e = {}
      res.data.customers.forEach(c => (e[c.id] = false))
      setExpanded(e)
      alert(`Imported: ${res.filePath}`)
    }
  }

  const copyUsername = async (username) => {
    if (!username) return
    try {
      await navigator.clipboard.writeText(username)
    } catch {
      // no-op
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.svg" alt="Portra" />
          <h1>Portra</h1>
          <span className="badge">{stats.customers} customers · {stats.portals} portals</span>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button className="ghost" onClick={importData}>Import</button>
          <button className="ghost" onClick={exportData}>Export</button>
          <button onClick={addCustomer}>+ Customer</button>
        </div>
      </header>

      <div className="searchWrap">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search customers or portals..." />
      </div>

      <main className="list">
        {filtered.map(c => (
          <section key={c.id} className="card">
            <div className="cardHead" onClick={() => setExpanded({ ...expanded, [c.id]: !expanded[c.id] })}>
              <span>{expanded[c.id] ? '▾' : '▸'}</span>
              <h2>{c.name}</h2>
              <button onClick={(e) => { e.stopPropagation(); addPortal(c.id) }}>+ Portal</button>
            </div>
            {expanded[c.id] && (
              <div className="portals">
                {c.portals.length === 0 && <p className="muted">No portals yet.</p>}
                {c.portals.map((p, i) => (
                  <div key={p.name + i} className="portalRow">
                    <div>
                      <div className="pname">{p.name}</div>
                      <a href={p.url} target="_blank" rel="noreferrer">{p.url}</a>
                    </div>
                    <div className="inputWrap">
                      <input
                        value={p.username || ''}
                        onChange={e => setUsername(c.id, i, e.target.value)}
                        placeholder="Username"
                      />
                      <button className="tiny" onClick={() => copyUsername(p.username)}>Copy</button>
                    </div>
                    <button onClick={() => window.orbit.openPortal({ customerId: c.id, url: p.url })}>Open</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
