import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
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
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors]       = useState({});

  const validate = () => {
    const e = {};
    if (!email)                   e.email    = lang === 'bn' ? 'ইমেইল আবশ্যক' : 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = lang === 'bn' ? 'সঠিক ইমেইল ঠিকানা দিন' : 'Enter a valid email';
    if (!password)                e.password = lang === 'bn' ? 'পাসওয়ার্ড আবশ্যক' : 'Password is required';
    else if (password.length < 6) e.password = lang === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' : 'Password must be at least 6 characters';
    if (!confirm)                 e.confirm  = lang === 'bn' ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Please confirm your password';
    else if (confirm !== password) e.confirm = lang === 'bn' ? 'পাসওয়ার্ড দুটি মেলেনি' : 'Passwords do not match';
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
        ? (lang === 'bn' ? 'এই ইমেইলটি ইতিমধ্যে ব্যবহার করা হয়েছে। লগইন করার চেষ্টা করুন।' : 'This email is already registered. Try signing in instead.')
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

      {/* Header */}
      <header className="auth-header">
        <div className="auth-header-content">
          <div className="auth-brand">
            <span className="auth-brand-logo">🔌</span>
            <span className="auth-brand-name">{t('login_title')}</span>
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
      </header>

      <div className="auth-container" style={{ maxWidth: '460px' }}>
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-icon">🔌</div>
            <div>
              <p className="auth-title">{lang === 'bn' ? 'নতুন অ্যাকাউন্ট' : 'Create Account'}</p>
              <p className="auth-subtitle">{t('signup_subtitle')}</p>
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
              <label className="form-label" htmlFor="signup-email">{t('login_email')}</label>
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
              <label className="form-label" htmlFor="signup-password">{t('login_password')}</label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder={lang === 'bn' ? 'কমপক্ষে ৬ অক্ষর' : 'At least 6 characters'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors.password && <span className="form-error">⚠ {errors.password}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="signup-confirm">{t('signup_confirm')}</label>
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
              {loading ? <span className="spinner" /> : t('signup_btn')}
            </button>
          </form>

          <div className="divider" style={{ margin: '20px 0' }}>{t('login_or')}</div>

          <button
            id="signup-google"
            type="button"
            className="btn-google"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? <span className="spinner" /> : <><GoogleIcon /> {t('login_google')}</>}
          </button>

          <p className="auth-footer">
            {t('signup_has_acc')}{' '}
            <Link to="/login" className="auth-link">{t('signup_login_link')}</Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="auth-footer">
        <div className="auth-footer-content">
          <div className="auth-footer-links">
            <a href="mailto:support@smartmultiplug.com">{lang === 'bn' ? 'সহায়তা' : 'Support'}</a>
            <span style={{ color: 'var(--clr-border)' }}>|</span>
            <a href="#privacy">{lang === 'bn' ? 'গোপনীয়তা নীতি' : 'Privacy Policy'}</a>
            <span style={{ color: 'var(--clr-border)' }}>|</span>
            <a href="#terms">{lang === 'bn' ? 'ব্যবহারের শর্তাবলী' : 'Terms of Service'}</a>
          </div>
          <p className="auth-footer-text">
            {lang === 'bn'
              ? '© ২০২৬ স্মার্ট মাল্টি-প্লাগ। সর্বস্বত্ব সংরক্ষিত।'
              : '© 2026 Smart Multi-Plug. All rights reserved.'}
          </p>
        </div>
      </footer>
    </div>
  );
}
