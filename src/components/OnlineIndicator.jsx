import React from 'react';

export default function OnlineIndicator({ online }) {
  if (online === null || online === undefined) {
    return (
      <div className="online-indicator">
        <div className="dot dot-amber" />
        <span style={{ color: 'var(--clr-text-muted)' }}>Connecting…</span>
      </div>
    );
  }

  return (
    <div className="online-indicator">
      <div className={`dot ${online ? 'dot-green' : 'dot-red'}`} />
      <span style={{ color: online ? 'var(--clr-green)' : 'var(--clr-red)' }}>
        {online ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
