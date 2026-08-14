import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DeviceProvider, useDevice } from './contexts/DeviceContext';
import { LanguageProvider } from './contexts/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import TabBar from './components/TabBar';

import PwaInstallRecommendation from './components/PwaInstallRecommendation';

import Login      from './pages/Login';
import SignUp     from './pages/SignUp';
import PairDevice from './pages/PairDevice';
import Dashboard  from './pages/Dashboard';
import Timers     from './pages/Timers';
import Settings   from './pages/Settings';
import { isFirebaseConfigured } from './firebase';

function SetupGuide() {
  return (
    <div className="auth-page" style={{ justifyContent: 'center' }}>
      <div className="bg-mesh" />
      <div className="auth-card" style={{ maxWidth: 500, animation: 'slideUp 0.4s cubic-bezier(0.4,0,0.2,1) both' }}>
        <div className="auth-logo" style={{ marginBottom: 24 }}>
          <div className="auth-logo-icon">🔌</div>
          <div>
            <h1 className="auth-title" style={{ fontSize: 24 }}>Smart Multi-Plug</h1>
            <p className="auth-subtitle" style={{ fontSize: 14 }}>Web Dashboard Setup</p>
          </div>
        </div>

        <div className="inline-notice" style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 16 }}>🛠️</span>
          <span><strong>Configuration required:</strong> Environment variables for Firebase and MQTT are missing or incomplete.</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--clr-text-muted)', lineHeight: 1.6, animation: 'slideUp 0.4s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.1s' }}>
            Please follow these quick steps to launch the app:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="pwa-step-card" style={{ animation: 'slideUp 0.4s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.2s' }}>
              <div className="pwa-step-num">1</div>
              <div className="pwa-step-text">
                <strong>Create a configuration file:</strong>
                <div style={{
                  background: 'var(--clr-surface-2)',
                  border: '1px solid var(--clr-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  marginTop: 6,
                  color: 'var(--clr-text-muted)',
                }}>
                  cp .env.example .env
                </div>
              </div>
            </div>

            <div className="pwa-step-card" style={{ animation: 'slideUp 0.4s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.3s' }}>
              <div className="pwa-step-num">2</div>
              <div className="pwa-step-text">
                <strong>Open the newly created <code>.env</code> file</strong> in your editor.
              </div>
            </div>

            <div className="pwa-step-card" style={{ animation: 'slideUp 0.4s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.4s' }}>
              <div className="pwa-step-num">3</div>
              <div className="pwa-step-text">
                <strong>Fill in your Firebase credentials</strong> and your MQTT broker WebSocket credentials.
              </div>
            </div>

            <div className="pwa-step-card" style={{ animation: 'slideUp 0.4s cubic-bezier(0.4,0,0.2,1) both', animationDelay: '0.5s' }}>
              <div className="pwa-step-num">4</div>
              <div className="pwa-step-text">
                <strong>Restart your development server</strong> by stopping the current terminal process and running <code>npm run dev</code> again.
              </div>
            </div>
          </div>

          <div style={{
            marginTop: 4,
            padding: '12px 16px',
            background: 'var(--clr-surface-2)',
            border: '1px solid var(--clr-border)',
            borderRadius: 'var(--radius-lg)',
            fontSize: 13,
            color: 'var(--clr-text-muted)',
            animation: 'slideUp 0.4s cubic-bezier(0.4,0,0.2,1) both', 
            animationDelay: '0.6s'
          }}>
            ℹ️ Read the <strong>README.md</strong> file in the workspace directory for detailed setup instructions.
          </div>
        </div>
      </div>
    </div>
  );
}

/* Shows the tab bar only on authenticated, paired routes */
function AppShell() {
  const { user, loading: authLoading } = useAuth();
  const { loading: devLoading } = useDevice();
  const showTabs = user && !authLoading && !devLoading;

  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/login"  element={<Login  />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Needs auth but NOT a paired device (fresh users land here) */}
        <Route
          path="/pair"
          element={
            <ProtectedRoute>
              <PairDevice />
            </ProtectedRoute>
          }
        />

        {/* Needs auth + optional paired device */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/timers"
          element={
            <ProtectedRoute>
              <Timers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showTabs && <TabBar />}
      <PwaInstallRecommendation />
    </>
  );
}

export default function App() {
  if (!isFirebaseConfigured) {
    return (
      <ThemeProvider>
        <LanguageProvider>
          <SetupGuide />
          <Toaster 
            position="top-center" 
            toastOptions={{
              duration: 3500,
              style: {
                background: 'var(--clr-surface-2)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                color:       'var(--clr-text)',
                border:      '1px solid var(--clr-border-md)',
                borderRadius:'var(--radius-md)',
                fontFamily:  'var(--font)',
                fontSize:    '14px',
                boxShadow:   'var(--shadow-md)',
                padding:     '12px 16px',
              },
              success: {
                iconTheme: { primary: 'var(--clr-green)', secondary: 'transparent' },
              },
              error: {
                iconTheme: { primary: 'var(--clr-red)', secondary: 'transparent' },
              },
            }}
          />
        </LanguageProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <DeviceProvider>
            <AppShell />

            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3500,
                style: {
                  background: 'var(--clr-surface-2)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color:       'var(--clr-text)',
                  border:      '1px solid var(--clr-border-md)',
                  borderRadius:'var(--radius-md)',
                  fontFamily:  'var(--font)',
                  fontSize:    '14px',
                  boxShadow:   'var(--shadow-md)',
                  padding:     '12px 16px',
                },
                success: {
                  iconTheme: { primary: 'var(--clr-green)', secondary: 'transparent' },
                },
                error: {
                  iconTheme: { primary: 'var(--clr-red)', secondary: 'transparent' },
                },
              }}
            />
          </DeviceProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
