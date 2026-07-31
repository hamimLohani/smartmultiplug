import React from 'react';

export default function SkeletonLoader() {
  return (
    <div className="page-wrap">
      <div className="bg-mesh" />
      <div className="container" style={{ paddingTop: 24, paddingBottom: 120 }}>

        {/* Header skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div className="skeleton" style={{ width: 120, height: 24, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 80, height: 14 }} />
          </div>
          <div className="skeleton" style={{ width: 90, height: 34, borderRadius: 'var(--radius-pill)' }} />
        </div>

        {/* Stats bar skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div className="skeleton" style={{ height: 70, borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: 70, borderRadius: 'var(--radius-lg)' }} />
        </div>

        {/* Section header skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="skeleton" style={{ width: 60, height: 14 }} />
          <div className="skeleton" style={{ width: 90, height: 30, borderRadius: 'var(--radius-sm)' }} />
        </div>

        {/* Plug cards skeleton */}
        <div className="plug-grid">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="skeleton"
              style={{ height: 130, borderRadius: 'var(--radius-xl)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
