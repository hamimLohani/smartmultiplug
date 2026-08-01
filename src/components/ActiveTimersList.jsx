import React, { useState, useEffect } from 'react';

function formatCountdown(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatScheduleLabel(timer) {
  const repeatLabel =
    timer.repeat === 'once'   ? 'once'         :
    timer.repeat === 'daily'  ? 'every day'    :
    Array.isArray(timer.days) ? timer.days.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') :
    '';
  const actionLabel = timer.action === 'ON' ? 'ON' : 'OFF';
  const timeLabel = (() => {
    if (!timer.time) return '';
    const [hh, mm] = timer.time.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12  = hh % 12 || 12;
    return `${h12}:${String(mm).padStart(2,'0')} ${ampm}`;
  })();
  return `${timer.plugLabel || `Plug ${timer.plugNum}`} — ${actionLabel} ${repeatLabel ? `${repeatLabel}` : ''} at ${timeLabel}`;
}

function CountdownTimer({ seconds: initialSeconds }) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!seconds || seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  return (
    <span className="active-timer-countdown">
      {formatCountdown(seconds)}
    </span>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}

export default function ActiveTimersList({ timers, timerStates, onDelete }) {
  if (!timers || timers.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⏰</div>
        <p className="empty-state-text">No active timers</p>
        <p style={{ fontSize: 12, color: 'var(--clr-text-subtle)' }}>
          Add a delay or schedule above to automate your outlets.
        </p>
      </div>
    );
  }

  return (
    <div className="scroll-list">
      {timers.map((timer) => {
        const isDelay = timer.type === 'delay';

        return (
          <div key={timer.id} className="active-timer-item">
            <div className="active-timer-left">
              <div className={`active-timer-icon ${isDelay ? 'delay' : 'schedule'}`}>
                {isDelay ? '⏱' : '📅'}
              </div>
              <div className="active-timer-text" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span className="active-timer-desc" style={{ fontWeight: 600 }}>
                    {timer.plugLabel || `Plug ${timer.plugNum}`}
                  </span>
                  <span className={`badge ${timer.action === 'ON' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10, padding: '1px 6px', lineHeight: 1 }}>
                    {timer.action === 'ON' ? 'ON' : 'OFF'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  {isDelay ? (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>Turns {timer.action.toLowerCase()} in</span>
                      {timer.remainingSeconds !== undefined && (
                        <CountdownTimer seconds={timer.remainingSeconds} />
                      )}
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-accent)' }}>
                        {(() => {
                          if (!timer.time) return '';
                          const [hh, mm] = timer.time.split(':').map(Number);
                          const ampm = hh >= 12 ? 'PM' : 'AM';
                          const h12  = hh % 12 || 12;
                          return `${h12}:${String(mm).padStart(2,'0')} ${ampm}`;
                        })()}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>
                        ({timer.repeat === 'once' ? 'once' : timer.repeat === 'daily' ? 'every day' : Array.isArray(timer.days) ? timer.days.map(d => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ') : ''})
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              className="active-timer-cancel"
              onClick={() => onDelete(timer)}
              aria-label="Delete timer"
              title="Remove this timer"
            >
              <TrashIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}
