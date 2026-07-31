import React, { useState, useRef } from 'react';

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export default function PlugCard({ plugNum, label, state, isPending, hasFailed, disabled, onToggle, onRename }) {
  const [editing, setEditing]   = useState(false);
  const [nameVal, setNameVal]   = useState(label);
  const inputRef                = useRef(null);

  const startEdit = () => {
    setNameVal(label);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const commitEdit = () => {
    setEditing(false);
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== label) {
      onRename(trimmed);
    } else {
      setNameVal(label);
    }
  };

  const handleKeyDown = (ev) => {
    if (ev.key === 'Enter')  commitEdit();
    if (ev.key === 'Escape') { setEditing(false); setNameVal(label); }
  };

  const isOn = state === true;

  return (
    <div className={`plug-card ${isOn ? 'on' : ''} ${disabled ? 'disabled' : ''}`}
         style={{ opacity: disabled ? 0.7 : 1 }}>

      {/* Header row */}
      <div className="plug-card-header">
        <div className="plug-number-badge">P{plugNum}</div>

        <div className="plug-name-area" style={{ marginLeft: 10 }}>
          {editing ? (
            <input
              ref={inputRef}
              className="plug-name-input"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              maxLength={20}
              style={{ flex: 1 }}
            />
          ) : (
            <span className="plug-name" onClick={startEdit} title="Tap to rename">
              {label}
            </span>
          )}
        </div>

        {editing ? (
          <button className="plug-edit-btn" onClick={commitEdit} aria-label="Save name">
            <CheckIcon />
          </button>
        ) : (
          <button className="plug-edit-btn" onClick={startEdit} aria-label="Rename plug">
            <EditIcon />
          </button>
        )}

        <div className="plug-status-dot" style={{ marginLeft: 8 }} />
      </div>

      {/* Toggle row */}
      <div className="plug-card-body">
        <div>
          <p className="plug-state-label">
            {isPending ? 'Updating…' : isOn ? 'On' : 'Off'}
          </p>
          {hasFailed && (
            <p className="plug-pending-note">
              ⚠ Device didn't respond
            </p>
          )}
        </div>

        <label className="toggle-wrap" htmlFor={`plug-toggle-${plugNum}`} style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
          <input
            id={`plug-toggle-${plugNum}`}
            type="checkbox"
            className="toggle-input"
            checked={isOn}
            disabled={disabled || isPending}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <div className="toggle-track" style={{ opacity: isPending ? 0.6 : 1 }}>
            <div className="toggle-thumb" />
          </div>
        </label>
      </div>
    </div>
  );
}
