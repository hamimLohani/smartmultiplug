import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export default function OnlineIndicator({ online }) {
  const { lang, t } = useLanguage();

  if (online === null || online === undefined) {
    return (
      <div className="online-indicator">
        <div className="dot dot-amber" />
        <span style={{ color: 'var(--clr-text-muted)' }}>
          {lang === 'bn' ? 'সংযোগ হচ্ছে…' : 'Connecting…'}
        </span>
      </div>
    );
  }

  if (online === 'unpaired') {
    return (
      <div className="online-indicator">
        <div className="dot dot-red" />
        <span style={{ color: 'var(--clr-red)' }}>
          {t('unpaired')}
        </span>
      </div>
    );
  }

  return (
    <div className="online-indicator">
      <div className={`dot ${online ? 'dot-green' : 'dot-red'}`} />
      <span style={{ color: online ? 'var(--clr-green)' : 'var(--clr-red)' }}>
        {online ? t('online') : t('offline')}
      </span>
    </div>
  );
}
