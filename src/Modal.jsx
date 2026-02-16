import React, { useEffect, useRef, useState } from 'react'
import { IconX } from './icons'

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
  const [mode, setMode] = useState('fresh') // fresh | copy
  const [sourceCustomerId, setSourceCustomerId] = useState(customers[0]?.id || '')
  const ref = useRef()

  useEffect(() => { ref.current?.focus() }, [])

  const submit = () => {
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      mode,
      sourceCustomerId: mode === 'copy' ? sourceCustomerId : null
    })
  }

  return (
    <div className="modalOverlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modalHeader">
          <h3>New Customer</h3>
          <button className="iconBtn" onClick={onCancel}><IconX /></button>
        </div>

        <label className="modalLabel">Customer name</label>
        <input
          ref={ref}
          className="modalInput"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Customer name"
        />

        <label className="modalLabel">Portal setup</label>
        <div className="modeGrid">
          <label className={`modeCard ${mode === 'fresh' ? 'active' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'fresh'} onChange={() => setMode('fresh')} />
            <div>
              <strong>Fresh</strong>
              <span>Start with no portals</span>
            </div>
          </label>
          <label className={`modeCard ${mode === 'copy' ? 'active' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'copy'} onChange={() => setMode('copy')} />
            <div>
              <strong>Copy</strong>
              <span>Copy portals from existing customer</span>
            </div>
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
  const ref = useRef()
  useEffect(() => { ref.current?.focus() }, [])
  const submit = () => { if (name.trim() && url.trim()) onSubmit({ name: name.trim(), url: url.trim() }) }

  return (
    <div className="modalOverlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modalHeader">
          <h3>{title}</h3>
          <button className="iconBtn" onClick={onCancel}><IconX /></button>
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
