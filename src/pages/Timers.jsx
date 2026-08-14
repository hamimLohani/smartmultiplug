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
import OnlineIndicator from '../components/OnlineIndicator';
import SkeletonLoader from '../components/SkeletonLoader';

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
const ONCE_CLEANUP_GRACE_MS = 15000;

function isOnceSchedule(timer) {
  return timer?.type === 'schedule' && (timer.repeat === 'once' || timer.days === 'once');
}

function scheduleMatchesTimer(schedule, timer) {
  const time = schedule?.t || schedule?.time;
  const action = (schedule?.a === 1 || schedule?.action === 'ON') ? 'ON' : 'OFF';
  const enabled = (schedule?.e !== 0 && schedule?.enabled !== false);
  
  return enabled &&
    time === timer.time &&
    action === timer.action;
}

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


function LiveClock({ lang }) {
  const [liveTime, setLiveTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return liveTime.toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export default function Timers() {
  const navigate = useNavigate();
  const { user, mqttOk } = useAuth();
  const { devices, device, deviceId, plugLabels, numPlugs, selectDevice, loading } = useDevice();
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

  // Set schedule to current time
  const setSchedTimeToNow = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setSchedTime(`${hh}:${mm}`);
  };

  // Active timers from RTDB + MQTT
  const [activeTimers, setActiveTimers] = useState([]);
  const [timerStates, setTimerStates] = useState({}); // plug -> MQTT timer state
  const [mqttSchedules, setMqttSchedules] = useState({}); // plug -> MQTT schedule array from device
  const [online, setOnline] = useState(null);

  const lastResponseTimeRef = useRef(null);
  const syncStartTimeRef = useRef(0);

  const ownerUid = device?.is_shared ? device.owner_uid : user?.uid;
  const baseTopic = user && deviceId && ownerUid
    ? `users/${ownerUid}/devices/${deviceId}`
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

  const pendingDeleteRefs = useRef(new Set());

  // Load schedule entries from RTDB
  useEffect(() => {
    if (!user || !deviceId || !ownerUid) return;
    const schedRef = ref(db, `users/${ownerUid}/devices/${deviceId}/schedules`);
    const handle = (snap) => {
      if (!snap.exists()) { setActiveTimers([]); return; }
      const data = snap.val();
      const list = Object.entries(data).map(([id, entry]) => ({ id, ...entry }));
      setActiveTimers(list);
    };
    onValue(schedRef, handle);
    return () => off(schedRef, 'value', handle);
  }, [user, deviceId, ownerUid]);

  // Clean up completed 'once' schedules from RTDB after the device executes
  // them and republishes a schedule list without the fired item.
  useEffect(() => {
    if (!db || !user || !deviceId) return;

    const cleanupFinishedOnceSchedules = async () => {
      const now = Date.now();
      const finishedOnceTimers = activeTimers.filter((timer) => {
        if (!isOnceSchedule(timer)) return false;
        if (timer.createdAt && now - timer.createdAt < ONCE_CLEANUP_GRACE_MS) return false;

        const deviceList = mqttSchedules[timer.plugNum];
        if (!Array.isArray(deviceList)) return false;

        return !deviceList.some((item) => scheduleMatchesTimer(item, timer));
      });

      const newlyFinished = finishedOnceTimers.filter((t) => !pendingDeleteRefs.current.has(t.id));
      if (newlyFinished.length === 0) return;

      newlyFinished.forEach((t) => pendingDeleteRefs.current.add(t.id));

      // Add a 5-second delay before visually removing it, as requested
      setTimeout(async () => {
        setActiveTimers((prev) =>
          prev.filter((timer) => !newlyFinished.some((done) => done.id === timer.id))
        );

        try {
          await Promise.all(
            newlyFinished.map((timer) =>
              remove(ref(db, `users/${ownerUid}/devices/${deviceId}/schedules/${timer.id}`))
            )
          );
        } catch (err) {
          console.error('Failed to auto-delete finished once schedule from RTDB:', err);
        } finally {
          newlyFinished.forEach((t) => pendingDeleteRefs.current.delete(t.id));
        }
      }, 5000);
    };

    cleanupFinishedOnceSchedules();
  }, [db, user, deviceId, ownerUid, activeTimers, mqttSchedules]);

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
      const schedRef = ref(db, `users/${ownerUid}/devices/${deviceId}/schedules`);
      const newRef = push(schedRef);
      await set(newRef, entry);

      // Publish to MQTT (retained, so device picks it up on reconnect). 
      // Important: Map to minimal payload to avoid exceeding ESP8266 512 byte buffer.
      const schedulesForPlug = activeTimers
        .filter(t => t.plugNum === selectedPlug && t.type === 'schedule')
        .concat({ id: newRef.key, ...entry });
        
      const payloadToEsp = schedulesForPlug.map(s => ({
        t: s.time,
        a: s.action === 'ON' ? 1 : 0,
        r: (s.repeat === 'custom' ? 'daily' : s.repeat) === 'once' ? 0 : 1,
        e: s.enabled ? 1 : 0
      }));
      
      publish(
        `${baseTopic}/plug/${selectedPlug}/schedule`,
        payloadToEsp,
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
      await remove(ref(db, `users/${ownerUid}/devices/${deviceId}/schedules/${timer.id}`));

      // Re-publish updated schedule list (retained) with minimized payload
      const remaining = activeTimers.filter(t => t.id !== timer.id && t.plugNum === timer.plugNum);
      const payloadToEsp = remaining.map(s => ({
        t: s.time,
        a: s.action === 'ON' ? 1 : 0,
        r: (s.repeat === 'custom' ? 'daily' : s.repeat) === 'once' ? 0 : 1,
        e: s.enabled ? 1 : 0
      }));
      publish(`${baseTopic}/plug/${timer.plugNum}/schedule`, payloadToEsp, { retain: true });
    }
    toast.success(lang === 'bn' ? 'টাইমারটি মুছে ফেলা হয়েছে।' : 'Timer removed.');
  };

  // Build combined timer list (MQTT delay timers + RTDB schedule entries + device MQTT schedules)
  const deviceSchedules = [];
  Object.entries(mqttSchedules).forEach(([plugNumStr, list]) => {
    const plugNum = parseInt(plugNumStr, 10);
    if (!Array.isArray(list)) return;
    list.forEach((item, index) => {
      const time = item.t || item.time;
      const action = (item.a === 1 || item.action === 'ON') ? 'ON' : 'OFF';
      const repeat = (item.r === 1 || item.repeat === 'daily') ? 'daily' : 'once';
      const enabled = (item.e !== 0 && item.enabled !== false);

      if (enabled) {
        // Avoid duplicate if same schedule exists in RTDB
        const exists = activeTimers.some(
          (t) => t.plugNum === plugNum && t.time === time && t.action === action
        );
        if (!exists) {
          deviceSchedules.push({
            id: `device-sched-${plugNum}-${index}`,
            type: 'schedule',
            plugNum,
            plugLabel: plugLabels[plugNum] || (lang === 'bn' ? `প্লাগ ${plugNum}` : `Plug ${plugNum}`),
            action: action,
            time: time,
            repeat: repeat,
            days: repeat === 'once' ? 'once' : 'all',
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

  if (loading) return <SkeletonLoader />;

  if (!deviceId) {
    return (
      <div className="page-wrap">
        <div className="bg-mesh" />
        <div className="container timers-container page-enter">
          {/* Header */}
          <div className="dash-hero">
            <div>
              <span className="dash-kicker">
                {lang === 'bn' ? 'স্মার্ট অটোমেশন' : 'Smart Automation'}
              </span>
              <h1 className="page-title dash-title">{t('timers_title')}</h1>
              <p className="page-subtitle dash-subtitle">{t('dash_paired')}</p>
            </div>
            <div className="dash-status-wrap">
              <OnlineIndicator online="unpaired" />
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

      <div className="container timers-container page-enter">
        <div className="dash-hero">
          <div>
            <span className="dash-kicker">
              {lang === 'bn' ? 'স্মার্ট অটোমেশন' : 'Smart Automation'}
            </span>
            <h1 className="page-title dash-title">{t('timers_title')}</h1>
            {devices?.length > 1 && deviceId ? (
              <div className="device-select-container">
                <select
                  className="device-select-dropdown"
                  value={deviceId || ''}
                  onChange={(e) => selectDevice(e.target.value)}
                >
                  {devices?.map((d) => (
                    <option key={d.id} value={d.id}>
                      🔌 {d.name || 'Smart Multi-Plug'} ({d.id})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="page-subtitle dash-subtitle">{t('timers_subtitle')}</p>
            )}
          </div>
          <div className="dash-status-wrap">
            <OnlineIndicator online={online} />
          </div>
        </div>

        {mqttOk && online === false && (
          <div className="timers-alert timers-alert-offline">
            <span className="timers-alert-icon">⚠️</span>
            <div>
              <strong>
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
        <div className="timer-command-card">

          {/* Mode Toggle */}
          <div className="timer-mode-toggle timer-mode-toggle-modern">
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
          <div className="timer-field-block">
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
          <div className="timer-field-block">
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
            <div className="timer-field-block">
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
              <div className="timer-custom-delay">
                <div className="timer-custom-delay-input">
                  <input
                    id="delay-custom-min"
                    type="number"
                    className="form-input"
                    placeholder={t('timers_custom_min')}
                    min="1"
                    max="999"
                    value={customMin}
                    onChange={(e) => { setCustomMin(e.target.value); setDelayPreset(null); }}
                  />
                  <span>
                    {lang === 'bn' ? 'মিনিট' : 'min'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className={`timer-schedule-options ${!mqttOk ? 'sched-disabled-layer' : ''}`}>
              <div>
                <div className="timer-time-row">
                  <p className="timer-section-label">{t('timers_time')}</p>
                  
                  <div className="live-clock-badge">
                    <span className="live-clock-dot"></span>
                    <span className="live-clock-text"><LiveClock lang={lang} /></span>
                    <button
                      type="button"
                      className="live-clock-use-btn"
                      onClick={setSchedTimeToNow}
                      title={lang === 'bn' ? 'বর্তমান সময় সেট করুন' : 'Use current system time'}
                      disabled={!mqttOk}
                    >
                      {lang === 'bn' ? 'এখনকার সময় নিন' : 'Set to Now'}
                    </button>
                  </div>
                </div>

                <input
                  type="time"
                  className="time-picker-input"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  disabled={!mqttOk}
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
                  <div className="inline-notice inline-notice--warn" style={{ marginTop: 12 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>
                      {lang === 'bn' 
                        ? 'এই ফিচারটি বর্তমানে তৈরির কাজ চলছে (Under Construction)। আপাতত প্রতিদিন বা একবার অপশনটি ব্যবহার করুন।' 
                        : 'This feature is under construction. Please use Everyday or Once for now.'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live Timing Summary Message Card */}
          <div className="timer-preview-card">
            <span className="timer-preview-icon">
              {mode === 'delay' ? '⏱️' : '📅'}
            </span>
            <div>
              <span className="timer-preview-label">
                {lang === 'bn' ? 'টাইমিং সেট করার পূর্বরূপ (প্রিভিউ)' : 'Timer Setting Preview'}
              </span>
              <span className="timer-preview-text">
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
            className="btn btn-primary btn-full timer-add-btn"
            onClick={handleAddTimer}
            disabled={!baseTopic || (mode === 'schedule' && (!mqttOk || repeat === 'custom'))}
          >
            {t('timers_add_btn')}
          </button>
        </div>

        {/* Active timers */}
        <div className="section-header timers-list-header">
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
