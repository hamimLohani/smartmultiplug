import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth, db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { ref, remove, update, onValue, off } from 'firebase/database';
import toast from 'react-hot-toast';
import { usePwaInstall } from '../hooks/usePwaInstall';
import PwaInstallRecommendation from '../components/PwaInstallRecommendation';
import { useMqttSubscribe } from '../hooks/useMqtt';
import OnlineIndicator from '../components/OnlineIndicator';
import { useDelayUnmount } from '../hooks/useDelayUnmount';

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function Modal({ show, title, body, onConfirm, onCancel, confirmLabel, cancelLabel, danger = false }) {
  const shouldRender = useDelayUnmount(show, 250); // 250ms matches the animation duration

  if (!shouldRender) return null;
  
  const isClosing = !show;

  return (
    <div className={`modal-overlay ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={onCancel}>
      <div className={`modal-card ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`} onClick={(e) => e.stopPropagation()}>
        <p className="modal-title">{title}</p>
        <p className="modal-body">{body}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
            {cancelLabel || 'Cancel'}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            style={{ flex: 1 }}
            onClick={onConfirm}
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

async function unpairDeviceDirectly(deviceId, uid, isShared) {
  const userDeviceRef = ref(db, `users/${uid}/devices/${deviceId}`);

  if (isShared) {
    await remove(ref(db, `devices/${deviceId}/shared_members/${uid}`));
    await remove(userDeviceRef);
    return;
  }

  const deviceRef = ref(db, `devices/${deviceId}`);
  await update(deviceRef, {
    claimed_by: null,
    claimed_at: null,
  });
  await remove(ref(db, `devices/${deviceId}/shared_members`));
  await remove(userDeviceRef);
}

function ChangePasswordModal({ show, onClose, lang, t }) {
  const [current, setCurrent]   = useState('');
  const [newPass, setNewPass]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);

  const shouldRender = useDelayUnmount(show, 250);

  if (!shouldRender) return null;
  
  const isClosing = !show;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const hasUppercase = /[A-Z]/.test(newPass);
    const hasNumber = /[0-9]/.test(newPass);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPass);
    
    if (newPass.length < 8) {
      toast.error(lang === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।' : 'Password must be at least 8 characters.'); 
      return; 
    }
    if (!hasUppercase || !hasNumber || !hasSpecial) {
      toast.error(
        lang === 'bn' 
          ? 'পাসওয়ার্ডে কমপক্ষে একটি বড় হাতের অক্ষর (Capital Letter), একটি সংখ্যা (Number) এবং একটি চিহ্ন (Symbol) থাকতে হবে।' 
          : 'Password must contain at least one capital letter, one number, and one symbol (e.g. @, #, $, !).'
      );
      return;
    }
    if (newPass !== confirm) {
      toast.error(lang === 'bn' ? 'পাসওয়ার্ড দুটি মিলছে না।' : 'Passwords do not match.'); 
      return; 
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, current);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPass);
      toast.success(lang === 'bn' ? 'পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে!' : 'Password updated successfully!');
      onClose();
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error(lang === 'bn' ? 'বর্তমান পাসওয়ার্ডটি সঠিক নয়।' : 'Current password is incorrect.');
      } else {
        toast.error(lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।' : 'Failed to update password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`modal-overlay ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={onClose}>
      <div className={`modal-card ${isClosing ? 'animate-slide-down' : 'animate-slide-up'}`} onClick={(e) => e.stopPropagation()}>
        <p className="modal-title">{t('settings_change_pw')}</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-current">
              {lang === 'bn' ? 'বর্তমান পাসওয়ার্ড' : 'Current Password'}
            </label>
            <input id="cp-current" type="password" className="form-input" placeholder="••••••••" value={current} onChange={e => setCurrent(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-new">{t('settings_new_pw')}</label>
            <input id="cp-new" type="password" className="form-input" placeholder={lang === 'bn' ? 'কমপক্ষে ৮ অক্ষরের শক্তিশালী পাসওয়ার্ড' : 'At least 8 chars strong password'} value={newPass} onChange={e => setNewPass(e.target.value)} />
            
            {newPass.length > 0 && (
              <div className="password-requirements" style={{
                marginTop: '8px',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--clr-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--clr-text-muted)', marginBottom: '2px' }}>
                  {lang === 'bn' ? 'পাসওয়ার্ডের শর্তসমূহ:' : 'Password Requirements:'}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: newPass.length >= 8 ? 'var(--clr-green)' : 'var(--clr-text-subtle)' }}>
                    <span>{newPass.length >= 8 ? '✅' : '⚪'}</span>
                    <span>{lang === 'bn' ? '৮+ অক্ষর' : '8+ characters'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: /[A-Z]/.test(newPass) ? 'var(--clr-green)' : 'var(--clr-text-subtle)' }}>
                    <span>{/[A-Z]/.test(newPass) ? '✅' : '⚪'}</span>
                    <span>{lang === 'bn' ? 'বড় হাতের অক্ষর (A-Z)' : 'Capital letter (A-Z)'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: /[0-9]/.test(newPass) ? 'var(--clr-green)' : 'var(--clr-text-subtle)' }}>
                    <span>{/[0-9]/.test(newPass) ? '✅' : '⚪'}</span>
                    <span>{lang === 'bn' ? 'একটি সংখ্যা (0-9)' : 'Number (0-9)'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: /[^A-Za-z0-9]/.test(newPass) ? 'var(--clr-green)' : 'var(--clr-text-subtle)' }}>
                    <span>{/[^A-Za-z0-9]/.test(newPass) ? '✅' : '⚪'}</span>
                    <span>{lang === 'bn' ? 'একটি চিহ্ন (যেমন @, !)' : 'Symbol (e.g. @, !)'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-confirm">{t('settings_confirm_pw')}</label>
            <input id="cp-confirm" type="password" className="form-input" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          <div className="modal-actions" style={{ marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              {t('cancel')}
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? <span className="spinner" /> : (lang === 'bn' ? 'আপডেট করুন' : 'Update')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const HELP_STEPS = [
  { key: 1 }, { key: 2 }, { key: 3 }, { key: 4 },
  { key: 5 }, { key: 6 }, { key: 7 },
];

const STEP_ICONS = ['⚡', '🖥️', '📶', '🌐', '🔑', '🔗', '🎮'];

function HelpInstructions({ lang, t }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div
        className="settings-item"
        onClick={() => setOpen(v => !v)}
        style={{ cursor: 'pointer' }}
        id="settings-help-toggle"
      >
        <div className="settings-item-left">
          <div className="settings-item-icon" style={{ background: 'rgba(79,142,247,0.15)', fontSize: 16 }}>📖</div>
          <div>
            <span className="settings-item-label">{t('settings_help_subtitle')}</span>
            <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', marginTop: 2 }}>
              {lang === 'bn' ? '৭টি সহজ ধাপ' : '7 easy steps'}
            </p>
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.25s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>

      {open && (
        <div style={{
          padding: '16px 16px 20px',
          borderTop: '1px solid var(--clr-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}>
          <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            {t('settings_help_intro')}
          </p>
          {HELP_STEPS.map(({ key }, idx) => (
            <div
              key={key}
              style={{
                display: 'flex',
                gap: 14,
                paddingBottom: idx < 6 ? 18 : 0,
                marginBottom: idx < 6 ? 18 : 0,
                borderBottom: idx < 6 ? '1px solid var(--clr-border)' : 'none',
              }}
            >
              {/* Step number bubble */}
              <div style={{
                flexShrink: 0,
                width: 32, height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--clr-accent), #7c5af4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, color: '#fff',
                boxShadow: '0 2px 8px rgba(79,142,247,0.3)',
                marginTop: 1,
              }}>
                {key}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--clr-text)', marginBottom: 4, lineHeight: 1.4 }}>
                  <span style={{ marginRight: 6 }}>{STEP_ICONS[idx]}</span>
                  {t(`settings_help_step${key}_title`)}
                </p>
                <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', lineHeight: 1.65 }}>
                  {t(`settings_help_step${key}_desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user, logout, mqttOk }   = useAuth();
  const { devices, device, deviceId, plugLabels, updatePlugLabel, updateDeviceName, selectDevice, clearDevice, numPlugs } = useDevice();
  const { lang, setLang, t }       = useLanguage();
  const { theme, setTheme }        = useTheme();
  const navigate                   = useNavigate();

  const [online, setOnline] = useState(null);
  const lastResponseTimeRef = useRef(null);
  const syncStartTimeRef = useRef(0);

  const ownerUid = device?.is_shared ? device.owner_uid : user?.uid;
  const baseTopic = user && deviceId && ownerUid ? `users/${ownerUid}/devices/${deviceId}` : null;

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

  // Perform sync check on mount
  useEffect(() => {
    if (!baseTopic || !mqttOk) return;

    syncStartTimeRef.current = Date.now();
    const initialTimer = setTimeout(() => {
      if (lastResponseTimeRef.current && Date.now() - lastResponseTimeRef.current < 5000) {
        setOnline(true);
      } else {
        setOnline(false);
      }
    }, 500);

    return () => clearTimeout(initialTimer);
  }, [baseTopic, mqttOk]);

  const [showUnpair, setShowUnpair]     = useState(false);
  const [showLogout, setShowLogout]     = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const { isStandalone, canPromptNative, promptInstall } = usePwaInstall();
  const [unpairing, setUnpairing]       = useState(false);

  // Inline plug rename state
  const [renamingPlug, setRenamingPlug]   = useState(null);
  const [renameValue, setRenameValue]     = useState('');

  const startRename = (n) => { setRenamingPlug(n); setRenameValue(plugLabels[n]); };
  const commitRename = async (n) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== plugLabels[n]) await updatePlugLabel(n, trimmed);
    setRenamingPlug(null);
  };

  const [renamingDevice, setRenamingDevice] = useState(false);
  const [deviceRenameValue, setDeviceRenameValue] = useState('');

  const startDeviceRename = () => {
    setRenamingDevice(true);
    setDeviceRenameValue(device?.name || 'Smart Multi-Plug');
  };
  const commitDeviceRename = async () => {
    const trimmed = deviceRenameValue.trim();
    if (trimmed && trimmed !== device?.name) {
      await updateDeviceName(trimmed);
    }
    setRenamingDevice(false);
  };

  const [sharedMembers, setSharedMembers] = useState([]);
  const [memberToRemove, setMemberToRemove] = useState(null);

  useEffect(() => {
    if (!db || !user || !deviceId || device?.is_shared) {
      setSharedMembers([]);
      return;
    }

    const membersRef = ref(db, `devices/${deviceId}/shared_members`);
    const handleMembers = (snap) => {
      if (!snap.exists()) {
        setSharedMembers([]);
        return;
      }
      const data = snap.val();
      const list = Object.entries(data).map(([uid, details]) => ({
        uid,
        email: details.email || 'guest@email.com',
        name: details.name || 'Guest Member',
        sharedAt: details.shared_at || Date.now()
      }));
      setSharedMembers(list);
    };

    onValue(membersRef, handleMembers);
    return () => off(membersRef, 'value', handleMembers);
  }, [deviceId, device?.is_shared, user]);

  const handleRevokeAccess = async (guestUid) => {
    try {
      // 1. Remove device reference from guest's user node
      await remove(ref(db, `users/${guestUid}/devices/${deviceId}`));
      // 2. Remove guest details from the device's shared members node
      await remove(ref(db, `devices/${deviceId}/shared_members/${guestUid}`));
      toast.success(lang === 'bn' ? 'শেয়ার করা সদস্যকে সফলভাবে রিমুভ করা হয়েছে।' : 'Shared member removed successfully.');
    } catch (err) {
      console.error('Failed to revoke guest access:', err);
      toast.error(lang === 'bn' ? 'সদস্য রিমুভ করতে ব্যর্থ হয়েছে।' : 'Failed to remove shared member.');
    }
  };

  const [pairingRequests, setPairingRequests] = useState([]);

  useEffect(() => {
    if (!db || !user || !deviceId || device?.is_shared) {
      setPairingRequests([]);
      return;
    }

    const reqsRef = ref(db, `devices/${deviceId}/pairing_requests`);
    const handleReqs = (snap) => {
      if (!snap.exists()) {
        setPairingRequests([]);
        return;
      }
      const data = snap.val();
      const list = Object.entries(data).map(([uid, details]) => ({
        uid,
        email: details.email || 'guest@email.com',
        name: details.name || 'Guest Member',
        requestedAt: details.requested_at || Date.now()
      }));
      setPairingRequests(list);
    };

    onValue(reqsRef, handleReqs);
    return () => off(reqsRef, 'value', handleReqs);
  }, [deviceId, device?.is_shared, user]);

  const handleAcceptRequest = async (request) => {
    try {
      // 1. Add guest details to device shared_members
      await update(ref(db, `devices/${deviceId}/shared_members/${request.uid}`), {
        email: request.email,
        name: request.name,
        shared_at: Date.now()
      });

      // 2. Add device link under guest user's account path
      await update(ref(db, `users/${request.uid}/devices/${deviceId}`), {
        name: device?.name || 'Smart Multi-Plug',
        is_shared: true,
        owner_uid: user.uid,
        paired_at: Date.now()
      });

      // 3. Remove from pairing requests
      await remove(ref(db, `devices/${deviceId}/pairing_requests/${request.uid}`));

      toast.success(lang === 'bn' ? 'অনুরোধটি অনুমোদন করা হয়েছে।' : 'Request approved successfully.');
    } catch (err) {
      console.error('Failed to approve request:', err);
      toast.error(lang === 'bn' ? 'অনুমোদন করতে ব্যর্থ হয়েছে।' : 'Failed to approve request.');
    }
  };

  const handleRejectRequest = async (guestUid) => {
    try {
      // Remove from pairing requests
      await remove(ref(db, `devices/${deviceId}/pairing_requests/${guestUid}`));
      toast.success(lang === 'bn' ? 'অনুরোধটি বাতিল করা হয়েছে।' : 'Request rejected.');
    } catch (err) {
      console.error('Failed to reject request:', err);
      toast.error(lang === 'bn' ? 'বাতিল করতে ব্যর্থ হয়েছে।' : 'Failed to reject request.');
    }
  };

  const handleUnpair = async () => {
    if (!mqttOk) {
      toast.error(
        lang === 'bn'
          ? 'MQTT সংযোগ নেই। ডিভাইস রিমুভ করার আগে অ্যাপ সংযোগ ফিরে আসা পর্যন্ত অপেক্ষা করুন।'
          : 'MQTT is not connected. Wait for app connection before removing the device.'
      );
      return;
    }

    setUnpairing(true);
    try {
      // Notify the device over MQTT first
      const { publishAsync } = await import('../mqtt');
      await publishAsync(`users/${ownerUid}/devices/${deviceId}/unpair`, 'unpair', { retain: true });

      if (functions) {
        try {
          const unclaimDevice = httpsCallable(functions, 'unclaimDevice');
          await unclaimDevice({ deviceId });
        } catch (err) {
          if (['functions/internal', 'functions/unavailable'].includes(err.code)) {
            await unpairDeviceDirectly(deviceId, user.uid, device?.is_shared);
          } else {
            throw err;
          }
        }
      } else {
        await unpairDeviceDirectly(deviceId, user.uid, device?.is_shared);
      }

      const remainingCount = (devices || []).length - 1;
      toast.success(lang === 'bn' ? 'আপনার অ্যাকাউন্ট থেকে ডিভাইসটি মুছে ফেলা হয়েছে।' : 'Device removed from your account.');
      if (remainingCount <= 0) {
        clearDevice();
        navigate('/pair');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Failed to unpair device:', err);
      toast.error(lang === 'bn' ? 'ডিভাইসটি মুছতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।' : 'Failed to remove device. Please try again.');
    } finally {
      setUnpairing(false);
      setShowUnpair(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      toast.error(lang === 'bn' ? 'লগ আউট ব্যর্থ হয়েছে। আবার চেষ্টা করুন।' : 'Logout failed. Please try again.');
    }
  };

  const isEmailUser = user?.providerData?.[0]?.providerId === 'password';

  return (
    <div className="page-wrap">
      <div className="bg-mesh" />
      <div className="container settings-container page-enter">
        <div className="dash-hero">
          <div>
            <span className="dash-kicker">
              {lang === 'bn' ? 'কন্ট্রোল সেন্টার' : 'Control Center'}
            </span>
            <h1 className="page-title dash-title">{t('settings_title')}</h1>
            {devices.length > 1 && deviceId ? (
              <div className="device-select-container">
                <select
                  className="device-select-dropdown"
                  value={deviceId || ''}
                  onChange={(e) => selectDevice(e.target.value)}
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      🔌 {d.name || 'Smart Multi-Plug'} ({d.id})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="page-subtitle dash-subtitle">
                {deviceId ? t('settings_subtitle') : t('dash_paired')}
              </p>
            )}
          </div>
          <div className="dash-status-wrap">
            <OnlineIndicator online={deviceId ? online : 'unpaired'} />
          </div>
        </div>

        {/* Account info card */}
        <div className="settings-account-card">
          <div className="settings-avatar">
            {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="settings-account-text">
            <p className="settings-account-name">
              {user?.displayName || (lang === 'bn' ? 'আমার অ্যাকাউন্ট' : 'My Account')}
            </p>
            <p className="settings-account-email">
              {user?.email}
            </p>
          </div>
        </div>

        {/* App Language */}
        <p className="settings-section-title">{lang === 'bn' ? 'অ্যাপের ভাষা' : 'App Language'}</p>
        <div className="settings-group settings-group-modern">
          <div className="settings-item" style={{ cursor: 'default' }}>
            <div className="settings-item-left">
              <div className="settings-item-icon" style={{ background: 'var(--clr-accent-dim)', fontSize: 16 }}>🌐</div>
              <span className="settings-item-label">
                {lang === 'bn' ? 'ভাষা পরিবর্তন করুন' : 'Change Language'}
              </span>
            </div>
            <div className="lang-switcher-wrap">
              <button
                className={`lang-btn ${lang === 'bn' ? 'active' : ''}`}
                onClick={() => setLang('bn')}
              >
                বাং
              </button>
              <button
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
              >
                EN
              </button>
            </div>
          </div>
        </div>

        {/* Appearance / Theme */}
        <p className="settings-section-title">{lang === 'bn' ? 'থিম ও রূপরেখা' : 'Appearance / Theme'}</p>
        <div className="settings-group settings-group-modern">
          <div className="settings-item settings-item-stack" style={{ cursor: 'default' }}>
            <div className="settings-stack-head">
              <div className="settings-item-left">
                <div className="settings-item-icon" style={{ background: 'var(--clr-accent-dim)', fontSize: 16 }}>🎨</div>
                <span className="settings-item-label">
                  {lang === 'bn' ? 'থিম নির্বাচন করুন' : 'Theme Preference'}
                </span>
              </div>
              <span className="settings-current-value">
                {theme === 'system' 
                  ? (lang === 'bn' ? 'সিস্টেম ডিফল্ট' : 'System Default')
                  : (theme === 'dark' ? (lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode') : (lang === 'bn' ? 'লাইট মোড' : 'Light Mode'))}
              </span>
            </div>

            <div className="settings-theme-grid">
              <button
                type="button"
                className={`chip settings-theme-chip ${theme === 'system' ? 'active' : ''}`}
                onClick={() => setTheme('system')}
              >
                💻 {lang === 'bn' ? 'সিস্টেম' : 'System'}
              </button>
              <button
                type="button"
                className={`chip settings-theme-chip ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                🌙 {lang === 'bn' ? 'ডার্ক' : 'Dark'}
              </button>
              <button
                type="button"
                className={`chip settings-theme-chip ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                ☀️ {lang === 'bn' ? 'লাইট' : 'Light'}
              </button>
            </div>
          </div>
        </div>

        {/* PWA App Installation Card */}
        <p className="settings-section-title">{t('pwa_settings_card_title')}</p>
        <div className="settings-group settings-group-modern">
          <div
            id="settings-pwa-install"
            className="settings-item"
            style={{ cursor: 'pointer' }}
            onClick={async () => {
              if (isStandalone) {
                toast.success(t('pwa_installed_badge'));
              } else if (canPromptNative) {
                await promptInstall();
              } else {
                setShowPwaModal(true);
              }
            }}
          >
            <div className="settings-item-left">
              <div className="settings-item-icon" style={{ background: 'linear-gradient(135deg, rgba(88, 166, 255, 0.2), rgba(37, 208, 165, 0.2))', fontSize: 18 }}>📲</div>
              <div>
                <p className="settings-item-label">{t('pwa_install_title')}</p>
                <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', marginTop: 2 }}>{t('pwa_settings_card_desc')}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`badge ${isStandalone ? 'badge-green' : 'badge-amber'}`}>
                {isStandalone ? t('pwa_installed_badge') : t('pwa_install_btn')}
              </span>
              <ChevronRight />
            </div>
          </div>
        </div>

        {/* Outlet names */}
        {deviceId && (
          <>
            <p className="settings-section-title">{t('settings_rename_header')}</p>
            <div className="settings-group settings-group-modern">
              {Array.from({ length: numPlugs }, (_, i) => i + 1).map((n) => (
                <div key={n} className="settings-item" style={{ cursor: 'default' }}>
                  {renamingPlug === n ? (
                    <div className="settings-rename-row">
                      <input
                        autoFocus
                        className="form-input"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if(e.key==='Enter') commitRename(n); if(e.key==='Escape') setRenamingPlug(null); }}
                        maxLength={20}
                        style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => commitRename(n)}>{t('save')}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setRenamingPlug(null)}>{t('cancel')}</button>
                    </div>
                  ) : (
                    <>
                      <div className="settings-item-left">
                        <div className="settings-item-icon" style={{ background: 'var(--clr-accent-dim)', fontSize: 16 }}>🔌</div>
                        <span className="settings-item-label">
                          {lang === 'bn' ? `প্লাগ ${n}` : `Plug ${n}`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="settings-item-value">{plugLabels[n]}</span>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => startRename(n)}
                        >
                          {t('settings_rename_btn')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Account settings */}
        {isEmailUser && (
          <>
            <p className="settings-section-title">{t('settings_account')}</p>
            <div className="settings-group settings-group-modern">
              <div
                id="settings-change-password"
                className="settings-item"
                onClick={() => setShowChangePw(true)}
              >
                <div className="settings-item-left">
                  <div className="settings-item-icon" style={{ background: 'var(--clr-surface-3)' }}>🔒</div>
                  <span className="settings-item-label">{t('settings_change_pw')}</span>
                </div>
                <ChevronRight />
              </div>
            </div>
          </>
        )}

        {/* Device */}
        <p className="settings-section-title">{lang === 'bn' ? 'ডিভাইস' : 'Device'}</p>
        {deviceId ? (
          <div className="settings-group settings-group-modern">
            <div className="settings-item" style={{ cursor: 'default' }}>
              {renamingDevice ? (
                <div className="settings-rename-row" style={{ width: '100%' }}>
                  <input
                    autoFocus
                    className="form-input"
                    value={deviceRenameValue}
                    onChange={e => setDeviceRenameValue(e.target.value)}
                    onKeyDown={e => { if(e.key==='Enter') commitDeviceRename(); if(e.key==='Escape') setRenamingDevice(false); }}
                    maxLength={30}
                    style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={commitDeviceRename}>{t('save')}</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setRenamingDevice(false)}>{t('cancel')}</button>
                </div>
              ) : (
                <>
                  <div className="settings-item-left">
                    <div className="settings-item-icon" style={{ background: 'var(--clr-green-dim)' }}>🔌</div>
                    <div>
                      <p className="settings-item-label">{device?.name || 'Smart Multi-Plug'}</p>
                      <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', fontFamily: 'var(--font-mono)' }}>{deviceId}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={startDeviceRename}
                    >
                      {lang === 'bn' ? 'নাম পরিবর্তন' : 'Rename'}
                    </button>
                    <span className="badge badge-green">
                      {lang === 'bn' ? 'সংযুক্ত' : 'Paired'}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div
              id="settings-pair-device"
              className="settings-item"
              onClick={() => navigate('/pair')}
            >
              <div className="settings-item-left">
                <div className="settings-item-icon" style={{ background: 'var(--clr-accent-dim)' }}>🔌</div>
                <span className="settings-item-label" style={{ color: 'var(--clr-accent)' }}>
                  {lang === 'bn' ? 'নতুন ডিভাইস যুক্ত করুন' : 'Pair New Device'}
                </span>
              </div>
              <ChevronRight />
            </div>

            <div
              id="settings-unpair-device"
              className="settings-item"
              onClick={() => setShowUnpair(true)}
            >
              <div className="settings-item-left">
                <div className="settings-item-icon" style={{ background: 'var(--clr-red-dim)' }}>🔗</div>
                <span className="settings-item-label" style={{ color: 'var(--clr-red)' }}>{t('settings_unpair_title')}</span>
              </div>
              <ChevronRight />
            </div>
          </div>
        ) : (
          <div className="settings-group settings-group-modern">
            <div
              id="settings-pair-device"
              className="settings-item"
              onClick={() => navigate('/pair')}
            >
              <div className="settings-item-left">
                <div className="settings-item-icon" style={{ background: 'var(--clr-accent-dim)' }}>🔌</div>
                <span className="settings-item-label" style={{ color: 'var(--clr-accent)' }}>
                  {lang === 'bn' ? 'নতুন ডিভাইস যুক্ত করুন' : 'Pair New Device'}
                </span>
              </div>
              <ChevronRight />
            </div>
          </div>
        )}
        {/* Pairing Requests (Owner only) */}
        {deviceId && !device?.is_shared && pairingRequests.length > 0 && (
          <>
            <p className="settings-section-title">
              {lang === 'bn' ? 'কানেক্ট করার অনুরোধ' : 'Pairing Requests'}
            </p>
            <div className="settings-group settings-group-modern">
              {pairingRequests.map((request) => (
                <div key={request.uid} className="settings-item" style={{ cursor: 'default' }}>
                  <div className="settings-item-left">
                    <div className="settings-item-icon" style={{ background: 'var(--clr-accent-dim)' }}>⏳</div>
                    <div>
                      <p className="settings-item-label">{request.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', fontFamily: 'var(--font-mono)' }}>{request.email}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAcceptRequest(request)}
                    >
                      {lang === 'bn' ? 'অনুমোদন করুন' : 'Accept'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRejectRequest(request.uid)}
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--clr-red)', border: 'none' }}
                    >
                      {lang === 'bn' ? 'বাতিল করুন' : 'Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Shared Members (Owner only) */}
        {deviceId && !device?.is_shared && (
          <>
            <p className="settings-section-title">
              {lang === 'bn' ? 'শেয়ার্ড মেম্বারস' : 'Shared Members'}
            </p>
            <div className="settings-group settings-group-modern">
              {sharedMembers.length > 0 ? (
                sharedMembers.map((member) => (
                  <div key={member.uid} className="settings-item" style={{ cursor: 'default' }}>
                    <div className="settings-item-left">
                      <div className="settings-item-icon" style={{ background: 'var(--clr-surface-3)' }}>👤</div>
                      <div>
                        <p className="settings-item-label">
                          {member.name && member.name !== member.email ? member.name : member.email}
                        </p>
                        {member.name && member.name !== member.email && (
                          <p style={{ fontSize: 12, color: 'var(--clr-text-subtle)' }}>
                            {member.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setMemberToRemove(member)}
                      style={{ color: 'var(--clr-red)' }}
                    >
                      {lang === 'bn' ? 'রিমুভ করুন' : 'Remove'}
                    </button>
                  </div>
                ))
              ) : (
                <div className="settings-item" style={{ cursor: 'default', justifyContent: 'center', padding: '20px' }}>
                  <p style={{ color: 'var(--clr-text-subtle)', fontSize: 13, textAlign: 'center' }}>
                    {lang === 'bn' 
                      ? 'কোনো অ্যাকাউন্ট বা ডিভাইসের সাথে শেয়ার করা হয়নি।' 
                      : 'This device is not shared with any other users.'}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Help & Instructions */}
        <p className="settings-section-title">{t('settings_help_title')}</p>
        <div className="settings-group settings-group-modern">
          {/* PDF Download */}
          <a
            id="settings-download-manual"
            href="/Smart_MultiPlug_User_Manual_Bangla.pdf"
            download="Smart_MultiPlug_User_Manual_Bangla.pdf"
            className="settings-item"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="settings-item-left">
              <div className="settings-item-icon" style={{ background: 'rgba(239,68,68,0.15)', fontSize: 16 }}>📄</div>
              <div>
                <span className="settings-item-label" style={{ color: 'var(--clr-accent)' }}>
                  {t('settings_download_manual')}
                </span>
                <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', marginTop: 2 }}>
                  Smart_MultiPlug_User_Manual_Bangla.pdf
                </p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </a>

          {/* Step-by-step instructions (collapsible) */}
          <HelpInstructions lang={lang} t={t} />
        </div>

        {/* Sign out */}
        <p className="settings-section-title">{lang === 'bn' ? 'অ্যাকাউন্ট অ্যাকশন' : 'Account Actions'}</p>
        <div className="settings-group settings-group-modern">
          <div
            id="settings-logout"
            className="settings-item"
            onClick={() => setShowLogout(true)}
          >
            <div className="settings-item-left">
              <div className="settings-item-icon" style={{ background: 'var(--clr-surface-3)' }}>🚪</div>
              <span className="settings-item-label">{t('settings_logout')}</span>
            </div>
            <ChevronRight />
          </div>
        </div>

        <p className="settings-version">
          Smart Multi-Plug v1.0
        </p>
      </div>

      {/* Modals */}
      <Modal
        show={showUnpair}
        title={t('settings_confirm_unpair_title')}
        body={t('settings_confirm_unpair_body').replace('{deviceName}', device?.name || 'Smart Multi-Plug').replace('{deviceId}', deviceId || '')}
        confirmLabel={unpairing ? (lang === 'bn' ? 'মুছে ফেলা হচ্ছে…' : 'Removing…') : t('settings_unpair_title')}
        cancelLabel={t('cancel')}
        danger
        onConfirm={handleUnpair}
        onCancel={() => setShowUnpair(false)}
      />

      <Modal
        show={showLogout}
        title={t('settings_confirm_logout_title')}
        body={t('settings_confirm_logout_body')}
        confirmLabel={t('settings_logout')}
        cancelLabel={t('cancel')}
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
      />

      <Modal
        show={!!memberToRemove}
        title={lang === 'bn' ? 'সদস্য মুছে ফেলুন' : 'Remove Member'}
        body={lang === 'bn' ? 'আপনি কি নিশ্চিত যে আপনি এই সদস্যকে মুছে ফেলতে চান? তারা আর এই ডিভাইসটি নিয়ন্ত্রণ করতে পারবেন না।' : 'Are you sure you want to remove this member? They will no longer be able to control this device.'}
        confirmLabel={lang === 'bn' ? 'মুছে ফেলুন' : 'Remove'}
        cancelLabel={t('cancel')}
        danger
        onConfirm={() => {
          if (memberToRemove) {
            handleRevokeAccess(memberToRemove.uid);
            setMemberToRemove(null);
          }
        }}
        onCancel={() => setMemberToRemove(null)}
      />

      <ChangePasswordModal show={showChangePw} onClose={() => setShowChangePw(false)} lang={lang} t={t} />

      {showPwaModal && (
        <PwaInstallRecommendation forceShow={true} onCloseModal={() => setShowPwaModal(false)} />
      )}
    </div>
  );
}
