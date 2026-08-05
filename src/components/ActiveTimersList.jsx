import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const DAYS_TRANSLATIONS = {
  bn: { mon: 'সোম', tue: 'মঙ্গল', wed: 'বুধ', thu: 'বৃহ', fri: 'শুক্র', sat: 'শনি', sun: 'রবি' },
  en: { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
};

function formatCountdown(seconds, lang) {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return lang === 'bn' ? `${h}ঘণ্টা ${m}মিনিট` : `${h}h ${m}m`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function CountdownTimer({ seconds: initialSeconds, lang }) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!seconds || seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

  return (
    <span className="active-timer-countdown">
      {formatCountdown(seconds, lang)}
    </span>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}

export default function ActiveTimersList({ timers, timerStates, onDelete }) {
  const { lang, t } = useLanguage();

  if (!timers || timers.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⏰</div>
        <p className="empty-state-text">{t('timers_no_active')}</p>
        <p style={{ fontSize: 12, color: 'var(--clr-text-subtle)' }}>
          {lang === 'bn'
            ? 'আউটলেট স্বয়ংক্রিয় করতে উপরে একটি টাইমার বা শিডিউল যোগ করুন।'
            : 'Add a delay or schedule above to automate your outlets.'}
        </p>
      </div>
    );
  }

  const getRepeatLabel = (timer) => {
    if (timer.repeat === 'once') return t('timers_once');
    if (timer.repeat === 'daily') return t('timers_everyday');
    if (Array.isArray(timer.days)) {
      return timer.days
        .map((d) => DAYS_TRANSLATIONS[lang]?.[d] || d)
        .join(', ');
    }
    return '';
  };

  return (
    <div className="scroll-list">
      {timers.map((timer) => {
        const isDelay = timer.type === 'delay';
        const localizedPlugName = timer.plugLabel || (lang === 'bn' ? `প্লাগ ${timer.plugNum}` : `Plug ${timer.plugNum}`);

        return (
          <div key={timer.id} className="active-timer-item">
            <div className="active-timer-left">
              <div className={`active-timer-icon ${isDelay ? 'delay' : 'schedule'}`}>
                {isDelay ? '⏱' : '📅'}
              </div>
              <div className="active-timer-text" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span className="active-timer-desc" style={{ fontWeight: 600 }}>
                    {localizedPlugName}
                  </span>
                  <span className={`badge ${timer.action === 'ON' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 10, padding: '1px 6px', lineHeight: 1 }}>
                    {timer.action === 'ON' ? t('on') : t('off')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  {isDelay ? (
                    <>
                      <span style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>
                        {lang === 'bn'
                          ? `${timer.action === 'ON' ? 'চালু' : 'বন্ধ'} হতে বাকি`
                          : `Turns ${timer.action.toLowerCase()} in`}
                      </span>
                      {timer.remainingSeconds !== undefined && (
                        <CountdownTimer seconds={timer.remainingSeconds} lang={lang} />
                      )}
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-accent)' }}>
                        {(() => {
                          if (!timer.time) return '';
                          const [hh, mm] = timer.time.split(':').map(Number);
                          const ampm = hh >= 12 ? 'PM' : 'AM';
                          const h12  = hh % 12 || 12;
                          return `${h12}:${String(mm).padStart(2,'0')} ${ampm}`;
                        })()}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>
                        ({getRepeatLabel(timer)})
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              className="active-timer-cancel"
              onClick={() => onDelete(timer)}
              aria-label="Delete timer"
              title="Remove this timer"
            >
              <TrashIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}
