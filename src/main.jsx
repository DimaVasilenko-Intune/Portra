import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  const [data, setData] = useState({ customers: [] })
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState({})

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
    return data.customers.filter(c => c.name.toLowerCase().includes(s) || c.portals.some(p => p.name.toLowerCase().includes(s)))
  }, [data, q])

  const setUsername = (cid, idx, username) => {
    const next = structuredClone(data)
    const c = next.customers.find(x => x.id === cid)
    c.portals[idx].username = username
    setData(next)
    window.orbit.saveData(next)
  }

  const addCustomer = () => {
    const name = prompt('Customer name')
    if (!name) return
    const id = crypto.randomUUID()
    const next = structuredClone(data)
    next.customers.push({ id, name, portals: [] })
    setData(next)
    setExpanded({ ...expanded, [id]: true })
    window.orbit.saveData(next)
  }

  const addPortal = (cid) => {
    const name = prompt('Portal name (e.g. Azure)')
    const url = prompt('Portal URL (https://...)')
    if (!name || !url) return
    const next = structuredClone(data)
    const c = next.customers.find(x => x.id === cid)
    c.portals.push({ name, url, username: '' })
    setData(next)
    window.orbit.saveData(next)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.svg" alt="Portra" />
          <h1>Portra</h1>
        </div>
        <button onClick={addCustomer}>+ Customer</button>
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
                    <input
                      value={p.username || ''}
                      onChange={e => setUsername(c.id, i, e.target.value)}
                      placeholder="Username"
                    />
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
