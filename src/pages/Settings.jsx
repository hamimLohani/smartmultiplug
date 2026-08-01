import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDevice } from '../contexts/DeviceContext';
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

function Modal({ show, title, body, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
  if (!show) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <p className="modal-title">{title}</p>
        <p className="modal-body">{body}</p>
        <div className="modal-actions">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            style={{ flex: 1 }}
            onClick={onConfirm}
          >
            {confirmLabel}
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

function ChangePasswordModal({ show, onClose }) {
  const [current, setCurrent]   = useState('');
  const [newPass, setNewPass]   = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);

  if (!show) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPass.length < 6)    { toast.error('Password must be at least 6 characters.'); return; }
    if (newPass !== confirm)   { toast.error('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, current);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPass);
      toast.success('Password updated successfully!');
      onClose();
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        toast.error('Current password is incorrect.');
      } else {
        toast.error('Failed to update password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <p className="modal-title">Change Password</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-current">Current Password</label>
            <input id="cp-current" type="password" className="form-input" placeholder="••••••••" value={current} onChange={e => setCurrent(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-new">New Password</label>
            <input id="cp-new" type="password" className="form-input" placeholder="At least 6 characters" value={newPass} onChange={e => setNewPass(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cp-confirm">Confirm New Password</label>
            <input id="cp-confirm" type="password" className="form-input" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          <div className="modal-actions" style={{ marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Update'}
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

      toast.success('Device removed from your account.');
      clearDevice();
      navigate('/pair');
    } catch (err) {
      console.error('Failed to unpair device:', err);
      toast.error('Failed to remove device. Please try again.');
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
      toast.error('Logout failed. Please try again.');
    }
  };

  const isEmailUser = user?.providerData?.[0]?.providerId === 'password';

  return (
    <div className="page-wrap">
      <div className="bg-mesh" />

      <div className="container" style={{ paddingTop: 24, paddingBottom: 120 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Settings</h1>

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
              {user?.displayName || 'My Account'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </p>
          </div>
        </div>

        {/* Outlet names */}
        {deviceId && (
          <>
            <p className="settings-section-title">Outlet Names</p>
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
                      <button className="btn btn-primary btn-sm" onClick={() => commitRename(n)}>Save</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setRenamingPlug(null)}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div className="settings-item-left">
                        <div className="settings-item-icon" style={{ background: 'var(--clr-accent-dim)', fontSize: 16 }}>🔌</div>
                        <span className="settings-item-label">Plug {n}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="settings-item-value">{plugLabels[n]}</span>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => startRename(n)}
                        >
                          Rename
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
            <p className="settings-section-title">Account</p>
            <div className="settings-group">
              <div
                id="settings-change-password"
                className="settings-item"
                onClick={() => setShowChangePw(true)}
              >
                <div className="settings-item-left">
                  <div className="settings-item-icon" style={{ background: 'var(--clr-surface-3)' }}>🔒</div>
                  <span className="settings-item-label">Change Password</span>
                </div>
                <ChevronRight />
              </div>
            </div>
          </>
        )}

        {/* Device */}
        <p className="settings-section-title">Device</p>
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
              <span className="badge badge-green">Paired</span>
            </div>

            <div
              id="settings-unpair-device"
              className="settings-item"
              onClick={() => setShowUnpair(true)}
            >
              <div className="settings-item-left">
                <div className="settings-item-icon" style={{ background: 'var(--clr-red-dim)' }}>🔗</div>
                <span className="settings-item-label" style={{ color: 'var(--clr-red)' }}>Remove Device</span>
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
                <span className="settings-item-label" style={{ color: 'var(--clr-accent)' }}>Pair New Device</span>
              </div>
              <ChevronRight />
            </div>
          </div>
        )}

        {/* Sign out */}
        <p className="settings-section-title">Account Actions</p>
        <div className="settings-group">
          <div
            id="settings-logout"
            className="settings-item"
            onClick={() => setShowLogout(true)}
          >
            <div className="settings-item-left">
              <div className="settings-item-icon" style={{ background: 'var(--clr-surface-3)' }}>🚪</div>
              <span className="settings-item-label">Sign Out</span>
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
        title="Remove Device?"
        body={`This will disconnect your Smart Multi-Plug from your account. The device can be paired again with a new code. Your outlet schedules will be deleted.`}
        confirmLabel={unpairing ? 'Removing…' : 'Remove Device'}
        danger
        onConfirm={handleUnpair}
        onCancel={() => setShowUnpair(false)}
      />

      <Modal
        show={showLogout}
        title="Sign Out?"
        body="You'll need to sign in again to control your device."
        confirmLabel="Sign Out"
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
      />

      <ChangePasswordModal show={showChangePw} onClose={() => setShowChangePw(false)} />
    </div>
  );
}
