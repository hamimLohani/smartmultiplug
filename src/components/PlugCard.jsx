import React, { useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

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

export default function PlugCard({ plugNum, label, state, isPending, hasFailed, disabled, timerMsg, onToggle, onRename }) {
  const { lang, t } = useLanguage();
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

      {/* Top Row: Plug Number and Status Dot */}
      <div className="plug-card-top">
        <span className="plug-number-label">
          {lang === 'bn' ? `সকেট ${plugNum}` : `Outlet ${plugNum}`}
        </span>
        <div className="plug-status-indicator">
          <span className="plug-status-text">
            {isOn 
              ? (lang === 'bn' ? 'চলমান' : 'Active') 
              : (lang === 'bn' ? 'নিষ্ক্রিয়' : 'Idle')}
          </span>
          <div className="plug-status-dot" />
        </div>
      </div>

      {/* Middle Row: Name & Rename */}
      <div className="plug-card-mid">
        <div className="plug-name-area">
          {editing ? (
            <input
              ref={inputRef}
              className="plug-name-input"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              maxLength={20}
            />
          ) : (
            <span 
              className="plug-name" 
              onClick={startEdit} 
              title={lang === 'bn' ? 'নাম পরিবর্তন করতে ট্যাপ করুন' : 'Tap to rename'}
            >
              {label}
            </span>
          )}
        </div>
        <button
          className="plug-edit-btn"
          onClick={editing ? commitEdit : startEdit}
          aria-label={editing ? 'Save name' : 'Rename plug'}
        >
          {editing ? <CheckIcon /> : <EditIcon />}
        </button>
      </div>

      {/* Active Timer / Schedule Message Badge */}
      {timerMsg && (
        <div style={{
          marginTop: 6,
          marginBottom: 6,
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--clr-accent-dim)',
          color: 'var(--clr-accent)',
          fontSize: 11,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ fontSize: 12 }}>⏱️</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {timerMsg}
          </span>
        </div>
      )}

      {/* Bottom Row: State Label & Toggle Switch */}
      <div className="plug-card-bottom">
        <div className="plug-state-info">
          <span className="plug-state-label">
            {isPending 
              ? (lang === 'bn' ? 'পরিবর্তন হচ্ছে…' : 'Updating…') 
              : (isOn ? t('on') : t('off'))}
          </span>
          {hasFailed && (
            <span className="plug-pending-note">
              {lang === 'bn' ? '⚠ সাড়া দিচ্ছে না' : '⚠ Unresponsive'}
            </span>
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
