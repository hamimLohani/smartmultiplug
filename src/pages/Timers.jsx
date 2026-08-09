import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
import { useLanguage } from '../contexts/LanguageContext';
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
const DAYS_SHORT_BN = ['সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি', 'রবি'];
const DAYS_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function WifiNotice({ connected, t }) {
  if (connected) {
    return (
      <div className="inline-notice inline-notice--ok">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        <span>{t('timers_wifi_ok')}</span>
      </div>
    );
  }
  return (
    <div className="inline-notice inline-notice--warn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{t('timers_wifi_warning')}</span>
    </div>
  );
}

/* ── Custom drum-roll time picker ── */
function TimeSpinner({ value, onChange, lang }) {
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
            {lang === 'bn' ? 'পরিবর্তন' : 'Edit'}
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
            <button type="button" className="time-spin-action-btn ok" onClick={confirm}>
              {lang === 'bn' ? 'ঠিক আছে' : 'OK'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Timers() {
  const navigate = useNavigate();
  const { user, mqttOk } = useAuth();
  const { deviceId, plugLabels, numPlugs } = useDevice();
  const { lang, t } = useLanguage();
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
  const [mqttSchedules, setMqttSchedules] = useState({}); // plug -> MQTT schedule array from device
  const [online, setOnline] = useState(null);

  const lastResponseTimeRef = useRef(null);
  const syncStartTimeRef = useRef(0);

  const baseTopic = user && deviceId
    ? `users/${user.uid}/devices/${deviceId}`
    : null;

  // Subscribe to device status topic in Timers.jsx
  useMqttSubscribe(
    baseTopic ? `${baseTopic}/status` : null,
    (msg) => {
      const now = Date.now();
      lastResponseTimeRef.current = now;
      if (msg === 'offline') {
        setOnline(false);
      } else if (msg === 'online' && syncStartTimeRef.current > 0 && now >= syncStartTimeRef.current) {
        setOnline(true);
      }
    },
  );

  // Active sync ping in Timers.jsx
  useEffect(() => {
    if (!baseTopic || !mqttOk) return;

    const initialTimer = setTimeout(() => {
      const syncTime = Date.now();
      syncStartTimeRef.current = syncTime;
      publish(`${baseTopic}/sync`, 'sync', { retain: false, qos: 1 });

      setTimeout(() => {
        const responded = lastResponseTimeRef.current && lastResponseTimeRef.current >= syncTime;
        if (!responded) {
          setOnline(false);
        } else {
          setOnline(true);
        }
      }, 3500);
    }, 500);

    return () => clearTimeout(initialTimer);
  }, [baseTopic, mqttOk, publish]);

  // Subscribe to timer/state and schedule topics for all plugs
  for (let n = 1; n <= 4; n++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMqttSubscribe(
      baseTopic ? `${baseTopic}/plug/${n}/timer/state` : null,
      (msg) => {
        const now = Date.now();
        lastResponseTimeRef.current = now;
        if (syncStartTimeRef.current > 0 && now >= syncStartTimeRef.current) {
          setOnline(true);
        }
        try {
          const data = JSON.parse(msg);
          setTimerStates((prev) => ({ ...prev, [n]: data }));
        } catch { /* ignore malformed */ }
      },
    );

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMqttSubscribe(
      baseTopic ? `${baseTopic}/plug/${n}/schedule` : null,
      (msg) => {
        try {
          const data = JSON.parse(msg);
          if (Array.isArray(data)) {
            setMqttSchedules((prev) => ({ ...prev, [n]: data }));
          }
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

    const currentPlugLabel = plugLabels[selectedPlug] || (lang === 'bn' ? `প্লাগ ${selectedPlug}` : `Plug ${selectedPlug}`);

    if (mode === 'delay') {
      const mins = getDelayMinutes();
      if (!mins) { 
        toast.error(lang === 'bn' ? 'একটি টাইমারের সময় নির্ধারণ করুন।' : 'Pick a delay duration.'); 
        return; 
      }

      // Check if there's already an active delay for this plug
      const existing = timerStates[selectedPlug];
      if (existing?.active) {
        const ok = window.confirm(
          lang === 'bn'
            ? `${currentPlugLabel} এ ইতিমধ্যে একটি টাইমার চলছে। এটি পরিবর্তন করতে চান?`
            : `There's already a timer running on ${currentPlugLabel}. Replace it?`
        );
        if (!ok) return;
      }

      const payload = {
        action,
        durationSeconds: mins * 60,
        timestamp: Date.now(),
      };
      publish(`${baseTopic}/plug/${selectedPlug}/timer/set`, payload);

      if (online === false) {
        toast(
          lang === 'bn'
            ? `টাইমার সংরক্ষিত — ডিভাইস অফলাইনে রয়েছে, ওয়াইফাই সংযোগ পেলে ${currentPlugLabel} ${mins} মিনিট পর ${action === 'ON' ? 'চালু' : 'বন্ধ'} হবে`
            : `Timer saved — Device offline. Will turn ${action} in ${mins} min when plug reconnects to WiFi`,
          { icon: '⚠️' }
        );
      } else {
        toast.success(
          lang === 'bn'
            ? `টাইমার সেট করা হয়েছে — ${mins} মিনিট পর ${currentPlugLabel} ${action === 'ON' ? 'চালু' : 'বন্ধ'} হবে`
            : `Timer set — ${currentPlugLabel} will turn ${action} in ${mins} min`
        );
      }

    } else {
      // Schedule mode
      if (!schedTime) { 
        toast.error(lang === 'bn' ? 'সময় নির্বাচন করুন।' : 'Pick a time.'); 
        return; 
      }
      if (repeat === 'custom' && customDays.length === 0) {
        toast.error(lang === 'bn' ? 'অন্তত একদিন নির্বাচন করুন।' : 'Select at least one day.'); 
        return;
      }

      const entry = {
        plugNum: selectedPlug,
        plugLabel: currentPlugLabel,
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

      if (online === false) {
        toast(
          lang === 'bn'
            ? `সময়সূচী সংরক্ষিত — ডিভাইস অফলাইনে রয়েছে, অনলাইন হলে ${schedTime} সময়ে ${currentPlugLabel} ${action === 'ON' ? 'চালু' : 'বন্ধ'} হবে`
            : `Schedule saved — Device offline. Will turn ${action} at ${schedTime} when plug reconnects to WiFi`,
          { icon: '⚠️' }
        );
      } else {
        toast.success(
          lang === 'bn'
            ? `সময়সূচী সংরক্ষিত হয়েছে — ${schedTime} মিনিটে ${currentPlugLabel} ${action === 'ON' ? 'চালু' : 'বন্ধ'} হবে`
            : `Schedule saved — ${currentPlugLabel} will turn ${action} at ${schedTime}`
        );
      }
    }
  };

  const handleDeleteTimer = async (timer) => {
    if (!user || !deviceId) return;
    if (timer.type === 'delay') {
      publish(`${baseTopic}/plug/${timer.plugNum}/timer/set`, { cancel: true });
      setTimerStates((prev) => { const c = { ...prev }; delete c[timer.plugNum]; return c; });
    } else if (timer.isFromDevice) {
      const currentList = mqttSchedules[timer.plugNum] || [];
      const updatedList = currentList.map((item, idx) => {
        if (idx === timer.slotIndex) {
          return { ...item, enabled: false };
        }
        return item;
      });
      publish(`${baseTopic}/plug/${timer.plugNum}/schedule`, updatedList, { retain: true });
      setMqttSchedules((prev) => ({ ...prev, [timer.plugNum]: updatedList }));
    } else {
      await remove(ref(db, `users/${user.uid}/devices/${deviceId}/schedules/${timer.id}`));

      // Re-publish updated schedule list (retained)
      const remaining = activeTimers.filter(t => t.id !== timer.id && t.plugNum === timer.plugNum);
      publish(`${baseTopic}/plug/${timer.plugNum}/schedule`, remaining, { retain: true });
    }
    toast.success(lang === 'bn' ? 'টাইমারটি মুছে ফেলা হয়েছে।' : 'Timer removed.');
  };

  // Build combined timer list (MQTT delay timers + RTDB schedule entries + device MQTT schedules)
  const deviceSchedules = [];
  Object.entries(mqttSchedules).forEach(([plugNumStr, list]) => {
    const plugNum = parseInt(plugNumStr, 10);
    if (!Array.isArray(list)) return;
    list.forEach((item, index) => {
      if (item.enabled) {
        // Avoid duplicate if same schedule exists in RTDB
        const exists = activeTimers.some(
          (t) => t.plugNum === plugNum && t.time === item.time && t.action === item.action
        );
        if (!exists) {
          deviceSchedules.push({
            id: `device-sched-${plugNum}-${index}`,
            type: 'schedule',
            plugNum,
            plugLabel: plugLabels[plugNum] || (lang === 'bn' ? `প্লাগ ${plugNum}` : `Plug ${plugNum}`),
            action: item.action,
            time: item.time,
            repeat: item.repeat || 'daily',
            days: item.repeat === 'once' ? 'once' : 'all',
            enabled: true,
            isFromDevice: true,
            slotIndex: index,
          });
        }
      }
    });
  });

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
    ...deviceSchedules,
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
              <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>{t('timers_title')}</h1>
              <p style={{ fontSize: 13, color: 'var(--clr-text-muted)' }}>{t('dash_paired')}</p>
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
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{t('timers_disabled_title')}</h2>
            <p style={{ fontSize: 14, color: 'var(--clr-text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              {t('timers_disabled_desc')}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/pair')}
              style={{ width: '100%', maxWidth: 200, margin: '0 auto' }}
            >
              {t('dash_btn_pair')}
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
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t('timers_title')}</h1>
        <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', marginBottom: 24 }}>
          {t('timers_subtitle')}
        </p>

        {/* Device Offline Warning Banner */}
        {mqttOk && online === false && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 20,
            fontSize: 13,
            lineHeight: 1.5,
            color: '#f87171',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)',
          }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>⚠️</span>
            <div>
              <strong style={{ display: 'block', fontSize: 14, marginBottom: 2, color: '#f87171', fontWeight: 700 }}>
                {lang === 'bn' ? 'ডিভাইসটি অফলাইনে আছে' : 'Device is Offline'}
              </strong>
              <span>
                {lang === 'bn' 
                  ? 'স্মার্ট মাল্টি-প্লাগটি অফলাইনে রয়েছে। ডিভাইসটি ওয়াইফাইতে পুনরায় অনলাইনে যুক্ত হলে আপনার সেট করা টাইমার ও সময়সূচী স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।' 
                  : 'Your Smart Multi-Plug is offline. Timers and schedules will automatically sync to the device once it reconnects to WiFi.'}
              </span>
            </div>
          </div>
        )}

        {/* Panel card */}
        <div className="card" style={{ marginBottom: 24 }}>

          {/* Mode Toggle */}
          <div className="timer-mode-toggle" style={{ marginBottom: 20 }}>
            <button
              id="timer-mode-delay"
              className={`timer-mode-btn ${mode === 'delay' ? 'active' : ''}`}
              onClick={() => setMode('delay')}
            >
              {t('timers_delay')}
            </button>
            <button
              id="timer-mode-schedule"
              className={`timer-mode-btn ${mode === 'schedule' ? 'active' : ''}`}
              onClick={() => setMode('schedule')}
            >
              {t('timers_schedule')}
            </button>
          </div>

          {mode === 'schedule' && <WifiNotice connected={mqttOk} t={t} />}

          {/* Plug selector */}
          <div style={{ marginTop: 20 }}>
            <p className="timer-section-label">{t('timers_outlet')}</p>
            <div className="chip-group">
              {Array.from({ length: numPlugs }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  id={`timer-plug-${n}`}
                  className={`chip ${selectedPlug === n ? 'active' : ''}`}
                  onClick={() => setPlug(n)}
                >
                  {plugLabels[n] || (lang === 'bn' ? `প্লাগ ${n}` : `Plug ${n}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Action */}
          <div style={{ marginTop: 16 }}>
            <p className="timer-section-label">{t('timers_action')}</p>
            <div className="action-toggle">
              <button
                id="timer-action-on"
                className={`action-btn on ${action === 'ON' ? 'active' : ''}`}
                onClick={() => setAction('ON')}
              >
                {t('timers_turn_on')}
              </button>
              <button
                id="timer-action-off"
                className={`action-btn off ${action === 'OFF' ? 'active' : ''}`}
                onClick={() => setAction('OFF')}
              >
                {t('timers_turn_off')}
              </button>
            </div>
          </div>

          {/* Mode-specific options */}
          {mode === 'delay' ? (
            <div style={{ marginTop: 16 }}>
              <p className="timer-section-label">{t('timers_delay_duration')}</p>
              <div className="delay-chips">
                {DELAY_PRESETS.map(({ label, value }) => (
                  <button
                    key={value}
                    id={`delay-preset-${value}`}
                    className={`delay-chip ${delayPreset === value ? 'active' : ''}`}
                    onClick={() => { setDelayPreset(value); setCustomMin(''); }}
                  >
                    {lang === 'bn' 
                      ? (value === 60 ? '১ ঘণ্টা' : `${value} মিনিট`) 
                      : label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    id="delay-custom-min"
                    type="number"
                    className="form-input"
                    placeholder={t('timers_custom_min')}
                    min="1"
                    max="999"
                    value={customMin}
                    onChange={(e) => { setCustomMin(e.target.value); setDelayPreset(null); }}
                    style={{ flex: 1 }}
                  />
                  <span style={{ color: 'var(--clr-text-muted)', fontSize: 14, whiteSpace: 'nowrap' }}>
                    {lang === 'bn' ? 'মিনিট' : 'min'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }} className={!mqttOk ? 'sched-disabled-layer' : ''}>
              <div>
                <p className="timer-section-label">{t('timers_time')}</p>
                <TimeSpinner
                  value={schedTime}
                  onChange={setSchedTime}
                  lang={lang}
                />
              </div>

              <div>
                <p className="timer-section-label">{t('timers_repeat')}</p>
                <div className="chip-group">
                  {[
                    { label: t('timers_once'), key: 'once' },
                    { label: t('timers_everyday'), key: 'daily' },
                    { label: t('timers_custom_days'), key: 'custom' },
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
                        title={lang === 'bn' ? DAYS_SHORT_BN[i] : day}
                        disabled={!mqttOk}
                      >
                        {lang === 'bn' ? DAYS_SHORT_BN[i].charAt(0) : day.charAt(0)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live Timing Summary Message Card */}
          <div style={{
            marginTop: 20,
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--clr-surface-2)',
            border: '1px solid var(--clr-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 13,
            lineHeight: 1.45,
          }}>
            <span style={{ fontSize: 22 }}>
              {mode === 'delay' ? '⏱️' : '📅'}
            </span>
            <div>
              <span style={{
                fontWeight: 700,
                color: 'var(--clr-accent)',
                display: 'block',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 2,
              }}>
                {lang === 'bn' ? 'টাইমিং সেট করার পূর্বরূপ (প্রিভিউ)' : 'Timer Setting Preview'}
              </span>
              <span style={{ color: 'var(--clr-text)' }}>
                {mode === 'delay' ? (
                  getDelayMinutes() ? (
                    lang === 'bn' 
                      ? `সেট করা হচ্ছে: ${plugLabels[selectedPlug] || `প্লাগ ${selectedPlug}`} — ${getDelayMinutes()} মিনিট পর ${action === 'ON' ? 'চালু (ON)' : 'বন্ধ (OFF)'} হবে`
                      : `Setting: ${plugLabels[selectedPlug] || `Plug ${selectedPlug}`} to turn ${action} in ${getDelayMinutes()} min`
                  ) : (
                    lang === 'bn' ? 'টাইমারের সময় (মিনিট) নির্বাচন করুন…' : 'Select or enter a delay duration above…'
                  )
                ) : (
                  lang === 'bn'
                    ? `সেট করা হচ্ছে: ${plugLabels[selectedPlug] || `প্লাগ ${selectedPlug}`} — ${schedTime} সময়ে ${action === 'ON' ? 'চালু (ON)' : 'বন্ধ (OFF)'} হবে (${repeat === 'daily' ? 'প্রতিদিন' : repeat === 'once' ? 'একবার' : 'নির্দিষ্ট দিনগুলোতে'})`
                    : `Setting: ${plugLabels[selectedPlug] || `Plug ${selectedPlug}`} to turn ${action} at ${schedTime} (${repeat === 'daily' ? 'Every day' : repeat === 'once' ? 'Once' : 'Custom days'})`
                )}
              </span>
            </div>
          </div>

          {/* Add button */}
          <button
            id="timer-add-btn"
            className="btn btn-primary btn-full"
            style={{ marginTop: 20 }}
            onClick={handleAddTimer}
            disabled={!baseTopic || (mode === 'schedule' && !mqttOk)}
          >
            {t('timers_add_btn')}
          </button>
        </div>

        {/* Active timers */}
        <div className="section-header">
          <span className="section-title">{t('timers_active_timers')}</span>
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
