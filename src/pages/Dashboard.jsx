import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
import { useMqttSubscribe, useMqttPublish } from '../hooks/useMqtt';
import OnlineIndicator from '../components/OnlineIndicator';
import PlugCard from '../components/PlugCard';
import SkeletonLoader from '../components/SkeletonLoader';

const CONFIRM_TIMEOUT_MS = 5000;

export default function Dashboard() {
  const { user, mqttOk } = useAuth();
  const { device, deviceId, plugLabels, updatePlugLabel, loading } = useDevice();
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

  const getDisplayState = (n) =>
    n in optimistic ? optimistic[n] : plugStates[n] ?? false;

  return (
    <div className="page-wrap">
      <div className="bg-mesh" />

      <div className="container" style={{ paddingTop: 24, paddingBottom: 120 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 2 }}>My Plugs</h1>
            <p style={{ fontSize: 13, color: 'var(--clr-text-muted)' }}>
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
            <span>Connecting to your device… Controls will be available shortly.</span>
          </div>
        )}

        {/* Quick stats bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 24,
        }}>
          {[
            {
              label: 'Active Outlets',
              value: [1,2,3,4].filter(n => getDisplayState(n)).length,
              icon: '⚡',
              color: 'var(--clr-accent)',
              bg: 'var(--clr-accent-dim)',
            },
            {
              label: 'Total Outlets',
              value: 4,
              icon: '🔌',
              color: 'var(--clr-text-muted)',
              bg: 'var(--clr-surface-2)',
            },
          ].map(({ label, value, icon, color, bg }) => (
            <div key={label} style={{
              background: bg,
              border: `1px solid ${color === 'var(--clr-text-muted)' ? 'var(--clr-border)' : 'rgba(79,142,247,0.2)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
                <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', marginTop: 3 }}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plug grid */}
        <div className="section-header">
          <span className="section-title">Outlets</span>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => {
              const allOn = [1,2,3,4].every(n => getDisplayState(n));
              [1,2,3,4].forEach(n => handleToggle(n, !allOn));
            }}
            disabled={!mqttOk}
          >
            {[1,2,3,4].every(n => getDisplayState(n)) ? 'Turn All Off' : 'Turn All On'}
          </button>
        </div>

        <div className="plug-grid">
          {[1, 2, 3, 4].map((n) => (
            <PlugCard
              key={n}
              plugNum={n}
              label={plugLabels[n]}
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
              Device ID: <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--clr-text-subtle)' }}>{deviceId}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
