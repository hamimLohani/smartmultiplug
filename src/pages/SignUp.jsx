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

export default function SignUp() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors]       = useState({});

  const validate = () => {
    const e = {};
    if (!email)                   e.email    = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password)                e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters';
    if (!confirm)                 e.confirm  = 'Please confirm your password';
    else if (confirm !== password) e.confirm = 'Passwords do not match';
    return e;
  };

  const handleSignUp = async (ev) => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setErrors({});
    try {
      await register(email, password);
      navigate('/pair');
    } catch (err) {
      console.error('Registration failed:', err);
      const msg = err.code === 'auth/email-already-in-use'
        ? 'This email is already registered. Try signing in instead.'
        : `Registration failed: ${err.message || 'Please try again.'}`;
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

  return (
    <div className="auth-page">
      <div className="bg-mesh" />

      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🔌</div>
          <div>
            <p className="auth-title">Create Account</p>
            <p className="auth-subtitle">Start controlling your smart plugs</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSignUp} noValidate>
          {errors.general && (
            <div
              className="badge badge-red"
              style={{ justifyContent: 'center', padding: '10px 14px', borderRadius: 'var(--radius-md)', width: '100%' }}
            >
              ⚠️ {errors.general}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
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
            <label className="form-label" htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password && <span className="form-error">⚠ {errors.password}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-confirm">Confirm Password</label>
            <input
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              className={`form-input ${errors.confirm ? 'error' : ''}`}
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {errors.confirm && <span className="form-error">⚠ {errors.confirm}</span>}
          </div>

          <button
            id="signup-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <div className="divider" style={{ margin: '20px 0' }}>or</div>

        <button
          id="signup-google"
          type="button"
          className="btn-google"
          onClick={handleGoogle}
          disabled={googleLoading}
        >
          {googleLoading ? <span className="spinner" /> : <><GoogleIcon /> Continue with Google</>}
        </button>

        <p className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
