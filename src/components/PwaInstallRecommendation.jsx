import React, { useState } from 'react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';

export default function PwaInstallRecommendation({ forceShow = false, onCloseModal = null }) {
  const { isStandalone, canPromptNative, isIos, isDismissed, promptInstall, dismissPrompt } = usePwaInstall();
  const { t } = useLanguage();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // If app is already running in standalone mode (installed), don't show prompt
  if (isStandalone && !forceShow) {
    return null;
  }

  // If user dismissed the prompt and forceShow is not set, don't display
  if (isDismissed && !forceShow && !showGuideModal) {
    return null;
  }

  const handleInstallClick = async () => {
    const res = await promptInstall();
    if (res?.outcome === 'accepted') {
      toast.success(t('pwa_installed_badge'));
      if (onCloseModal) onCloseModal();
    } else if (res?.outcome === 'manual_guide' || !canPromptNative) {
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    dismissPrompt();
    if (onCloseModal) onCloseModal();
  };

  return (
    <>
      {/* ── Visit Recommendation Center Popup Modal ── */}
      {(!isDismissed || forceShow) && !showGuideModal && (
        <div className="modal-overlay pwa-popup-overlay" onClick={handleDismiss}>
          <div className="modal-card pwa-popup-card" onClick={(e) => e.stopPropagation()}>
            <button className="pwa-banner-close" onClick={handleDismiss} title={t('pwa_install_later')} aria-label="Close">
              &times;
            </button>

            <div className="pwa-popup-header">
              <div className="pwa-popup-icon-glow">
                <img src="/plug-icon.svg?v=4" alt="Smart Multi-Plug Icon" width="44" height="44" />
              </div>
              <div className="pwa-banner-title-area text-center" style={{ alignItems: 'center' }}>
                <div className="pwa-banner-badge">
                  <span className="pwa-badge-pulse" />
                  {t('pwa_badge')}
                </div>
                <h3 className="pwa-banner-title" style={{ fontSize: 19, marginTop: 4 }}>{t('pwa_install_title')}</h3>
              </div>
            </div>

            <p className="pwa-banner-desc text-center" style={{ marginTop: 8, marginBottom: 16 }}>
              {t('pwa_install_subtitle')}
            </p>

            <div className="pwa-features-grid">
              <div className="pwa-feature-item">
                <span className="pwa-feature-icon">⚡</span>
                <div>
                  <div className="pwa-feature-title">{t('pwa_feature_1_title')}</div>
                  <div className="pwa-feature-sub">{t('pwa_feature_1_desc')}</div>
                </div>
              </div>
              <div className="pwa-feature-item">
                <span className="pwa-feature-icon">📱</span>
                <div>
                  <div className="pwa-feature-title">{t('pwa_feature_2_title')}</div>
                  <div className="pwa-feature-sub">{t('pwa_feature_2_desc')}</div>
                </div>
              </div>
            </div>

            <div className="pwa-banner-actions" style={{ flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary pwa-install-btn" style={{ width: '100%', minHeight: 46 }} onClick={handleInstallClick}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {t('pwa_install_btn')}
              </button>

              <button className="btn btn-secondary pwa-later-btn" style={{ width: '100%' }} onClick={handleDismiss}>
                {t('pwa_install_later')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manual / iOS Installation Guide Modal ── */}
      {showGuideModal && (
        <div className="modal-overlay" onClick={() => setShowGuideModal(false)}>
          <div className="modal-card pwa-guide-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pwa-guide-header">
              <div className="pwa-guide-icon">📲</div>
              <div>
                <h3 className="modal-title" style={{ marginBottom: 4 }}>
                  {isIos ? t('pwa_ios_guide_title') : t('pwa_generic_guide_title')}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--clr-text-subtle)' }}>Smart Multi-Plug App</p>
              </div>
            </div>

            <div className="pwa-steps-list">
              {isIos ? (
                <>
                  <div className="pwa-step-card">
                    <div className="pwa-step-num">1</div>
                    <div className="pwa-step-text">{t('pwa_ios_step_1')}</div>
                  </div>
                  <div className="pwa-step-card">
                    <div className="pwa-step-num">2</div>
                    <div className="pwa-step-text">{t('pwa_ios_step_2')}</div>
                  </div>
                  <div className="pwa-step-card">
                    <div className="pwa-step-num">3</div>
                    <div className="pwa-step-text">{t('pwa_ios_step_3')}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="pwa-step-card">
                    <div className="pwa-step-num">1</div>
                    <div className="pwa-step-text">{t('pwa_generic_step_1')}</div>
                  </div>
                  <div className="pwa-step-card">
                    <div className="pwa-step-num">2</div>
                    <div className="pwa-step-text">{t('pwa_generic_step_2')}</div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => {
                  setShowGuideModal(false);
                  if (onCloseModal) onCloseModal();
                }}
              >
                {t('pwa_got_it')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
