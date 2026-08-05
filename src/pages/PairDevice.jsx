import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, functions } from '../firebase';
import { ref, get, update } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const CODE_REGEX = /^SP[234]?-[A-Fa-f0-9]{8}$/;

async function pairDeviceDirectly(deviceId, uid) {
  const deviceRef = ref(db, `devices/${deviceId}`);
  const snap = await get(deviceRef);
  if (!snap.exists()) {
    throw new Error('not-found');
  }

  const deviceData = snap.val();
  if (deviceData.claimed_by && deviceData.claimed_by !== uid) {
    throw new Error('already-claimed');
  }

  await update(deviceRef, {
    claimed_by: uid,
    claimed_at: Date.now(),
  });

  const userDeviceRef = ref(db, `users/${uid}/devices/${deviceId}`);
  
  // Extract number of plugs from the prefix
  const getNumPlugs = (id) => {
    if (id?.startsWith('SP2-')) return 2;
    if (id?.startsWith('SP3-')) return 3;
    return 4; // default
  };
  const count = getNumPlugs(deviceId);
  const plugsData = {};
  for (let i = 1; i <= count; i++) {
    plugsData[`plugs/${i}/label`] = `Plug ${i}`;
  }

  await update(userDeviceRef, {
    name: 'Smart Multi-Plug',
    paired_at: Date.now(),
    ...plugsData,
  });
}

function Step({ n, label, active, done }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: done ? 0.5 : 1 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: done ? 'var(--clr-green-dim)' : active ? 'var(--clr-accent-dim)' : 'var(--clr-surface-3)',
        border: `2px solid ${done ? 'var(--clr-green)' : active ? 'var(--clr-accent)' : 'var(--clr-border-md)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
        color: done ? 'var(--clr-green)' : active ? 'var(--clr-accent)' : 'var(--clr-text-subtle)',
        flexShrink: 0, transition: 'all 0.3s',
      }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize: 14, color: active ? 'var(--clr-text)' : 'var(--clr-text-subtle)', transition: 'color 0.3s' }}>
        {label}
      </span>
    </div>
  );
}

export default function PairDevice() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [step, setStep]         = useState(1); // 1=enter code, 2=success
  const [error, setError]       = useState('');
  const [pairedId, setPairedId] = useState('');

  const formatCode = (val) => {
    const clean = val.replace(/[^A-Fa-f0-9]/g, '').slice(0, 8).toUpperCase();
    return clean ? `SP-${clean}` : '';
  };

  const handleInput = (ev) => {
    const raw = ev.target.value.toUpperCase();
    // Allow typing alphanumeric characters and hyphen freely up to 12 chars
    const clean = raw.replace(/[^SP234A-F0-9-]/g, '').slice(0, 12);
    setCode(clean);
    setError('');
  };

  const handlePair = async (ev) => {
    ev.preventDefault();
    setError('');

    let codeToPair = code.trim();
    // Auto-prepend default 'SP-' if only 8-character hex code is entered
    if (/^[A-Fa-f0-9]{8}$/.test(codeToPair)) {
      codeToPair = `SP-${codeToPair}`;
    }

    if (!CODE_REGEX.test(codeToPair)) {
      setError('Enter a valid pairing code in the format SP-XXXXXXXX or SP4-XXXXXXXX (shown on your device screen).');
      return;
    }

    setLoading(true);
    try {
      if (functions) {
        try {
          const claimDevice = httpsCallable(functions, 'claimDevice');
          await claimDevice({ deviceId: codeToPair });
        } catch (err) {
          if (['functions/not-found', 'functions/internal', 'functions/unavailable'].includes(err.code)) {
            await pairDeviceDirectly(codeToPair, user.uid);
          } else {
            throw err;
          }
        }
      } else {
        await pairDeviceDirectly(codeToPair, user.uid);
      }

      setPairedId(codeToPair);
      setStep(2);
    } catch (err) {
      console.error('[PairDevice] Claim error:', err);
      if (err.message?.includes('already-claimed') || err.code?.includes('already-claimed')) {
        setError('This device is already paired to another account. Contact support if this is your device.');
      } else if (err.message?.includes('permission_denied') || err.code?.includes('permission-denied')) {
        setError('Permission denied. Make sure you are logged in and the device is provisioned.');
      } else {
        setError(`Something went wrong: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="pair-page">
        <div className="bg-mesh" />
        <div className="pair-card">
          <div className="pair-success">
            <div className="pair-success-icon">✓</div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Device Paired!</p>
              <p style={{ color: 'var(--clr-text-muted)', fontSize: 15, lineHeight: 1.6 }}>
                Your Smart Multi-Plug is ready to go. You can now control all 4 outlets from the dashboard.
              </p>
            </div>
            <div style={{
              background: 'var(--clr-surface-2)',
              border: '1px solid var(--clr-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--clr-text-muted)',
              letterSpacing: '0.1em',
            }}>
              {pairedId}
            </div>
            <button
              id="pair-go-dashboard"
              className="btn btn-primary btn-full btn-lg"
              onClick={() => navigate('/')}
            >
              Go to Dashboard →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pair-page">
      <div className="bg-mesh" />

      <div className="pair-card">
        <div className="pair-icon">🔌</div>

        <p style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
          Pair Your Device
        </p>
        <p style={{ fontSize: 14, color: 'var(--clr-text-muted)', textAlign: 'center', marginBottom: 28, lineHeight: 1.6 }}>
          Find the pairing code on your device's screen and enter it below.
        </p>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          <Step n={1} label="Power on your Smart Multi-Plug" active={true} done={false} />
          <Step n={2} label="Wait for the code to appear on screen" active={true} done={false} />
          <Step n={3} label="Enter the code below" active={true} done={false} />
        </div>

        <form onSubmit={handlePair}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" htmlFor="pair-code">Pairing Code</label>
            <input
              id="pair-code"
              type="text"
              className={`form-input pair-code-input ${error ? 'error' : ''}`}
              placeholder="SP-00000000"
              value={code}
              onChange={handleInput}
              maxLength={12}
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            {error && (
              <span className="form-error" style={{ marginTop: 6 }}>
                ⚠ {error}
              </span>
            )}
          </div>

          <button
            id="pair-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading || code.length < 8}
          >
            {loading ? <><span className="spinner" /> Pairing…</> : 'Pair Device'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--clr-text-subtle)', marginTop: 20 }}>
          Having trouble?{' '}
          <a href="mailto:support@smartmultiplug.com" style={{ color: 'var(--clr-accent)' }}>
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
