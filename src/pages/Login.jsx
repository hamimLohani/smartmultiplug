import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [errors, setErrors]     = useState({});

  const validate = () => {
    const e = {};
    if (!email)    e.email    = 'Email is required';
    if (!password) e.password = 'Password is required';
    return e;
  };

  const handleLogin = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setErrors({});
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      console.error('Login failed:', err);
      const msg = err.code === 'auth/invalid-credential'
        ? 'Incorrect email or password'
        : `Login failed: ${err.message || 'Please try again.'}`;
      setErrors({ general: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error('Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleReset = async (ev) => {
    ev.preventDefault();
    if (!resetEmail) { toast.error('Enter your email address.'); return; }
    setResetLoading(true);
    try {
      const { resetPassword } = useAuth();
      // We'll import the function differently
      await import('../firebase').then(async () => {
        const { sendPasswordResetEmail } = await import('firebase/auth');
        const { auth } = await import('../firebase');
        await sendPasswordResetEmail(auth, resetEmail);
      });
      toast.success('Check your inbox for a reset link!');
      setShowReset(false);
    } catch {
      toast.error('Could not send reset email. Check the address and try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const { resetPassword } = useAuth();
  const handleResetClean = async (ev) => {
    ev.preventDefault();
    if (!resetEmail) { toast.error('Enter your email address.'); return; }
    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
      toast.success('Check your inbox for a reset link!');
      setShowReset(false);
    } catch {
      toast.error('Could not send reset email. Check the address and try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="bg-mesh" />

      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🔌</div>
          <div>
            <p className="auth-title">Smart Multi-Plug</p>
            <p className="auth-subtitle">Sign in to control your device</p>
          </div>
        </div>

        {!showReset ? (
          <>
            <form className="auth-form" onSubmit={handleLogin} noValidate>
              {errors.general && (
                <div className="badge badge-red" style={{ justifyContent: 'center', padding: '10px 14px', borderRadius: 'var(--radius-md)', width: '100%' }}>
                  ⚠️ {errors.general}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {errors.email && <span className="form-error">⚠ {errors.email}</span>}
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    className="auth-link"
                    style={{ fontSize: '12px', textTransform: 'none' }}
                    onClick={() => setShowReset(true)}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {errors.password && <span className="form-error">⚠ {errors.password}</span>}
              </div>

              <button
                id="login-submit"
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : 'Sign In'}
              </button>
            </form>

            <div className="divider" style={{ margin: '20px 0' }}>or</div>

            <button
              id="login-google"
              type="button"
              className="btn-google"
              onClick={handleGoogle}
              disabled={googleLoading}
            >
              {googleLoading ? <span className="spinner" /> : <><GoogleIcon /> Continue with Google</>}
            </button>

            <p className="auth-footer">
              Don't have an account?{' '}
              <Link to="/signup" className="auth-link">Create one</Link>
            </p>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleResetClean}>
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <p style={{ fontSize: '18px', fontWeight: 700 }}>Reset Password</p>
              <p style={{ fontSize: '14px', color: 'var(--clr-text-muted)', marginTop: '6px' }}>
                We'll send a reset link to your inbox.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">Email address</label>
              <input
                id="reset-email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={resetLoading}>
              {resetLoading ? <span className="spinner" /> : 'Send Reset Link'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-full"
              onClick={() => setShowReset(false)}
            >
              Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
