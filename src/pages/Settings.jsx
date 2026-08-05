import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
import { useLanguage } from '../contexts/LanguageContext';
import { updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth, db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { ref, remove, update } from 'firebase/database';
import toast from 'react-hot-toast';

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function Modal({ show, title, body, onConfirm, onCancel, confirmLabel, cancelLabel, danger = false }) {
  if (!show) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
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

async function unpairDeviceDirectly(deviceId, uid) {
  const deviceRef = ref(db, `devices/${deviceId}`);
  const userDeviceRef = ref(db, `users/${uid}/devices/${deviceId}`);

  await update(deviceRef, {
    claimed_by: null,
    claimed_at: null,
  });
  await remove(userDeviceRef);
}

function ChangePasswordModal({ show, onClose, lang, t }) {
  const [current, setCurrent]   = useState('');
  const [newPass, setNewPass]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);

  if (!show) return null;

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
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

export default function Settings() {
  const { user, logout }           = useAuth();
  const { device, deviceId, plugLabels, updatePlugLabel, clearDevice } = useDevice();
  const { lang, setLang, t }       = useLanguage();
  const navigate                   = useNavigate();

  const [showUnpair, setShowUnpair]     = useState(false);
  const [showLogout, setShowLogout]     = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
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

  const handleUnpair = async () => {
    setUnpairing(true);
    try {
      if (functions) {
        try {
          const unclaimDevice = httpsCallable(functions, 'unclaimDevice');
          await unclaimDevice({ deviceId });
        } catch (err) {
          if (['functions/not-found', 'functions/internal', 'functions/unavailable'].includes(err.code)) {
            await unpairDeviceDirectly(deviceId, user.uid);
          } else {
            throw err;
          }
        }
      } else {
        await unpairDeviceDirectly(deviceId, user.uid);
      }

      toast.success(lang === 'bn' ? 'আপনার অ্যাকাউন্ট থেকে ডিভাইসটি মুছে ফেলা হয়েছে।' : 'Device removed from your account.');
      clearDevice();
      navigate('/pair');
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

      <div className="container" style={{ paddingTop: 24, paddingBottom: 120 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>{t('settings_title')}</h1>

        {/* Account info card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(79,142,247,0.12), rgba(124,90,244,0.08))',
          border: '1px solid rgba(79,142,247,0.2)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--clr-accent), #7c5af4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {(user?.displayName || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.displayName || (lang === 'bn' ? 'আমার অ্যাকাউন্ট' : 'My Account')}
            </p>
            <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </p>
          </div>
        </div>

        {/* App Language */}
        <p className="settings-section-title">{lang === 'bn' ? 'অ্যাপের ভাষা' : 'App Language'}</p>
        <div className="settings-group" style={{ marginBottom: 28 }}>
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
                বাংলা
              </button>
              <button
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
              >
                English
              </button>
            </div>
          </div>
        </div>

        {/* Outlet names */}
        {deviceId && (
          <>
            <p className="settings-section-title">{t('settings_rename_header')}</p>
            <div className="settings-group">
              {[1,2,3,4].map((n) => (
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
            <div className="settings-group">
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
          <div className="settings-group">
            <div className="settings-item" style={{ cursor: 'default' }}>
              <div className="settings-item-left">
                <div className="settings-item-icon" style={{ background: 'var(--clr-green-dim)' }}>🔌</div>
                <div>
                  <p className="settings-item-label">Smart Multi-Plug</p>
                  <p style={{ fontSize: 11, color: 'var(--clr-text-subtle)', fontFamily: 'var(--font-mono)' }}>{deviceId}</p>
                </div>
              </div>
              <span className="badge badge-green">
                {lang === 'bn' ? 'সংযুক্ত' : 'Paired'}
              </span>
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
          <div className="settings-group">
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

        {/* Sign out */}
        <p className="settings-section-title">{lang === 'bn' ? 'অ্যাকাউন্ট অ্যাকশন' : 'Account Actions'}</p>
        <div className="settings-group">
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

        <p style={{ fontSize: 12, color: 'var(--clr-text-subtle)', textAlign: 'center', marginTop: 32 }}>
          Smart Multi-Plug v1.0
        </p>
      </div>

      {/* Modals */}
      <Modal
        show={showUnpair}
        title={t('settings_confirm_unpair_title')}
        body={t('settings_confirm_unpair_body')}
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

      <ChangePasswordModal show={showChangePw} onClose={() => setShowChangePw(false)} lang={lang} t={t} />
    </div>
  );
}
