import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, functions } from '../firebase';
import { ref, get, update, onValue, off, remove } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';

// Device ID formats:
//   Smart Home:       SH{plugs}{sensors}-{8hex}  e.g. SH4gfd-A1B2C3D4
//   Smart Multi-Plug: SP{plugs}-{8hex}            e.g. SP4-A1B2C3D4
const SH_REGEX = /^SH[234][GFDgfd]*-[A-Fa-f0-9]{8}$/;
const SP_REGEX = /^SP[234]?-[A-Fa-f0-9]{8}$/;
const CODE_REGEX = /^(SH[234][GFDgfd]*|SP[234]?)-[A-Fa-f0-9]{8}$/;

// Detect device type from typed code prefix
function detectDeviceType(code) {
  const upper = code.toUpperCase();
  if (upper.startsWith('SH')) return 'sh';
  if (upper.startsWith('SP')) return 'sp';
  return null; // unknown / not typed yet
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
  const { lang, t } = useLanguage();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1=enter code, 2=success
  const [error, setError] = useState('');
  const [pairedId, setPairedId] = useState('');
  const [approvalStatus, setApprovalStatus] = useState(null); // null | 'pending' | 'rejected'

  useEffect(() => {
    if (!user || !pairedId || approvalStatus !== 'pending') return;

    const userDeviceRef = ref(db, `users/${user.uid}/devices/${pairedId}`);
    const reqRef = ref(db, `devices/${pairedId}/pairing_requests/${user.uid}`);

    const handleUserDeviceValue = (snap) => {
      if (snap.exists()) {
        setApprovalStatus(null);
        setStep(2);
      }
    };

    const handleReqValue = (snap) => {
      if (!snap.exists()) {
        setTimeout(async () => {
          const checkLinked = await get(userDeviceRef);
          if (!checkLinked.exists()) {
            setApprovalStatus('rejected');
          }
        }, 1500);
      } else {
        const data = snap.val();
        if (data.status === 'rejected') {
          setApprovalStatus('rejected');
        }
      }
    };

    onValue(userDeviceRef, handleUserDeviceValue);
    onValue(reqRef, handleReqValue);

    return () => {
      off(userDeviceRef, 'value', handleUserDeviceValue);
      off(reqRef, 'value', handleReqValue);
    };
  }, [user, pairedId, approvalStatus]);

  const handleInput = (ev) => {
    const raw = ev.target.value.toUpperCase();
    // Allow typing alphanumeric characters and hyphen freely up to 12 chars
    // Allow SH/SP prefix, digits, sensor suffix letters (G,F,D), hyphen, hex
    const clean = raw.replace(/[^SHPGFD234A-F0-9-]/g, '').slice(0, 15);
    setCode(clean);
    setError('');
  };

  const handlePair = async (ev) => {
    ev.preventDefault();
    setError('');

    let codeToPair = code.trim();
    // Auto-prepend 'SH4-' for bare 8-hex input (default to Smart Home)
    if (/^[A-Fa-f0-9]{8}$/.test(codeToPair)) {
      codeToPair = `SH4-${codeToPair}`;
    }

    if (!CODE_REGEX.test(codeToPair)) {
      const isSHtype = codeToPair.toUpperCase().startsWith('SH');
      setError(
        lang === 'bn'
          ? (isSHtype
            ? 'সঠিক Smart Home Device ID দিন, যেমন SH4gfd-XXXXXXXX'
            : 'সঠিক Smart Multi-Plug Device ID দিন, যেমন SP4-XXXXXXXX')
          : (isSHtype
            ? 'Enter a valid Smart Home Device ID like SH4gfd-XXXXXXXX'
            : 'Enter a valid Smart Multi-Plug Device ID like SP4-XXXXXXXX')
      );
      return;
    }

    setLoading(true);
    try {
      // The full SH device ID includes sensor suffix (e.g. SH4gfd-XXXXXXXX).
      // If user typed just SH4-XXXXXXXX without sensor suffix, try all suffix combos.
      // For SP, try SP-, SP2-, SP3-, SP4- variants.
      let resolvedId = codeToPair;
      const shBareMatch = codeToPair.match(/^(SH[234])(-[A-Fa-f0-9]{8})$/);
      const spBareMatch = codeToPair.match(/^(SP)(-[A-Fa-f0-9]{8})$/);
      if (shBareMatch) {
        const [, plugPart, hexPart] = shBareMatch;
        const suffixes = ['gfd', 'gf', 'gd', 'fd', 'g', 'f', 'd', ''];
        for (const s of suffixes) {
          const testId = `${plugPart}${s}${hexPart}`;
          try {
            const snap = await get(ref(db, `devices/${testId}`));
            if (snap.exists()) { resolvedId = testId; break; }
          } catch (e) { /* ignore permission errors */ }
        }
      } else if (spBareMatch) {
        const hexPart = spBareMatch[2];
        for (const pref of ['SP4', 'SP3', 'SP2', 'SP']) {
          const testId = `${pref}${hexPart}`;
          try {
            const snap = await get(ref(db, `devices/${testId}`));
            if (snap.exists()) { resolvedId = testId; break; }
          } catch (e) { /* ignore */ }
        }
      }
      codeToPair = resolvedId;

      if (!functions) {
        throw new Error('Firebase functions are not initialized.');
      }
      
      const claimDevice = httpsCallable(functions, 'claimDevice');
      try {
        await claimDevice({ deviceId: codeToPair });
      } catch (err) {
        const code = err.code || '';
        const msg = err.message || '';
        if (code === 'already-exists' || msg.includes('already paired') || code === 'already-claimed' || msg.includes('already-claimed')) {
          // Write guest details to devices pairing requests path
          try {
            const reqRef = ref(db, `devices/${codeToPair}/pairing_requests/${user.uid}`);
            await update(reqRef, {
              email: user.email || 'guest@email.com',
              name: user.displayName || user.email || 'Guest Member',
              requested_at: Date.now(),
              status: "pending"
            });
            setPairedId(codeToPair);
            setApprovalStatus('pending');
            setLoading(false);
            return;
          } catch (reqErr) {
             throw new Error('already-exists');
          }
        }
        throw err;
      }

      setPairedId(codeToPair);
      setStep(2);
    } catch (err) {
      console.error('[PairDevice] Claim error:', err);
      const code = err.code || '';
      const msg  = err.message || '';

      if (msg === 'already-exists') {
        setError(lang === 'bn'
          ? 'এই ডিভাইসটি অন্য অ্যাকাউন্টে যুক্ত এবং অনুরোধ পাঠানো যায়নি।'
          : 'Device is already paired and the pairing request could not be sent.');
      } else if (code.includes('not-found') || msg.includes('not-found')) {
        setError(lang === 'bn'
          ? 'ডিভাইসটি খুঁজে পাওয়া যায়নি। Device ID সঠিক কিনা নিশ্চিত করুন এবং ডিভাইসটি WiFi-এ সংযুক্ত হয়েছে কিনা দেখুন।'
          : 'Device not found. Ensure the Device ID is correct and the device has connected to WiFi at least once.');
      } else if (code.includes('permission-denied') || msg.includes('permission_denied')) {
        setError(lang === 'bn'
          ? 'অনুমতি নেই। আপনার অ্যাকাউন্টে লগইন করা আছে কিনা নিশ্চিত করুন।'
          : 'Permission denied. Make sure you are logged in.');
      } else if (code.includes('unauthenticated')) {
        setError(lang === 'bn'
          ? 'আপনি লগইন করা নেই। অনুগ্রহ করে প্রথমে লগইন করুন।'
          : 'You are not signed in. Please log in and try again.');
      } else if (code.includes('internal')) {
        setError(lang === 'bn'
          ? 'সার্ভারে সমস্যা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
          : 'A server error occurred. Please try again in a moment.');
      } else {
        setError(lang === 'bn' ? `সমস্যা হয়েছে: ${msg}` : `Something went wrong: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  if (approvalStatus === 'pending') {
    return (
      <div className="pair-page">
        <div className="bg-mesh" />
        <div className="pair-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="spinner" style={{ width: 48, height: 48, borderWidth: 3, margin: '0 auto 24px auto' }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
            {lang === 'bn' ? 'অনুমোদনের জন্য অপেক্ষা করা হচ্ছে' : 'Awaiting Approval'}
          </h2>
          <p style={{ color: 'var(--clr-text-subtle)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
            {lang === 'bn'
              ? `আপনার অনুরোধটি ডিভাইস মালিকের কাছে পাঠানো হয়েছে। মালিক অনুমোদন করলে এই পেজটি স্বয়ংক্রিয়ভাবে পরিবর্তিত হবে। (ডিভাইস আইডি: ${pairedId})`
              : `Your pairing request has been sent to the device owner. This page will automatically update once they approve. (Device ID: ${pairedId})`}
          </p>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              try {
                await remove(ref(db, `devices/${pairedId}/pairing_requests/${user.uid}`));
              } catch (e) {}
              setApprovalStatus(null);
              setStep(1);
            }}
          >
            {lang === 'bn' ? 'অনুরোধ বাতিল করুন' : 'Cancel Request'}
          </button>
        </div>
      </div>
    );
  }

  if (approvalStatus === 'rejected') {
    return (
      <div className="pair-page">
        <div className="bg-mesh" />
        <div className="pair-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="pair-error-icon" style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'var(--clr-red-dim)', color: 'var(--clr-red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, fontWeight: 'bold', margin: '0 auto 20px auto'
          }}>✗</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: 'var(--clr-red)' }}>
            {lang === 'bn' ? 'অনুরোধটি বাতিল করা হয়েছে' : 'Request Rejected'}
          </h2>
          <p style={{ color: 'var(--clr-text-subtle)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
            {lang === 'bn'
              ? `দুঃখিত, এই ডিভাইসটির মালিক আপনার অনুরোধটি অনুমোদন করেননি। সঠিক ডিভাইস আইডি দিয়ে আবার চেষ্টা করুন বা মালিকের সাথে যোগাযোগ করুন।`
              : `Sorry, the owner of this device did not approve your pairing request. Please check the Device ID and try again.`}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setApprovalStatus(null);
              setStep(1);
            }}
          >
            {lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="pair-page">
        <div className="bg-mesh" />
        <div className="pair-card">
          <div className="pair-success">
            <div className="pair-success-icon">✓</div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                {lang === 'bn' ? 'ডিভাইস সফলভাবে যুক্ত হয়েছে!' : 'Device Paired!'}
              </p>
              <p style={{ color: 'var(--clr-text-muted)', fontSize: 15, lineHeight: 1.6 }}>
                {lang === 'bn'
                  ? 'আপনার স্মার্ট মাল্টি-প্লাগটি সফলভাবে সেট করা হয়েছে। এখন আপনি ড্যাশবোর্ড থেকে এটি নিয়ন্ত্রণ করতে পারবেন।'
                  : 'Your Smart Multi-Plug is ready to go. You can now control your outlets from the dashboard.'}
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
              {lang === 'bn' ? 'ড্যাশবোর্ডে যান →' : 'Go to Dashboard →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const deviceType = detectDeviceType(code);
  const isSH = deviceType === 'sh';
  const isSP = deviceType === 'sp';

  // Dynamic branding based on typed code prefix
  const brand = {
    icon:  isSH ? '🏠' : isSP ? '🔌' : '📱',
    name:  isSH
      ? (lang === 'bn' ? 'স্মার্ট হোম' : 'Smart Home')
      : isSP
        ? (lang === 'bn' ? 'স্মার্ট মাল্টি-প্লাগ' : 'Smart Multi-Plug')
        : (lang === 'bn' ? 'স্মার্ট ডিভাইস' : 'Smart Device'),
    step1: isSH
      ? (lang === 'bn' ? 'আপনার Smart Home ডিভাইসটি পাওয়ার অন করুন' : 'Power on your Smart Home device')
      : (lang === 'bn' ? 'আপনার Smart Multi-Plug চালু করুন' : 'Power on your Smart Multi-Plug'),
    step2: isSH
      ? (lang === 'bn' ? 'ডিভাইসের WiFi Setup পেজে Device ID দেখুন' : 'Find the Device ID on the WiFi setup page')
      : (lang === 'bn' ? 'প্লাগের স্ক্রিনে বা স্টিকারে Device ID দেখুন' : 'Find the Device ID on the screen or sticker'),
    placeholder: isSH ? 'SH4gfd-XXXXXXXX' : isSP ? 'SP4-XXXXXXXX' : 'SHx / SPx-XXXXXXXX',
    subtitle: isSH
      ? (lang === 'bn' ? 'WiFi Setup পেজে বা ডিভাইসের স্টিকারে থাকা Device ID টাইপ করুন।' : "Enter the Device ID shown on your device's WiFi setup page or casing sticker.")
      : isSP
        ? (lang === 'bn' ? 'স্ক্রিনে বা স্টিকারে থাকা Device ID টাইপ করুন।' : "Enter the Device ID shown on your device's screen or casing sticker.")
        : (lang === 'bn' ? 'ডিভাইস আইডি টাইপ করতে শুরু করুন — SH (Smart Home) অথবা SP (Smart Multi-Plug)।' : 'Start typing your Device ID — SH for Smart Home or SP for Smart Multi-Plug.'),
  };

  return (
    <div className="pair-page">
      <div className="bg-mesh" />

      <div className="pair-card">
        {/* Dynamic icon with smooth transition hint */}
        <div className="pair-icon" style={{ transition: 'all 0.25s' }}>{brand.icon}</div>

        <p style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>
          {brand.name}
        </p>
        <p style={{ fontSize: 13, color: 'var(--clr-accent)', fontWeight: 600, textAlign: 'center', marginBottom: 8, letterSpacing: '0.04em', transition: 'opacity 0.2s', opacity: deviceType ? 1 : 0 }}>
          {isSH ? 'SH ·' : isSP ? 'SP ·' : ''} {lang === 'bn' ? 'ডিভাইস শনাক্ত হয়েছে' : 'Device type detected'}
        </p>
        <p style={{ fontSize: 14, color: 'var(--clr-text-muted)', textAlign: 'center', marginBottom: 28, lineHeight: 1.6 }}>
          {brand.subtitle}
        </p>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          <Step n={1} label={brand.step1} active={true} done={false} />
          <Step n={2} label={brand.step2} active={true} done={false} />
          <Step n={3} label={lang === 'bn' ? 'নিচের বক্সে Device ID লিখুন' : 'Enter the Device ID below'} active={true} done={false} />
        </div>

        <form onSubmit={handlePair}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" htmlFor="pair-code">{t('pair_sec_code')}</label>
            <input
              id="pair-code"
              type="text"
              className={`form-input pair-code-input ${error ? 'error' : ''}`}
              placeholder={brand.placeholder}
              value={code}
              onChange={handleInput}
              maxLength={15}
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
            {loading ? <><span className="spinner" /> {lang === 'bn' ? 'সংযোগ হচ্ছে…' : 'Pairing…'}</> : t('pair_btn')}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--clr-text-subtle)', marginTop: 20 }}>
          {lang === 'bn' ? 'কোনো সমস্যা হচ্ছে?' : 'Having trouble?'}{' '}
          <a href="mailto:support@smartmultiplug.com" style={{ color: 'var(--clr-accent)' }}>
            {lang === 'bn' ? 'সাপোর্টে ইমেইল করুন' : 'Contact support'}
          </a>
        </p>
      </div>
    </div>
  );
}
