import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
import { useMqttSubscribe, useMqttPublish } from '../hooks/useMqtt';
import { ref, set, push, remove, onValue, off } from 'firebase/database';
import { db } from '../firebase';
import ActiveTimersList from '../components/ActiveTimersList';
import toast from 'react-hot-toast';

const DELAY_PRESETS = [
  { label: '1 min', value: 1 },
  { label: '5 min', value: 5 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
];

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function WifiNotice({ connected }) {
  if (connected) {
    return (
      <div className="inline-notice inline-notice--ok">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        <span>WiFi connected — schedule will sync to device.</span>
      </div>
    );
  }
  return (
    <div className="inline-notice inline-notice--warn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>WiFi not connected — connect your plug to enable schedules.</span>
    </div>
  );
}

/* ── Custom drum-roll time picker ── */
function TimeSpinner({ value, onChange }) {
  const [hh, mm] = value.split(':').map(Number);
  const [editing, setEditing] = useState(false);
  const [tempH, setTempH] = useState(hh);
  const [tempM, setTempM] = useState(mm);

  // Long-press repeat
  const intervalRef = useRef(null);
  const startRepeat = useCallback((fn) => {
    fn();
    intervalRef.current = setInterval(fn, 120);
  }, []);
  const stopRepeat = useCallback(() => {
    clearInterval(intervalRef.current);
  }, []);

  const open = () => {
    setTempH(hh);
    setTempM(mm);
    setEditing(true);
  };

  const confirm = () => {
    const formatted = `${String(tempH).padStart(2, '0')}:${String(tempM).padStart(2, '0')}`;
    onChange(formatted);
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  const incrH = () => setTempH(h => (h + 1) % 24);
  const decrH = () => setTempH(h => (h + 23) % 24);
  const incrM = () => setTempM(m => (m + 1) % 60);
  const decrM = () => setTempM(m => (m + 59) % 60);

  const display = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  return (
    <div>
      {/* Collapsed display */}
      {!editing && (
        <button type="button" className="time-display-btn" onClick={open}>
          <span className="time-display-value">{display}</span>
          <span className="time-display-edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </span>
        </button>
      )}

      {/* Expanded spinner */}
      {editing && (
        <div className="time-spinner-wrap">
          {/* Hours column */}
          <div className="time-spinner-col">
            <button
              type="button"
              className="time-spin-btn"
              onMouseDown={() => startRepeat(incrH)}
              onMouseUp={stopRepeat}
              onMouseLeave={stopRepeat}
              onTouchStart={() => startRepeat(incrH)}
              onTouchEnd={stopRepeat}
              aria-label="Increase hours"
            >▲</button>
            <div className="time-spin-value">{String(tempH).padStart(2, '0')}</div>
            <button
              type="button"
              className="time-spin-btn"
              onMouseDown={() => startRepeat(decrH)}
              onMouseUp={stopRepeat}
              onMouseLeave={stopRepeat}
              onTouchStart={() => startRepeat(decrH)}
              onTouchEnd={stopRepeat}
              aria-label="Decrease hours"
            >▼</button>
          </div>

          <span className="time-spin-sep">:</span>

          {/* Minutes column */}
          <div className="time-spinner-col">
            <button
              type="button"
              className="time-spin-btn"
              onMouseDown={() => startRepeat(incrM)}
              onMouseUp={stopRepeat}
              onMouseLeave={stopRepeat}
              onTouchStart={() => startRepeat(incrM)}
              onTouchEnd={stopRepeat}
              aria-label="Increase minutes"
            >▲</button>
            <div className="time-spin-value">{String(tempM).padStart(2, '0')}</div>
            <button
              type="button"
              className="time-spin-btn"
              onMouseDown={() => startRepeat(decrM)}
              onMouseUp={stopRepeat}
              onMouseLeave={stopRepeat}
              onTouchStart={() => startRepeat(decrM)}
              onTouchEnd={stopRepeat}
              aria-label="Decrease minutes"
            >▼</button>
          </div>

          {/* Action buttons */}
          <div className="time-spin-actions">
            <button type="button" className="time-spin-action-btn cancel" onClick={cancel}>✕</button>
            <button type="button" className="time-spin-action-btn ok" onClick={confirm}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Timers() {
  const navigate = useNavigate();
  const { user, mqttOk } = useAuth();
  const { deviceId, plugLabels } = useDevice();
  const publish = useMqttPublish();

  const [mode, setMode] = useState('delay');    // 'delay' | 'schedule'
  const [selectedPlug, setPlug] = useState(1);
  const [action, setAction] = useState('ON');

  // Delay state
  const [delayPreset, setDelayPreset] = useState(null);
  const [customMin, setCustomMin] = useState('');

  // Schedule state
  const [schedTime, setSchedTime] = useState('08:00');
  const [repeat, setRepeat] = useState('once');     // 'once' | 'daily' | 'custom'
  const [customDays, setCustomDays] = useState([]);

  // Active timers from RTDB + MQTT
  const [activeTimers, setActiveTimers] = useState([]);
  const [timerStates, setTimerStates] = useState({}); // plug -> MQTT timer state

  const baseTopic = user && deviceId
    ? `users/${user.uid}/devices/${deviceId}`
    : null;

  // Subscribe to timer/state topics for all plugs (live countdown from device)
  for (let n = 1; n <= 4; n++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMqttSubscribe(
      baseTopic ? `${baseTopic}/plug/${n}/timer/state` : null,
      (msg) => {
        try {
          const data = JSON.parse(msg);
          setTimerStates((prev) => ({ ...prev, [n]: data }));
        } catch { /* ignore malformed */ }
      },
    );
  }

  // Load schedule entries from RTDB
  useEffect(() => {
    if (!user || !deviceId) return;
    const schedRef = ref(db, `users/${user.uid}/devices/${deviceId}/schedules`);
    const handle = (snap) => {
      if (!snap.exists()) { setActiveTimers([]); return; }
      const data = snap.val();
      const list = Object.entries(data).map(([id, entry]) => ({ id, ...entry }));
      setActiveTimers(list);
    };
    onValue(schedRef, handle);
    return () => off(schedRef, 'value', handle);
  }, [user, deviceId]);

  const getDelayMinutes = () => {
    if (delayPreset) return delayPreset;
    const v = parseInt(customMin, 10);
    return isNaN(v) || v < 1 ? null : v;
  };

  const handleAddTimer = async () => {
    if (!baseTopic) return;

    if (mode === 'delay') {
      const mins = getDelayMinutes();
      if (!mins) { toast.error('Pick a delay duration.'); return; }

      // Check if there's already an active delay for this plug
      const existing = timerStates[selectedPlug];
      if (existing?.active) {
        const ok = window.confirm(
          `There's already a timer running on ${plugLabels[selectedPlug]}. Replace it?`
        );
        if (!ok) return;
      }

      const payload = {
        action,
        durationSeconds: mins * 60,
        timestamp: Date.now(),
      };
      publish(`${baseTopic}/plug/${selectedPlug}/timer/set`, payload);
      toast.success(`Timer set — ${plugLabels[selectedPlug]} will turn ${action} in ${mins} min`);

    } else {
      // Schedule mode
      if (!schedTime) { toast.error('Pick a time.'); return; }
      if (repeat === 'custom' && customDays.length === 0) {
        toast.error('Select at least one day.'); return;
      }

      const entry = {
        plugNum: selectedPlug,
        plugLabel: plugLabels[selectedPlug],
        action,
        time: schedTime,
        repeat,
        days: repeat === 'custom' ? customDays : (repeat === 'daily' ? 'all' : 'once'),
        enabled: true,
        createdAt: Date.now(),
        type: 'schedule',
      };

      // Save to RTDB
      const schedRef = ref(db, `users/${user.uid}/devices/${deviceId}/schedules`);
      const newRef = push(schedRef);
      await set(newRef, entry);

      // Publish to MQTT (retained, so device picks it up on reconnect)
      const schedulesForPlug = activeTimers
        .filter(t => t.plugNum === selectedPlug && t.type === 'schedule')
        .concat({ id: newRef.key, ...entry });
      publish(
        `${baseTopic}/plug/${selectedPlug}/schedule`,
        schedulesForPlug,
        { retain: true },
      );

      toast.success(`Schedule saved — ${plugLabels[selectedPlug]} will turn ${action} at ${schedTime}`);
    }
  };

  const handleDeleteTimer = async (timer) => {
    if (!user || !deviceId) return;
    if (timer.type === 'delay') {
      publish(`${baseTopic}/plug/${timer.plugNum}/timer/set`, { cancel: true });
      setTimerStates((prev) => { const c = { ...prev }; delete c[timer.plugNum]; return c; });
    } else {
      await remove(ref(db, `users/${user.uid}/devices/${deviceId}/schedules/${timer.id}`));

      // Re-publish updated schedule list (retained)
      const remaining = activeTimers.filter(t => t.id !== timer.id && t.plugNum === timer.plugNum);
      publish(`${baseTopic}/plug/${timer.plugNum}/schedule`, remaining, { retain: true });
    }
    toast.success('Timer removed.');
  };

  // Build combined timer list (MQTT delay timers + RTDB schedule entries)
  const allTimers = [
    ...Object.entries(timerStates)
      .filter(([, s]) => s?.active)
      .map(([n, s]) => ({
        id: `delay-${n}`,
        type: 'delay',
        plugNum: parseInt(n),
        plugLabel: plugLabels[n],
        action: s.action,
        remainingSeconds: s.remainingSeconds,
      })),
    ...activeTimers,
  ];

  const toggleDay = (key) => {
    setCustomDays((prev) =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    );
  };

  if (!deviceId) {
    return (
      <div className="page-wrap">
        <div className="bg-mesh" />
        <div className="container" style={{ paddingTop: 24, paddingBottom: 120 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>Advanced Timers</h1>
              <p style={{ fontSize: 13, color: 'var(--clr-text-muted)' }}>No device paired</p>
            </div>
          </div>

          <div style={{
            background: 'var(--clr-surface)',
            border: '1px solid var(--clr-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px 24px',
            textAlign: 'center',
            marginTop: 40,
          }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>⏱️</span>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Schedules Disabled</h2>
            <p style={{ fontSize: 14, color: 'var(--clr-text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              Please pair a device first to set automated on/off schedules and delay timers.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/pair')}
              style={{ width: '100%', maxWidth: 200, margin: '0 auto' }}
            >
              Pair Device
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div className="bg-mesh" />

      <div className="container" style={{ paddingTop: 24, paddingBottom: 120 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Advanced Timers</h1>
        <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', marginBottom: 24 }}>
          Automate your outlets with delays or schedules.
        </p>

        {/* Panel card */}
        <div className="card" style={{ marginBottom: 24 }}>

          {/* Mode Toggle */}
          <div className="timer-mode-toggle" style={{ marginBottom: 20 }}>
            <button
              id="timer-mode-delay"
              className={`timer-mode-btn ${mode === 'delay' ? 'active' : ''}`}
              onClick={() => setMode('delay')}
            >
              ⏱ Delay
            </button>
            <button
              id="timer-mode-schedule"
              className={`timer-mode-btn ${mode === 'schedule' ? 'active' : ''}`}
              onClick={() => setMode('schedule')}
            >
              📅 Schedule
            </button>
          </div>

          {mode === 'schedule' && <WifiNotice connected={mqttOk} />}

          {/* Plug selector */}
          <div style={{ marginTop: 20 }}>
            <p className="timer-section-label">Outlet</p>
            <div className="chip-group">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  id={`timer-plug-${n}`}
                  className={`chip ${selectedPlug === n ? 'active' : ''}`}
                  onClick={() => setPlug(n)}
                >
                  {plugLabels[n]}
                </button>
              ))}
            </div>
          </div>

          {/* Action */}
          <div style={{ marginTop: 16 }}>
            <p className="timer-section-label">Action</p>
            <div className="action-toggle">
              <button
                id="timer-action-on"
                className={`action-btn on ${action === 'ON' ? 'active' : ''}`}
                onClick={() => setAction('ON')}
              >
                ⚡ Turn On
              </button>
              <button
                id="timer-action-off"
                className={`action-btn off ${action === 'OFF' ? 'active' : ''}`}
                onClick={() => setAction('OFF')}
              >
                ○ Turn Off
              </button>
            </div>
          </div>

          {/* Mode-specific options */}
          {mode === 'delay' ? (
            <div style={{ marginTop: 16 }}>
              <p className="timer-section-label">Delay Duration</p>
              <div className="delay-chips">
                {DELAY_PRESETS.map(({ label, value }) => (
                  <button
                    key={value}
                    id={`delay-preset-${value}`}
                    className={`delay-chip ${delayPreset === value ? 'active' : ''}`}
                    onClick={() => { setDelayPreset(value); setCustomMin(''); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    id="delay-custom-min"
                    type="number"
                    className="form-input"
                    placeholder="Custom minutes"
                    min="1"
                    max="999"
                    value={customMin}
                    onChange={(e) => { setCustomMin(e.target.value); setDelayPreset(null); }}
                    style={{ flex: 1 }}
                  />
                  <span style={{ color: 'var(--clr-text-muted)', fontSize: 14, whiteSpace: 'nowrap' }}>min</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }} className={!mqttOk ? 'sched-disabled-layer' : ''}>
              <div>
                <p className="timer-section-label">Time</p>
                <TimeSpinner
                  value={schedTime}
                  onChange={setSchedTime}
                />
              </div>

              <div>
                <p className="timer-section-label">Repeat</p>
                <div className="chip-group">
                  {[
                    { label: 'Once', key: 'once' },
                    { label: 'Every Day', key: 'daily' },
                    { label: 'Custom…', key: 'custom' },
                  ].map(({ label, key }) => (
                    <button
                      key={key}
                      id={`repeat-${key}`}
                      className={`chip ${repeat === key ? 'active' : ''}`}
                      onClick={() => setRepeat(key)}
                      disabled={!mqttOk}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {repeat === 'custom' && (
                  <div className="week-days-row" style={{ marginTop: 12 }}>
                    {DAYS_SHORT.map((day, i) => (
                      <button
                        key={day}
                        id={`day-${DAYS_KEYS[i]}`}
                        className={`day-circle-btn ${customDays.includes(DAYS_KEYS[i]) ? 'active' : ''}`}
                        onClick={() => toggleDay(DAYS_KEYS[i])}
                        type="button"
                        title={day}
                        disabled={!mqttOk}
                      >
                        {day.charAt(0)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Add button */}
          <button
            id="timer-add-btn"
            className="btn btn-primary btn-full"
            style={{ marginTop: 24 }}
            onClick={handleAddTimer}
            disabled={!baseTopic || (mode === 'schedule' && !mqttOk)}
          >
            + Add Timer
          </button>
        </div>

        {/* Active timers */}
        <div className="section-header">
          <span className="section-title">Active Timers</span>
          <span className="badge badge-blue">{allTimers.length}</span>
        </div>

        <ActiveTimersList
          timers={allTimers}
          timerStates={timerStates}
          onDelete={handleDeleteTimer}
        />
      </div>
    </div>
  );
}
