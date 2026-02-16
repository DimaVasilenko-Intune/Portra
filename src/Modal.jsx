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
        <input
          ref={ref}
          className="modalInput"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        <div className="modalActions">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={submit} disabled={!value.trim()}>Save</button>
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
        <input
          ref={ref}
          className="modalInput"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Azure Portal"
          onKeyDown={e => e.key === 'Enter' && document.getElementById('portal-url-input')?.focus()}
        />
        <label className="modalLabel">URL</label>
        <input
          id="portal-url-input"
          className="modalInput"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://portal.azure.com"
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
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
