import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, functions } from '../firebase';
import { ref, get, update, onValue, off, remove } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';

const CODE_REGEX = /^SP[234]?-[A-Fa-f0-9]{8}$/;

async function pairDeviceDirectly(deviceId, user) {
  const uid = user.uid;
  const deviceRef = ref(db, `devices/${deviceId}`);
  const snap = await get(deviceRef);
  if (!snap.exists()) {
    throw new Error('not-found');
  }

  const deviceData = snap.val();
  const ownerUid = deviceData.claimed_by;
  if (ownerUid && ownerUid !== uid) {
    // Write guest details to devices pairing requests path
    const reqRef = ref(db, `devices/${deviceId}/pairing_requests/${uid}`);
    await update(reqRef, {
      email: user.email || 'guest@email.com',
      name: user.displayName || user.email || 'Guest Member',
      requested_at: Date.now(),
      status: "pending"
    });
    throw new Error('awaiting-approval');
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
      setError(
        lang === 'bn'
          ? 'অনুগ্রহ করে সঠিক ফরম্যাটে ডিভাইস আইডি দিন, যেমন SPX-XXXXXXXX (এটি প্লাগের স্ক্রিনে দেখতে পাবেন)।'
          : 'Enter a valid Device ID in the format SPX-XXXXXXXX (shown on your device screen or casing).'
      );
      return;
    }

    setLoading(true);
    try {
      // Resolve the correct prefix (SP-, SP2-, SP3-, SP4-) by querying the DB
      let resolvedId = codeToPair;
      if (codeToPair.startsWith('SP-')) {
        const suffix = codeToPair.substring(3);
        const prefixes = ['SP-', 'SP2-', 'SP3-', 'SP4-'];
        for (const pref of prefixes) {
          const testId = `${pref}${suffix}`;
          try {
            const deviceRef = ref(db, `devices/${testId}`);
            const snap = await get(deviceRef);
            if (snap.exists()) {
              resolvedId = testId;
              break;
            }
          } catch (e) {
            // Ignore read/permission errors (e.g. if node exists but database rules restrict access)
          }
        }
      }
      codeToPair = resolvedId;

      if (functions) {
        try {
          const claimDevice = httpsCallable(functions, 'claimDevice');
          await claimDevice({ deviceId: codeToPair });
        } catch (err) {
          if (['functions/internal', 'functions/unavailable'].includes(err.code)) {
            await pairDeviceDirectly(codeToPair, user);
          } else {
            throw err;
          }
        }
      } else {
        await pairDeviceDirectly(codeToPair, user);
      }

      setPairedId(codeToPair);
      setStep(2);
    } catch (err) {
      if (err.message === 'awaiting-approval') {
        setPairedId(codeToPair);
        setApprovalStatus('pending');
        return;
      }
      console.error('[PairDevice] Claim error:', err);
      if (err.message?.includes('already-claimed') || err.code?.includes('already-claimed')) {
        setError(
          lang === 'bn'
            ? 'এই মাল্টি-প্লাগটি ইতিমধ্যে অন্য একটি অ্যাকাউন্টে যুক্ত করা আছে। প্রয়োজনে সাপোর্ট টিমের সাথে যোগাযোগ করুন।'
            : 'This device is already paired to another account. Contact support if this is your device.'
        );
      } else if (err.message?.includes('permission_denied') || err.code?.includes('permission-denied')) {
        setError(
          lang === 'bn'
            ? 'অনুমতি নেই। আপনার অ্যাকাউন্ট লগইন করা আছে কিনা নিশ্চিত করুন।'
            : 'Permission denied. Make sure you are logged in and the device is provisioned.'
        );
      } else {
        setError(lang === 'bn' ? `দুঃখিত, কোনো সমস্যা হয়েছে: ${err.message}` : `Something went wrong: ${err.message}`);
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

  return (
    <div className="pair-page">
      <div className="bg-mesh" />

      <div className="pair-card">
        <div className="pair-icon">🔌</div>

        <p style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
          {t('pair_title')}
        </p>
        <p style={{ fontSize: 14, color: 'var(--clr-text-muted)', textAlign: 'center', marginBottom: 28, lineHeight: 1.6 }}>
          {lang === 'bn'
            ? 'প্লাগের স্ক্রিনে অথবা স্টিকারে থাকা ডিভাইস আইডিটি সংগ্রহ করে নিচে টাইপ করুন।'
            : 'Find the Device ID on your device\'s screen or casing and enter it below.'}
        </p>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          <Step
            n={1}
            label={lang === 'bn' ? 'আপনার স্মার্ট মাল্টি-প্লাগটি চালু করুন' : 'Power on your Smart Multi-Plug'}
            active={true}
            done={false}
          />
          <Step
            n={2}
            label={lang === 'bn' ? 'স্ক্রিনে বা বডিতে থাকা ডিভাইস আইডিটি (Device ID) দেখুন' : 'Find the Device ID on the screen or casing'}
            active={true}
            done={false}
          />
          <Step
            n={3}
            label={lang === 'bn' ? 'নিচের বক্সে ডিভাইস আইডিটি লিখুন' : 'Enter the Device ID below'}
            active={true}
            done={false}
          />
        </div>

        <form onSubmit={handlePair}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" htmlFor="pair-code">{t('pair_sec_code')}</label>
            <input
              id="pair-code"
              type="text"
              className={`form-input pair-code-input ${error ? 'error' : ''}`}
              placeholder="SPX-XXXXXXXX"
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
