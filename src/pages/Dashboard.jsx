import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useMqttSubscribe, useMqttPublish } from '../hooks/useMqtt';
import OnlineIndicator from '../components/OnlineIndicator';
import PlugCard from '../components/PlugCard';
import SkeletonLoader from '../components/SkeletonLoader';

const CONFIRM_TIMEOUT_MS = 5000;

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, mqttOk } = useAuth();
  const { devices, device, deviceId, plugLabels, updatePlugLabel, selectDevice, loading, numPlugs } = useDevice();
  const { lang, t } = useLanguage();
  const publish = useMqttPublish();

  // Plug states: null = unknown, true = on, false = off
  const [plugStates, setPlugStates] = useState({ 1: null, 2: null, 3: null, 4: null });
  const [timerMsgs, setTimerMsgs]   = useState({});   // plug num -> timer display string
  const [scheduleMsgs, setScheduleMsgs] = useState({}); // plug num -> schedule display string
  const [optimistic, setOptimistic]   = useState({});   // plug num -> optimistic value
  const [pending, setPending]         = useState({});    // plug num -> true while waiting for confirm
  const [failed, setFailed]           = useState({});    // plug num -> true if device didn't respond
  const [online, setOnline]           = useState(null);  // null=unknown, true, false

  const confirmTimers = useRef({});
  const lastResponseTimeRef = useRef(null);
  const syncStartTimeRef = useRef(0);

  const ownerUid = device?.is_shared ? device.owner_uid : user?.uid;
  const baseTopic = user && deviceId && ownerUid
    ? `users/${ownerUid}/devices/${deviceId}`
    : null;

  // Helper to record received MQTT messages from ESP
  const handleIncomingMessage = useCallback((msg, topic) => {
    const now = Date.now();
    lastResponseTimeRef.current = now;

    if (msg === 'offline' || msg === '0' || msg === 'false') {
      if (topic?.endsWith('/status')) {
        setOnline(false);
        return;
      }
    }

    if (msg === 'online' || msg === '1' || msg === 'true') {
      if (syncStartTimeRef.current > 0 && now >= syncStartTimeRef.current) {
        setOnline(true);
      }
    }
  }, []);

  // Subscribe to device status topic
  useMqttSubscribe(
    baseTopic ? `${baseTopic}/status` : null,
    (msg, topic) => {
      handleIncomingMessage(msg, topic);
      if (msg === 'offline') {
        setOnline(false);
      } else if (msg === 'online' && syncStartTimeRef.current > 0 && Date.now() >= syncStartTimeRef.current) {
        setOnline(true);
      }
    },
  );

  // Subscribe to plug state, timer, and schedule topics for all 4 plugs
  for (let n = 1; n <= 4; n++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMqttSubscribe(
      baseTopic ? `${baseTopic}/plug/${n}/state` : null,
      (msg, topic) => {
        handleIncomingMessage(msg, topic);

        const isOn = msg === '1' || msg === 'ON' || msg === 'true';
        setPlugStates((prev) => ({ ...prev, [n]: isOn }));

        // Clear optimistic + pending when device confirms
        setOptimistic((prev) => { const c = { ...prev }; delete c[n]; return c; });
        setPending((prev)    => { const c = { ...prev }; delete c[n]; return c; });
        setFailed((prev)     => { const c = { ...prev }; delete c[n]; return c; });
        if (confirmTimers.current[n]) {
          clearTimeout(confirmTimers.current[n]);
          delete confirmTimers.current[n];
        }
      },
    );

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMqttSubscribe(
      baseTopic ? `${baseTopic}/plug/${n}/timer/state` : null,
      (msg, topic) => {
        handleIncomingMessage(msg, topic);
        try {
          const data = JSON.parse(msg);
          if (data.active && data.remainingSeconds > 0) {
            const m = Math.floor(data.remainingSeconds / 60);
            const s = data.remainingSeconds % 60;
            const timeStr = `${m}:${String(s).padStart(2, '0')}`;
            const actionText = data.action === 'ON' 
              ? (lang === 'bn' ? 'চালু' : 'ON') 
              : (lang === 'bn' ? 'বন্ধ' : 'OFF');
            const str = lang === 'bn'
              ? `${timeStr} পর ${actionText} হবে`
              : `${actionText} in ${timeStr}`;
            setTimerMsgs((prev) => ({ ...prev, [n]: str }));
          } else {
            setTimerMsgs((prev) => { const c = { ...prev }; delete c[n]; return c; });
          }
        } catch { /* ignore */ }
      },
      [lang]
    );

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMqttSubscribe(
      baseTopic ? `${baseTopic}/plug/${n}/schedule` : null,
      (msg, topic) => {
        handleIncomingMessage(msg, topic);
        try {
          const data = JSON.parse(msg);
          if (Array.isArray(data)) {
            const activeItem = data.find((item) => item.enabled);
            if (activeItem) {
              const actionText = activeItem.action === 'ON'
                ? (lang === 'bn' ? 'চালু' : 'ON')
                : (lang === 'bn' ? 'বন্ধ' : 'OFF');
              const str = lang === 'bn'
                ? `শিডিউল: ${activeItem.time} এ ${actionText}`
                : `Sched: ${actionText} at ${activeItem.time}`;
              setScheduleMsgs((prev) => ({ ...prev, [n]: str }));
            } else {
              setScheduleMsgs((prev) => { const c = { ...prev }; delete c[n]; return c; });
            }
          }
        } catch { /* ignore */ }
      },
      [lang]
    );
  }

  const handleToggle = useCallback((plugNum, newState) => {
    if (!baseTopic || !mqttOk) return;

    // Clear any previous failure indicator
    setFailed((prev) => { const c = { ...prev }; delete c[plugNum]; return c; });

    // Optimistic update
    setOptimistic((prev) => ({ ...prev, [plugNum]: newState }));
    setPending((prev)    => ({ ...prev, [plugNum]: true }));

    // Publish command
    const topic = `${baseTopic}/plug/${plugNum}/set`;
    publish(topic, newState ? '1' : '0');

    // Revert if no confirmation within timeout
    if (confirmTimers.current[plugNum]) clearTimeout(confirmTimers.current[plugNum]);
    confirmTimers.current[plugNum] = setTimeout(() => {
      setOptimistic((prev) => { const c = { ...prev }; delete c[plugNum]; return c; });
      setPending((prev)    => { const c = { ...prev }; delete c[plugNum]; return c; });
      setFailed((prev)     => ({ ...prev, [plugNum]: true }));
      // Active detection fallback: if a command fails to reply, ESP is offline
      setOnline(false);
    }, CONFIRM_TIMEOUT_MS);
  }, [baseTopic, mqttOk, publish]);

  // Active sync ping logic
  const performSyncCheck = useCallback(() => {
    if (!baseTopic || !mqttOk) return;

    console.log('[Dashboard] Initiating active sync check with ESP...');
    const syncTime = Date.now();
    syncStartTimeRef.current = syncTime;

    publish(`${baseTopic}/sync`, 'sync', { retain: false, qos: 1 });

    setTimeout(() => {
      const responded = lastResponseTimeRef.current && lastResponseTimeRef.current >= syncTime;
      if (!responded) {
        console.warn('[Dashboard] ESP did not respond to sync check. Setting offline.');
        setOnline(false);
      } else {
        console.log('[Dashboard] ESP responded to sync check. Confirmed online.');
        setOnline(true);
      }
    }, 3500);
  }, [baseTopic, mqttOk, publish]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(confirmTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Initial sync check on load (after 500ms to allow broker retained dump to settle)
  useEffect(() => {
    if (!baseTopic || !mqttOk) return;

    const initialTimer = setTimeout(() => {
      performSyncCheck();
    }, 500);

    return () => clearTimeout(initialTimer);
  }, [baseTopic, mqttOk, performSyncCheck]);

  // Periodic heartbeat check every 15 seconds
  useEffect(() => {
    if (!baseTopic || !mqttOk || online !== true) return;

    const interval = setInterval(() => {
      const secondsSinceLastMsg = lastResponseTimeRef.current ? (Date.now() - lastResponseTimeRef.current) / 1000 : 999;
      if (secondsSinceLastMsg > 15) {
        performSyncCheck();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [baseTopic, mqttOk, online, performSyncCheck]);

  if (loading) return <SkeletonLoader />;

  if (!deviceId) {
    return (
      <div className="page-wrap">
        <div className="bg-mesh" />
        <div className="container dash-container page-enter">
          {/* Header */}
          <div className="dash-hero">
            <div>
              <span className="dash-kicker">
                {lang === 'bn' ? 'লাইভ কন্ট্রোল' : 'Live Control'}
              </span>
              <h1 className="page-title dash-title">{t('dash_title')}</h1>
              <p className="page-subtitle dash-subtitle">{t('dash_paired')}</p>
            </div>
            <div className="dash-status-wrap">
              <OnlineIndicator online="unpaired" />
            </div>
          </div>

          <div className="dash-empty-card">
            <span className="dash-empty-icon">🔌</span>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{t('dash_paired')}</h2>
            <p style={{ fontSize: 14, color: 'var(--clr-text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              {t('dash_paired_desc')}
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

  const getDisplayState = (n) =>
    n in optimistic ? optimistic[n] : plugStates[n] ?? false;

  const plugsList = Array.from({ length: numPlugs }, (_, i) => i + 1);
  const allOn = plugsList.every(n => getDisplayState(n));

  return (
    <div className="page-wrap">
      <div className="bg-mesh" />

      <div className="container dash-container page-enter">
        {/* Header */}
        <div className="dash-hero">
          <div>
            <span className="dash-kicker">
              {lang === 'bn' ? 'লাইভ কন্ট্রোল' : 'Live Control'}
            </span>
            <h1 className="page-title dash-title">{t('dash_title')}</h1>
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
              <p className="page-subtitle dash-subtitle">
                {device?.name || 'Smart Multi-Plug'}
              </p>
            )}
          </div>
          <div className="dash-status-wrap">
            <OnlineIndicator online={online} />
          </div>
        </div>

        {/* MQTT connecting banner */}
        {!mqttOk && (
          <div className="dash-alert dash-alert-warn">
            <span className="dash-alert-icon">⚡</span>
            <span>
              {lang === 'bn' 
                ? 'ডিভাইসের সাথে সংযোগ স্থাপন করা হচ্ছে… নিয়ন্ত্রণ ফিচারসমূহ কিছুক্ষণের মধ্যেই উপলব্ধ হবে।' 
                : 'Connecting to your device… Controls will be available shortly.'}
            </span>
          </div>
        )}

        {/* Device Offline Warning Banner */}
        {mqttOk && online === false && (
          <div className="dash-alert dash-alert-offline">
            <span className="dash-alert-icon">⚠️</span>
            <div>
              <strong>
                {lang === 'bn' ? 'ডিভাইসটি অফলাইনে আছে' : 'Device is Offline'}
              </strong>
              <span>
                {lang === 'bn' 
                  ? 'স্মার্ট মাল্টি-প্লাগটি পাওয়ার সকেটে প্লাগ করা আছে কিনা এবং ওয়াইফাই সংযোগ সচল আছে কিনা তা নিশ্চিত করুন। ডিভাইসটি পাওয়ার অন বা অনলাইনে আসলে নিয়ন্ত্রণ বোতামসমূহ কাজ করবে।' 
                  : 'Your Smart Multi-Plug is powered off or disconnected from WiFi. Ensure it is plugged into a wall socket and connected to WiFi for controls to respond.'}
              </span>
            </div>
          </div>
        )}

        {/* Quick stats bar */}
        <div className="stats-grid">
          {[
            {
              label: lang === 'bn' ? 'সক্রিয় সকেট' : 'Active Outlets',
              value: plugsList.filter(n => getDisplayState(n)).length,
              icon: '⚡',
              color: 'var(--clr-accent)',
              bg: 'var(--clr-accent-dim)',
            },
            {
              label: lang === 'bn' ? 'মোট সকেট' : 'Total Outlets',
              value: numPlugs,
              icon: '🔌',
              color: 'var(--clr-text-muted)',
              bg: 'var(--clr-surface-2)',
            },
          ].map(({ label, value, icon, color, bg }) => (
            <div key={label} className="stat-card dash-stat-card" style={{ '--stat-bg': bg, '--stat-color': color }}>
              <span className="stat-icon" style={{ color }}>{icon}</span>
              <div>
                <p className="stat-value" style={{ color }}>{value}</p>
                <p className="stat-label">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plug grid */}
        <div className="section-header dash-section-header">
          <span className="section-title">
            {lang === 'bn' ? 'আউটলেটসমূহ' : 'Outlets'}
          </span>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => {
              plugsList.forEach(n => handleToggle(n, !allOn));
            }}
            disabled={!mqttOk}
          >
            {allOn 
              ? (lang === 'bn' ? 'সব বন্ধ করুন' : 'Turn All Off') 
              : (lang === 'bn' ? 'সব চালু করুন' : 'Turn All On')}
          </button>
        </div>

        <div className="plug-grid">
          {plugsList?.map((n) => (
            <PlugCard
              key={n}
              plugNum={n}
              label={plugLabels[n] || (lang === 'bn' ? `প্লাগ ${n}` : `Plug ${n}`)}
              state={getDisplayState(n)}
              isPending={!!pending[n]}
              hasFailed={!!failed[n]}
              disabled={!mqttOk}
              timerMsg={timerMsgs[n] || scheduleMsgs[n]}
              onToggle={(newState) => handleToggle(n, newState)}
              onRename={(label) => updatePlugLabel(n, label)}
            />
          ))}
        </div>

        {/* Device info footer */}
        <div className="dash-device-footer">
          <span className="dash-device-footer-icon">ℹ️</span>
          <div>
            <p>
              {lang === 'bn' ? 'ডিভাইস আইডি:' : 'Device ID:'} <span>{deviceId}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
