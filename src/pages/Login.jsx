
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';

import { useTheme } from '../contexts/ThemeContext';

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
  const { lang, setLang, t } = useLanguage();
  const { theme, setTheme, resolvedTheme } = useTheme();
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
    if (!email)    e.email    = t('login_email') + ' is required';
    if (!password) e.password = t('login_password') + ' is required';
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
        ? (lang === 'bn' ? 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়' : 'Incorrect email or password')
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

  const { resetPassword } = useAuth();
  const handleResetClean = async (ev) => {
    ev.preventDefault();
    if (!resetEmail) { toast.error(lang === 'bn' ? 'আপনার ইমেইল আইডি দিন।' : 'Enter your email address.'); return; }
    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
      toast.success(lang === 'bn' ? 'পাসওয়ার্ড রিসেটের লিংক পাঠানো হয়েছে!' : 'Check your inbox for a reset link!');
      setShowReset(false);
    } catch {
      toast.error(lang === 'bn' ? 'ইমেইল পাঠানো যায়নি। আবার চেষ্টা করুন।' : 'Could not send reset email. Check the address and try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="bg-mesh" />

      {/* Header */}
      <header className="auth-header">
        <div className="auth-header-content">
          <div className="auth-brand">
            <img
              src="/logo.png"
              alt="Smart Multi-Plug Logo"
              style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-sm)',
                objectFit: 'cover',
                boxShadow: 'var(--shadow-accent)',
              }}
            />
            <span className="auth-brand-name">{t('login_title')}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Quick Theme Switcher Button */}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              title={lang === 'bn' ? 'থিম পরিবর্তন করুন' : 'Toggle Theme'}
              style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--clr-border)', fontSize: 13 }}
            >
              {resolvedTheme === 'dark' ? '🌙' : '☀️'}
            </button>

            {/* Language Switcher */}
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
      </header>

      <div className="auth-container">
        {/* Step-by-Step Onboarding Guide Card */}
        <div className="card guide-card" style={{ padding: '24px 28px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📖</span>
            {lang === 'bn' ? 'কিভাবে সেটআপ ও ব্যবহার করবেন?' : 'How to Setup & Use?'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--clr-text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
            {lang === 'bn' 
              ? 'আপনার স্মার্ট মাল্টি-প্লাগটি প্রথমবার সেটআপ করার জন্য নিচের ধাপগুলো মনোযোগ দিয়ে অনুসরণ করুন:' 
              : 'Follow these detailed steps to set up and start using your smart multi-plug strip:'}
          </p>

          <div className="setup-steps-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Step 1 */}
            <div className="step-item" style={{ display: 'flex', gap: '14px' }}>
              <div className="step-number" style={{
                background: 'var(--clr-accent-dim)',
                color: 'var(--clr-accent)',
                width: '28px',
                height: '28px',
                minWidth: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px'
              }}>1</div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                  {lang === 'bn' ? 'পাওয়ার অন করুন (Power On)' : 'Power On the Plug'}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--clr-text-muted)', lineHeight: '1.5' }}>
                  {lang === 'bn'
                    ? 'মাল্টি-প্লাগটির মেইন তারটি দেওয়ালের বৈদ্যুতিক সকেটে লাগান। প্লাগের ডিসপ্লে অথবা ইন্ডিকেটর লাল লাইটটি জ্বলে উঠবে।'
                    : 'Plug the multi-plug strip into a wall socket. The OLED screen or status LED on the front will light up.'}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="step-item" style={{ display: 'flex', gap: '14px' }}>
              <div className="step-number" style={{
                background: 'var(--clr-accent-dim)',
                color: 'var(--clr-accent)',
                width: '28px',
                height: '28px',
                minWidth: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px'
              }}>2</div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                  {lang === 'bn' ? 'মেনু ও ডিসপ্লে (Navigate Screen)' : 'Understand Screen & Menu'}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--clr-text-muted)', lineHeight: '1.5' }}>
                  {lang === 'bn'
                    ? 'ডিসপ্লে স্ক্রিনে আপনার মাল্টি-প্লাগের অন/অফ অবস্থা এবং নেটওয়ার্ক স্ট্যাটাস দেখতে পাবেন। ডিসপ্লের নিচে ৩টি বোতাম (Up/Down/OK) চেপে স্ক্রিন মেনুতে ঘোরাঘুরি করতে পারবেন।'
                    : 'The OLED screen shows the live state of each outlet. Use the 3 buttons (Up, Down, OK) below the screen to explore settings.'}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="step-item" style={{ display: 'flex', gap: '14px' }}>
              <div className="step-number" style={{
                background: 'var(--clr-accent-dim)',
                color: 'var(--clr-accent)',
                width: '28px',
                height: '28px',
                minWidth: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px'
              }}>3</div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                  {lang === 'bn' ? 'প্লাগের নিজস্ব ওয়াইফাই কানেক্ট করুন (Plug WiFi)' : 'Connect to Plug Hotspot'}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--clr-text-muted)', lineHeight: '1.5' }}>
                  {lang === 'bn'
                    ? 'আপনার মোবাইল ফোনের WiFi চালু করুন। সেখানে "SP4-XXXX" (অথবা SP2/SP3) নামের একটি নতুন ওয়াইফাই দেখতে পাবেন। এটিতে ক্লিক করে কানেক্ট করুন (কোনো পাসওয়ার্ড লাগবে না)।'
                    : 'Turn on your mobile WiFi settings. Connect to the hotspot named "SP4-XXXX" (or SP2-XXXX / SP3-XXXX). No password is required.'}
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="step-item" style={{ display: 'flex', gap: '14px' }}>
              <div className="step-number" style={{
                background: 'var(--clr-accent-dim)',
                color: 'var(--clr-accent)',
                width: '28px',
                height: '28px',
                minWidth: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px'
              }}>4</div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                  {lang === 'bn' ? 'বাসার ওয়াইফাইয়ের সাথে প্লাগ কানেক্ট করুন (Setup Internet)' : 'Setup Home WiFi'}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--clr-text-muted)', lineHeight: '1.5' }}>
                  {lang === 'bn'
                    ? 'প্লাগের ওয়াইফাই কানেক্ট করার পর আপনার মোবাইলে অটোমেটিক একটি সেটআপ পেজ খুলবে। পেজটি না আসলে ব্রাউজারে "192.168.4.1" লিখে গো (Go) চাপুন। সেখানে আপনার বাসার ওয়াইফাই সিলেক্ট করে পাসওয়ার্ড দিন এবং "Save" বাটনে ক্লিক করুন। প্লাগটি আপনার বাসার ইন্টারনেটে কানেক্ট হয়ে যাবে।'
                    : 'After connecting to the hotspot, a settings page will auto-open. If it does not, open a browser and go to "192.168.4.1". Select your home WiFi SSID, type the password, and click "Save". The plug will connect to your home internet.'}
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="step-item" style={{ display: 'flex', gap: '14px' }}>
              <div className="step-number" style={{
                background: 'var(--clr-accent-dim)',
                color: 'var(--clr-accent)',
                width: '28px',
                height: '28px',
                minWidth: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px'
              }}>5</div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                  {lang === 'bn' ? 'সিকিউরিটি কোড সংগ্রহ করুন (Security Code)' : 'Get Security Code'}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--clr-text-muted)', lineHeight: '1.5' }}>
                  {lang === 'bn'
                    ? 'ডিসপ্লে মডেলে: প্লাগের বোতাম চেপে Menu → App Connect-এ যান। সেখানে "Device ID" এবং "Security Code" (৮ সংখ্যার কোড) দেখতে পাবেন। ডিসপ্লে না থাকলে: প্লাগের বডি বা পেছনের স্টিকারে কোডটি লেখা পাবেন।'
                    : 'With Screen: Press the OK button on the strip, navigate to Menu → App Connect. Copy the "Device ID" and "Security Code" (8 digits). Without Screen: Look at the printed sticker on the back of the plug casing.'}
                </p>
              </div>
            </div>

            {/* Step 6 */}
            <div className="step-item" style={{ display: 'flex', gap: '14px' }}>
              <div className="step-number" style={{
                background: 'var(--clr-accent-dim)',
                color: 'var(--clr-accent)',
                width: '28px',
                height: '28px',
                minWidth: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px'
              }}>6</div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                  {lang === 'bn' ? 'অ্যাকাউন্টে প্লাগ কানেক্ট করুন (App Connect)' : 'Pair with this Website'}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--clr-text-muted)', lineHeight: '1.5' }}>
                  {lang === 'bn'
                    ? 'ডানপাশের ফর্ম থেকে এই ওয়েবসাইটে লগইন বা নতুন অ্যাকাউন্ট খুলুন। লগইন করার পর প্লাগ কানেক্ট (Pair) করার পেজে গিয়ে প্লাগের আইডি (ID) এবং সিকিউরিটি কোডটি বসিয়ে সাবমিট করুন।'
                    : 'Register/Sign In using the form on the right. Once logged in, go to the "Pair Device" screen, enter your Device ID & Security Code, and confirm.'}
                </p>
              </div>
            </div>

            {/* Step 7 */}
            <div className="step-item" style={{ display: 'flex', gap: '14px' }}>
              <div className="step-number" style={{
                background: 'var(--clr-accent-dim)',
                color: 'var(--clr-accent)',
                width: '28px',
                height: '28px',
                minWidth: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '14px'
              }}>7</div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>
                  {lang === 'bn' ? 'মোবাইল দিয়ে প্লাগ নিয়ন্ত্রণ করুন (App Control)' : 'Control & Automate'}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--clr-text-muted)', lineHeight: '1.5' }}>
                  {lang === 'bn'
                    ? 'প্লাগ কানেক্ট হয়ে গেলে ড্যাশবোর্ড থেকে প্রতিটি সকেট অন/অফ করতে পারবেন। এছাড়া টাইমার ও শিডিউল অপশনে গিয়ে সকেটগুলোর জন্য অটো-অফ বা সময়সূচী সেট করতে পারবেন।'
                    : 'Once paired, use your mobile dashboard to toggle outlets instantly. You can also name your outlets, set countdown delay timers, or schedule auto ON/OFF times.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Login / Reset Password Card */}
        <div className="auth-card">
          <div className="auth-logo">
            <img
              src="/logo.png"
              alt="Smart Multi-Plug Logo"
              style={{
                width: 68,
                height: 68,
                borderRadius: 20,
                objectFit: 'cover',
                boxShadow: 'var(--shadow-accent)',
                marginBottom: 8,
              }}
            />
            <div style={{ textAlign: 'center' }}>
              <p className="auth-title" style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, var(--clr-text), var(--clr-text-muted))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.2,
              }}>
                {t('login_title')}
              </p>
              <p className="auth-subtitle" style={{ fontSize: 14, color: 'var(--clr-text-muted)', marginTop: 6 }}>
                {t('login_subtitle')}
              </p>
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
                  <label className="form-label" htmlFor="login-email">{t('login_email')}</label>
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
                    <label className="form-label" htmlFor="login-password">{t('login_password')}</label>
                    <button
                      type="button"
                      className="auth-link"
                      style={{ fontSize: '12px', textTransform: 'none' }}
                      onClick={() => setShowReset(true)}
                    >
                      {t('login_forgot')}
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
                  {loading ? <span className="spinner" /> : t('login_btn')}
                </button>
              </form>

              <div className="divider" style={{ margin: '20px 0' }}>{t('login_or')}</div>

              <button
                id="login-google"
                type="button"
                className="btn-google"
                onClick={handleGoogle}
                disabled={googleLoading}
              >
                {googleLoading ? <span className="spinner" /> : <><GoogleIcon /> {t('login_google')}</>}
              </button>

              <p className="auth-footer">
                {t('login_no_acc')}{' '}
                <Link to="/signup" className="auth-link">{t('login_create_acc')}</Link>
              </p>
            </>
          ) : (
            <form className="auth-form" onSubmit={handleResetClean}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <p style={{ fontSize: '18px', fontWeight: 700 }}>{t('reset_title')}</p>
                <p style={{ fontSize: '14px', color: 'var(--clr-text-muted)', marginTop: '6px' }}>
                  {t('reset_desc')}
                </p>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-email">{t('login_email')}</label>
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
                {resetLoading ? <span className="spinner" /> : t('reset_btn')}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-full"
                onClick={() => setShowReset(false)}
              >
                {t('reset_back')}
              </button>
            </form>
          )}
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
