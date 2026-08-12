import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { IconSun, IconMoon, IconPlus, IconSearch, IconEdit, IconTrash, IconCopy, IconExternalLink, IconDownload, IconUpload, IconChevron, IconShield, IconSignOut, IconGrip, PortalIcon } from './icons'
import { InputModal, PortalModal, ConfirmModal, CustomerModal } from './Modal'
import { getStandardPortals, PORTAL_CATALOG } from './portalCatalog'
import { SORT_MODES, sortCustomers, moveCustomer } from './sortCustomers.mjs'
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
  const [sortMode, setSortMode] = useState(localStorage.getItem('portra-sort') || 'custom')
  const [dragId, setDragId] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const dragIdRef = useRef(null)
  const [toast, setToast] = useState(null)
  const [version, setVersion] = useState('')
  const [modal, setModal] = useState(null)
  const [readError, setReadError] = useState(null)
  const [plaintextWarning, setPlaintextWarning] = useState(false)
  const [autoUpdates, setAutoUpdates] = useState(true)
  const [updateState, setUpdateState] = useState(null)

  const notify = useCallback((msg) => setToast(msg), [])
  const closeModal = useCallback(() => setModal(null), [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('portra-theme', theme)
  }, [theme])

  useEffect(() => {
    window.orbit.loadData().then((d) => {
      setData({ customers: d.customers || [] })
      if (d.readError) setReadError(d.readError)
      if (d.encryptionAvailable === false) setPlaintextWarning(true)
      const e = {}
      ;(d.customers || []).forEach(c => (e[c.id] = false))
      setExpanded(e)
    })
    window.orbit.getVersion?.().then(v => setVersion(v || ''))
    // The macOS traffic lights sit on top of the content with titleBarStyle: hiddenInset,
    // so the header needs extra top inset there.
    window.orbit.getPlatform?.().then(p => {
      if (p) document.documentElement.setAttribute('data-platform', p)
    })
    window.orbit.hasAutoUpdates?.().then(v => setAutoUpdates(v !== false))
  }, [])

  const checkForUpdate = async () => {
    setUpdateState({ checking: true })
    const res = await window.orbit.checkUpdate()
    setUpdateState(res)
    if (res?.ok && !res.updateAvailable) notify('Portra is up to date')
    if (res?.ok === false) notify('Could not reach GitHub to check for updates')
  }

  useEffect(() => { localStorage.setItem('portra-sort', sortMode) }, [sortMode])

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim()
    const matching = !s
      ? data.customers
      : data.customers.filter(c =>
          c.name.toLowerCase().includes(s) || c.portals.some(p => p.name.toLowerCase().includes(s))
        )
    return sortCustomers(matching, sortMode)
  }, [data, q, sortMode])

  // Dragging rearranges the stored order, so it only makes sense in custom mode — and a filtered
  // list hides the neighbours you would be dropping between.
  const canReorder = sortMode === 'custom' && !q.trim()

  const stats = useMemo(() => ({
    customers: data.customers.length,
    portals: data.customers.reduce((a, c) => a + c.portals.length, 0)
  }), [data])

  const save = useCallback(async (next) => {
    const res = await window.orbit.saveData(next)
    if (res && res.ok === false) notify(res.error || 'Could not save changes')
  }, [notify])

  const persist = useCallback((next) => {
    setData(next)
    save(next)
  }, [save])

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
              portals = getStandardPortals().map((p) => ({ name: p.name, url: p.url }))
            }

            next.customers.push({ id, name, username: '', portals })
            save(next)
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
            customer.portals.push({ name, url })
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

  const setCustomerUsername = (cid, username) => {
    const next = structuredClone(data)
    next.customers.find(x => x.id === cid).username = username
    persist(next)
  }

  const copyUsername = async (username) => {
    if (!username) return
    try { await navigator.clipboard.writeText(username); notify('Copied to clipboard') } catch {}
  }

  const openPortal = async (customer, portal) => {
    const res = await window.orbit.openPortal({
      customerId: customer.id, url: portal.url, customerName: customer.name, portalName: portal.name
    })
    if (res && res.ok === false) {
      notify(res.error || 'Could not open portal')
      return
    }
    // Counted locally only, to drive the "Most used" sort. Nothing leaves the machine.
    setData(prev => {
      const next = structuredClone(prev)
      const target = next.customers.find(x => x.id === customer.id)
      if (!target) return prev
      target.openCount = (target.openCount || 0) + 1
      target.lastOpenedAt = Date.now()
      save(next)
      return next
    })
  }

  // --- Custom order (drag and drop) ---
  // The dragged id lives in a ref, not state: dragover and drop can fire in the same tick as
  // dragstart, and a state update would not be visible to them yet. State is only for styling.
  const onDragStart = (e, cid) => {
    dragIdRef.current = cid
    setDragId(cid)
    e.dataTransfer.effectAllowed = 'move'
    // Some browsers refuse to start a drag with no data attached; it also gives us a fallback.
    e.dataTransfer.setData('text/plain', cid)
  }

  const draggedId = (e) => dragIdRef.current || e.dataTransfer.getData('text/plain') || null

  const onDragOver = (e, cid) => {
    const from = draggedId(e)
    if (!from || from === cid) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetId(cid)
  }

  const onDrop = (e, cid) => {
    e.preventDefault()
    const from = draggedId(e)
    if (from && from !== cid) {
      setData(prev => {
        const next = { ...prev, customers: moveCustomer(prev.customers, from, cid) }
        save(next)
        return next
      })
    }
    dragIdRef.current = null
    setDragId(null)
    setDropTargetId(null)
  }

  const onDragEnd = () => { dragIdRef.current = null; setDragId(null); setDropTargetId(null) }

  const signOut = async (customer) => {
    const res = await window.orbit.signOutPortal({ customerId: customer.id, customerName: customer.name })
    if (res?.ok) notify(`Signed out of "${customer.name}"`)
    else if (res?.error) notify(res.error)
  }

  const exportData = async () => {
    const res = await window.orbit.exportData(data)
    if (res?.ok) notify('Data exported')
  }

  const importData = async () => {
    const res = await window.orbit.importData()
    if (res?.ok) {
      setData({ customers: res.data.customers })
      const e = {}
      res.data.customers.forEach(c => (e[c.id] = false))
      setExpanded(e)
      notify(`Imported ${res.data.customers.length} customer(s)`)
    }
    if (res?.error) notify(res.error)
  }

  return (
    <div className="app">
      <div className="titlebarDrag" />
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

      {readError && (
        <div className="alert">
          <strong>Your saved data could not be decrypted.</strong>
          <span>
            Nothing has been deleted — the file is kept at <code>{readError.backupPath}</code>.
            {readError.encryptionAvailable
              ? ' This usually means the OS keychain denied access to Portra, often after an app update changed its code signature.'
              : ' OS-level encryption is unavailable on this machine.'}
            {' '}Changes cannot be saved until this is resolved.
          </span>
        </div>
      )}

      {plaintextWarning && !readError && (
        <div className="alert">
          <strong>Usernames are being stored unencrypted.</strong>
          <span>
            This machine has no OS keychain available to Portra, so <code>customers.enc</code> is
            written as plain text. Avoid storing anything sensitive until this is resolved.
          </span>
        </div>
      )}

      <div className="listControls">
        <div className="searchWrap">
          <IconSearch />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search customers or portals..." />
        </div>
        <label className="sortWrap">
          <span>Sort</span>
          <select value={sortMode} onChange={e => setSortMode(e.target.value)}>
            {SORT_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      </div>

      {sortMode === 'custom' && q.trim() && data.customers.length > 1 && (
        <p className="hint">Clear the search to drag customers into your own order.</p>
      )}

      {filtered.length === 0 && (
        <div className="empty">
          {q ? 'No results found.' : 'No customers yet — add one to get started.'}
        </div>
      )}

      <main className="list">
        {filtered.map(c => (
          <section
            key={c.id}
            className={`card${dragId === c.id ? ' dragging' : ''}${dropTargetId === c.id ? ' dropTarget' : ''}`}
            draggable={canReorder}
            onDragStart={canReorder ? (e => onDragStart(e, c.id)) : undefined}
            onDragOver={canReorder ? (e => onDragOver(e, c.id)) : undefined}
            onDrop={canReorder ? (e => onDrop(e, c.id)) : undefined}
            onDragEnd={canReorder ? onDragEnd : undefined}
          >
            <div className="cardHead" onClick={() => setExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}>
              {canReorder && <IconGrip />}
              <IconChevron open={expanded[c.id]} />
              <h2>{c.name}</h2>
              <span className="portalCount">{c.portals.length} portal{c.portals.length !== 1 ? 's' : ''}</span>
              <div className="cardActions" onClick={e => e.stopPropagation()}>
                <button className="ghost small" onClick={() => addPortal(c.id)}><IconPlus /> Portal</button>
                <button className="iconBtn" onClick={() => signOut(c)} title="Sign out of this workspace — clears its cookies and tokens"><IconSignOut /></button>
                <button className="iconBtn" onClick={() => renameCustomer(c.id)} title="Rename"><IconEdit /></button>
                <button className="iconBtn dangerHover" onClick={() => deleteCustomer(c.id)} title="Delete"><IconTrash /></button>
              </div>
            </div>
            {expanded[c.id] && (
              <div className="portals">
                <div className="customerUsername">
                  <label>Username for {c.name}</label>
                  <div className="inputWrap">
                    <input
                      value={c.username || ''}
                      onChange={e => setCustomerUsername(c.id, e.target.value)}
                      placeholder="user@domain.com"
                      onClick={e => e.stopPropagation()}
                    />
                    <button className="iconBtn" onClick={() => copyUsername(c.username)} title="Copy username"><IconCopy /></button>
                  </div>
                </div>
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
                    <div className="portalActions">
                      <button className="primary compact" onClick={() => openPortal(c, p)}>
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
        {!autoUpdates && (
          <span className="footerUpdate">
            Automatic updates are unavailable on macOS —{' '}
            <button className="linkBtn" onClick={checkForUpdate} disabled={updateState?.checking}>
              {updateState?.checking ? 'checking…' : 'check for updates'}
            </button>
            {updateState?.ok && updateState.updateAvailable && (
              <>
                {' · '}
                <button className="linkBtn strong" onClick={() => window.orbit.openReleases()}>
                  v{updateState.latest} available
                </button>
              </>
            )}
          </span>
        )}
        <span className="footerSecure"><IconShield /> Encrypted locally</span>
        <span className="footerMadeBy">Made by DimaVasilenko</span>
      </footer>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
