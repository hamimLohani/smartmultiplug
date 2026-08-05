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
  const { device, deviceId, plugLabels, updatePlugLabel, loading, numPlugs } = useDevice();
  const { lang, t } = useLanguage();
  const publish = useMqttPublish();

  // Plug states: null = unknown, true = on, false = off
  const [plugStates, setPlugStates] = useState({ 1: null, 2: null, 3: null, 4: null });
  const [optimistic, setOptimistic]   = useState({});   // plug num -> optimistic value
  const [pending, setPending]         = useState({});    // plug num -> true while waiting for confirm
  const [failed, setFailed]           = useState({});    // plug num -> true if device didn't respond
  const [online, setOnline]           = useState(null);  // null=unknown, true, false

  const confirmTimers = useRef({});

  const baseTopic = user && deviceId
    ? `users/${user.uid}/devices/${deviceId}`
    : null;

  // Subscribe to device status topic
  useMqttSubscribe(
    baseTopic ? `${baseTopic}/status` : null,
    (msg) => setOnline(msg === 'online'),
  );

  // Subscribe to all 4 plug state topics
  for (let n = 1; n <= 4; n++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMqttSubscribe(
      baseTopic ? `${baseTopic}/plug/${n}/state` : null,
      (msg) => {
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
    }, CONFIRM_TIMEOUT_MS);
  }, [baseTopic, mqttOk, publish]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(confirmTimers.current).forEach(clearTimeout);
    };
  }, []);

  if (loading) return <SkeletonLoader />;

  if (!deviceId) {
    return (
      <div className="page-wrap">
        <div className="bg-mesh" />
        <div className="container" style={{ paddingTop: 24, paddingBottom: 120 }}>
          {/* Header */}
          <div className="page-header">
            <div>
              <h1 className="page-title">{t('dash_title')}</h1>
              <p className="page-subtitle">{t('dash_paired')}</p>
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
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🔌</span>
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

      <div className="container" style={{ paddingTop: 24, paddingBottom: 120 }}>
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('dash_title')}</h1>
            <p className="page-subtitle">
              {device?.name || 'Smart Multi-Plug'}
            </p>
          </div>
          <OnlineIndicator online={online} />
        </div>

        {/* MQTT offline banner */}
        {!mqttOk && (
          <div style={{
            background: 'var(--clr-amber-dim)',
            border: '1px solid rgba(251,191,36,0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 20,
            fontSize: 13,
            color: 'var(--clr-amber)',
          }}>
            <span>⚡</span>
            <span>
              {lang === 'bn' 
                ? 'ডিভাইসের সাথে সংযোগ স্থাপন করা হচ্ছে… নিয়ন্ত্রণ ফিচারসমূহ কিছুক্ষণের মধ্যেই উপলব্ধ হবে।' 
                : 'Connecting to your device… Controls will be available shortly.'}
            </span>
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
            <div key={label} className="stat-card" style={{ background: bg }}>
              <span className="stat-icon" style={{ color }}>{icon}</span>
              <div>
                <p className="stat-value" style={{ color }}>{value}</p>
                <p className="stat-label">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plug grid */}
        <div className="section-header">
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
          {plugsList.map((n) => (
            <PlugCard
              key={n}
              plugNum={n}
              label={plugLabels[n] || (lang === 'bn' ? `প্লাগ ${n}` : `Plug ${n}`)}
              state={getDisplayState(n)}
              isPending={!!pending[n]}
              hasFailed={!!failed[n]}
              disabled={!mqttOk}
              onToggle={(newState) => handleToggle(n, newState)}
              onRename={(label) => updatePlugLabel(n, label)}
            />
          ))}
        </div>

        {/* Device info footer */}
        <div style={{
          marginTop: 28,
          padding: '16px',
          background: 'var(--clr-surface)',
          border: '1px solid var(--clr-border)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>ℹ️</span>
          <div>
            <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', lineHeight: 1.5 }}>
              {lang === 'bn' ? 'ডিভাইস আইডি:' : 'Device ID:'} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--clr-text-subtle)' }}>{deviceId}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
